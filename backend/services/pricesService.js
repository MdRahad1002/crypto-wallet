/**
 * Prices Service
 * Handles cryptocurrency price fetching from external APIs
 * Includes caching, error handling, and metrics
 */

const axios = require('axios');
const { APIService } = require('./BaseService');

const COINGECKO_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 15000; // 15 seconds

// CryptoCompare fallback — no API key required, reliable from cloud IPs
async function fetchLivePricesFromCryptoCompare() {
  const res = await axios.get(
    'https://min-api.cryptocompare.com/data/pricemultifull',
    { params: { fsyms: 'BTC,ETH,USDT', tsyms: 'USD' }, timeout: 5000 }
  );
  const raw = res.data?.RAW || {};
  return {
    bitcoin:  { usd: raw.BTC?.USD?.PRICE  || 0, usd_24h_change: raw.BTC?.USD?.CHANGEPCT24HOUR  || 0 },
    ethereum: { usd: raw.ETH?.USD?.PRICE  || 0, usd_24h_change: raw.ETH?.USD?.CHANGEPCT24HOUR  || 0 },
    tether:   { usd: raw.USDT?.USD?.PRICE || 1, usd_24h_change: raw.USDT?.USD?.CHANGEPCT24HOUR || 0 }
  };
}

/**
 * PricesService - Manages cryptocurrency price data
 */
class PricesService extends APIService {
  constructor() {
    super('PricesService', COINGECKO_URL, {
      timeout: 8000,
      retryAttempts: 3
    });
  }

  /**
   * Get live USD prices for major cryptocurrencies
   * Includes caching with 15-second TTL
   */
  async getLiveUsdPrices() {
    return this.executeWithTracking('getLiveUsdPrices', async () => {
      const cacheKey = 'live_usd_prices';
      const cached = this.getCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Try CoinGecko first; fall back to CryptoCompare on Vercel/cloud IPs
      // where CoinGecko's free tier is aggressively rate-limited.
      try {
        const response = await axios.get(`${COINGECKO_URL}/simple/price`, {
          params: {
            ids: 'bitcoin,ethereum,tether',
            vs_currencies: 'usd',
            include_24hr_change: true
          },
          timeout: 5000
        });
        this.setCache(cacheKey, response.data, CACHE_TTL);
        return response.data;
      } catch (_cgErr) {
        // CoinGecko failed — fall back to CryptoCompare
      }

      const data = await fetchLivePricesFromCryptoCompare();
      this.setCache(cacheKey, data, CACHE_TTL);
      return data;
    });
  }

  /**
   * Get prices for specific tokens
   */
  async getPricesForTokens(tokenIds = ['bitcoin', 'ethereum', 'tether']) {
    return this.executeWithTracking('getPricesForTokens', async () => {
      this.validateRequired({ tokenIds }, ['tokenIds']);

      const response = await axios.get(COINGECKO_URL, {
        params: {
          ids: tokenIds.join(','),
          vs_currencies: 'usd',
          include_24hr_change: true
        },
        timeout: this.timeout
      });

      return response.data;
    });
  }

  /**
   * Get prices with fallback
   */
  async getLiveUsdPricesWithFallback() {
    try {
      return await this.getLiveUsdPrices();
    } catch (error) {
      this.log('warn', 'getLiveUsdPrices_failed_fallback', {
        errorMessage: error.message
      });

      // Return zero prices as fallback
      return {
        bitcoin: { usd: 0, usd_24h_change: 0 },
        ethereum: { usd: 0, usd_24h_change: 0 },
        tether: { usd: 1, usd_24h_change: 0 }
      };
    }
  }

  /**
   * Invalidate price cache
   */
  invalidateCache() {
    this.clearCache();
    this.log('info', 'cache_invalidated', {});
  }
}

// Export singleton instance
const pricesService = new PricesService();

module.exports = {
  getLiveUsdPrices: () => pricesService.getLiveUsdPrices(),
  getPricesForTokens: (tokenIds) => pricesService.getPricesForTokens(tokenIds),
  getLiveUsdPricesWithFallback: () => pricesService.getLiveUsdPricesWithFallback(),
  invalidateCache: () => pricesService.invalidateCache(),
  // Export instance for advanced usage
  instance: pricesService
};
