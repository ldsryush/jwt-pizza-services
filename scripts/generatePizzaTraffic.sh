#!/usr/bin/env bash
# generatePizzaTraffic.sh - Simulate pizza service traffic for observability testing
# Usage: ./generatePizzaTraffic.sh <host>
# Example: ./generatePizzaTraffic.sh https://pizza-service.yourdomainname.click

# ── Exit if host not provided ────────────────────────────────────────────────
if [ -z "${1:-}" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  echo "Example: $0 https://pizza-service.yourdomainname.click"
  exit 1
fi

host="$1"
echo "Targeting host: $host"
echo "Press Ctrl-C to stop all traffic simulation"
echo "-------------------------------------------"

# ── Track all background PIDs for clean shutdown ────────────────────────────
pids=()

cleanup() {
  echo ""
  echo "Stopping all background traffic generators..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "Done."
  exit 0
}
trap cleanup INT TERM

# ── Helper: extract token from login response ────────────────────────────────
get_token() {
  echo "$1" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

# ── Background task 1: Hit menu every 3 seconds ────────────────────────────
(
  while true; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$host/api/order/menu")
    echo "Requesting menu... $status"
    sleep 3
  done
) &
pids+=($!)

# ── Background task 2: Invalid login every 25 seconds ───────────────────────
(
  while true; do
    status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$host/api/auth" \
      -d '{"email":"unknown@jwt.com", "password":"bad"}' \
      -H 'Content-Type: application/json')
    echo "Logging in with invalid credentials... $status"
    sleep 25
  done
) &
pids+=($!)

# ── Background task 3: Franchisee login, stay 110s, then logout ─────────────
(
  while true; do
    response=$(curl -s -X PUT "$host/api/auth" \
      -d '{"email":"f@jwt.com", "password":"franchisee"}' \
      -H 'Content-Type: application/json')
    token=$(get_token "$response")
    echo "Login franchisee... $(echo "$response" | grep -o '"name":"[^"]*"' | head -1)"
    sleep 110
    curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
    echo "Logout franchisee..."
    sleep 10
  done
) &
pids+=($!)

# ── Background task 4: Diner login, buy pizza, logout every ~50s ────────────
(
  while true; do
    response=$(curl -s -X PUT "$host/api/auth" \
      -d '{"email":"d@jwt.com", "password":"diner"}' \
      -H 'Content-Type: application/json')
    token=$(get_token "$response")
    echo "Login diner... $(echo "$response" | grep -o '"name":"[^"]*"' | head -1)"

    pizza_status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$host/api/order" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $token" \
      -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}')
    echo "Bought a pizza... $pizza_status"

    sleep 20
    curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
    echo "Logout diner..."
    sleep 30
  done
) &
pids+=($!)

# ── Background task 5: Diner buys too many pizzas (failure case) every 5min ─
(
  while true; do
    response=$(curl -s -X PUT "$host/api/auth" \
      -d '{"email":"d@jwt.com", "password":"diner"}' \
      -H 'Content-Type: application/json')
    token=$(get_token "$response")
    echo "Login hungry diner..."

    items='{ "menuId": 1, "description": "Veggie", "price": 0.05 }'
    for (( i=0; i < 21; i++ )); do
      items+=', { "menuId": 1, "description": "Veggie", "price": 0.05 }'
    done

    overflow_status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$host/api/order" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $token" \
      -d "{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}")
    echo "Bought too many pizzas... $overflow_status"

    sleep 5
    curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
    echo "Logging out hungry diner..."
    sleep 295
  done
) &
pids+=($!)

# ── Wait for all background tasks ────────────────────────────────────────────
echo "All traffic generators started (PIDs: ${pids[*]})"
wait
