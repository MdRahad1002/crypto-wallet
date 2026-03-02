# Blockchair API Quick Reference

## Official Documentation
https://blockchair.com/api/docs

## Base URL
```
https://api.blockchair.com
```

## Authentication
Add your API key as a query parameter:
```
?key=YOUR_API_KEY
```

## Core Endpoints Used

### 1. Address Dashboard
**Endpoint:** `/{blockchain}/dashboards/address/{address}`

**Example:**
```
GET https://api.blockchair.com/bitcoin/dashboards/address/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?key=YOUR_KEY
```

**Response Structure:**
```json
{
  "data": {
    "{address}": {
      "address": {
        "balance": 0,
        "unconfirmed_balance": 0,
        "transaction_count": 123,
        "first_seen_receiving": "2009-01-03 18:15:05",
        "last_seen_receiving": "2023-01-15 10:30:00",
        "first_seen_spending": "2009-01-12 03:30:25",
        "last_seen_spending": "2023-01-20 15:45:00"
      },
      "transactions": ["hash1", "hash2", ...],
      "utxo": [...]
    }
  },
  "context": {
    "code": 200,
    "state": 12345678,
    "cache": {...},
    "api": {...},
    "request_cost": 1
  }
}
```

### 2. Bitcoin Stats
**Endpoint:** `/bitcoin/stats`

**Example:**
```
GET https://api.blockchair.com/bitcoin/stats?key=YOUR_KEY
```

**Returns:**
- Network statistics
- Suggested transaction fee per byte
- Mempool size
- Block height

### 3. Ethereum Dashboard (EVM Chains)
**Endpoint:** `/ethereum/dashboards/address/{address}`

**Note:** For Ethereum/EVM chains, the response uses `calls` instead of `transactions`:
```json
{
  "data": {
    "{address}": {
      "address": {
        "balance": "1234567890000000000",
        "balance_usd": 1234.56,
        "nonce": 42
      },
      "calls": [{
        "block_id": 12345678,
        "transaction_hash": "0x...",
        "sender": "0x...",
        "recipient": "0x...",
        "value": "1000000000000000000",
        "time": "2023-01-15 10:30:00"
      }]
    }
  }
}
```

## Supported Blockchains

### Bitcoin Family
- `bitcoin` - Bitcoin
- `bitcoin-cash` - Bitcoin Cash
- `litecoin` - Litecoin
- `dogecoin` - Dogecoin
- `dash` - Dash
- `zcash` - Zcash
- `groestlcoin` - Groestlcoin

### Ethereum Family (EVM)
- `ethereum` - Ethereum
- `bnb` - BNB Smart Chain
- `polygon` - Polygon
- `avalanche` - Avalanche C-Chain
- `arbitrum` - Arbitrum
- `optimism` - Optimism

### Other Chains
- `cardano` - Cardano
- `ripple` - Ripple (XRP)
- `stellar` - Stellar
- `monero` - Monero
- `polkadot` - Polkadot
- And 25+ more...

## Rate Limits

### Free Tier (No API Key)
- **Requests:** 1 per minute
- **Daily:** ~1,440 requests
- **Limitations:** May have delayed data

### With API Key (Free)
- **Requests:** 1,440 per day
- **Rate:** ~1 per minute sustained
- **Resets:** Midnight UTC

### Paid Plans
| Plan | Price | Requests/Day | Rate |
|------|-------|--------------|------|
| Analyst | $99/mo | 144,000 | 100/min |
| Developer | $599/mo | 1,440,000 | 1,000/min |
| Enterprise | Custom | Unlimited | Custom |

## Request Cost

Each API call has a "cost" which counts toward your limit:
- Simple queries: 1 cost
- Dashboard endpoints: 1-10 cost
- Complex aggregations: 10+ cost

Check the `context.request_cost` in the response.

## Common Parameters

### Pagination
```
?offset=0&limit=100
```

### Sorting
```
?s=time(desc)
```

### Filtering (specific endpoints)
```
?q=time(2023-01-01..)
```

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 402 | Payment required / Rate limit exceeded |
| 404 | Resource not found |
| 429 | Too many requests |
| 500 | Internal server error |

## Error Response Example
```json
{
  "context": {
    "code": 402,
    "error": "Request limit exceeded",
    "limit": 1440,
    "remaining": 0,
    "reset_time": "2023-01-16 00:00:00"
  }
}
```

## Best Practices

### 1. Cache Responses
```javascript
// Cache address data for 5 minutes
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getCachedBalance(address) {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await blockchairService.getBitcoinBalance(address);
  cache.set(address, { data, timestamp: Date.now() });
  return data;
}
```

### 2. Handle Rate Limits
```javascript
async function requestWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429) {
        const waitTime = 60000; // Wait 1 minute
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Monitor Usage
```javascript
// Track daily usage
let requestCount = 0;
let resetDate = new Date().toDateString();

function trackRequest() {
  const today = new Date().toDateString();
  if (today !== resetDate) {
    requestCount = 0;
    resetDate = today;
  }
  requestCount++;
  console.log(`Daily requests: ${requestCount}/1440`);
}
```

### 4. Use Appropriate Endpoints
- For balance only: Use dashboard (lower cost)
- For transactions: Use dashboard with transactions
- For analytics: Use dedicated analytics endpoints

## Testing Your Integration

### Quick Test (PowerShell)
```powershell
# Without API key
$response = Invoke-RestMethod -Uri "https://api.blockchair.com/bitcoin/stats"
$response

# With API key
$key = "YOUR_API_KEY"
$response = Invoke-RestMethod -Uri "https://api.blockchair.com/bitcoin/stats?key=$key"
$response.context
```

### Using the Test Script
```bash
node backend/scripts/testBlockchair.js
```

## Example Use Cases

### Get Bitcoin Balance
```javascript
const balance = await blockchairService.getBitcoinBalance(address);
console.log(`Balance: ${balance.totalBtc} BTC`);
```

### Get Transaction History
```javascript
const txs = await blockchairService.getBitcoinTransactions(address);
console.log(`Found ${txs.length} transactions`);
```

### Get Current Fees
```javascript
const fees = await blockchairService.getRecommendedFees();
console.log(`Recommended fee: ${fees.medium} sat/byte`);
```

### Check Rate Limit
```javascript
const status = await blockchairService.getRateLimitStatus();
console.log(`Remaining: ${status.remaining}/${status.limit}`);
```

## Common Issues

### "Request limit exceeded"
**Solution:** Wait until midnight UTC or upgrade plan

### "Invalid API key"
**Solution:** Check `.env` file has correct `BLOCKCHAIR_API_KEY`

### Slow responses
**Solution:** 
- Implement caching
- Use pagination
- Request fewer fields

### Missing data
**Solution:**
- Check blockchain name spelling
- Verify address format
- Some chains have delayed indexing

## Additional Resources

- **API Docs:** https://blockchair.com/api/docs
- **Status Page:** https://blockchair.com/status  
- **Changelog:** https://blockchair.com/api/changelog
- **Support:** support@blockchair.com
- **Pricing:** https://blockchair.com/api/pricing

## Stats Endpoints Usage

### Get All Blockchain Stats at Once
```javascript
// Single call for 15+ blockchains
const allStats = await blockchairService.getAllStats();
console.log(allStats.bitcoin.data.blocks);
console.log(allStats.ethereum.data.market_price_usd);
```

### Get Bitcoin Stats
```javascript
const btcStats = await blockchairService.getBitcoinLikeStats('bitcoin');
console.log(`Blocks: ${btcStats.blocks}`);
console.log(`Hashrate: ${btcStats.hashrate_24h}`);
console.log(`Mempool: ${btcStats.mempool_transactions} txs`);
console.log(`Suggested Fee: ${btcStats.suggested_transaction_fee_per_byte_sat} sat/byte`);
```

### Get Ethereum Stats  
```javascript
const ethStats = await blockchairService.getEthereumLikeStats('ethereum');
console.log(`Blocks: ${ethStats.blocks}`);
console.log(`ERC-20 Tokens: ${ethStats.layer_2.erc_20.tokens}`);
console.log(`Gas Prices:`, ethStats.suggested_transaction_fee_gwei_options);
```

### Get Gas Prices (Ethereum/EVM Chains)
```javascript
const gasPrices = await blockchairService.getGasPrices('ethereum');
console.log(`Slow: ${gasPrices.slow} gwei`);
console.log(`Normal: ${gasPrices.normal} gwei`);
console.log(`Fast: ${gasPrices.fast} gwei`);
```

### Get Market Data for Any Chain
```javascript
const marketData = await blockchairService.getMarketData('bitcoin');
console.log(`Price: $${marketData.priceUsd}`);
console.log(`24h Change: ${marketData.change24h}%`);
console.log(`Market Cap: $${marketData.marketCap}`);
console.log(`Dominance: ${marketData.dominance}%`);
```

### Get Network Health
```javascript
const health = await blockchairService.getNetworkHealth('bitcoin');
console.log(`Mempool TPS: ${health.mempoolTps}`);
console.log(`24h Transactions: ${health.transactions24h}`);
console.log(`Hashrate: ${health.hashrate24h}`);
```

### Get Stats with Auto-Detection
```javascript
// Automatically detects chain type
const stats = await blockchairService.getStats('bitcoin');     // Bitcoin-like
const stats2 = await blockchairService.getStats('ethereum');   // Ethereum-like
const stats3 = await blockchairService.getStats('ripple');     // Ripple
const stats4 = await blockchairService.getStats('xrp');        // Ripple (alias)
```

### Supported Chains for Stats

**Bitcoin-like:**
- bitcoin, bitcoin-cash, litecoin, dogecoin, dash, zcash, groestlcoin, ecash

**Ethereum-like:**
- ethereum, bnb, polygon, avalanche, arbitrum, optimism

**Special Chains:**
- ripple (xrp), stellar (xlm), monero (xmr), cardano (ada), mixin (xin)

### ERC-20 Token Stats
```javascript
const erc20 = await blockchairService.getErc20Stats();
console.log(`Total Tokens: ${erc20.tokens}`);
console.log(`24h Transactions: ${erc20.transactions_24h}`);
```

### Ripple Stats
```javascript
const xrpStats = await blockchairService.getRippleStats();
console.log(`Ledgers: ${xrpStats.ledgers}`);
console.log(`TPS: ${xrpStats.mempool_tps}`);
```

### Omni Layer Stats (Bitcoin Second Layer)
```javascript
const omniStats = await blockchairService.getOmniStats();
console.log(`Properties: ${omniStats.properties}`);
console.log(`Tether (USDT): ${omniStats.latest_transactions[0]}`);
```

## Integration Status

✅ **Implemented:**
- Bitcoin balance and transactions
- Ethereum fallback support
- Automatic failover from Etherscan
- Mempool data
- Fee recommendations
- **All blockchain stats endpoints (15+ chains)**
- **Market data extraction**
- **Network health metrics** 
- **Gas price recommendations**
- **ERC-20 token statistics**
- **Multi-chain stats (single API call)**
- **Auto-detection of chain types**

⏳ **Coming Soon:**
- WebSocket streaming
- Bulk address queries
- Advanced analytics dashboards
