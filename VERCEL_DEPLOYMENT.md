# Vercel Deployment Configuration

## 🚀 Deployment Details

| Component | Details |
|-----------|---------|
| **Frontend URL** | https://crypto-wallet-blush-beta.vercel.app |
| **Backend API** | /api (same Vercel deployment) |
| **Database** | Supabase (bzrmdqvzqcbnpzhurzcr) |
| **Status** | ✅ Configured and Ready |

---

## 📋 Configuration Updates

### 1. Frontend Environment Variables

**Development (`.env.local`)**
```
REACT_APP_SUPABASE_URL=https://bzrmdqvzqcbnpzhurzcr.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
REACT_APP_API_URL=/api
```

**Production (`.env.production`)**
```
REACT_APP_SUPABASE_URL=https://bzrmdqvzqcbnpzhurzcr.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
REACT_APP_API_URL=https://crypto-wallet-blush-beta.vercel.app/api
```

### 2. Backend Configuration (vercel.json)

**Environment Variables:**
```json
{
  "NODE_ENV": "production",
  "SUPABASE_URL": "https://bzrmdqvzqcbnpzhurzcr.supabase.co",
  "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGc...",
  "SUPABASE_ANON_KEY": "eyJhbGc...",
  "CORS_ORIGIN": "https://crypto-wallet-blush-beta.vercel.app",
  "ADMIN_ALLOW_REMOTE": "true"
}
```

**Build Command:**
```bash
npm install && cd frontend && npm install && CI=false \
REACT_APP_API_URL=https://crypto-wallet-blush-beta.vercel.app/api \
REACT_APP_SUPABASE_URL=https://bzrmdqvzqcbnpzhurzcr.supabase.co \
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc... \
npm run build
```

**API Routing:**
```json
"rewrites": [
  { "source": "/api/:path*", "destination": "/api/index" },
  { "source": "/((?!api).*)", "destination": "/index.html" }
]
```

---

## 🔒 Security Headers

**Content Security Policy (CSP):**
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'`
- `connect-src 'self' https: wss:` (allows Supabase and WebSocket connections)

**Other Headers:**
- `X-Frame-Options: DENY` (prevents clickjacking)

---

## 🔄 CORS Configuration

**Allowed Origin:**
```
https://crypto-wallet-blush-beta.vercel.app
```

**Backend Response:**
- API routes `/api/*` accept requests from the Vercel domain
- Credentials (cookies) are allowed for cross-origin requests
- All standard HTTP methods supported (GET, POST, PUT, PATCH, DELETE)

---

## 📂 File Structure on Vercel

```
vercel.json                  → Deployment configuration
api/index.js               → Backend serverless functions
frontend/build/            → Built frontend (React)
```

---

## 🧪 Testing Vercel Deployment

### Test Frontend
```bash
curl https://crypto-wallet-blush-beta.vercel.app
```

### Test API
```bash
curl https://crypto-wallet-blush-beta.vercel.app/api/health
```

### Test Admin Login
```bash
curl -X POST https://crypto-wallet-blush-beta.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"SecureP@ss123"}'
```

---

## 📝 Environment Variables on Vercel

To update environment variables in Vercel:

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Add/update:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `CORS_ORIGIN`
   - `COOKIE_SECRET`
   - `JWT_SECRET`
   - Any other backend config

---

## 🔐 Secrets Management

**Never commit to GitHub:**
- `.env` (local backend)
- `frontend/.env.local` (local frontend)
- API keys, JWT secrets, passwords

**These are properly in `.gitignore`**

**To manage secrets on Vercel:**
1. Use Vercel Dashboard Environment Variables
2. Or use `vercel env:pull` to sync local env
3. Or configure in `vercel.json` (for non-sensitive defaults)

---

## 🚨 CORS & Cross-Origin Issues

If you get CORS errors:

1. **Check `CORS_ORIGIN` in vercel.json matches your domain**
   - Current: `https://crypto-wallet-blush-beta.vercel.app`

2. **Check `REACT_APP_API_URL` in build**
   - Frontend must call the correct API endpoint

3. **Check browser console for specific CORS error**
   - Look at `error` message for missing header or origin mismatch

4. **Common fix if domain changes:**
   ```json
   // In vercel.json
   "CORS_ORIGIN": "https://your-new-domain.vercel.app"
   ```

---

## 📊 Deployment Checklist

- ✅ Frontend configured with Vercel URL
- ✅ Backend API configured with CORS_ORIGIN
- ✅ Supabase credentials in vercel.json
- ✅ Build command includes environment variables
- ✅ Security headers configured
- ✅ API routing configured
- ✅ Database connection verified
- ✅ Admin user created

---

## 🔗 Related Documentation

- [Vercel Deployment Guide](https://vercel.com/docs)
- [Supabase Setup](./SUPABASE_SETUP.md)
- [GitHub Repository](https://github.com/MdRahad1002/crypto-wallet)
- [Admin Management](./README.md#admin-management)

---

**Last Updated:** March 2, 2026
**Deployment Status:** 🟢 ACTIVE
