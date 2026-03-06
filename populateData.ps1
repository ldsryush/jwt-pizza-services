param(
    [Parameter(Mandatory=$true)]
    [string]$endpoint
)

Write-Host "Populating data for: $endpoint"

# Login as admin and capture token
$loginBody = @{
    email = "a@jwt.com"
    password = "admin"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$endpoint/api/auth" -Method Put -Body $loginBody -ContentType "application/json"
$token = $response.token
Write-Host "Admin login successful, token: $($token.Substring(0, 20))..."

# Add users
Write-Host "`nAdding users..."
$diners = @{
    name = "pizza diner"
    email = "d@jwt.com"
    password = "diner"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$endpoint/api/auth" -Method Post -Body $diners -ContentType "application/json" | Out-Null

$franchisee = @{
    name = "pizza franchisee"
    email = "f@jwt.com"
    password = "franchisee"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$endpoint/api/auth" -Method Post -Body $franchisee -ContentType "application/json" | Out-Null
Write-Host "Users added successfully"

# Add menu items
Write-Host "`nAdding menu items..."
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$menuItems = @(
    @{ title="Veggie"; description="A garden of delight"; image="pizza1.png"; price=0.0038 },
    @{ title="Pepperoni"; description="Spicy treat"; image="pizza2.png"; price=0.0042 },
    @{ title="Margarita"; description="Essential classic"; image="pizza3.png"; price=0.0042 },
    @{ title="Crusty"; description="A dry mouthed favorite"; image="pizza4.png"; price=0.0028 },
    @{ title="Charred Leopard"; description="For those with a darker side"; image="pizza5.png"; price=0.0099 }
)

foreach ($item in $menuItems) {
    $body = $item | ConvertTo-Json
    Invoke-RestMethod -Uri "$endpoint/api/order/menu" -Method Put -Body $body -Headers $headers | Out-Null
    Write-Host "  Added: $($item.title) - $($item.description)"
}

# Add franchise and store
Write-Host "`nAdding franchise..."
$franchiseBody = @{
    name = "pizzaPocket"
    admins = @(@{ email = "f@jwt.com" })
} | ConvertTo-Json
Invoke-RestMethod -Uri "$endpoint/api/franchise" -Method Post -Body $franchiseBody -Headers $headers | Out-Null

$storeBody = @{
    franchiseId = 1
    name = "SLC"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$endpoint/api/franchise/1/store" -Method Post -Body $storeBody -Headers $headers | Out-Null
Write-Host "Franchise and store added successfully"

Write-Host "`nDatabase data generated successfully!"
