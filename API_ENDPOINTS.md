# 🔌 API ENDPOINTS DOCUMENTATION

## ✅ All Endpoints Verified and Connected

### Base URL
```
Development: http://localhost:5000/api
Network:     http://192.168.0.102:5000/api
```

---

## 📊 ENDPOINT SUMMARY

### Total Endpoints: 39
- **Auth:** 2 endpoints
- **Wallet:** 7 endpoints
- **Transactions:** 8 endpoints
- **Prices:** 10 endpoints (4 legacy + 6 Blockchair)
- **Tokens:** 9 endpoints
- **Health:** 1 endpoint
- **Protected:** 30 endpoints (require authentication)
- **Public:** 9 endpoints (+ 6 new Blockchair stats)

---

## 🔓 PUBLIC ENDPOINTS (No Authentication Required)

### Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "OK",
  "message": "Crypto Wallet API is running"
}
```

---

## 🔐 AUTHENTICATION ENDPOINTS

### 1. Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64a1234567890abcdef12345",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Validation:**
- Email: Valid email format
- Password: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
- Name: 2-50 characters

### 2. Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** Same as register

---

## 💼 WALLET ENDPOINTS (All require authentication)

**Authentication Header:**
```http
Authorization: Bearer <token>
```

### 1. Create New Wallet
```http
POST /api/wallet/create
Content-Type: application/json

{
  "network": "ethereum",
  "password": "YourSecurePassword123!"
}
```

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "network": "ethereum",
  "mnemonic": "word1 word2 word3 ... word12"
}
```

**Networks:** `ethereum`, `polygon`, `bsc`, `bitcoin`, `btc`

### 2. List All Wallets
```http
GET /api/wallet/list
```

**Response:**
```json
[
  {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    "network": "ethereum",
    "createdAt": "2026-01-26T12:00:00.000Z"
  }
]
```

### 3. Get Wallet Balance
```http
GET /api/wallet/balance/:address?network=ethereum
```

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "network": "ethereum",
  "native": {
    "symbol": "ETH",
    "balance": "1.234567890123456789"
  },
  "tokens": []
}
```

### 4. Get All Balances
```http
GET /api/wallet/balances
```

**Response:** Array of balance objects for all wallets

### 5. Import Existing Wallet
```http
POST /api/wallet/import
Content-Type: application/json

{
  "privateKey": "0x1234567890abcdef...",
  "network": "ethereum",
  "password": "YourSecurePassword123!"
}
```

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "network": "ethereum"
}
```

### 6. Add Watch-Only Wallet
```http
POST /api/wallet/watch-only
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "network": "ethereum",
  "label": "My Watch Wallet"
}
```

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "network": "ethereum",
  "watchOnly": true,
  "label": "My Watch Wallet"
}
```

### 7. Get Watch-Only Wallets
```http
GET /api/wallet/watch-only
```

**Response:** Array of watch-only wallets

---

## 💸 TRANSACTION ENDPOINTS (All require authentication)

### 1. Get Transaction History (Database)
```http
GET /api/transactions/history?limit=50&skip=0&type=send&status=completed
```

**Query Parameters:**
- `limit`: Number of transactions (default: 50)
- `skip`: Pagination offset (default: 0)
- `type`: Filter by type (`send`, `receive`, `deposit`, `withdraw`)
- `status`: Filter by status (`pending`, `completed`, `failed`)

**Response:**
```json
{
  "transactions": [...],
  "total": 150,
  "limit": 50,
  "skip": 0
}
```

### 2. Get Blockchain Transaction History
```http
GET /api/transactions/blockchain/:address?network=ethereum
```

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "network": "ethereum",
  "transactions": [
    {
      "hash": "0xabc123...",
      "from": "0x...",
      "to": "0x...",
      "value": "1000000000000000000",
      "timestamp": 1706284800,
      "blockNumber": 12345678,
      "gasUsed": "21000"
    }
  ],
  "total": 25
}
```

### 3. Send Transaction
```http
POST /api/transactions/send
Content-Type: application/json

{
  "fromAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "toAddress": "0x123...",
  "amount": 0.1,
  "cryptocurrency": "ETH",
  "network": "ethereum",
  "password": "YourSecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Transaction sent successfully",
  "transaction": {
    "id": "64a1234567890abcdef12345",
    "hash": "0xabc123...",
    "status": "completed"
  }
}
```

### 4. Send Batch Transactions
```http
POST /api/transactions/send-batch
Content-Type: application/json

{
  "fromAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "recipients": [
    { "address": "0x123...", "amount": 0.1 },
    { "address": "0x456...", "amount": 0.2 }
  ],
  "cryptocurrency": "ETH",
  "network": "ethereum",
  "password": "YourSecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Batch transaction processing completed",
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  },
  "results": [...]
}
```

### 5. Estimate Gas Fee
```http
POST /api/transactions/estimate-gas
Content-Type: application/json

{
  "toAddress": "0x123...",
  "amount": 0.1,
  "network": "ethereum"
}
```

**Response:**
```json
{
  "gasLimit": "21000",
  "gasPrice": "50000000000",
  "estimatedFee": "0.00105",
  "currency": "ETH"
}
```

### 6. Get Transaction by ID
```http
GET /api/transactions/:id
```

### 7. Deposit Funds
```http
POST /api/transactions/deposit
```

### 8. Withdraw Funds
```http
POST /api/transactions/withdraw
```

---

## 💰 PRICES ENDPOINTS (Public Access)

### 1. Get Live Crypto Prices
```http
GET /api/prices/live?coins=bitcoin,ethereum,binancecoin,matic-network
```

**Response:**
```json
[
  {
    "id": "bitcoin",
    "symbol": "BTC",
    "price": 45000.50,
    "change24h": 2.5,
    "volume24h": 25000000000,
    "marketCap": 880000000000
  }
]
```

### 2. Get Specific Coin Price
```http
GET /api/prices/:coinId
```

**Example:** `/api/prices/bitcoin`

**Response:**
```json
{
  "id": "bitcoin",
  "symbol": "BTC",
  "prices": {
    "usd": 45000.50,
    "eur": 41234.20,
    "gbp": 35678.90
  },
  "change24h": 2.5,
  "volume24h": 25000000000,
  "marketCap": 880000000000,
  "lastUpdated": 1706284800
}
```

### 3. Get Price History
```http
GET /api/prices/:coinId/history?days=7
```

**Query Parameters:**
- `days`: Number of days (1, 7, 14, 30, 90, 365, max)

**Response:**
```json
{
  "coinId": "ethereum",
  "prices": [[1706284800000, 2500.50], ...],
  "marketCaps": [[1706284800000, 300000000000], ...],
  "volumes": [[1706284800000, 15000000000], ...]
}
```

### 4. Get Trending Coins
```http
GET /api/prices/trending/list
```

**Response:**
```json
[
  {
    "id": "bitcoin",
    "name": "Bitcoin",
    "symbol": "BTC",
    "rank": 1,
    "price": 45000.50,
    "image": "https://..."
  }
]
```

### 5. Get Market Data (Blockchair)
```http
GET /api/prices/market/:chain
```

**Supported Chains:** bitcoin, ethereum, litecoin, dogecoin, ripple, stellar, cardano, etc.

**Example:** `/api/prices/market/bitcoin`

**Response:**
```json
{
  "chain": "bitcoin",
  "price": 45000.50,
  "priceBtc": 1,
  "change24h": 2.5,
  "marketCap": 880000000000,
  "dominance": 43.5,
  "circulation": 19500000,
  "timestamp": 1706284800000
}
```

### 6. Get Blockchain Stats (Blockchair)
```http
GET /api/prices/stats/:chain
```

**Supported Chains:** bitcoin, ethereum, litecoin, dogecoin, ripple, stellar, monero, cardano, etc.

**Example:** `/api/prices/stats/bitcoin`

**Response:**
```json
{
  "chain": "bitcoin",
  "stats": {
    "blocks": 850000,
    "transactions": 850000000,
    "difficulty": 73187900000000,
    "hashrate_24h": "500000000000000000000",
    "mempool_transactions": 15000,
    "mempool_size": 45000000,
    "blocks_24h": 144,
    "transactions_24h": 350000,
    "volume_24h": 5000000000000,
    "average_transaction_fee_usd_24h": 2.5,
    "suggested_transaction_fee_per_byte_sat": 10
  },
  "timestamp": 1706284800000
}
```

### 7. Get Network Health (Blockchair)
```http
GET /api/prices/network-health/:chain
```

**Example:** `/api/prices/network-health/bitcoin`

**Response:**
```json
{
  "chain": "bitcoin",
  "health": {
    "mempoolTransactions": 15000,
    "mempoolSize": 45000000,
    "mempoolTps": 5.5,
    "transactions24h": 350000,
    "blocks24h": 144,
    "avgFee24h": 2.5,
    "medianFee24h": 1.8,
    "volume24h": 5000000000000,
    "hashrate24h": "500000000000000000000",
    "difficulty": 73187900000000
  },
  "timestamp": 1706284800000
}
```

### 8. Get Gas Prices (Blockchair - Ethereum/EVM)
```http
GET /api/prices/gas?chain=ethereum
```

**Supported Chains:** ethereum, bsc, polygon, avalanche, arbitrum, optimism

**Response:**
```json
{
  "chain": "ethereum",
  "gasPrices": {
    "sloth": 10,
    "slow": 15,
    "normal": 20,
    "fast": 30,
    "cheetah": 50,
    "mempoolMedian": 18,
    "unit": "gwei"
  },
  "timestamp": 1706284800000
}
```

### 9. Get All Blockchain Stats (Blockchair)
```http
GET /api/prices/all-stats
```

**Response:**
```json
{
  "blockchains": ["bitcoin", "ethereum", "litecoin", ...],
  "stats": {
    "bitcoin": {
      "data": {
        "blocks": 850000,
        "market_price_usd": 45000.50,
        ...
      }
    },
    "ethereum": {
      "data": {
        "blocks": 19000000,
        "market_price_usd": 2500.50,
        ...
      }
    }
  },
  "timestamp": 1706284800000
}
```

### 10. Get ERC-20 Token Stats (Blockchair)
```http
GET /api/prices/erc20
```

**Response:**
```json
{
  "erc20": {
    "tokens": 500000,
    "transactions": 1500000000,
    "tokens_24h": 150,
    "transactions_24h": 1200000
  },
  "timestamp": 1706284800000
}
```

---

## 🪙 TOKEN ENDPOINTS (ERC-20) (All require authentication)

### 1. Get Popular Tokens
```http
GET /api/tokens/popular?network=ethereum
```

**Response:**
```json
{
  "network": "ethereum",
  "tokens": [
    {
      "symbol": "USDT",
      "name": "Tether USD",
      "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "decimals": 6,
      "logoUrl": "https://..."
    }
  ]
}
```

### 2. Get User's Token List
```http
GET /api/tokens/list?walletAddress=0x...&network=ethereum
```

**Response:** Array of user's saved tokens

### 3. Get Token Info
```http
GET /api/tokens/info/:address?network=ethereum
```

**Response:**
```json
{
  "symbol": "USDT",
  "name": "Tether USD",
  "decimals": 6,
  "totalSupply": "1000000000"
}
```

### 4. Add Custom Token
```http
POST /api/tokens/add
Content-Type: application/json

{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "network": "ethereum"
}
```

**Response:**
```json
{
  "message": "Token added successfully",
  "token": {
    "id": "...",
    "symbol": "USDT",
    "name": "Tether USD",
    "decimals": 6,
    "balance": "0"
  }
}
```

### 5. Get Token Balance
```http
GET /api/tokens/balance/:walletAddress/:tokenAddress?network=ethereum
```

**Response:**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "tokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "symbol": "USDT",
  "balance": "100.000000",
  "decimals": 6
}
```

### 6. Get All Token Balances for Wallet
```http
GET /api/tokens/balances/:walletAddress?network=ethereum
```

### 7. Transfer Tokens
```http
POST /api/tokens/transfer
Content-Type: application/json

{
  "fromAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  "toAddress": "0x123...",
  "tokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "amount": 10,
  "network": "ethereum",
  "password": "YourSecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Token transfer successful",
  "transaction": {
    "id": "...",
    "hash": "0xabc123...",
    "status": "completed"
  }
}
```

### 8. Delete Token from List
```http
DELETE /api/tokens/:id
```

### 9. Refresh Token Balance
```http
POST /api/tokens/refresh/:id
```

---

## 🔒 SECURITY & RATE LIMITING

### Rate Limits
- **API Endpoints:** 100 requests per 15 minutes per IP
- **Auth Endpoints:** 5 requests per 15 minutes per IP

### Authentication
All protected endpoints require JWT token in header:
```http
Authorization: Bearer <your_jwt_token>
```

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*)

---

## 🧪 TESTING ENDPOINTS

### Run Automated Tests
```bash
cd backend
node test-endpoints.js
```

This will verify all 33 endpoints are properly connected and responding.

---

## 📝 ERROR RESPONSES

### Standard Error Format
```json
{
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## 🚀 FRONTEND INTEGRATION

All endpoints are already integrated in the frontend via:
```javascript
// frontend/src/services/api.js

import { authAPI, walletAPI, transactionAPI, pricesAPI, tokenAPI } from './services/api';

// Examples:
await authAPI.login({ email, password });
await walletAPI.create({ network: 'ethereum', password });
await transactionAPI.send({ fromAddress, toAddress, amount, password });
await pricesAPI.getLivePrices('bitcoin,ethereum');
await tokenAPI.add({ walletAddress, contractAddress, network });
```

---

**Last Updated:** January 26, 2026  
**Total Endpoints:** 33  
**Status:** ✅ All Connected and Functional
