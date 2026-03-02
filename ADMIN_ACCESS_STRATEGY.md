# Admin Access Strategy Guide

## Overview

This document describes the multi-layered security strategy for protecting admin endpoints in production.

## Security Layers

### 1. **IP Allowlisting (Primary)**
The primary defense layer that restricts admin API access to known, trusted IP addresses or networks.

**Environment Variable:** `ADMIN_ALLOWED_IPS`

**Format:**
- Single IP: `127.0.0.1`
- Multiple IPs: `10.0.0.1,10.0.0.2,192.168.1.100`
- CIDR Ranges: `10.0.0.0/8,192.168.0.0/16`
- Mixed: `10.0.0.1,10.0.0.0/24,192.168.1.100`

**Default (Development):** `127.0.0.1,::1` (localhost only)

**Example Production Setup (.env):**
```env
# Allow only VPN gateway and office networks
ADMIN_ALLOWED_IPS=203.0.113.10,203.0.113.0/24,198.51.100.0/25
```

### 2. **API Key Authentication (Optional, Recommended)**
An additional authentication layer using API keys for higher security.

**Environment Variable:** `ADMIN_API_KEY`

**When to use:**
- For extra protection on highly sensitive operations
- When admin access spans multiple networks
- For programmatic admin API access

**Format:**
- Bearer token in Authorization header
- Example: `Authorization: Bearer your-secret-admin-api-key`

**Example Production Setup (.env):**
```env
# Generate a strong random key: `openssl rand -hex 32`
ADMIN_API_KEY=a7f3c9e2b1d4f6a8c0e3b5d7f9a1c3e5
```

**Client Usage:**
```bash
curl -H "Authorization: Bearer a7f3c9e2b1d4f6a8c0e3b5d7f9a1c3e5" \
  http://localhost:5000/api/admin/stats
```

### 3. **Rate Limiting**
Admin endpoints are rate-limited to 30 requests per minute to prevent abuse.

**Behavior:**
- Tracks by IP address
- Returns 429 status on limit exceeded
- Logs all rate-limited requests

### 4. **JWT Authentication**
All admin endpoints require a valid JWT token with `admin` role.

**Behavior:**
- Checked by `adminAuth` middleware
- Verified by `adminGuard` middleware
- Token expiry: 15 minutes (short-lived for security)

### 5. **Anti-Replay Protection**
X-Request-Id and X-Request-Timestamp headers prevent replay attacks on state-changing operations.

**Enforcement:** All POST/PUT/PATCH/DELETE requests to admin endpoints

### 6. **Audit Logging**
All admin access attempts (successful and failed) are logged.

**Logged Events:**
- `ADMIN_ACCESS_BLOCKED_IP` - IP not in allowlist
- `ADMIN_ACCESS_BLOCKED_API_KEY` - Invalid API key
- `ADMIN_ACTION_*` - All admin operations
- Request metadata: IP, user agent, timestamp, action

## Deployment Scenarios

### Scenario 1: Development (Local)
```env
ADMIN_ALLOWED_IPS=127.0.0.1,::1
# No API key needed
NODE_ENV=development
USE_HTTPS=false
```

### Scenario 2: Staging (Office Network)
```env
ADMIN_ALLOWED_IPS=203.0.113.0/24
ADMIN_API_KEY=staging-api-key-here
NODE_ENV=staging
USE_HTTPS=true
REQUIRE_HTTPS=true
```

### Scenario 3: Production (VPN + API Key)
```env
ADMIN_ALLOWED_IPS=203.0.113.10,10.0.0.0/8
ADMIN_API_KEY=$(openssl rand -hex 32)
NODE_ENV=production
USE_HTTPS=true
REQUIRE_HTTPS=true
TLS_KEY_PATH=/etc/tls/private/server.key
TLS_CERT_PATH=/etc/tls/certs/server.crt
```

### Scenario 4: Restricted Shared Hosting
```env
# Only allow specific admin IP with additional API key
ADMIN_ALLOWED_IPS=203.0.113.42
ADMIN_API_KEY=your-secret-key
NODE_ENV=production
USE_HTTPS=true
REQUIRE_HTTPS=true
```

## Best Practices

### For Development
✅ Use localhost allowlist
✅ No API key needed
✅ Use HTTP if convenient

### For Production
✅ Use VPN or private network IP ranges
✅ Enable API key authentication
✅ Use HTTPS (set `USE_HTTPS=true`)
✅ Use TLS certificates (set `TLS_KEY_PATH` and `TLS_CERT_PATH`)
✅ Regularly rotate API keys
✅ Monitor audit logs for unauthorized attempts
✅ Keep IP allowlist minimal (only necessary IPs)
✅ Use strong, randomly generated API keys

## Monitoring

### Audit Log Queries
```javascript
// Find all blocked admin access attempts
db.auditlogs.find({ 
  action: { $regex: 'ADMIN_ACCESS_BLOCKED' },
  success: false 
}).sort({ timestamp: -1 }).limit(50)

// Find all admin operations by user
db.auditlogs.find({ 
  action: { $regex: 'ADMIN' },
  actorId: 'user-id-here'
}).sort({ timestamp: -1 })
```

### Logging Best Practices
- Review audit logs weekly for suspicious patterns
- Alert on multiple failed access attempts from same IP
- Monitor for unusual API usage patterns
- Log all IP allowlist changes

## Troubleshooting

### "Access Denied" Error
1. Check your client IP: `curl https://api.ipify.org`
2. Verify IP is in `ADMIN_ALLOWED_IPS`
3. Check for reverse proxy or load balancer (may need `X-Forwarded-For` header)

### "Invalid API Key" Error
1. Verify `ADMIN_API_KEY` is set in `.env`
2. Ensure Bearer token matches exactly (case-sensitive)
3. Check Authorization header format: `Bearer <key>`

### Server Not Accepting Connections
1. Verify HTTPS is configured correctly (if `USE_HTTPS=true`)
2. Check TLS certificate paths are correct
3. Verify firewall allows traffic on port 5000

## Migration Path

1. **Phase 1 (Current):** IP allowlist only, localhost in dev
2. **Phase 2 (Recommended):** Add API key to production
3. **Phase 3 (Future):** mTLS certificates for mutual authentication
4. **Phase 4 (Future):** OAuth2/OpenID Connect integration

## Future Enhancements

- [ ] mTLS certificate-based authentication
- [ ] Time-window-based admin panel access (only during business hours)
- [ ] Geographic IP restrictions
- [ ] Hardware security key (U2F/WebAuthn) support
- [ ] Dynamic IP allowlist updates via CI/CD

## References

- [OWASP Admin Interfaces](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/02-Testing_for_Authorization_Schema)
- [Express Middleware Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [CIDR Notation Guide](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing)
