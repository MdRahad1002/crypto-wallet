const Token = require('../models/Token');
const walletService = require('../utils/walletService');
const TokenService = require('../services/tokenService');
const logger = require('../core/logger');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

const tokenService = new TokenService(walletService);

async function refreshTokenBalances(batchSize) {
  const tokens = await Token.find({})
    .sort({ lastUpdated: 1 })
    .limit(batchSize);

  for (const token of tokens) {
    try {
      const balance = await tokenService.getTokenBalance(
        token.walletAddress,
        token.contractAddress,
        token.network
      );
      token.balance = balance;
      token.lastUpdated = Date.now();
      await token.save();
    } catch (error) {
      logger.error('balanceRefresher failed', {
        tokenId: token._id,
        message: error.message
      });
    }
  }
}

function startBalanceRefresher({ intervalMs = DEFAULT_INTERVAL_MS, batchSize = DEFAULT_BATCH_SIZE } = {}) {
  logger.info('balanceRefresher started', { intervalMs, batchSize });

  const timer = setInterval(() => {
    refreshTokenBalances(batchSize).catch((error) => {
      logger.error('balanceRefresher loop error', { message: error.message });
    });
  }, intervalMs);

  timer.unref?.();
  return timer;
}

module.exports = {
  startBalanceRefresher
};
