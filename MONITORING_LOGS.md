# Monitoring & Structured Logs

## Overview

The Crypto Wallet Platform now includes comprehensive monitoring and structured logging capabilities. All events are logged as JSON for easy parsing, aggregation, and analysis. Prometheus-compatible metrics are exposed for integration with observability platforms.

## Features

### 1. Structured JSON Logging

All log entries are output as structured JSON with consistent format:

```json
{
  "timestamp": "2026-02-01T20:31:00.000Z",
  "level": "INFO",
  "message": "login_success",
  "type": "auth_event",
  "event": "login",
  "success": true,
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com"
}
```

**Benefits:**
- Easy to parse and aggregate with log aggregation platforms (ELK, Splunk, DataDog)
- Consistent schema across all logs
- Includes metadata for filtering and correlation
- Human-readable timestamps (ISO 8601)

### 2. Metrics Service

The `MetricsService` tracks all key operational metrics:

#### HTTP Metrics
- Total requests per endpoint
- Error rates per endpoint
- Response time averages
- Status code distribution

#### Authentication Metrics
- Login attempts and successes
- Token refresh operations
- Logout events
- Token revocation count
- Blacklisted tokens

#### Error Metrics
- Total error count
- Errors by type (login_error, refresh_error, logout_error, etc.)

#### Business Metrics
- Wallets created
- Transactions sent
- Wallet recoveries
- KYC submissions
- Webhooks dispatched

#### System Metrics
- Memory usage percentage
- System uptime (seconds)
- MongoDB connection status

### 3. Prometheus Endpoint

**Endpoint:** `GET /api/metrics`

Returns metrics in Prometheus text format (OpenMetrics 0.0.4 compatible):

```
# HELP http_requests_total Total HTTP requests by method and path
# TYPE http_requests_total counter
http_requests_total{endpoint="GET /api/auth/login"} 42
http_request_duration_ms_sum{endpoint="GET /api/auth/login"} 15234
http_request_errors_total{endpoint="GET /api/auth/login"} 2

# AUTH Metrics
auth_login_attempts_total 42
auth_login_successes_total 40
auth_login_failures_total 2
auth_refresh_tokens_total 128
auth_logouts_total 38
auth_token_revocations_total 3
auth_token_blacklist_total 5
```

**Use Cases:**
- Scraping from Prometheus every 15-30 seconds
- Setting up alerts on error rates, response times, or business metrics
- Dashboards in Grafana showing real-time metrics

### 4. Health Check Endpoint

**Endpoint:** `GET /api/health`

Returns:
```json
{
  "status": "OK",
  "message": "Crypto Wallet API is running",
  "timestamp": "2026-02-01T20:31:00.000Z",
  "uptime": 127
}
```

**Use Cases:**
- Load balancer health checks
- Kubernetes liveness probes
- Monitoring system heartbeat

### 5. Metrics Summary Endpoint

**Endpoint:** `GET /api/metrics/summary`

Returns a JSON summary of all metrics for debugging/dashboards:

```json
{
  "timestamp": "2026-02-01T20:31:00.000Z",
  "uptime": 127,
  "http": {
    "totalRequests": 256,
    "totalErrors": 8,
    "statusCodes": {
      "200": 200,
      "401": 4,
      "500": 4
    },
    "endpoints": [
      {
        "endpoint": "GET /api/auth/login",
        "requests": 42,
        "errors": 2,
        "avgDurationMs": 362
      }
    ]
  },
  "auth": {
    "loginAttempts": 42,
    "loginSuccesses": 40,
    "loginFailures": 2,
    "refreshTokens": 128,
    "logouts": 38,
    "tokenRevocations": 3,
    "tokenBlacklist": 5
  },
  "errors": {
    "total": 8,
    "byType": {
      "login_error": 2,
      "refresh_error": 1,
      "logout_error": 0
    }
  },
  "business": {
    "walletsCreated": 45,
    "transactionsSent": 156,
    "walletRecoveries": 3,
    "kycsSubmitted": 8,
    "webhooksDispatched": 234
  },
  "system": {
    "memoryUsage": 45,
    "uptime": 127,
    "mongodbConnected": true
  }
}
```

## Logging Examples

### Authentication Events

**Successful Login:**
```json
{
  "timestamp": "2026-02-01T20:31:00.000Z",
  "level": "INFO",
  "message": "login_success",
  "type": "auth_event",
  "event": "login",
  "success": true,
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com"
}
```

**Failed Login:**
```json
{
  "timestamp": "2026-02-01T20:31:02.000Z",
  "level": "INFO",
  "message": "login_attempt",
  "type": "auth_event",
  "event": "login",
  "success": false,
  "email": "user@example.com",
  "reason": "invalid_password"
}
```

**Token Refresh:**
```json
{
  "timestamp": "2026-02-01T20:32:00.000Z",
  "level": "INFO",
  "message": "token_refreshed",
  "type": "auth_event",
  "event": "refresh",
  "userId": "507f1f77bcf86cd799439011"
}
```

**Logout:**
```json
{
  "timestamp": "2026-02-01T20:35:00.000Z",
  "level": "INFO",
  "message": "logout_current_token",
  "type": "auth_event",
  "event": "logout",
  "userId": "507f1f77bcf86cd799439011",
  "allTokensRevoked": false
}
```

### HTTP Requests

```json
{
  "timestamp": "2026-02-01T20:31:00.000Z",
  "level": "INFO",
  "message": "http_request",
  "method": "GET",
  "path": "/api/wallet/balance/BTC",
  "status": 200,
  "durationMs": 45,
  "ip": "192.168.1.100"
}
```

### Errors

```json
{
  "timestamp": "2026-02-01T20:31:00.000Z",
  "level": "ERROR",
  "message": "login_error",
  "type": "auth_event",
  "errorType": "login_error",
  "email": "user@example.com",
  "message": "User not found"
}
```

## Integration with Observability Platforms

### Prometheus + Grafana

1. **Configure Prometheus to scrape metrics:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'crypto-wallet'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/metrics'
```

2. **Create Grafana dashboards** using the Prometheus data source:
   - Error rates by endpoint
   - Response time percentiles (p50, p95, p99)
   - Authentication success/failure rates
   - Business metrics (transactions/hour, wallets created)
   - System resource usage

### ELK Stack (Elasticsearch, Logstash, Kibana)

1. **Configure Logstash to parse JSON logs:**

```conf
input {
  stdin { }
}

filter {
  json { source => "message" }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "crypto-wallet-%{+YYYY.MM.dd}"
  }
}
```

2. **Pipe logs to Logstash:**
```bash
node server.js | logstash -f config.conf
```

3. **Create Kibana visualizations:**
   - Login failure trends
   - Error distribution by type
   - User activity timeline
   - Geographic distribution of IPs

### DataDog / New Relic / Splunk

All platforms support Prometheus scraping or JSON log ingestion. Configure your agent to:
- Scrape `/api/metrics` endpoint for metrics
- Parse JSON logs from stdout/stderr
- Set up alerts on critical metrics

## Recommended Alerts

### Critical Alerts
1. **High error rate** - More than 5% of requests returning 5xx
2. **Login failures spike** - More than 10 failed logins in 5 minutes
3. **Token revocation surge** - Unusual spike in revocations (possible breach)
4. **MongoDB disconnected** - Database unavailable
5. **Memory usage critical** - Over 90% memory utilization

### Warning Alerts
1. **Response time degradation** - Average response time > 1 second
2. **Elevated token blacklist** - Growing faster than expected
3. **High 4xx error rate** - More than 10% of requests returning client errors

### Example Prometheus Alert Rule

```yaml
groups:
  - name: crypto-wallet
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          (http_request_errors_total / http_requests_total) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: LoginFailureSurge
        expr: |
          increase(auth_login_failures_total[5m]) > 10
        for: 1m
        annotations:
          summary: "Unusual spike in login failures"
```

## Configuration

### Environment Variables

```bash
# Logging
NODE_ENV=production  # Set to 'production' to disable debug logs

# Metrics retention (optional, defaults to in-memory)
METRICS_RETENTION_HOURS=24  # Keep metrics for 24 hours (future implementation)
```

### Metrics Service API

```javascript
const metricsService = require('./services/metricsService');

// Record request
metricsService.recordRequest(method, path, statusCode, durationMs);

// Record auth event
metricsService.recordAuthEvent(eventType, success);
// eventTypes: 'login', 'refresh', 'logout', 'revoke', 'blacklist'

// Record error
metricsService.recordError(errorType);

// Record business event
metricsService.recordBusinessEvent(eventType);
// eventTypes: 'wallet_created', 'transaction_sent', 'wallet_recovery', 'kyc_submitted', 'webhook_dispatched'

// Update system metrics
metricsService.updateSystemMetrics(mongodbConnected);

// Get Prometheus format
const prometheusMetrics = metricsService.getPrometheusMetrics();

// Get JSON summary
const jsonSummary = metricsService.getMetricsSummary();

// Reset all metrics
metricsService.reset();
```

## Best Practices

1. **Log Aggregation:** Use a centralized log aggregation service to collect logs from all servers
2. **Metrics Retention:** Keep metrics for at least 24-48 hours for trend analysis
3. **Alert Tuning:** Adjust alert thresholds based on your baseline metrics
4. **Log Retention:** Archive logs older than 30 days for compliance and auditing
5. **Sensitive Data:** Never log passwords, tokens, or private keys (already handled by the application)
6. **Correlation IDs:** Add request ID tracking across distributed systems (future enhancement)

## Testing Monitoring

**Test health check:**
```bash
curl http://localhost:5000/api/health
```

**Test metrics endpoint:**
```bash
curl http://localhost:5000/api/metrics
```

**Test metrics summary:**
```bash
curl http://localhost:5000/api/metrics/summary | jq '.'
```

**Run automated test:**
```bash
node backend/scripts/testMonitoring.js
```

## Future Enhancements

1. **Distributed Tracing** - Add OpenTelemetry for request tracing across services
2. **Custom Metrics** - Application-specific metrics (transaction processing time, wallet derivation time)
3. **Metrics Persistence** - Store metrics in time-series database for long-term analysis
4. **Alerting Rules** - Built-in alert conditions and notification channels
5. **Performance Profiling** - CPU and memory profiling endpoints
6. **Request ID Tracking** - Unique request IDs for correlation across logs

## Troubleshooting

### High Memory Usage
1. Check if metrics are growing unboundedly
2. Call `/api/metrics/summary` to see metric counts
3. Consider implementing metrics rotation/cleanup

### Missing Metrics
1. Ensure middleware is loaded before routes
2. Check that `metricsService.recordRequest()` is called for all endpoints
3. Verify metrics service is imported in relevant route files

### Prometheus Scraping Failures
1. Verify `/api/metrics` endpoint is accessible
2. Check Content-Type header is `text/plain; version=0.0.4; charset=utf-8`
3. Ensure metrics format is valid (no special characters in labels)
