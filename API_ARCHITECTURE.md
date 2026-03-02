# 🏗️ API ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
│                     http://localhost:3000                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTP Requests
                                  │ JWT Authentication
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND API SERVER (Express)                     │
│                     http://localhost:5000/api                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    MIDDLEWARE LAYER                          │  │
│  │  • Helmet (Security Headers)                                 │  │
│  │  • CORS (Cross-Origin)                                       │  │
│  │  • Rate Limiting (100/15min API, 5/15min Auth)              │  │
│  │  • JWT Authentication                                        │  │
│  │  • Joi Validation                                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────── ROUTES ──────────────────────────────┐  │
│  │                                                                │  │
│  │  /api/health           [PUBLIC]                                │  │
│  │    └─ GET /health      Server health check                     │  │
│  │                                                                │  │
│  │  /api/auth             [PUBLIC]                                │  │
│  │    ├─ POST /register   Create user account                     │  │
│  │    └─ POST /login      User authentication                     │  │
│  │                                                                │  │
│  │  /api/wallet           [PROTECTED - 7 endpoints]               │  │
│  │    ├─ POST /create                Create new wallet            │  │
│  │    ├─ GET  /list                  List all wallets             │  │
│  │    ├─ GET  /balance/:addr         Get wallet balance           │  │
│  │    ├─ GET  /balances              Get all balances             │  │
│  │    ├─ POST /import                Import private key           │  │
│  │    ├─ POST /watch-only            Add watch-only wallet        │  │
│  │    └─ GET  /watch-only            Get watch-only wallets       │  │
│  │                                                                │  │
│  │  /api/transactions     [PROTECTED - 8 endpoints]               │  │
│  │    ├─ GET  /history               Database history             │  │
│  │    ├─ GET  /blockchain/:addr      Blockchain history           │  │
│  │    ├─ POST /send                  Send transaction             │  │
│  │    ├─ POST /send-batch            Batch transactions           │  │
│  │    ├─ POST /estimate-gas          Gas estimation               │  │
│  │    ├─ GET  /:id                   Get by ID                    │  │
│  │    ├─ POST /deposit               Deposit funds                │  │
│  │    └─ POST /withdraw              Withdraw funds               │  │
│  │                                                                │  │
│  │  /api/prices           [PUBLIC - 4 endpoints]                  │  │
│  │    ├─ GET /live                   Live prices (CoinGecko)      │  │
│  │    ├─ GET /:coinId                Specific coin price          │  │
│  │    ├─ GET /:coinId/history        Historical data              │  │
│  │    └─ GET /trending/list          Trending coins               │  │
│  │                                                                │  │
│  │  /api/tokens           [PROTECTED - 9 endpoints]               │  │
│  │    ├─ GET    /popular              Popular tokens              │  │
│  │    ├─ GET    /list                 User's tokens               │  │
│  │    ├─ GET    /info/:addr           Token contract info         │  │
│  │    ├─ POST   /add                  Add custom token            │  │
│  │    ├─ GET    /balance/:w/:t        Single token balance        │  │
│  │    ├─ GET    /balances/:wallet     All token balances          │  │
│  │    ├─ POST   /transfer             Transfer tokens             │  │
│  │    ├─ DELETE /:id                  Remove token                │  │
│  │    └─ POST   /refresh/:id          Refresh balance             │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────── SERVICES LAYER ─────────────────────────┐  │
│  │                                                                │  │
│  │  walletService.js                                              │  │
│  │    • Create wallet (HD Wallet)                                 │  │
│  │    • Encrypt/Decrypt private keys                              │  │
│  │    • Get balance from blockchain                               │  │
│  │    • Send transactions                                         │  │
│  │    • Estimate gas fees                                         │  │
│  │                                                                │  │
│  │  tokenService.js                                               │  │
│  │    • Get ERC-20 token info                                     │  │
│  │    • Get token balances                                        │  │
│  │    • Transfer tokens                                           │  │
│  │    • Popular token lists                                       │  │
│  │                                                                │  │
│  │  explorerService.js                                            │  │
│  │    • Etherscan API integration                                 │  │
│  │    • PolygonScan API integration                               │  │
│  │    • BscScan API integration                                   │  │
│  │    • Transaction history                                       │  │
│  │    • Token transactions                                        │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────── DATABASE MODELS ──────────────────────────┐  │
│  │                                                                │  │
│  │  User.js         • Email, password, name, wallets[]            │  │
│  │  Balance.js      • Wallet balances, token balances             │  │
│  │  Transaction.js  • Transaction history, status, hashes         │  │
│  │  Token.js        • Custom tokens, balances, metadata           │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
        ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
        │   MongoDB    │  │  Blockchain │  │  CoinGecko   │
        │   Database   │  │     RPC     │  │     API      │
        │   (Local)    │  │  (Infura)   │  │   (Prices)   │
        └──────────────┘  └─────────────┘  └──────────────┘
           • Users            • Ethereum        • Live prices
           • Balances         • Polygon         • Historical
           • Transactions     • BSC              • Trending
           • Tokens
```

---

## 🔄 Request Flow Example

### Example: User Sends ETH Transaction

```
1. User clicks "Send" in Frontend
   └─> calls transactionAPI.send(data)

2. Frontend API Service (api.js)
   └─> POST http://localhost:5000/api/transactions/send
       Headers: { Authorization: Bearer <JWT_TOKEN> }
       Body: { fromAddress, toAddress, amount, password }

3. Backend Server (server.js)
   └─> Rate Limiter checks: ✓ (under 100 requests)
   └─> CORS checks: ✓
   └─> Routes to: transactions.js

4. Transaction Route (/api/transactions/send)
   └─> Auth Middleware: Validates JWT token ✓
   └─> Validation Middleware: Validates request body (Joi) ✓
   └─> Route Handler:
       ├─ Finds user in MongoDB
       ├─ Verifies wallet ownership
       ├─> walletService.decryptPrivateKey(password)
       ├─> walletService.sendTransaction(privateKey, to, amount)
       │   └─> Connects to Ethereum RPC (Infura)
       │   └─> Signs transaction with ethers.js
       │   └─> Broadcasts to blockchain
       │   └─> Returns transaction hash
       ├─ Saves transaction to MongoDB
       └─ Returns response to frontend

5. Frontend receives response
   └─> Updates UI with transaction hash
   └─> Shows success message
   └─> Refreshes balance
```

---

## 📊 Data Flow Diagram

```
┌──────────────┐
│   Browser    │
│  (Frontend)  │
└──────┬───────┘
       │
       │ 1. User Action
       │
       ▼
┌─────────────────┐
│   React App     │◄──── State Management (useState/useEffect)
│   Components    │
└────────┬────────┘
         │
         │ 2. API Call
         │
         ▼
┌─────────────────┐
│   api.js        │◄──── Axios Interceptor (adds JWT token)
│   (API Service) │
└────────┬────────┘
         │
         │ 3. HTTP Request
         │
         ▼
┌─────────────────┐
│  Express.js     │
│  Server         │
│  (Backend)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│ MongoDB │ │Blockchain│
│Database │ │   RPC    │
└─────────┘ └──────────┘
```

---

## 🔐 Security Architecture

```
┌────────────────────────────────────────┐
│        SECURITY LAYERS                 │
├────────────────────────────────────────┤
│ 1. Helmet                              │
│    ├─ XSS Protection                   │
│    ├─ Content Security Policy          │
│    ├─ X-Frame-Options                  │
│    └─ Strict Transport Security        │
├────────────────────────────────────────┤
│ 2. Rate Limiting                       │
│    ├─ API: 100 req/15min               │
│    └─ Auth: 5 req/15min                │
├────────────────────────────────────────┤
│ 3. JWT Authentication                  │
│    ├─ Token expiry: 7 days             │
│    ├─ Bearer token in header           │
│    └─ User ID in payload               │
├────────────────────────────────────────┤
│ 4. Input Validation (Joi)              │
│    ├─ Email format                     │
│    ├─ Password strength                │
│    ├─ Address format (0x...)           │
│    └─ Amount positivity                │
├────────────────────────────────────────┤
│ 5. Password & Key Security             │
│    ├─ bcrypt (password hashing)        │
│    ├─ AES-256-CBC (key encryption)     │
│    └─ Environment variables            │
├────────────────────────────────────────┤
│ 6. CORS                                │
│    └─ Origin validation                │
└────────────────────────────────────────┘
```

---

## 📦 Technology Stack

### Backend
```
Node.js + Express.js
├─ Security
│  ├─ helmet ^8.1.0
│  ├─ express-rate-limit ^8.2.1
│  ├─ bcryptjs ^2.4.3
│  ├─ jsonwebtoken ^9.0.2
│  └─ joi ^18.0.2
│
├─ Database
│  └─ mongoose ^7.5.0 (MongoDB ODM)
│
├─ Blockchain
│  ├─ ethers ^6.7.1 (Ethereum interaction)
│  └─ web3 ^4.1.1
│
├─ HTTP Client
│  └─ axios ^1.5.0
│
└─ Utilities
   ├─ dotenv ^16.3.1
   └─ crypto (Node.js built-in)
```

### Frontend
```
React 18.2.0
├─ Routing
│  └─ react-router-dom ^6.16.0
│
├─ HTTP Client
│  └─ axios ^1.5.0
│
├─ Blockchain
│  ├─ ethers ^6.7.1
│  └─ web3 ^4.1.1
│
├─ QR Code
│  └─ html5-qrcode ^2.3.8
│
└─ Build
   └─ react-scripts 5.0.1
```

---

## 🎯 API Endpoint Summary

| Category | Public | Protected | Total |
|----------|--------|-----------|-------|
| Health   | 1      | 0         | 1     |
| Auth     | 2      | 0         | 2     |
| Wallet   | 0      | 7         | 7     |
| Transactions | 0  | 8         | 8     |
| Prices   | 4      | 0         | 4     |
| Tokens   | 0      | 9         | 9     |
| **TOTAL** | **7** | **24**   | **31** |

---

## ✅ Status: All Endpoints Connected

**Test Results:** 31/31 Passed (100%)  
**Date:** January 26, 2026  
**Ready for:** Development, Testing, Production
