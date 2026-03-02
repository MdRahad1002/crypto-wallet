# Supabase Database Connection Setup Complete ✅

## Overview
The crypto-wallet project has been successfully configured to connect to Supabase PostgreSQL database with the following credentials.

## Environment Files Created

### 1. Backend Configuration (`.env`)
Located at: `c:\Users\User\Downloads\crypto-wallet-main\.env`

**Supabase Configuration:**
- **SUPABASE_URL:** https://bzrmdqvzqcbnpzhurzcr.supabase.co
- **SUPABASE_SERVICE_ROLE_KEY:** Service role key (full database access, bypasses RLS)
- **SUPABASE_ANON_KEY:** Anonymous key (respects Row Level Security policies)
- **SUPABASE_JWT_SECRET:** JWT secret for token signing

**PostgreSQL Connection:**
- **POSTGRES_HOST:** db.bzrmdqvzqcbnpzhurzcr.supabase.co
- **POSTGRES_USER:** postgres
- **POSTGRES_PASSWORD:** YxN8lXw4GzeeVQtG
- **POSTGRES_DATABASE:** postgres
- **POSTGRES_PRISMA_URL:** Connection string with connection pooling (pgbouncer)
- **POSTGRES_URL:** Standard pooled connection
- **POSTGRES_URL_NON_POOLING:** Direct connection without pooling

### 2. Frontend Development Configuration (`.env.local`)
Located at: `c:\Users\User\Downloads\crypto-wallet-main\frontend\.env.local`

**REACT_APP_* Variables (for frontend):**
- **REACT_APP_SUPABASE_URL:** https://bzrmdqvzqcbnpzhurzcr.supabase.co
- **REACT_APP_SUPABASE_ANON_KEY:** Frontend anonymous key
- **REACT_APP_API_URL:** http://localhost:5000/api

### 3. Frontend Production Configuration
Updated: `c:\Users\User\Downloads\crypto-wallet-main\frontend\.env.production`

- Uses the same Supabase URL and anonymous key as development
- **REACT_APP_API_URL:** /api (relative to production domain)

## Backend Configuration Updates

Updated `backend/core/config.js` to export:
- Supabase connection parameters
- PostgreSQL connection URLs
- Support for both MongoDB (legacy) and Supabase

## Database Architecture

The project uses Supabase with the following tables:

### Core Tables:
1. **users** - User accounts with authentication, KYC status, recovery info
2. **user_wallets** - User's wallet addresses and key material
3. **user_notifications** - In-app notifications for users
4. **user_refresh_tokens** - JWT refresh token management
5. **transactions** - Blockchain transaction history
6. **wallets** - Wallet recovery information (mnemonic/seed)
7. **user_tokens** - Custom token tracking
8. **webhooks** - Webhook configurations
9. **webhook_events** - Webhook event history
10. **support_tickets** - Support ticket management
11. **audit_logs** - Security audit trail

## Next Steps to Complete Setup

### 1. Initialize Database Schema
Run the SQL schema in Supabase Dashboard:

```sql
-- Go to: Supabase Dashboard → SQL Editor
-- Upload/copy: backend/scripts/supabase-schema.sql
-- Execute the entire file to create all tables and indexes
```

See: [backend/scripts/supabase-schema.sql](backend/scripts/supabase-schema.sql)

### 2. Install Dependencies (if not already done)
```bash
npm install
cd frontend && npm install
```

### 3. Test Supabase Connection

**Backend:**
```bash
npm run server
```
The backend will log "supabase_admin_client_initialised" and "supabase_anon_client_initialised" if connection is successful.

**Frontend:**
```bash
cd frontend
npm start
```

### 4. Verify Frontend Connection
The frontend will:
- Initialize Supabase client in `src/lib/supabaseClient.js`
- Use REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
- Connect to the API at REACT_APP_API_URL

### 5. Create Test User (Optional)
```bash
node backend/scripts/createTestUser.js
```

### 6. Seed Demo Data (Optional)
```bash
node backend/scripts/seedDemoUsers.js
```

## Architecture Overview

```
┌─────────────────────┐
│   Frontend (React)  │
│  (port 3000)        │
└──────────┬──────────┘
           │
           │ REACT_APP_SUPABASE_* 
           │ REACT_APP_API_URL
           │
┌──────────▼──────────┐
│  Backend (Express)  │
│  (port 5000)        │
└──────────┬──────────┘
           │
           │ SUPABASE_URL
           │ SUPABASE_SERVICE_ROLE_KEY
           │
┌──────────▼──────────────────────────┐
│  Supabase (PostgreSQL Database)     │
│  https://bzrmdqvzqcbnpzhurzcr.      │
│          supabase.co                │
└─────────────────────────────────────┘
```

## Connection String Reference

**For Connection Pooling (recommended for API):**
```
postgres://postgres.bzrmdqvzqcbnpzhurzcr:YxN8lXw4GzeeVQtG@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
```

**For Direct Connection (Prisma, migrations):**
```
postgres://postgres.bzrmdqvzqcbnpzhurzcr:YxN8lXw4GzeeVQtG@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

## Security Notes

⚠️ **Important:**
1. All credentials are now in `.env` and `.env.local` files
2. These files should NOT be committed to git (already in .gitignore)
3. In production (Vercel), set these environment variables through:
   - Vercel Project Settings → Environment Variables
   - Or use `vercel env:pull` to sync from Vercel
4. The Supabase Service Role Key should only be used server-side
5. The Anon Key is safe for client-side use (respects RLS policies)

## Troubleshooting

### Connection Issues
1. Check that all environment variables are properly set:
   ```bash
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. Verify Supabase project is active in dashboard
3. Check PostgreSQL user permissions (usually full permissions by default)

### Schema Issues
1. Ensure supabase-schema.sql was run completely
2. Verify no schema migration errors in Supabase SQL Editor
3. Check for conflicting table names

### Authentication Issues
1. Verify SUPABASE_JWT_SECRET matches the JWT secret in Supabase project
2. Check that users table has proper RLS policies configured
3. Test authentication with `backend/scripts/testValidation.js`

## Useful Supabase Dashboard Links

- **Project URL:** https://app.supabase.com/project/bzrmdqvzqcbnpzhurzcr
- **SQL Editor:** Dashboard → SQL Editor
- **Database:** Dashboard → Database → Tables
- **RLS Policies:** Dashboard → Authentication → Policies
- **Storage:** Dashboard → Storage (for file uploads)
- **Logs:** Dashboard → Logs (for debugging)

## Database Clients in Code

### Backend
- File: `backend/services/supabaseClient.js`
- Admin Client: `getSupabaseAdmin()` (service role key)
- Anon Client: `getSupabaseAnon()` (anon key, respects RLS)

### Frontend
- Library: `@supabase/supabase-js`
- Configuration: Uses REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
- Location: `frontend/src/lib/supabaseClient.js` (if exists)

---

**Status:** ✅ Ready for Database Schema Initialization
**Next Action:** Run SQL schema in Supabase Dashboard
