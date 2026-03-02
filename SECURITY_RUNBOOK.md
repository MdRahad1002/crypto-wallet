# Security Runbook & Operations Guide

Comprehensive operational guide for managing, maintaining, and securing the crypto-wallet-platform in production.

## 📋 Table of Contents

- [Critical Operations](#critical-operations)
- [Key Rotation Procedures](#key-rotation-procedures)
- [Secret Management](#secret-management)
- [Incident Response](#incident-response)
- [Monitoring & Alerting](#monitoring--alerting)
- [Deployment & Updates](#deployment--updates)
- [Backup & Recovery](#backup--recovery)
- [Security Checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)

## Critical Operations

### Pre-Production Checklist

Before deploying to production, verify:

**Security:**
- [ ] All environment variables configured (JWT_SECRET, KMS_MASTER_KEY, etc.)
- [ ] HTTPS/TLS certificates installed and valid
- [ ] Database credentials rotated (never use defaults)
- [ ] Redis passwords configured (not exposed on network)
- [ ] Admin API keys generated and distributed securely
- [ ] CORS_ORIGIN set to frontend domain only
- [ ] COOKIE_SECRET configured and strong (32+ bytes)
- [ ] NODE_ENV set to 'production'

**Infrastructure:**
- [ ] SSL/TLS certificates valid (expiry >30 days)
- [ ] Firewall rules configured (whitelist ports only)
- [ ] Database backups enabled and tested
- [ ] Redis persistence enabled
- [ ] Logging to persistent storage enabled
- [ ] Health check endpoints configured
- [ ] Rate limits appropriate for expected traffic

**Monitoring:**
- [ ] Metrics collection enabled (Prometheus endpoint)
- [ ] Logging aggregation configured (ELK/Splunk)
- [ ] Alerting rules created for critical metrics
- [ ] Pagerduty/on-call rotation established
- [ ] Uptime monitoring configured
- [ ] SSL certificate expiry alerts configured

**Compliance:**
- [ ] Security audit completed
- [ ] Penetration testing completed
- [ ] Code review completed
- [ ] Dependency scan (Snyk) passed
- [ ] Incident response plan documented
- [ ] Privacy policy updated
- [ ] Terms of service updated

### Startup Sequence

```bash
# 1. Verify environment
echo $NODE_ENV  # Should be 'production'
echo $JWT_SECRET  # Should not be empty
echo $KMS_MASTER_KEY  # Should not be empty

# 2. Start backend
npm start

# 3. Verify health
curl https://localhost:5000/health

# 4. Check metrics
curl https://localhost:5000/metrics

# 5. Verify WebSocket
curl -H "Upgrade: websocket" https://localhost:5000/socket.io
```

### Shutdown Sequence

```bash
# 1. Notify users of maintenance
# 2. Stop accepting new connections (readiness probe returns 503)
# 3. Wait for existing connections to close (timeout: 30s)
# 4. Stop application (SIGTERM)
# 5. Verify shutdown (check logs)
# 6. Backup critical state (optional, if not automated)
```

## Key Rotation Procedures

### Master Key Rotation (KMS)

**Frequency:** Annually or after suspected compromise

**Risk:** HIGH - Affects all encrypted data

**Procedure:**

```bash
# 1. Take backup of encrypted data
mongodump --uri="mongodb://..." --out=./backup/pre-key-rotation

# 2. Initiate key rotation
curl -X POST https://api.example.com/admin/kms/rotate-master-key \
  -H "X-API-Key: admin-key" \
  -H "X-Require-MFA: code123456"

# 3. Monitor rotation process
curl https://api.example.com/admin/kms/status \
  -H "X-API-Key: admin-key"

# 4. Verify no errors in logs
tail -f logs/app.log | grep -i "error"

# 5. Re-encrypt data (if needed)
npm run kms:re-encrypt

# 6. Verify integrity of decrypted data
npm run kms:verify

# 7. Document completion in change log
# Rotation completed at [timestamp] by [operator]
```

**Rollback:**
```bash
# If rotation fails, restore from backup
mongorestore --uri="mongodb://..." ./backup/pre-key-rotation
```

### Data Key Rotation (KMS)

**Frequency:** Monthly or per usage policy

**Risk:** MEDIUM - Enables forward secrecy

**Procedure:**

```bash
# 1. Automatic via scheduled job (monthly)
# Scheduled in: backend/jobs/keyRotationScheduler.js

# 2. Manual rotation (if needed)
curl -X POST https://api.example.com/admin/kms/rotate-data-key \
  -H "X-API-Key: admin-key"

# 3. Check status
curl https://api.example.com/admin/kms/status
```

### JWT Secret Rotation

**Frequency:** Quarterly or after access compromise

**Risk:** HIGH - All sessions invalidated

**Procedure:**

```bash
# 1. Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Update environment variable
export JWT_SECRET="[new-secret]"

# 3. Deploy new version (old sessions work during overlap period)
git push origin main  # Triggers CI/CD

# 4. Monitor for increase in 401 errors (sign of old sessions)
curl https://api.example.com/metrics | grep -i "auth.*error"

# 5. After grace period (1 hour), invalidate old sessions
curl -X POST https://api.example.com/admin/sessions/invalidate-all \
  -H "X-API-Key: admin-key"

# 6. Verify all sessions require re-authentication
```

**Grace Period:** Recommended 1-24 hours to allow client refresh

### Refresh Token Secret Rotation

**Frequency:** Semi-annually

**Risk:** MEDIUM - Only affects inactive users (refresh tokens have TTL)

**Procedure:**

```bash
# Similar to JWT secret rotation
# Affects users with active sessions (they'll need to refresh)

export REFRESH_TOKEN_SECRET="[new-secret]"

# Deploy and monitor for 401 errors on /auth/refresh
```

### API Key Rotation (Admin)

**Frequency:** Quarterly or annually per key

**Risk:** MEDIUM-HIGH - Affects admin API access

**Procedure:**

```bash
# 1. Generate new API key
node -e "console.log('sk_live_' + require('crypto').randomBytes(16).toString('hex'))"

# 2. Create new key in system
curl -X POST https://api.example.com/admin/api-keys \
  -H "X-API-Key: current-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "new-key-2024-Q2", "permissions": ["read:*", "write:*"]}'

# 3. Update all consumers to use new key
# Update deployment configs, CI/CD, third-party integrations

# 4. Test with new key
curl https://api.example.com/admin/status \
  -H "X-API-Key: new-key"

# 5. Revoke old key (after 7-day grace period)
curl -X DELETE https://api.example.com/admin/api-keys/old-key \
  -H "X-API-Key: new-key"
```

## Secret Management

### Environment Variables (Critical)

**NEVER commit to git. Use:**

1. **Production:** AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
2. **Staging:** Encrypted env files (git-crypt)
3. **Development:** `.env.local` (gitignored)

**Required Variables:**

```bash
# Authentication
JWT_SECRET=<32+ bytes random>
REFRESH_TOKEN_SECRET=<32+ bytes random>
COOKIE_SECRET=<32+ bytes random>

# KMS
KMS_MASTER_KEY=<32 bytes random>

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true
REDIS_URL=redis://:[password]@host:6379

# Server
NODE_ENV=production
PORT=5000
TLS_KEY_PATH=/etc/ssl/private/key.pem
TLS_CERT_PATH=/etc/ssl/private/cert.pem

# Security
CORS_ORIGIN=https://app.example.com
REQUIRE_HTTPS=true
ADMIN_ALLOWED_IPS=10.0.0.0/8

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Secret Validation

```bash
# Verify all required secrets are set
npm run validate:secrets

# Check for weak secrets
npm run validate:secret-strength

# Audit secret usage
npm run audit:secrets
```

### Revoking Compromised Secrets

**Immediate Actions:**

```bash
# 1. Alert all users (if passwords compromised)
# 2. Invalidate all sessions
curl -X POST https://api.example.com/admin/sessions/invalidate-all \
  -H "X-API-Key: backup-admin-key"

# 3. Force password reset for all users
curl -X POST https://api.example.com/admin/users/force-password-reset \
  -H "X-API-Key: backup-admin-key"

# 4. Enable 2FA enforcement
curl -X POST https://api.example.com/admin/settings/2fa-required \
  -H "X-API-Key: backup-admin-key"

# 5. Rotate all secrets immediately
# - JWT_SECRET
# - REFRESH_TOKEN_SECRET
# - COOKIE_SECRET
# - Admin API keys
```

**Communication:**
- Notify users within 1 hour
- Provide estimated resolution time
- Regular status updates
- Post-incident report within 24 hours

## Incident Response

### Security Incident Classification

| Severity | Impact | Response Time | Examples |
|----------|--------|----------------|----------|
| **Critical** | All users affected, data breach | <15 min | Master key compromise, database breach |
| **High** | Subset of users affected | <1 hour | Session hijacking, API misuse |
| **Medium** | Limited impact, containable | <4 hours | Invalid state, temporary outage |
| **Low** | Minimal user impact | <24 hours | Warning signs, configuration issues |

### Critical Incident Procedure

**Timeline: 0-30 minutes**

```
T+0:   Incident detected → Page on-call
       Immediately: Activate incident channel
       
T+5:   Incident Commander assigned
       - Coordinate response
       - Track timeline
       - Communicate status
       
T+10:  Containment
       - Stop the bleeding (isolate compromised service)
       - Prevent data loss
       - Preserve evidence
       
T+15:  Assessment
       - What happened?
       - Who was affected?
       - How long was it running?
       
T+20:  Remediation starts
       - Patch vulnerability
       - Rotate secrets
       - Update systems
       
T+30:  Status update to users
       - Acknowledge incident
       - Expected resolution
       - Compensation (if applicable)
```

**Resolution Phase: 30 min - 24 hours**

```
- Implement permanent fix
- Test thoroughly
- Deploy to production
- Verify all systems
- Document root cause
- Plan preventive measures
```

### Examples: Incident Response

**Scenario 1: Database Compromise**

```bash
# 1. Immediate isolation
# Revoke database credentials
# Redirect traffic to backup database

# 2. Assessment
# Check access logs for unauthorized access
# Determine what data was accessed
# Calculate affected users

# 3. Remediation
# Restore from clean backup
# Rotate database credentials
# Audit all user data for tampering

# 4. Communication
# Notify affected users within 1 hour
# Provide steps they should take
# Offer monitoring service (free)

# 5. Prevention
# Implement database encryption at rest
# Enable audit logging
# Add intrusion detection
```

**Scenario 2: JWT Secret Leaked**

```bash
# 1. Immediate action
# Invalidate all sessions
curl -X POST https://api.example.com/admin/sessions/invalidate-all \
  -H "X-API-Key: backup-admin-key"

# 2. Generate new JWT_SECRET
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 3. Deploy new version
git commit -am "Security: Rotate JWT secret"
git push origin main

# 4. Monitor
# Watch for increase in 401 errors
# Verify users can re-authenticate

# 5. Post-incident
# Review how secret was exposed
# Update secret management procedures
# Add secret scanning to CI/CD
```

**Scenario 3: Rate Limiting Bypass**

```bash
# 1. Enable protective measures
# Increase rate limits temporarily
# Enable CAPTCHA
# Block suspicious IPs

# 2. Investigate
# Review logs for attack pattern
# Identify affected endpoints
# Calculate impact

# 3. Fix vulnerability
# Implement proper rate limiting
# Add request validation
# Deploy fix

# 4. Monitor
# Watch for similar attacks
# Review protection effectiveness
```

### Incident Communication Template

```
Subject: [INCIDENT] Crypto Wallet Platform - [Status]

Dear Users,

We're aware of [incident description].

Status:
- Detected at: [time]
- Impact: [number] users, [description]
- Current status: [investigating/resolving/resolved]
- Expected resolution: [time]

What you should do:
[action items]

We apologize for the inconvenience and take security very seriously.

Updates: [frequency]
Support: [contact info]

- The Security Team
```

## Monitoring & Alerting

### Key Metrics to Monitor

**Application Health:**
```bash
# HTTP endpoints
- Request count (5xx errors)
- Response time (p50, p95, p99)
- Auth failures (401/403)
- Rate limit hits

# Authentication
- Login success rate
- Refresh token failures
- Session invalidations
- Token revocations

# KMS
- Encryption operations
- Key rotation status
- Decryption failures
- Secret retrieval time

# WebSocket
- Connection count
- Rate limit violations
- Auth failures
- Message count
```

### Critical Alerts

**Alert When:**

```
1. Error rate > 1%
2. HTTP 5xx errors > 10 in 5 minutes
3. Authentication failures > 100 in 5 minutes
4. KMS operations failing > 5%
5. Database connection pool exhausted
6. Redis memory usage > 90%
7. Disk usage > 85%
8. SSL certificate expiry < 30 days
9. Backup failures
10. Security logs show suspicious activity
```

### Monitoring Dashboard

**Recommended Panels:**

```
Row 1: Application Status
- Uptime percentage (target: 99.95%)
- Error rate (target: <0.1%)
- Response time (target: <200ms p95)

Row 2: Security
- Authentication success rate
- Failed login attempts
- Rate limit violations
- Suspicious requests

Row 3: Infrastructure
- CPU usage
- Memory usage
- Disk usage
- Database connections
- Redis memory

Row 4: Business
- Active users
- Transactions processed
- API calls
- Revenue (if applicable)
```

## Deployment & Updates

### Deployment Checklist

Before deploying to production:

```bash
# 1. Code review
[ ] All pull requests reviewed
[ ] Security scan passed (Snyk)
[ ] Tests passing (>80% coverage)
[ ] Lint passing

# 2. Build & Test
[ ] Docker image builds successfully
[ ] Integration tests pass
[ ] Smoke tests pass on staging

# 3. Security
[ ] No secrets in code/config
[ ] All dependencies up to date
[ ] Security headers configured
[ ] Rate limiting configured

# 4. Operations
[ ] Rollback plan documented
[ ] Database migrations tested
[ ] Health checks configured
[ ] Monitoring/alerts configured

# 5. Communication
[ ] Maintenance window announced
[ ] On-call team notified
[ ] Stakeholders notified
[ ] Support team informed
```

### Deployment Process

```bash
# 1. Pre-deployment backup
mongodump --uri="mongodb://..." --out=./backup/pre-deploy-$(date +%s)

# 2. Deploy to staging first
git tag v1.2.3
git push origin v1.2.3  # Triggers CI/CD for staging

# 3. Run acceptance tests on staging
npm run test:e2e:staging

# 4. Deploy to production
# Update production deployment config
# This triggers automated deployment

# 5. Post-deployment verification
curl https://api.example.com/health
curl https://api.example.com/metrics | grep -i error

# 6. Smoke tests
npm run test:smoke:production

# 7. Notify stakeholders
```

### Zero-Downtime Deployment

**Blue-Green Deployment:**

```
1. Deploy v2 (green) alongside v1 (blue)
2. Health check green (v2)
3. Run smoke tests against green
4. Switch traffic to green (DNS/load balancer)
5. Keep blue running for 1 hour (rollback capability)
6. Remove blue
```

**Rolling Deployment:**

```
1. Update 1 instance at a time
2. Health check after each update
3. Wait for traffic to route successfully
4. Move to next instance
5. Requires load balancer to remove failing instances
```

### Rollback Procedure

```bash
# If deployment fails:

# 1. Immediate rollback
git revert HEAD  # Revert the commit
git push origin main  # Triggers re-deployment

# 2. Rollback database (if needed)
mongorestore --uri="mongodb://..." ./backup/pre-deploy-TIMESTAMP

# 3. Verify
curl https://api.example.com/health

# 4. Investigation
# Review logs to find the issue
tail -f logs/app.log

# 5. Fix and redeploy
# Fix the issue in code
# Run full test suite again
# Redeploy with confidence
```

## Backup & Recovery

### Backup Strategy

**Frequency:**
- Database: Hourly (continuous replication)
- Redis: Daily
- Secrets: Real-time (encryption ensures safety)
- SSL Certificates: Manual (immutable)

**Retention:**
- Hourly backups: 7 days
- Daily backups: 30 days
- Weekly backups: 1 year
- Yearly backups: Permanent

### Database Backup

```bash
# Automated hourly backup
mongodump \
  --uri="mongodb+srv://user:pass@cluster.mongodb.net/db" \
  --out=./backups/mongodb-$(date +%Y%m%d-%H%M%S)

# Restore from backup
mongorestore \
  --uri="mongodb+srv://user:pass@cluster.mongodb.net/db" \
  --dir=./backups/mongodb-20240115-140000

# Verify backup integrity
npm run backup:verify
```

### Redis Backup

```bash
# Backup Redis to file
redis-cli BGSAVE

# Verify backup
redis-cli INFO persistence

# Restore from backup
# Stop Redis
redis-cli SHUTDOWN

# Replace dump file
cp ./redis-backups/dump.rdb /var/lib/redis/dump.rdb

# Restart Redis
redis-server

# Verify
redis-cli KEYS "*"
```

### Disaster Recovery Test

**Monthly Schedule:**

```bash
# 1. Restore to isolated environment
# 2. Run full test suite
# 3. Verify data integrity
# 4. Document any issues
# 5. Update recovery procedures
```

## Security Checklist

### Quarterly Security Audit

```
Authentication:
[ ] All sessions have expiration
[ ] Refresh tokens rotate properly
[ ] Logout invalidates all tokens
[ ] MFA is enforced for admins

Authorization:
[ ] Admin endpoints require admin role
[ ] Users can only access their own data
[ ] API keys have proper scopes
[ ] Rate limiting is active

Encryption:
[ ] Secrets encrypted at rest
[ ] Data encrypted in transit (HTTPS)
[ ] Passwords hashed with bcrypt
[ ] KMS operating properly

Data Protection:
[ ] Sensitive data not logged
[ ] Backups encrypted
[ ] Database requires authentication
[ ] Redis requires password

Infrastructure:
[ ] SSL certificates valid (>30 days)
[ ] Firewall rules restrictive
[ ] SSH keys rotated
[ ] Bastion host access logged

Dependencies:
[ ] No high-severity vulnerabilities (Snyk)
[ ] All dependencies up to date
[ ] No abandoned libraries
[ ] License compliance verified

Compliance:
[ ] Privacy policy current
[ ] Terms of service current
[ ] GDPR compliance verified (if applicable)
[ ] PCI compliance verified (if handling cards)
```

### Annual Penetration Testing

- **Timing:** Same week each year
- **Scope:** Full application and infrastructure
- **Report:** Findings documented and tracked to resolution
- **Follow-up:** Re-test critical findings

### Security Training

- **Frequency:** Quarterly for team
- **Topics:** OWASP Top 10, secure coding, incident response
- **Certification:** Security+ or equivalent for ops team

## Troubleshooting

### Common Issues & Solutions

**Issue: High 401 Unauthorized Errors**

```bash
# Cause: JWT secret rotated or token expired
# Solution:

# 1. Check logs
grep "401" logs/app.log

# 2. Verify JWT_SECRET is consistent across instances
echo $JWT_SECRET | sha256sum

# 3. Check token expiration
npm run debug:token-expiration

# 4. Restart sessions
curl -X POST https://api.example.com/admin/sessions/refresh-all \
  -H "X-API-Key: admin-key"
```

**Issue: Database Queries Slow**

```bash
# Cause: Missing index, query optimization needed
# Solution:

# 1. Check slow query log
db.setProfilingLevel(1, { slowms: 100 })

# 2. Analyze query
db.collection.find().explain("executionStats")

# 3. Add index if needed
db.collection.createIndex({ field1: 1, field2: 1 })

# 4. Verify improvement
npm run benchmark:database
```

**Issue: SSL Certificate Expiry Alert**

```bash
# Solution:

# 1. Generate new certificate
# Using Let's Encrypt, AWS ACM, or provider

# 2. Update environment variables
export TLS_CERT_PATH=/path/to/new/cert.pem
export TLS_KEY_PATH=/path/to/new/key.pem

# 3. Restart service
systemctl restart crypto-wallet-backend

# 4. Verify
openssl s_client -connect api.example.com:443

# 5. Add calendar reminder for next renewal
```

**Issue: Rate Limit Too Strict**

```bash
# Solution:

# 1. Review traffic patterns
npm run analyze:rate-limits

# 2. Adjust limits in environment
export RATE_LIMIT_WINDOW=900000  # 15 minutes
export RATE_LIMIT_MAX_REQUESTS=100

# 3. Deploy and monitor
npm start

# 4. Monitor hit rate
curl https://api.example.com/metrics | grep "rate_limit"
```

### Getting Help

**For Production Issues:**

1. Check status page: https://status.example.com
2. Review recent logs: `tail -f logs/app.log | grep -i error`
3. Check monitoring dashboard
4. Page on-call engineer
5. Review runbook for similar issues
6. Create incident ticket with details

**Documentation:**
- This runbook: `SECURITY_RUNBOOK.md`
- API docs: `API_ARCHITECTURE.md`
- KMS guide: `KMS_INTEGRATION_GUIDE.md`
- Testing: `BACKEND_TESTING_GUIDE.md`

---

**Last Updated:** February 2026
**Next Review:** August 2026
**Maintained By:** Security Team
