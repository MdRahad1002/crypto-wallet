const axios = require('axios');

// Binance public klines API — high rate limits but blocked on some US cloud IPs
const BINANCE_SYMBOL      = { bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', tether: null };
// CryptoCompare — already used for live prices, reliable from Vercel cloud IPs
const CRYPTOCOMPARE_SYMBOL = { bitcoin: 'BTC',     ethereum: 'ETH',     tether: null };

const cache = new Map();

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) { cache.delete(key); return null; }
  return item.data;
}

function setCache(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const REQUEST_TIMEOUT = 8000;

async function fetchFromBinance(coinId, days) {
  const symbol = BINANCE_SYMBOL[coinId];
  if (!symbol) throw new Error(`No Binance symbol for ${coinId}`);

  const interval = days <= 7 ? '1h' : '1d';
  const limit    = days <= 7 ? days * 24 : days;

  const res = await axios.get('https://api.binance.com/api/v3/klines', {
    params: { symbol, interval, limit },
    timeout: REQUEST_TIMEOUT,
  });

  // Binance kline: [openTime, open, high, low, close, ...]
  const prices = res.data.map(k => [k[0], parseFloat(k[4])]);
  if (!prices.length) throw new Error('Binance returned empty data');
  return { prices };
}

/**
 * CryptoCompare histohour / histoday — no API key required, works from cloud IPs.
 * Already used for live price cards so we know it's reachable from Vercel.
 */
async function fetchFromCryptoCompare(coinId, days) {
  const symbol = CRYPTOCOMPARE_SYMBOL[coinId];
  if (!symbol) throw new Error(`No CryptoCompare symbol for ${coinId}`);

  const endpoint = days <= 7 ? 'histohour' : 'histoday';
  const limit    = days <= 7 ? days * 24    : days;

  const res = await axios.get(`https://min-api.cryptocompare.com/data/v2/${endpoint}`, {
    params: { fsym: symbol, tsym: 'USD', limit },
    timeout: REQUEST_TIMEOUT,
  });

  if (res.data?.Response !== 'Success') throw new Error('CryptoCompare non-success response');

  const prices = (res.data?.Data?.Data || [])
    .map(k => [k.time * 1000, parseFloat(k.close)])
    .filter(([, p]) => p > 0);

  if (!prices.length) throw new Error('CryptoCompare returned empty data');
  return { prices };
}

async function getUsdMarketChart(coinId, days) {
  const key = `chart:${coinId}:${days}`;
  const cached = getCache(key);
  if (cached) return cached;

  // Tether is always ~$1 — skip network call entirely
  if (coinId === 'tether') {
    const data = generateTetherData(days);
    setCache(key, data, 5 * 60 * 1000);
    return data;
  }

  // 1st choice: Binance (best resolution, but blocked on some US cloud IPs)
  try {
    const data = await fetchFromBinance(coinId, days);
    setCache(key, data, 5 * 60 * 1000);
    return data;
  } catch (_) {}

  // 2nd choice: CryptoCompare (already works for live prices on this deployment)
  try {
    const data = await fetchFromCryptoCompare(coinId, days);
    setCache(key, data, 5 * 60 * 1000);
    return data;
  } catch (_) {}

  // Last resort: random-walk demo centred on a plausible current price
  const demo = generateDemoData(coinId, days);
  setCache(key, demo, 60 * 1000);
  return demo;
}

function generateTetherData(days) {
  const intervalMs  = days <= 7 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const totalPoints = days <= 7 ? days * 24 : days;
  const now = Date.now();
  const prices = [];
  for (let i = totalPoints; i >= 0; i--) {
    prices.push([now - i * intervalMs, 1.0]);
  }
  return { prices };
}

function generateDemoData(coinId, days) {
  // Keep these in sync with reality — only used when both Binance and
  // CryptoCompare are unreachable, which should be extremely rare.
  const BASE_PRICES = { bitcoin: 62000, ethereum: 2400 };
  const VOLATILITY  = { bitcoin: 0.018,  ethereum: 0.022 };

  const basePrice  = BASE_PRICES[coinId] ?? 100;
  const volatility = VOLATILITY[coinId]  ?? 0.015;

  const intervalMs  = days <= 7 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const totalPoints = days <= 7 ? days * 24 : days;
  const now = Date.now();
  const prices = [];
  let price = basePrice * (0.92 + Math.random() * 0.16);

  for (let i = totalPoints; i >= 0; i--) {
    const ts = now - i * intervalMs;
    const change = (Math.random() - 0.5) * 2 * volatility;
    price = Math.max(price * (1 + change), basePrice * 0.5);
    prices.push([ts, parseFloat(price.toFixed(2))]);
  }

  return { prices };
}

module.exports = { getUsdMarketChart };
