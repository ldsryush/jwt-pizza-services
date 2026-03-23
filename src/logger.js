const config = require('./config.js');

class Logger {
  // ── Sanitization ────────────────────────────────────────────────────────────

  // Keys whose values should always be redacted
  sensitiveKeys = ['password', 'token', 'authorization', 'auth', 'apikey', 'api_key', 'secret', 'jwt', 'bearer', 'cookie', 'session'];

  sanitize(data) {
    if (!data) return data;
    if (typeof data === 'string') return this.sanitizeString(data);
    if (typeof data !== 'object') return data;

    const out = Array.isArray(data) ? [...data] : { ...data };
    for (const key in out) {
      if (this.sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        out[key] = '[REDACTED]';
      } else if (typeof out[key] === 'object' && out[key] !== null) {
        out[key] = this.sanitize(out[key]);
      } else if (typeof out[key] === 'string') {
        out[key] = this.sanitizeString(out[key]);
      }
    }
    return out;
  }

  sanitizeString(str) {
    if (!str || typeof str !== 'string') return str;
    // Redact Bearer JWT tokens
    str = str.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, 'Bearer [REDACTED]');
    // Redact bare JWT tokens (header.payload.signature)
    str = str.replace(/\b([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)\b/g, (match) =>
      match.split('.').length === 3 ? '[REDACTED_JWT]' : match
    );
    // Partially redact email addresses (keep domain)
    str = str.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/g, (match, user, domain) =>
      user.length <= 2 ? match : `${user.substring(0, 2)}***@${domain}`
    );
    return str;
  }

  // ── Loki transport ──────────────────────────────────────────────────────────

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(config.logging.endpointUrl, {
      method: 'post',
      body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }

  // Core log method – fire and forget so it never blocks the request path
  log(level, type, logData) {
    const sanitized = this.sanitize(logData);
    const payload = {
      streams: [
        {
          stream: {
            source: config.logging.source,
            level,
            type,
          },
          values: [
            [
              `${Date.now()}000000`, // nanosecond timestamp
              JSON.stringify({ timestamp: new Date().toISOString(), level, type, ...sanitized }),
            ],
          ],
        },
      ],
    };
    this.sendLogToGrafana(payload);
  }

  // ── Express HTTP logger middleware ──────────────────────────────────────────

  httpLogger = (req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let responseBody = null;

    res.json = (data) => {
      responseBody = data;
      return originalJson(data);
    };

    res.send = (data) => {
      if (responseBody === null) responseBody = data;
      return originalSend(data);
    };

    res.on('finish', () => {
      this.log(res.statusCode >= 400 ? 'error' : 'info', 'http', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        hasAuthorization: !!req.headers.authorization,
        requestBody: req.body,
        responseBody,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
    });

    next();
  };

  // ── Specialised log helpers ─────────────────────────────────────────────────

  dbQuery(sql, params, durationMs, err = null) {
    this.log(err ? 'error' : 'info', 'db', {
      sql: this.sanitizeString(sql),
      params: this.sanitize(params),
      durationMs,
      error: err ? err.message : undefined,
    });
  }

  factoryRequest(reqBody, resBody, statusCode, durationMs) {
    this.log(statusCode >= 400 ? 'warn' : 'info', 'factory', {
      requestBody: reqBody,
      responseBody: resBody,
      statusCode,
      durationMs,
    });
  }

  unhandledException(err, context = {}) {
    this.log('error', 'exception', {
      message: err.message,
      statusCode: err.statusCode,
      name: err.name,
      stack: err.stack,
      context: this.sanitize(context),
    });
  }
}

// Singleton
const logger = new Logger();
module.exports = logger;
