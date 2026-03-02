# Installation & Setup Instructions

## Required Package

The cookie handling implementation requires one additional npm package:

### Install cookie-parser

```bash
cd backend
npm install cookie-parser
```

Or if using yarn:
```bash
yarn add cookie-parser
```

**What it does:**
- Parses `Cookie` header and populates `req.cookies`
- Provides cookie signing/encryption capabilities
- Standard Express.js middleware for cookie handling

## Environment Variables to Add

Create or update your `.env` file with:

```env
# Production safety
NODE_ENV=production
REQUIRE_HTTPS=true

# Must already exist
JWT_SECRET=<your-jwt-secret>
MONGODB_URI=mongodb://localhost:27017/crypto-wallet

# Optional but recommended
COOKIE_SECRET=your-cookie-signing-secret-change-this
REFRESH_TOKEN_EXPIRES_DAYS=30

# Optional domain customization
COOKIE_DOMAIN=.example.com
```

## Verification Checklist

After installation, verify these files exist:

```
✓ backend/services/cookieManager.js
✓ backend/middleware/csrfProtection.js
✓ backend/middleware/cookieSession.js
✓ backend/routes/auth.js (updated)
✓ backend/server.js (updated)
✓ COOKIE_HANDLING_GUIDE.md
✓ COOKIE_QUICK_REFERENCE.md
✓ COOKIE_IMPLEMENTATION_SUMMARY.md
```

## Startup Testing

### 1. Start Backend Server

```bash
cd backend
npm install cookie-parser  # If not already installed
node server.js
```

Expected output:
```
✓ Server listening on port 3000
✓ MongoDB connected
✓ HTTPS enforced (if REQUIRE_HTTPS=true)
```

### 2. Test Login Endpoint

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -v
```

Expected response headers:
```
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict
Set-Cookie: csrfToken=...; SameSite=Strict
```

Response body:
```json
{
  "token": "eyJhbGc...",
  "csrfToken": "abc123...",
  "user": { ... }
}
```

### 3. Test CSRF Protection

```bash
# GET request (fetch token)
curl -X GET http://localhost:3000/api/wallet \
  -H "Authorization: Bearer <access-token>" \
  -v

# POST request (send token)
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer <access-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{"amount":100}' \
  -v
```

## Frontend Integration

### Update API Service

If you have an API service/utility file, add:

```javascript
// Before making requests
import axios from 'axios';

// Configure axios to include cookies
axios.defaults.withCredentials = true;

// For fetch, use credentials
const options = {
  credentials: 'include',
  headers: {
    'X-CSRF-Token': window.csrfToken
  }
};
```

### Update Login Component

```javascript
async function handleLogin(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',  // NEW: send cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  
  // Store tokens in memory
  window.accessToken = data.token;
  window.csrfToken = data.csrfToken;
  
  return data.user;
}
```

### Update API Calls

```javascript
// Before: No CSRF
async function createTransaction(amount) {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ amount })
  });
}

// After: With CSRF and credentials
async function createTransaction(amount) {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    credentials: 'include',  // NEW
    headers: {
      'Authorization': `Bearer ${window.accessToken}`,
      'X-CSRF-Token': window.csrfToken,  // NEW
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount })
  });
  
  if (response.status === 401) {
    // Refresh token
    await refreshAccessToken();
    // Retry request
  }
  
  return response.json();
}
```

### Add Token Refresh Logic

```javascript
async function refreshAccessToken() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'  // Send refresh cookie
  });
  
  if (response.ok) {
    const data = await response.json();
    window.accessToken = data.token;
    window.csrfToken = data.csrfToken;
    return true;
  }
  
  // Refresh failed, redirect to login
  window.location.href = '/login';
  return false;
}
```

### Add Logout Logic

```javascript
async function handleLogout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': window.csrfToken
    }
  });
  
  // Clear memory
  window.accessToken = null;
  window.csrfToken = null;
  
  // Redirect to login
  window.location.href = '/login';
}
```

## Debugging & Troubleshooting

### Check Server Startup

```bash
# Look for these lines in console
[INFO] Server running on port 3000
[INFO] MongoDB connected
[INFO] Cookie parser initialized
```

### Check Cookies in Browser

```javascript
// In browser DevTools console
document.cookie  // Shows non-httpOnly cookies

// Check headers in Network tab
// Look for Set-Cookie headers in responses
// Look for Cookie headers in requests
```

### Monitor Logs

```bash
# Follow logs in real-time
tail -f backend/logs/app.log

# Filter for cookie operations
grep "cookie" backend/logs/app.log

# Filter for CSRF operations
grep "csrf" backend/logs/app.log
```

### Common Issues

#### Issue: "Cannot find module 'cookie-parser'"
```bash
# Solution: Install it
npm install cookie-parser
```

#### Issue: "CSRF token missing" on POST requests
```javascript
// Solution: Add CSRF token to headers
headers: { 'X-CSRF-Token': window.csrfToken }
```

#### Issue: Cookies not being sent
```javascript
// Solution: Add credentials to fetch
credentials: 'include'
```

#### Issue: "Secure cookies only over HTTPS"
```bash
# Solution: Either set REQUIRE_HTTPS=false in dev
# Or use HTTPS
NODE_ENV=development  # Disables secure flag requirement
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] `npm install cookie-parser` completed
- [ ] `.env` variables set (especially COOKIE_SECRET)
- [ ] `NODE_ENV=production` set
- [ ] `REQUIRE_HTTPS=true` set
- [ ] SSL certificates configured
- [ ] MongoDB connection verified
- [ ] Redis connection verified (for token revocation)
- [ ] Frontend updated with credentials and CSRF headers

### Post-Deployment Verification

```bash
# Test endpoint
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}'

# Check secure flags
# Cookies should have:
# - Secure flag (HTTPS only)
# - HttpOnly flag
# - SameSite=Strict
```

## Performance Tuning

### Optimize Token Cleanup

Edit `backend/services/cookieManager.js`:

```javascript
// Default: every 15 minutes
setInterval(() => {
  cookieManager.cleanupExpiredTokens();
}, 15 * 60 * 1000);

// Change to: every 30 minutes for lower traffic
// setInterval(() => {
//   cookieManager.cleanupExpiredTokens();
// }, 30 * 60 * 1000);
```

### Monitor Memory Usage

```javascript
// In server.js
setInterval(() => {
  const used = process.memoryUsage();
  logger.info('memory_usage', {
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    csrfTokens: cookieManager.getCsrfTokenCount()
  });
}, 60000);
```

## Migration from Old System

If upgrading from basic cookie handling:

### 1. Update Imports
```diff
- const cookieParser = require('cookie-parser');
+ const { setRefreshTokenCookie, setCsrfTokenCookie } = require('./services/cookieManager');
```

### 2. Update Middleware
```diff
- app.use(cookieParser());
+ app.use(cookieParser());
+ app.use(sessionMiddleware);
+ app.use(csrfProtection);
```

### 3. Update Routes
```diff
- res.cookie('refreshToken', token, { httpOnly: true });
+ await setRefreshTokenCookie(res, token, 30);
```

### 4. No Data Migration Needed
- Old cookies automatically invalidated when expired
- Users automatically re-authenticate
- Zero downtime upgrade

## Support & Documentation

### Files to Reference

- **Implementation Details:** `COOKIE_IMPLEMENTATION_SUMMARY.md`
- **Full Guide:** `COOKIE_HANDLING_GUIDE.md`
- **Quick Reference:** `COOKIE_QUICK_REFERENCE.md`
- **This File:** `INSTALLATION_INSTRUCTIONS.md`

### Key Source Files

- `backend/services/cookieManager.js` - Cookie management service
- `backend/middleware/csrfProtection.js` - CSRF middleware
- `backend/middleware/cookieSession.js` - Session middleware
- `backend/routes/auth.js` - Authentication routes (updated)
- `backend/server.js` - Server configuration (updated)

## Support Contacts

If you encounter issues:

1. Check logs: `tail -f backend/logs/app.log`
2. Review documentation: `COOKIE_HANDLING_GUIDE.md`
3. Check configuration: `.env` file
4. Verify package: `npm list cookie-parser`
5. Test endpoints: Use provided cURL examples

## Summary

✅ Install `cookie-parser` package
✅ Update `.env` variables
✅ Verify files in place
✅ Test startup
✅ Update frontend code
✅ Deploy

Ready for production deployment after verification!
