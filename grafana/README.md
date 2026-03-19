# Grafana Dashboard

This directory contains the exported Grafana dashboard for JWT Pizza Service metrics.

## Required Metrics

The dashboard should visualize the following metrics:

### HTTP Requests
- Total requests per minute
- GET, POST, PUT, DELETE requests per minute

### Authentication
- Successful authentication attempts per minute
- Failed authentication attempts per minute

### Active Users
- Current active users

### Pizzas
- Pizzas sold per minute
- Pizza creation failures
- Revenue per minute

### Latency
- Service endpoint average latency
- Pizza creation average latency

### System
- CPU usage percentage
- Memory usage percentage

## Exporting the Dashboard

1. Create visualizations in Grafana Cloud for all required metrics
2. Navigate to your dashboard in Grafana Cloud
3. Click the **Share** button
4. Click the **Export** tab
5. Click **Save to file**
6. Save the file as `deliverable8dashboard.json` in this directory

## Making the Dashboard Public

1. Navigate to your dashboard
2. Exit edit mode if needed
3. Click **Share** → **Share externally**
4. Acknowledge the warning
5. Enable options to allow time range changes and annotations
6. Copy the public URL for Canvas submission
