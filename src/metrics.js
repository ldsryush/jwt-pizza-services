const config = require('./config.js');
const os = require('os');

class Metrics {
  constructor() {
    // Period-based HTTP request counters (reset each interval)
    this.httpMetrics = {
      total: 0,
      get: 0,
      post: 0,
      put: 0,
      delete: 0,
    };

    // Period-based auth counters (reset each interval)
    this.authMetrics = {
      successful: 0,
      failed: 0,
    };

    // Active users (Set tracks unique logged-in users)
    this.activeUsers = new Set();

    // Period-based pizza counters (reset each interval)
    this.pizzaMetrics = {
      sold: 0,
      failures: 0,
      revenue: 0,
    };

    // Period-based latency tracking (reset each interval)
    this.latencyServiceTotal = 0;
    this.latencyServiceCount = 0;
    this.latencyPizzaTotal = 0;
    this.latencyPizzaCount = 0;

    // Last known latency values (fallback when no requests in window)
    this.lastServiceLatency = 0;
    this.lastPizzaLatency = 0;

    // Send metrics to Grafana every 10 seconds
    this.sendMetricsPeriodically(10000);
  }

  // Middleware to track HTTP requests and service latency
  requestTracker = (req, res, next) => {
    const startTime = Date.now();

    this.httpMetrics.total++;
    const method = req.method.toLowerCase();
    if (this.httpMetrics[method] !== undefined) {
      this.httpMetrics[method]++;
    }

    res.on('finish', () => {
      const latency = Date.now() - startTime;
      this.latencyServiceTotal += latency;
      this.latencyServiceCount++;
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

  // Track pizza purchases (called from orderRouter)
  pizzaPurchase(success, latency, revenue) {
    if (success) {
      this.pizzaMetrics.sold++;
      this.pizzaMetrics.revenue += revenue;
    } else {
      this.pizzaMetrics.failures++;
    }

    this.latencyPizzaTotal += latency;
    this.latencyPizzaCount++;
  }

  // Get CPU usage as a float percentage
  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return parseFloat((cpuUsage * 100).toFixed(2));
  }

  // Get memory usage as a float percentage
  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return parseFloat(((usedMemory / totalMemory) * 100).toFixed(2));
  }

  // Build the metrics snapshot, then reset period counters
  buildMetrics() {
    // Multiply by 6 to estimate per-minute rate from 10-second window
    const perMinuteFactor = 6;

    // Calculate average latencies for this window
    const serviceLatency = this.latencyServiceCount > 0
      ? this.latencyServiceTotal / this.latencyServiceCount
      : this.lastServiceLatency;

    const pizzaLatency = this.latencyPizzaCount > 0
      ? this.latencyPizzaTotal / this.latencyPizzaCount
      : this.lastPizzaLatency;

    // Preserve last known latency for idle windows
    if (this.latencyServiceCount > 0) this.lastServiceLatency = serviceLatency;
    if (this.latencyPizzaCount > 0) this.lastPizzaLatency = pizzaLatency;

    const metrics = [
      // HTTP request rates per minute
      { name: 'http_requests_total',  value: this.httpMetrics.total  * perMinuteFactor },
      { name: 'http_requests_get',    value: this.httpMetrics.get    * perMinuteFactor },
      { name: 'http_requests_post',   value: this.httpMetrics.post   * perMinuteFactor },
      { name: 'http_requests_put',    value: this.httpMetrics.put    * perMinuteFactor },
      { name: 'http_requests_delete', value: this.httpMetrics.delete * perMinuteFactor },

      // Auth attempt rates per minute
      { name: 'auth_attempts_successful', value: this.authMetrics.successful * perMinuteFactor },
      { name: 'auth_attempts_failed',     value: this.authMetrics.failed     * perMinuteFactor },

      // Active users (point-in-time, no multiplication)
      { name: 'active_users', value: this.activeUsers.size },

      // Pizza rates per minute
      { name: 'pizza_sold',     value: this.pizzaMetrics.sold     * perMinuteFactor },
      { name: 'pizza_failures', value: this.pizzaMetrics.failures * perMinuteFactor },
      { name: 'pizza_revenue',  value: this.pizzaMetrics.revenue  * perMinuteFactor },

      // Latency (average ms) – uses last known value if idle
      { name: 'latency_service_avg', value: serviceLatency },
      { name: 'latency_pizza_avg',   value: pizzaLatency },

      // System metrics (point-in-time)
      { name: 'cpu_usage_percent',    value: this.getCpuUsagePercentage() },
      { name: 'memory_usage_percent', value: this.getMemoryUsagePercentage() },
    ];

    // Reset period counters
    this.httpMetrics = { total: 0, get: 0, post: 0, put: 0, delete: 0 };
    this.authMetrics = { successful: 0, failed: 0 };
    this.pizzaMetrics = { sold: 0, failures: 0, revenue: 0 };
    this.latencyServiceTotal = 0;
    this.latencyServiceCount = 0;
    this.latencyPizzaTotal = 0;
    this.latencyPizzaCount = 0;

    return metrics;
  }

  // Send metrics to Grafana Cloud via OTLP JSON
  async sendMetricsToGrafana(metrics) {
    // Safely compute nanosecond timestamp (avoid exceeding JS max safe integer)
    const nowMs = Date.now();
    const timeUnixNano = nowMs.toString() + '000000';

    const encoded = Buffer.from(`${config.metrics.accountId}:${config.metrics.apiKey}`).toString('base64');

    for (const metric of metrics) {
      const body = JSON.stringify({
        resourceMetrics: [{
          resource: {
            attributes: [{
              key: 'service.name',
              value: { stringValue: config.metrics.source },
            }],
          },
          scopeMetrics: [{
            metrics: [{
              name: metric.name,
              unit: '1',
              gauge: {
                dataPoints: [{
                  asDouble: metric.value,
                  timeUnixNano: timeUnixNano,
                  attributes: [{
                    key: 'source',
                    value: { stringValue: config.metrics.source },
                  }],
                }],
              },
            }],
          }],
        }],
      });

      try {
        const response = await fetch(config.metrics.endpointUrl, {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${encoded}`,
          },
        });
        if (!response.ok) {
          const text = await response.text();
          console.error(`Failed to push ${metric.name}:`, text);
        }
      } catch (error) {
        console.error('Error pushing metric:', metric.name, error.message);
      }
    }
  }

  // Periodically collect and send all metrics
  sendMetricsPeriodically(period) {
    setInterval(async () => {
      try {
        const builtMetrics = this.buildMetrics();
        await this.sendMetricsToGrafana(builtMetrics);
      } catch (error) {
        console.error('Error building/sending metrics:', error);
      }
    }, period);
  }
}

// Export a singleton instance
const metrics = new Metrics();
module.exports = metrics;
