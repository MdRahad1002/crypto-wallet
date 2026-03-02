# Monitoring Quick Reference

## Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/health` | GET | Liveness/Readiness probe | JSON with status, uptime |
| `/api/metrics` | GET | Prometheus metrics | Text format (scrapable) |
| `/api/metrics/summary` | GET | Metrics overview | JSON |

## Common Commands

### Check System Health
```bash
curl http://localhost:5000/api/health | jq
```

**Response:**
```json
{
  "status": "OK",
  "message": "Crypto Wallet API is running",
  "timestamp": "2026-02-01T20:31:00.740Z",
  "uptime": 3600
}
```

### View Prometheus Metrics
```bash
curl http://localhost:5000/api/metrics | head -30
```

### View JSON Metrics
```bash
curl http://localhost:5000/api/metrics/summary | jq '.auth'
```

### Monitor Auth Events
```bash
docker logs crypto-wallet -f | jq 'select(.type == "auth_event")'
```

### Count Login Failures
```bash
docker logs crypto-wallet | jq 'select(.message == "login_attempt" and .success == false)' | wc -l
```

### Real-time Errors
```bash
docker logs crypto-wallet -f | jq 'select(.level == "ERROR")'
```

### Check Admin Actions
```bash
docker logs crypto-wallet -f | jq 'select(.message | contains("admin"))'
```

## Key Metrics to Monitor

### Authentication
- `auth_login_attempts_total` - Total login attempts
- `auth_login_successes_total` - Successful logins
- `auth_login_failures_total` - Failed logins
- **Alert if**: Failures > 20% of attempts

### Performance
- `http_request_duration_ms_sum` / `http_requests_total` = Avg Response Time
- **Alert if**: > 200ms average

### Errors
- `errors_total` - Total errors
- `errors_by_type` - Errors by type
- **Alert if**: Error rate > 1%

### Security
- `auth_token_revocations_total` - Token revocations
- `auth_logouts_total` - User logouts
- **Alert if**: Revocations spike unexpectedly

### System
- `system_memory_usage_percent` - Memory usage
- `mongodb_connected` - Database status
- **Alert if**: Memory > 80% or MongoDB disconnected

## Grafana Queries

### Request Rate (req/min)
```promql
rate(http_requests_total[1m])
```

### Error Rate (%)
```promql
rate(http_request_errors_total[5m]) / rate(http_requests_total[5m]) * 100
```

### Average Response Time (ms)
```promql
rate(http_request_duration_ms_sum[5m]) / rate(http_requests_total[5m])
```

### Login Success Rate (%)
```promql
auth_login_successes_total / auth_login_attempts_total * 100
```

### Active Sessions (estimate)
```promql
auth_refresh_tokens_total - auth_logouts_total
```

## Log Levels

| Level | Meaning | Examples |
|-------|---------|----------|
| INFO | Normal operation | login_success, http_request, wallet_created |
| WARN | Potential issue | admin_revoke_self_attempt, rate_limit_hit |
| ERROR | Failure/Exception | login_error, database_error, network_error |

## Typical Alert Thresholds

```yaml
Alerts:
  - name: HighErrorRate
    condition: error_rate > 1%
    severity: warning
    
  - name: LoginFailureSpike
    condition: auth_login_failures_total > 50/hour
    severity: warning
    
  - name: TokenRevocationSpike
    condition: auth_token_revocations_total > 5/hour
    severity: critical
    
  - name: HighMemoryUsage
    condition: system_memory_usage_percent > 80%
    severity: warning
    
  - name: MongoDBDown
    condition: mongodb_connected == 0
    severity: critical
```

## Log Analysis

### Find Security Issues
```bash
# All auth errors
docker logs crypto-wallet | jq 'select(.level == "ERROR" and .type == "auth_event")'

# Failed login attempts
docker logs crypto-wallet | jq 'select(.message == "login_attempt" and .success == false)'

# Admin token revocations
docker logs crypto-wallet | jq 'select(.message == "admin_revoked_user_tokens")'
```

### Performance Analysis
```bash
# Slow requests (>500ms)
docker logs crypto-wallet | jq 'select(.durationMs > 500)'

# Top error endpoints
docker logs crypto-wallet | jq 'select(.level == "ERROR")' | jq -r '.path' | sort | uniq -c | sort -rn
```

### Usage Patterns
```bash
# Active users (unique IDs)
docker logs crypto-wallet | jq -r '.userId' | sort | uniq | wc -l

# Peak usage hours
docker logs crypto-wallet | jq -r '.timestamp' | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c
```

## Troubleshooting

### No Metrics Data
```bash
# Check if service is running
curl http://localhost:5000/api/health

# Check if metrics endpoint responds
curl http://localhost:5000/api/metrics | head -5
```

### High Error Rate
```bash
# View latest errors
docker logs crypto-wallet | jq 'select(.level == "ERROR")' | tail -20

# Count errors by type
docker logs crypto-wallet | jq 'select(.level == "ERROR") | .errorType' | sort | uniq -c
```

### High Response Times
```bash
# Find slow endpoints
docker logs crypto-wallet | jq 'select(.durationMs > 200)' | jq '.path' | sort | uniq -c
```

### Memory Issues
```bash
# Check memory trend
curl http://localhost:5000/api/metrics/summary | jq '.system.memoryUsage'
```

## Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'crypto-wallet'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s
```

## Kubernetes Probe Configuration

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

## Log Aggregation Setup

### Docker
```bash
# Collect logs with timestamps
docker logs crypto-wallet --timestamps --follow | jq .
```

### ELK Stack (Filebeat)
```yaml
filebeat.inputs:
  - type: log
    paths:
      - /var/log/crypto-wallet/*.log
    json.message_key: message
    json.keys_under_root: true
```

### AWS CloudWatch
```bash
aws logs create-log-group --log-group-name /aws/ecs/crypto-wallet
aws logs put-log-events \
  --log-group-name /aws/ecs/crypto-wallet \
  --log-stream-name backend \
  --log-events file://events.json
```

## Documentation Links

- Full Monitoring Guide: See `MONITORING_GUIDE.md`
- Implementation Details: See `MONITORING_IMPLEMENTATION.md`
- Status: See `IMPLEMENTATION_STATUS.md`

## Support

For issues with monitoring:
1. Check `/api/health` endpoint
2. View recent logs: `docker logs crypto-wallet | tail -50 | jq`
3. Check metrics: `curl http://localhost:5000/api/metrics/summary | jq`
4. Review MONITORING_GUIDE.md for detailed troubleshooting
