# 🔗 Blockchair Integration Guide

## Overview

Blockchair is now integrated as a multi-chain blockchain explorer supporting 40+ blockchains. It provides enhanced Bitcoin support and automatic fallback for all chains.

## Features

### ✅ **Enhanced Bitcoin Support**
- Better transaction history than Blockstream
- Mempool data for accurate fee estimation
- Detailed UTXO information
- Transaction count and full address statistics

### ✅ **Multi-Chain Support**
- Bitcoin, Ethereum, Litecoin, Dogecoin
- Bitcoin Cash, Ripple, Cardano, Polkadot
- BSC, Polygon (as fallback)
- 40+ total blockchains

### ✅ **Automatic Fallback System**
- If Etherscan API fails → Try Blockchair
- If API key missing → Try Blockchair
- If primary returns no data → Try Blockchair

### ✅ **Additional Features**
- Mempool statistics
- Recommended transaction fees
- Rate limit tracking
- Detailed transaction data

---

## Getting Your API Key

### 1. Visit Blockchair
Go to: https://blockchair.com/api

### 2. Sign Up (Free)
- Click "Get Started" or "Sign Up"
- No credit card required
- Email verification needed

### 3. Create API Key
- Go to your dashboard
- Generate new API key
- Copy the key

### 4. Free Tier Limits
- **1,440 requests per day** (1 per minute)
- Rate resets at midnight UTC
- No expiration

### 5. Paid Plans (Optional)
- **Analyst**: $99/mo - 144,000 req/day
- **Developer**: $599/mo - 1.44M req/day
- **Enterprise**: Custom pricing

---

## Configuration

### Add to `.env` File

```env
# Blockchair API Key
BLOCKCHAIR_API_KEY=your_blockchair_api_key_here

# Enable Blockchair for Bitcoin (default: true)
USE_BLOCKCHAIR_FOR_BTC=true

# Enable Blockchair as fallback for all chains (default: true)
USE_BLOCKCHAIR_FALLBACK=true
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `BLOCKCHAIR_API_KEY` | `''` | Your Blockchair API key |
| `USE_BLOCKCHAIR_FOR_BTC` | `true` | Use Blockchair as primary for Bitcoin |
| `USE_BLOCKCHAIR_FALLBACK` | `true` | Use as fallback for all chains |

---

## How It Works

### Bitcoin Transactions
```
1. User requests Bitcoin balance/transactions
2. System checks USE_BLOCKCHAIR_FOR_BTC
3. If enabled and API key exists:
   → Try Blockchair first
   → If fails, fallback to Blockstream
4. If disabled or no key:
   → Use Blockstream directly
```

### Ethereum/Polygon/BSC Transactions
```
1. User requests transactions
2. System tries primary explorer (Etherscan/etc)
3. If primary fails and USE_BLOCKCHAIR_FALLBACK=true:
   → Try Blockchair as fallback
   → Return Blockchair data if available
4. If both fail:
   → Return empty array or error
```

---

## API Endpoints Using Blockchair

### Existing Endpoints (Enhanced)

#### Bitcoin Balance
```http
GET /api/wallet/balance/:network/:address
```

**Enhancement**: Now returns more detailed Bitcoin data when Blockchair is enabled:
```json
{
  "confirmedSats": 1000000,
  "unconfirmedSats": 50000,
  "totalSats": 1050000,
  "totalBtc": 0.0105,
  "transactionCount": 42
}
```

#### Bitcoin Transactions
```http
GET /api/transactions/blockchain/:address?network=bitcoin
```

**Enhancement**: Better transaction data with Blockchair

#### Ethereum Fallback
```http
GET /api/transactions/blockchain/:address?network=ethereum
```

**Fallback**: If Etherscan fails, automatically tries Blockchair

---

## Supported Blockchains

### Primary Support
- ✅ **Bitcoin** (BTC)
- ✅ **Ethereum** (ETH)
- ✅ **Litecoin** (LTC)
- ✅ **Dogecoin** (DOGE)
- ✅ **Bitcoin Cash** (BCH)
- ✅ **BSC** (BNB)
- ✅ **Polygon** (MATIC)

### Additional Chains (via Blockchair)
- Cardano, Polkadot, Ripple
- Stellar, Monero, Zcash
- Dash, Groestlcoin, Mixin
- And 30+ more...

---

## Testing Your Integration

### 1. Check API Key Status

Run in PowerShell:
```powershell
# Test Blockchair API
$headers = @{}
$response = Invoke-RestMethod -Uri "https://api.blockchair.com/bitcoin/stats?key=YOUR_KEY" -Headers $headers
$response
```

### 2. Test Bitcoin Balance

Using your app:
```javascript
// In browser console or API test
fetch('/api/wallet/balance/bitcoin/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
  .then(r => r.json())
  .then(console.log);
```

### 3. Test Transactions

```javascript
fetch('/api/transactions/blockchain/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?network=bitcoin')
  .then(r => r.json())
  .then(console.log);
```

### 4. Check Logs

Look for these log messages:
```
Fetching Bitcoin balance via Blockchair
Blockchair failed, falling back to Blockstream
trying_blockchair_fallback
primary_api_error_trying_blockchair
```

---

## Rate Limits

### Free Tier
- **Requests**: 1,440 per day
- **Rate**: 1 request per minute
- **Reset**: Midnight UTC

### Monitoring Usage

```javascript
// Check rate limit status (requires API key)
const blockchairService = require('./backend/services/blockchairService');
const status = await blockchairService.getRateLimitStatus();
console.log(status);
```

### Best Practices
1. Cache responses when possible
2. Use Blockchair for Bitcoin primarily
3. Let it fallback for other chains
4. Monitor daily usage
5. Upgrade if you exceed limits

---

## Troubleshooting

### "Missing API key"
**Solution**: Add `BLOCKCHAIR_API_KEY` to `.env` file

### "Rate limit exceeded"
**Solution**: 
- Wait until midnight UTC
- Upgrade to paid plan
- Disable `USE_BLOCKCHAIR_FOR_BTC` temporarily

### "Blockchair failed"
**Solution**: 
- Check API key is valid
- Verify network connectivity
- Check Blockchair status: https://blockchair.com
- System will automatically fallback to Blockstream

### No transactions returned
**Solution**:
- Bitcoin takes time to sync
- Check address has transactions
- Try with known address: `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`

---

## Comparison

| Feature | Blockstream | Blockchair | Etherscan |
|---------|------------|-----------|-----------|
| Bitcoin Support | ✅ Basic | ✅ **Advanced** | ❌ No |
| Ethereum Support | ❌ No | ✅ Basic | ✅ **Advanced** |
| Multi-chain | ❌ No | ✅ **40+ chains** | ❌ EVM only |
| Free Tier | ✅ Unlimited | ⚠️ 1,440/day | ✅ 100K/day |
| Mempool Data | ✅ Yes | ✅ **Yes** | ❌ No |
| Fee Estimation | ⚠️ Basic | ✅ **Advanced** | ✅ Yes |
| API Key Required | ❌ No | ✅ Yes | ✅ Yes |

---

## Migration Notes

### From Blockstream Only
If you were using only Blockstream:
1. Add Blockchair API key to `.env`
2. Set `USE_BLOCKCHAIR_FOR_BTC=true`
3. Restart server
4. Bitcoin queries now use Blockchair first

### Keeping Blockstream
If you want to keep using Blockstream:
1. Set `USE_BLOCKCHAIR_FOR_BTC=false`
2. Blockchair will only be used as fallback
3. Or don't add `BLOCKCHAIR_API_KEY` at all

---

## Advanced Features

### Get Mempool Data
```javascript
const blockchairService = require('./backend/services/blockchairService');
const mempool = await blockchairService.getMempoolData();
console.log(mempool);
```

### Get Recommended Fees
```javascript
const fees = await blockchairService.getRecommendedFees();
// Returns: { low: 1, medium: 5, high: 10, unit: 'sat/byte' }
```

### Check If Key Configured
```javascript
const hasKey = blockchairService.hasApiKey();
console.log('Blockchair configured:', hasKey);
```

---

## Resources

- **API Documentation**: https://blockchair.com/api/docs
- **Status Page**: https://blockchair.com/status
- **Support**: support@blockchair.com
- **Changelog**: https://blockchair.com/api/changelog

---

## Summary

✅ **Blockchair is now integrated!**

**What you get:**
- Better Bitcoin transaction history
- Multi-chain support (40+ blockchains)
- Automatic fallback system
- Mempool data and fee estimation
- Free tier: 1,440 requests/day

**Next steps:**
1. Get API key: https://blockchair.com/api
2. Add to `.env`: `BLOCKCHAIR_API_KEY=your_key`
3. Restart server
4. Test with Bitcoin address

**Questions?** Check logs for `Blockchair` messages to see when it's being used.
