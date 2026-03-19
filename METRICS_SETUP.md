# Metrics Observability Setup

This document describes the metrics observability implementation for JWT Pizza Service.

## Overview

Metrics have been added to track:
- HTTP requests by method
- Authentication attempts (successful/failed)
- Active users
- Pizza sales, failures, and revenue
- Service and pizza creation latency
- CPU and memory usage

## Implementation Details

### Files Modified/Created

1. **src/config.js** - Added metrics configuration
2. **src/metrics.js** - New file with metrics collection and reporting
3. **src/service.js** - Added metrics middleware
4. **src/routes/authRouter.js** - Added authentication tracking
5. **src/routes/orderRouter.js** - Added pizza purchase tracking
6. **.github/workflows/ci.yml** - Added metrics configuration to CI pipeline

### Metrics Collected

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_requests_get` - GET requests
- `http_requests_post` - POST requests
- `http_requests_put` - PUT requests
- `http_requests_delete` - DELETE requests

#### Authentication Metrics
- `auth_attempts_successful` - Successful login/register attempts
- `auth_attempts_failed` - Failed login attempts

#### User Metrics
- `active_users` - Count of currently logged-in users

#### Pizza Metrics
- `pizza_sold` - Number of pizzas sold
- `pizza_failures` - Failed pizza orders
- `pizza_revenue` - Total revenue from pizza sales

#### Latency Metrics
- `latency_service_avg` - Average service endpoint latency (ms)
- `latency_pizza_avg` - Average pizza creation latency (ms)

#### System Metrics
- `cpu_usage_percent` - CPU usage percentage
- `memory_usage_percent` - Memory usage percentage

## Next Steps

### 1. Configure Grafana Credentials

You need to set up your actual Grafana Cloud credentials. Replace the placeholder values in `src/config.js`:

```javascript
metrics: {
  source: process.env.METRICS_SOURCE || 'jwt-pizza-service-dev',
  endpointUrl: process.env.METRICS_ENDPOINT_URL || 'YOUR_GRAFANA_ENDPOINT',
  accountId: process.env.METRICS_ACCOUNT_ID || 'YOUR_ACCOUNT_ID',
  apiKey: process.env.METRICS_API_KEY || 'YOUR_API_KEY',
}
```

### 2. Add GitHub Secrets

Add the following secrets to your GitHub repository:

- `METRICS_ENDPOINT_URL` - Your Grafana Prometheus endpoint URL
- `METRICS_ACCOUNT_ID` - Your Grafana account/user ID
- `METRICS_API_KEY` - Your Grafana API key

To add secrets:
1. Go to your repository on GitHub
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret

### 3. Update Local Environment

For local development, you can either:
- Set environment variables
- Or update the default values in `src/config.js` (not recommended for security)

### 4. Test Locally

```bash
cd jwt-pizza-service
npm install
npm start
```

The metrics will be sent to Grafana every 10 seconds automatically.

### 5. Create Grafana Dashboard

1. Log into your Grafana Cloud account
2. Create a new dashboard
3. Add panels for each metric type
4. Use PromQL queries like:
   - `rate(http_requests_total[1m])` - Requests per minute
   - `rate(pizza_sold[1m])` - Pizzas sold per minute
   - `active_users` - Active users
   - `cpu_usage_percent` - CPU usage
   - etc.

### 6. Commit and Deploy

```bash
git add .
git commit -m "Add metrics observability with Grafana integration"
git push origin main
```

### 7. Generate Traffic

Use the traffic simulator or manual testing to generate metrics:
- Register/login users
- Order pizzas
- Browse the menu
- Make API calls

### 8. Export Dashboard

Once your dashboard is complete:
1. Click Share → Export
2. Save as `grafana/deliverable8dashboard.json`
3. Commit and push to repository

### 9. Make Dashboard Public

1. Click Share → Share externally
2. Enable time range and annotation options
3. Copy the public URL
4. Submit to Canvas

## Troubleshooting

### Metrics not appearing in Grafana

1. Check that your Grafana credentials are correct
2. Verify the endpoint URL is for Prometheus/Loki
3. Check console logs for errors
4. Ensure the service is running and receiving traffic

### CI Pipeline Failing

Make sure all GitHub secrets are set correctly:
- JWT_SECRET
- FACTORY_API_KEY
- METRICS_ENDPOINT_URL
- METRICS_ACCOUNT_ID
- METRICS_API_KEY
- DB_USERNAME
- DB_PASSWORD
- DB_HOSTNAME

## Design Patterns Used

- **Middleware Pattern** - HTTP request tracking via Express middleware
- **Singleton Pattern** - Single metrics instance shared across the application
- **Separation of Concerns** - Metrics logic isolated in dedicated module
- **Observer Pattern** - Response event listeners for latency tracking
