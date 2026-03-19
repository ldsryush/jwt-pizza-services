const config = require('./config.js');
const os = require('os');
// pay
class Metrics {
  constructor() {
    this.httpMetrics = {
      total: 0,
      get: 0,
      post: 0,
      put: 0,
      delete: 0,
    };

    this.authMetrics = {
      successful: 0,
      failed: 0,
    };

    this.activeUsers = new Set();

    this.pizzaMetrics = {
      sold: 0,
      failures: 0,
      revenue: 0,
    };

    this.latencyMetrics = {
      serviceEndpoints: [],
      pizzaCreation: [],
    };

    // Send metrics to Grafana every 10 seconds
    this.sendMetricsPeriodically(10000);
  }

  // Middleware to track HTTP requests
  requestTracker = (req, res, next) => {
    const startTime = Date.now();

    // Track HTTP method
    this.httpMetrics.total++;
    const method = req.method.toLowerCase();
    if (this.httpMetrics[method] !== undefined) {
      this.httpMetrics[method]++;
    }

    // Track latency for all service endpoints
    res.on('finish', () => {
      const latency = Date.now() - startTime;
      this.latencyMetrics.serviceEndpoints.push({
        path: req.path,
        method: req.method,
        latency: latency,
      });
    });

    next();
  };

  // Track authentication attempts
  trackAuthAttempt(success, userId = null) {
    if (success) {
      this.authMetrics.successful++;
      if (userId) {
        this.activeUsers.add(userId);
      }
    } else {
      this.authMetrics.failed++;
    }
  }

  // Track user logout
  trackUserLogout(userId) {
    if (userId) {
      this.activeUsers.delete(userId);
    }
  }

  // Track pizza purchases
  pizzaPurchase(success, latency, revenue) {
    if (success) {
      this.pizzaMetrics.sold++;
      this.pizzaMetrics.revenue += revenue;
    } else {
      this.pizzaMetrics.failures++;
    }

    this.latencyMetrics.pizzaCreation.push({
      latency: latency,
      success: success,
    });
  }

  // Get system metrics
  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  // Build metrics in OpenTelemetry format
  buildMetrics() {
    const now = Date.now();

    // Calculate average latencies
    const serviceLatency = this.latencyMetrics.serviceEndpoints.length > 0
      ? this.latencyMetrics.serviceEndpoints.reduce((sum, m) => sum + m.latency, 0) / this.latencyMetrics.serviceEndpoints.length
      : 0;

    const pizzaLatency = this.latencyMetrics.pizzaCreation.length > 0
      ? this.latencyMetrics.pizzaCreation.reduce((sum, m) => sum + m.latency, 0) / this.latencyMetrics.pizzaCreation.length
      : 0;

    const metrics = [
      // HTTP metrics
      { name: 'http_requests_total', value: this.httpMetrics.total },
      { name: 'http_requests_get', value: this.httpMetrics.get },
      { name: 'http_requests_post', value: this.httpMetrics.post },
      { name: 'http_requests_put', value: this.httpMetrics.put },
      { name: 'http_requests_delete', value: this.httpMetrics.delete },

      // Auth metrics
      { name: 'auth_attempts_successful', value: this.authMetrics.successful },
      { name: 'auth_attempts_failed', value: this.authMetrics.failed },

      // Active users
      { name: 'active_users', value: this.activeUsers.size },

      // Pizza metrics
      { name: 'pizza_sold', value: this.pizzaMetrics.sold },
      { name: 'pizza_failures', value: this.pizzaMetrics.failures },
      { name: 'pizza_revenue', value: this.pizzaMetrics.revenue },

      // Latency metrics
      { name: 'latency_service_avg', value: serviceLatency },
      { name: 'latency_pizza_avg', value: pizzaLatency },

      // System metrics
      { name: 'cpu_usage_percent', value: this.getCpuUsagePercentage() },
      { name: 'memory_usage_percent', value: this.getMemoryUsagePercentage() },
    ];

    // Clear latency arrays after averaging
    this.latencyMetrics.serviceEndpoints = [];
    this.latencyMetrics.pizzaCreation = [];

    return metrics;
  }

  // Send metrics to Grafana in Prometheus format
  async sendMetricsToGrafana(metrics) {
    const now = Date.now();
    
    // Convert metrics to Prometheus remote write format
    const timeseries = metrics.map(metric => ({
      labels: [
        { name: '__name__', value: metric.name },
        { name: 'source', value: config.metrics.source },
        { name: 'job', value: 'jwt-pizza-service' },
      ],
      samples: [
        {
          value: metric.value,
          timestamp: now,
        },
      ],
    }));

    const body = JSON.stringify({ timeseries });

    try {
      const response = await fetch(`${config.metrics.endpointUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send metrics to Grafana:', response.statusText, errorText);
      }
    } catch (error) {
      console.error('Error sending metrics to Grafana:', error.message);
    }
  }

  // Periodically send metrics
  sendMetricsPeriodically(period) {
    setInterval(async () => {
      try {
        const metrics = this.buildMetrics();
        await this.sendMetricsToGrafana(metrics);
      } catch (error) {
        console.error('Error building/sending metrics:', error);
      }
    }, period);
  }
}

// Export a singleton instance
const metrics = new Metrics();
module.exports = metrics;
