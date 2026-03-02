# Cookie Handling Quick Reference

## Quick Start

### Server-Side: Set Secure Cookies

```javascript
const { setRefreshTokenCookie, setCsrfTokenCookie, clearAuthCookies } = require('./services/cookieManager');

// After successful login
await setRefreshTokenCookie(res, refreshToken, 30); // 30 days
await setCsrfTokenCookie(res, csrfToken);

// On logout
await clearAuthCookies(res);
```

### Client-Side: Send Authenticated Requests

```javascript
// GET request (cookies sent automatically)
fetch('/api/wallet', {
  method: 'GET',
  credentials: 'include',  // IMPORTANT: send cookies
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// POST request (include CSRF token)
fetch('/api/transactions', {
  method: 'POST',
  credentials: 'include',  // IMPORTANT: send cookies
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken  // CSRF protection
  },
  body: JSON.stringify(data)
});
```

## Cookie Types at a Glance

| Cookie | Purpose | HttpOnly | Secure | SameSite | Path | TTL |
|--------|---------|----------|--------|----------|------|-----|
| `refreshToken` | Silent refresh | ✅ Yes | ✅ Yes | Strict | `/api/auth` | 30 days |
| `csrfToken` | CSRF protection | ❌ No | ✅ Yes | Strict | `/` | 30 min |
| `sessionId` | Session tracking | ✅ Yes | ✅ Yes | Strict | `/` | 1 hour |

## Common Operations

### Login
```javascript
// Server
const csrfToken = await generateCsrfToken(user._id);
await setRefreshTokenCookie(res, refreshToken, 30);
await setCsrfTokenCookie(res, csrfToken);

// Client
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  body: JSON.stringify({ email, password })
});
const { token, csrfToken } = await response.json();
localStorage.setItem('accessToken', token); // In memory is better
```

### Silent Refresh
```javascript
// Client detects 401 error
if (response.status === 401) {
  const refreshResp = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'  // Send refresh cookie
  });
  const { token, csrfToken } = await refreshResp.json();
  window.accessToken = token;
  window.csrfToken = csrfToken;
}
```

### Logout
```javascript
// Server
await clearAuthCookies(res);

// Client
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include',
  headers: { 'X-CSRF-Token': csrfToken }
});
window.accessToken = null;
window.csrfToken = null;
```

## CSRF Flow

### 1. GET Request (Fetch Token)
```
GET /api/wallet
↓
Server: Generate CSRF token → Send in cookie
↓
Browser: Store CSRF token from cookie in memory
```

### 2. POST Request (Send with Token)
```
POST /api/transactions
Headers: X-CSRF-Token: <token from memory>
Cookies: csrfToken=<token from cookie> (auto-sent)
↓
Server: Verify X-CSRF-Token header matches cookie
```

## Error Handling

### CSRF Token Missing
```
Error: "CSRF token missing"
Solution: Add 'X-CSRF-Token' header to POST/PUT/DELETE requests
```

### CSRF Token Invalid
```
Error: "CSRF token invalid"
Solutions:
- GET request first (to get fresh token)
- Ensure token hasn't expired (30 min)
- Check token matches between header and cookie
```

### Refresh Cookie Expired
```
Error: "Refresh token expired"
Solutions:
- User must login again
- Check server clock sync
- Verify REFRESH_TOKEN_EXPIRES_DAYS setting
```

### Cross-Site Cookie Not Sent
```
Problem: Cookies not included in request
Solution: Set credentials: 'include' in fetch()
```

## Middleware Stack (Order Matters!)

```javascript
// In server.js
app.use(express.json());
app.use(cookieParser());           // 1. Parse cookies

app.use(sessionMiddleware);        // 2. Load cookies into req
app.use(validateCookieSameSite);   // 3. Check same-site
app.use(autoRefreshCookieTTL);     // 4. Extend TTL
app.use(csrfProtection);           // 5. CSRF protection

app.use('/api/auth', require('./routes/auth'));
```

## Environment Variables

```bash
# Must set in production!
NODE_ENV=production
REQUIRE_HTTPS=true

# Optional customization
COOKIE_DOMAIN=.example.com
COOKIE_SECRET=your-secret-key
REFRESH_TOKEN_EXPIRES_DAYS=30

# Already set
JWT_SECRET=<your-jwt-secret>
MONGODB_URI=<your-mongo-uri>
```

## Security Checklist

### Server
- [ ] `httpOnly: true` on refreshToken cookie
- [ ] `secure: true` for production
- [ ] `sameSite: 'strict'` for CSRF
- [ ] Cookie paths limited (/api/auth for refresh)
- [ ] CSRF tokens validated on POST/PUT/DELETE
- [ ] Tokens rotated on refresh
- [ ] Cookies cleared on logout
- [ ] Token expiry enforced
- [ ] Logs monitored for security events

### Client
- [ ] `credentials: 'include'` on fetch requests
- [ ] Access token stored in memory (not localStorage)
- [ ] CSRF token included in X-CSRF-Token header
- [ ] 401 responses trigger token refresh
- [ ] Cookies cleared on logout
- [ ] HTTPS used for all auth requests
- [ ] HttpOnly cookies not accessed from JS

## Debugging Tips

### Check Cookies
```javascript
// Browser console
document.cookie  // Shows only non-httpOnly cookies

// Network tab
// View "Cookies" section in request/response
```

### Check Token Format
```javascript
// Verify CSRF token
console.log('CSRF Token:', window.csrfToken);

// Verify Access Token
const parts = window.accessToken.split('.');
console.log('JWT Header:', JSON.parse(atob(parts[0])));
console.log('JWT Payload:', JSON.parse(atob(parts[1])));
```

### Monitor Logs
```bash
# Check cookie operations
tail -f logs/app.log | grep cookie

# Check CSRF operations
tail -f logs/app.log | grep csrf

# Check all auth events
tail -f logs/app.log | grep auth_event
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Cookies not set | Missing credentials | Add `credentials: 'include'` |
| CSRF token errors | Missing header | Add `X-CSRF-Token` header |
| Logout doesn't clear | Wrong path | Use `clearAuthCookies()` |
| Refresh fails | Expired token | User must re-login |
| Cross-site requests | SameSite policy | Check domain matches |
| 401 on refresh | Rate limited | Check auth limiter settings |

## Testing with cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}' \
  -c cookies.txt

# GET request (cookies sent automatically)
curl -X GET http://localhost:3000/api/wallet \
  -b cookies.txt

# POST request with CSRF
curl -X POST http://localhost:3000/api/transactions \
  -H "X-CSRF-Token: <token>" \
  -b cookies.txt \
  -d '{"amount":100}'

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

## File Structure

```
backend/
├── services/
│   └── cookieManager.js        # Cookie management service
├── middleware/
│   ├── csrfProtection.js       # CSRF middleware
│   └── cookieSession.js        # Session middleware
└── routes/
    └── auth.js                 # Updated with new services
```

## Version History

| Date | Change | Impact |
|------|--------|--------|
| 2026-02-02 | Implemented cookie manager service | ✅ Backward compatible |
| 2026-02-02 | Added CSRF protection | ✅ Backward compatible |
| 2026-02-02 | Added session middleware | ✅ Backward compatible |

## Next Steps

1. ✅ Install cookie-parser: `npm install cookie-parser`
2. ✅ Update server.js with middleware
3. ✅ Update auth routes to use cookieManager
4. ✅ Test cookie flow in browser
5. ⏳ Add Redis-backed CSRF storage (optional)
6. ⏳ Add device fingerprinting (optional)

## References

- [OWASP Cookie Security](https://owasp.org/www-community/attacks/csrf)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [SameSite Cookie Explained](https://web.dev/samesite-cookies-explained/)
- [CSRF Protection Guide](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
