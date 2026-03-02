# Monitoring & Structured Logging Implementation

## Overview

This document describes the monitoring and structured logging system implemented in the crypto wallet platform. The system provides:

- **Structured JSON Logging**: All logs are output as JSON for easy parsing and integration with logging platforms
- **Prometheus Metrics**: Standard Prometheus-format metrics endpoint for integration with monitoring tools
- **Real-time Metrics Collection**: Automatic tracking of HTTP requests, authentication events, errors, and business metrics
- **System Health Monitoring**: Memory usage, uptime, and MongoDB connectivity tracking

## Architecture

### 1. Metrics Service (`backend/services/metricsService.js`)

Central singleton service that collects and exposes metrics:

```javascript
const metricsService = require('./services/metricsService');

// Record HTTP request
metricsService.recordRequest(method, path, statusCode, durationMs);

// Record auth event
metricsService.recordAuthEvent('login', success);

// Record error
metricsService.recordError('login_error');

// Record business event
metricsService.recordBusinessEvent('wallet_created');

// Get metrics in Prometheus format
const promMetrics = metricsService.getPrometheusMetrics();

// Get JSON metrics summary
const summary = metricsService.getMetricsSummary();
```

**Tracked Metrics:**

- **HTTP Metrics**: Request count, error count, duration by endpoint and status code
- **Auth Metrics**: Login attempts/successes/failures, token refreshes, logouts, revocations
- **Error Metrics**: Total errors and count by error type
- **Business Metrics**: Wallets created, transactions sent, wallet recoveries, KYC submissions, webhooks dispatched
- **System Metrics**: Memory usage %, uptime in seconds, MongoDB connection status

### 2. Structured JSON Logger (`backend/core/logger.js`)

All logs are emitted as JSON:

```javascript
const logger = require('./core/logger');

// Info log with metadata
logger.info('login_success', {
  type: 'auth_event',
  event: 'login',
  success: true,
  userId: user._id.toString(),
  email: email
});

// Error log with error type
logger.error('login_error', {
  type: 'auth_event',
  message: error.message,
  errorType: 'login_error',
  email: req.body?.email
});

// Warning log
logger.warn('admin_revoke_self_attempt', {
  adminId: req.userId.toString(),
  ip: req.ip,
  errorType: 'self_revocation_denied'
});
```

**Log Format:**
```json
{
  "timestamp": "2026-02-01T20:31:00.740Z",
  "level": "INFO",
  "message": "login_success",
  "type": "auth_event",
  "event": "login",
  "success": true,
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com"
}
```

### 3. HTTP Metrics Middleware

Automatic metrics collection on every request in `server.js`:

```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: durationMs,
      ip: req.ip
    });
    metricsService.recordRequest(req.method, req.path, res.statusCode, durationMs);
  });
  next();
});
```

## Monitoring Endpoints

### 1. Health Check Endpoint

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "OK",
  "message": "Crypto Wallet API is running",
  "timestamp": "2026-02-01T20:31:00.740Z",
  "uptime": 3600
}
```

**Usage:**
- Liveness/readiness probes in Kubernetes
- Application health dashboards
- Load balancer health checks

### 2. Prometheus Metrics Endpoint

**Endpoint:** `GET /api/metrics`

**Content-Type:** `text/plain; version=0.0.4; charset=utf-8`

**Response Format:** Prometheus text format (can be scraped by Prometheus)

```
# HTTP Metrics
http_requests_total{endpoint="GET /api/wallet"} 156
http_request_duration_ms_sum{endpoint="GET /api/wallet"} 15234
http_request_errors_total{endpoint="GET /api/wallet"} 2
http_responses_total{status="200"} 2541
http_responses_total{status="401"} 45
http_responses_total{status="500"} 3

# AUTH Metrics
auth_login_attempts_total 234
auth_login_successes_total 198
auth_login_failures_total 36
auth_refresh_tokens_total 412
auth_logouts_total 187
auth_token_revocations_total 5
auth_token_blacklist_total 189

# ERROR Metrics
errors_total 67
errors_by_type{type="login_error"} 28
errors_by_type{type="refresh_error"} 12

# BUSINESS Metrics
wallets_created_total 45
transactions_sent_total 234
wallet_recoveries_total 8
kyc_submissions_total 23
webhooks_dispatched_total 412

# SYSTEM Metrics
system_memory_usage_percent 42
system_uptime_seconds 14523
mongodb_connected{status="true"} 1
```

**Usage:**
- Prometheus scraper: Add job to `prometheus.yml`
- Grafana dashboards: Query metrics via Prometheus
- Alerting: Set up alerts on metric thresholds

### 3. JSON Metrics Summary Endpoint

**Endpoint:** `GET /api/metrics/summary`

**Response:**
```json
{
  "timestamp": "2026-02-01T20:31:00.740Z",
  "uptime": 14523,
  "http": {
    "totalRequests": 2589,
    "totalErrors": 48,
    "statusCodes": {
      "200": 2541,
      "401": 45,
      "500": 3
    },
    "endpoints": [
      {
        "endpoint": "GET /api/wallet",
        "requests": 156,
        "errors": 2,
        "avgDurationMs": 98
      },
      {
        "endpoint": "POST /api/auth/login",
        "requests": 234,
        "errors": 36,
        "avgDurationMs": 45
      }
    ]
  },
  "auth": {
    "loginAttempts": 234,
    "loginSuccesses": 198,
    "loginFailures": 36,
    "refreshTokens": 412,
    "logouts": 187,
    "tokenRevocations": 5,
    "tokenBlacklist": 189
  },
  "errors": {
    "total": 67,
    "byType": {
      "login_error": 28,
      "refresh_error": 12
    }
  },
  "business": {
    "walletsCreated": 45,
    "transactionsSent": 234,
    "walletRecoveries": 8,
    "kycsSubmitted": 23,
    "webhooksDispatched": 412
  },
  "system": {
    "memoryUsage": 42,
    "uptime": 14523,
    "mongodbConnected": true
  }
}
```

**Usage:**
- Development debugging: See full metrics in JSON
- Custom dashboards: Parse JSON response
- Automated reports: Generate summaries

## Integration Examples

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'crypto-wallet'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/metrics'
```

### Grafana Dashboard

Create dashboards using these queries:

```promql
# Request Rate (requests per minute)
rate(http_requests_total[1m])

# Error Rate (%)
rate(http_request_errors_total[5m]) / rate(http_requests_total[5m]) * 100

# Average Response Time
rate(http_request_duration_ms_sum[5m]) / rate(http_requests_total[5m])

# Login Success Rate (%)
auth_login_successes_total / auth_login_attempts_total * 100

# Active Sessions
auth_refreshTokens_total - auth_logouts_total

# Memory Usage
system_memory_usage_percent

# Uptime (hours)
system_uptime_seconds / 3600
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Log Analysis

### Parsing JSON Logs

Using `jq`:

```bash
# View all login attempts
docker logs crypto-wallet | jq 'select(.message == "login_attempt")'

# Count failed logins
docker logs crypto-wallet | jq 'select(.message == "login_attempt" and .success == false)' | wc -l

# View all admin actions
docker logs crypto-wallet | jq 'select(.type == "admin_event")'

# Real-time error monitoring
docker logs crypto-wallet -f | jq 'select(.level == "ERROR")'
```

### Log Aggregation

Send logs to centralized systems:

**ELK Stack:**
```bash
# Filebeat configuration
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/crypto-wallet/*.log
  json.message_key: message
  json.keys_under_root: true
  json.add_error_key: true
```

**CloudWatch (AWS):**
```bash
# Send structured logs
aws logs put-log-events \
  --log-group-name /aws/ecs/crypto-wallet \
  --log-stream-name backend \
  --log-events timestamp=$(date +%s000),message='{"level":"INFO","message":"login_success"}'
```

## Event Tracking

All critical events are automatically logged:

### Authentication Events

- **Login**: `logger.info('login_success/login_attempt')`
- **Token Refresh**: `logger.info('token_refreshed')`
- **Logout**: `logger.info('logout_current_token/logout_all_tokens')`
- **Token Revocation**: `logger.info('admin_revoked_user_tokens')`
- **Auth Errors**: `logger.error('login_error/refresh_error/logout_error')`

### Admin Events

- **User Token Revocation**: `logger.info('admin_revoked_user_tokens')`
- **Self-Revocation Blocked**: `logger.warn('admin_revoke_self_attempt')`
- **Revocation Errors**: `logger.error('admin_revoke_error')`

### Business Events

- **Wallet Creation**: Logged via metricsService
- **Transactions**: Logged via metricsService
- **KYC Submissions**: Logged via metricsService
- **Wallet Recoveries**: Logged via metricsService

### HTTP Events

- **All Requests**: `logger.info('http_request')`
- **Status Codes**: Tracked in metrics by status
- **Error Responses**: Tracked separately

## Best Practices

### 1. Log Levels

- **INFO**: Normal operations, successful actions
- **WARN**: Potential issues (e.g., blocked self-revocation)
- **ERROR**: Failures and exceptions

### 2. Metadata

Always include relevant context:

```javascript
logger.error('operation_failed', {
  type: 'auth_event',
  message: error.message,
  errorType: 'login_error',     // for metrics
  userId: user._id.toString(),
  email: email,
  ip: req.ip,
  userAgent: req.headers['user-agent']
});
```

### 3. Sensitive Data

Never log:
- Passwords or plaintext mnemonics
- Private keys or seeds
- Sensitive PII

### 4. Performance

- Metrics collection is non-blocking
- JSON logging is fast (synchronous console output)
- Metrics endpoint response is generated on-demand

## Monitoring Checklist

- [ ] Set up Prometheus scraper pointing to `/api/metrics`
- [ ] Configure Grafana dashboards for key metrics
- [ ] Set up alerts for error rate > 1%
- [ ] Monitor login failure rate for brute force attempts
- [ ] Track token revocation patterns
- [ ] Monitor memory usage and uptime
- [ ] Set up log aggregation (ELK/CloudWatch)
- [ ] Review logs daily for security events
- [ ] Set up dashboards for business KPIs (wallets created, transactions sent)
- [ ] Monitor auth event patterns for anomalies

## Future Enhancements

- [ ] Distributed tracing (OpenTelemetry)
- [ ] Custom metrics for business logic
- [ ] Anomaly detection for security events
- [ ] Automatic alerting on suspicious patterns
- [ ] Performance metrics per endpoint
- [ ] Rate limiting metrics
- [ ] Cache hit/miss ratios
- [ ] Database query performance tracking
