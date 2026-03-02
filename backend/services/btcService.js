const axios = require('axios');
const logger = require('../core/logger');
const blockchairService = require('./blockchairService');

const BASE_URL = process.env.BTC_API_URL || 'https://blockstream.info/api';
const USE_BLOCKCHAIR = process.env.USE_BLOCKCHAIR_FOR_BTC !== 'false'; // Default to true

async function getBalance(address) {
  // Try Blockchair first if enabled and has API key
  if (USE_BLOCKCHAIR && blockchairService.hasApiKey()) {
    try {
      logger.info('Fetching Bitcoin balance via Blockchair');
      return await blockchairService.getBitcoinBalance(address);
    } catch (error) {
      logger.warn('Blockchair failed, falling back to Blockstream', { message: error.message });
    }
  }

  // Fallback to Blockstream
  try {
    const response = await axios.get(`${BASE_URL}/address/${address}`);
    const { chain_stats, mempool_stats } = response.data || {};

    const confirmed = (chain_stats?.funded_txo_sum || 0) - (chain_stats?.spent_txo_sum || 0);
    const unconfirmed = (mempool_stats?.funded_txo_sum || 0) - (mempool_stats?.spent_txo_sum || 0);

    const totalSats = confirmed + unconfirmed;
    return {
      confirmedSats: confirmed,
      unconfirmedSats: unconfirmed,
      totalSats,
      totalBtc: totalSats / 1e8
    };
  } catch (error) {
    logger.error('BTC balance fetch failed', { message: error.message });
    throw error;
  }
}

async function getTransactions(address) {
  // Try Blockchair first if enabled and has API key
  if (USE_BLOCKCHAIR && blockchairService.hasApiKey()) {
    try {
      logger.info('Fetching Bitcoin transactions via Blockchair');
      const txs = await blockchairService.getBitcoinTransactions(address);
      if (txs && txs.length > 0) {
        // Return raw Blockchair data (already formatted)
        return txs;
      }
    } catch (error) {
      logger.warn('Blockchair failed, falling back to Blockstream', { message: error.message });
    }
  }

  // Fallback to Blockstream
  try {
    const response = await axios.get(`${BASE_URL}/address/${address}/txs`);
    return response.data || [];
  } catch (error) {
    logger.error('BTC transactions fetch failed', { message: error.message });
    throw error;
  }
}

function mapTransactions(transactions, address) {
  return transactions.map((tx) => {
    const received = tx.vout
      ?.filter((out) => out.scriptpubkey_address === address)
      .reduce((sum, out) => sum + out.value, 0) || 0;
    const sent = tx.vin
      ?.filter((input) => input.prevout?.scriptpubkey_address === address)
      .reduce((sum, input) => sum + (input.prevout?.value || 0), 0) || 0;

    const netSats = received - sent;

    return {
      hash: tx.txid,
      from: sent > 0 ? address : 'external',
      to: received > 0 ? address : 'external',
      value: Math.abs(netSats) / 1e8,
      timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : Date.now(),
      blockNumber: tx.status?.block_height || null,
      gasUsed: 0,
      status: tx.status?.confirmed ? 'confirmed' : 'pending',
      type: netSats >= 0 ? 'receive' : 'send',
      network: 'bitcoin',
      cryptocurrency: 'BTC'
    };
  });
}

module.exports = {
  getBalance,
  getTransactions,
  mapTransactions
};
