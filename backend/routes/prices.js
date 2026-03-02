const express = require('express');
const router = express.Router();
const { getLiveUsdPrices } = require('../services/pricesService');
const { getUsdMarketChart } = require('../services/pricesHistoryService');
const blockchairService = require('../services/blockchairService');

// Get live crypto prices (USD-only)
router.get('/live', async (req, res, next) => {
  try {
    const data = await getLiveUsdPrices();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/history/bitcoin?days=7
router.get('/history/:coinId', async (req, res, next) => {
  try {
    const { coinId } = req.params;
    const days = Number(req.query.days || 7);

    const allowed = new Set(['bitcoin', 'ethereum', 'tether']);
    if (!allowed.has(coinId)) {
      return res.status(400).json({ message: 'Unsupported coinId' });
    }

    if (![7, 30].includes(days)) {
      return res.status(400).json({ message: 'days must be 7 or 30' });
    }

    const data = await getUsdMarketChart(coinId, days);
    const points = (data.prices || []).map(([ts, price]) => ({ t: ts, p: price }));

    res.json({ coinId, days, points });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/market/:chain - Get comprehensive market data from Blockchair
router.get('/market/:chain', async (req, res, next) => {
  try {
    const { chain } = req.params;
    const marketData = await blockchairService.getMarketData(chain);
    
    if (!marketData) {
      return res.status(404).json({ message: `Market data not found for ${chain}` });
    }
    
    res.json({
      chain,
      price: marketData.priceUsd,
      priceBtc: marketData.priceBtc,
      change24h: marketData.change24h,
      marketCap: marketData.marketCap,
      dominance: marketData.dominance,
      circulation: marketData.circulation,
      timestamp: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/stats/:chain - Get blockchain statistics
router.get('/stats/:chain', async (req, res, next) => {
  try {
    const { chain } = req.params;
    const stats = await blockchairService.getStats(chain);
    
    if (!stats) {
      return res.status(404).json({ message: `Stats not found for ${chain}` });
    }
    
    res.json({
      chain,
      stats,
      timestamp: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/network-health/:chain - Get network health metrics
router.get('/network-health/:chain', async (req, res, next) => {
  try {
    const { chain } = req.params;
    const health = await blockchairService.getNetworkHealth(chain);
    
    if (!health) {
      return res.status(404).json({ message: `Network health data not found for ${chain}` });
    }
    
    res.json({
      chain,
      health,
      timestamp: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/gas - Get Ethereum gas prices
router.get('/gas', async (req, res, next) => {
  try {
    const chain = req.query.chain || 'ethereum';
    const gasPrices = await blockchairService.getGasPrices(chain);
    
    if (!gasPrices) {
      return res.status(404).json({ message: `Gas prices not available for ${chain}` });
    }
    
    res.json({
      chain,
      gasPrices,
      timestamp: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/all-stats - Get all blockchain stats at once
router.get('/all-stats', async (req, res, next) => {
  try {
    const allStats = await blockchairService.getAllStats();
    
    res.json({
      blockchains: Object.keys(allStats),
      stats: allStats,
      timestamp: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/erc20 - Get ERC-20 token statistics
router.get('/erc20', async (req, res, next) => {
  try {
    const erc20Stats = await blockchairService.getErc20Stats();
    
    if (!erc20Stats) {
      return res.status(404).json({ message: 'ERC-20 stats not available' });
    }
    
    res.json({
      erc20: erc20Stats,
      timestamp: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
