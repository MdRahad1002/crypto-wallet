const axios = require('axios');
const { BaseService } = require('./BaseService');

/**
 * Blockchair API Service
 * Unified blockchain explorer supporting 40+ blockchains
 * Documentation: https://blockchair.com/api/docs
 * 
 * Free tier: 1,440 requests/day (1 per minute)
 * Supports: Bitcoin, Ethereum, Litecoin, Dogecoin, Bitcoin Cash, Ripple, and more
 */
class BlockchairService extends BaseService {
  constructor() {
    super('BlockchairService');
    this.apiKey = process.env.BLOCKCHAIR_API_KEY || '';
    this.baseUrl = 'https://api.blockchair.com';
    
    // Supported blockchains
    this.supportedChains = {
      bitcoin: 'bitcoin',
      ethereum: 'ethereum',
      litecoin: 'litecoin',
      dogecoin: 'dogecoin',
      'bitcoin-cash': 'bitcoin-cash',
      bsc: 'bnb',
      polygon: 'polygon'
    };
  }

  /**
   * Get address dashboard (balance + transactions)
   * @param {string} address - Wallet address
   * @param {string} chain - Blockchain name (bitcoin, ethereum, etc.)
   */
  async getAddressDashboard(address, chain = 'bitcoin') {
    return this.executeWithTracking('getAddressDashboard', async () => {
      const blockchainName = this.supportedChains[chain] || chain;
      const url = `${this.baseUrl}/${blockchainName}/dashboards/address/${address}`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 15000
      });

      if (response.data && response.data.data) {
        return response.data.data;
      }

      return null;
    }, { address, chain });
  }

  /**
   * Get Bitcoin balance
   * @param {string} address - Bitcoin address
   */
  async getBitcoinBalance(address) {
    return this.executeWithTracking('getBitcoinBalance', async () => {
      const dashboard = await this.getAddressDashboard(address, 'bitcoin');
      
      if (!dashboard || !dashboard[address]) {
        return {
          confirmedSats: 0,
          unconfirmedSats: 0,
          totalSats: 0,
          totalBtc: 0
        };
      }

      const addressData = dashboard[address].address;
      const confirmed = addressData.balance || 0;
      const unconfirmed = addressData.unconfirmed_balance || 0;
      const total = confirmed + unconfirmed;

      return {
        confirmedSats: confirmed,
        unconfirmedSats: unconfirmed,
        totalSats: total,
        totalBtc: total / 1e8,
        transactionCount: addressData.transaction_count || 0
      };
    }, { address });
  }

  /**
   * Get Bitcoin transactions
   * @param {string} address - Bitcoin address
   * @param {number} limit - Number of transactions to fetch
   */
  async getBitcoinTransactions(address, limit = 50) {
    return this.executeWithTracking('getBitcoinTransactions', async () => {
      const dashboard = await this.getAddressDashboard(address, 'bitcoin');
      
      if (!dashboard || !dashboard[address]) {
        return [];
      }

      const transactions = dashboard[address].transactions || [];
      return this.formatBitcoinTransactions(transactions, address);
    }, { address, limit });
  }

  /**
   * Get Ethereum transactions (as fallback)
   * @param {string} address - Ethereum address
   */
  async getEthereumTransactions(address, limit = 50) {
    return this.executeWithTracking('getEthereumTransactions', async () => {
      const dashboard = await this.getAddressDashboard(address, 'ethereum');
      
      if (!dashboard || !dashboard[address]) {
        return [];
      }

      const transactions = dashboard[address].calls || [];
      return this.formatEthereumTransactions(transactions, address);
    }, { address, limit });
  }

  /**
   * Get transactions for any supported chain
   * @param {string} address - Wallet address
   * @param {string} chain - Blockchain name
   */
  async getTransactions(address, chain = 'bitcoin') {
    if (chain === 'bitcoin' || chain === 'btc') {
      return this.getBitcoinTransactions(address);
    } else if (chain === 'ethereum' || chain === 'eth') {
      return this.getEthereumTransactions(address);
    }

    // Generic handler for other chains
    return this.executeWithTracking('getTransactions', async () => {
      const dashboard = await this.getAddressDashboard(address, chain);
      
      if (!dashboard || !dashboard[address]) {
        return [];
      }

      return dashboard[address].transactions || dashboard[address].calls || [];
    }, { address, chain });
  }

  /**
   * Format Bitcoin transactions
   */
  formatBitcoinTransactions(transactions, address) {
    return transactions.map(txHash => {
      // For detailed transaction data, we'd need to make additional API calls
      // This is a simplified version with transaction hashes
      return {
        hash: txHash,
        from: 'unknown',
        to: 'unknown',
        value: 0,
        timestamp: Date.now(),
        blockNumber: null,
        gasUsed: 0,
        status: 'confirmed',
        type: 'bitcoin',
        network: 'bitcoin',
        cryptocurrency: 'BTC',
        note: 'Fetch full details with transaction hash'
      };
    });
  }

  /**
   * Get detailed Bitcoin transactions with full data
   * @param {string} address - Bitcoin address
   * @param {number} limit - Maximum number of transactions
   */
  async getBitcoinTransactionsDetailed(address, limit = 50) {
    return this.executeWithTracking('getBitcoinTransactionsDetailed', async () => {
      const url = `${this.baseUrl}/bitcoin/dashboards/address/${address}`;
      
      const params = {
        transaction_details: true,
        limit: limit
      };
      
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 20000
      });

      if (!response.data?.data || !response.data.data[address]) {
        return [];
      }

      const addressData = response.data.data[address];
      const transactions = addressData.transactions || [];
      
      // If we have transaction details in the response
      if (response.data.data.transactions) {
        return this.formatDetailedBitcoinTransactions(
          response.data.data.transactions, 
          address
        );
      }

      // Otherwise return simplified format
      return transactions.map(txHash => ({
        hash: txHash,
        type: 'bitcoin',
        network: 'bitcoin',
        status: 'confirmed'
      }));
    }, { address, limit });
  }

  /**
   * Format detailed Bitcoin transaction data
   */
  formatDetailedBitcoinTransactions(transactionsObj, userAddress) {
    if (!transactionsObj || typeof transactionsObj !== 'object') {
      return [];
    }

    return Object.entries(transactionsObj).map(([hash, tx]) => {
      // Determine if this is incoming or outgoing
      const inputs = tx.inputs || [];
      const outputs = tx.outputs || [];
      
      // Calculate value change for this address
      let valueChange = 0;
      let isIncoming = false;
      let isOutgoing = false;
      
      // Check outputs for incoming funds
      outputs.forEach(output => {
        if (output.recipient === userAddress) {
          valueChange += output.value || 0;
          isIncoming = true;
        }
      });
      
      // Check inputs for outgoing funds
      inputs.forEach(input => {
        if (input.recipient === userAddress) {
          valueChange -= input.value || 0;
          isOutgoing = true;
        }
      });
      
      const type = isIncoming && !isOutgoing ? 'received' : 
                   isOutgoing && !isIncoming ? 'sent' : 'self';
      
      return {
        hash: hash,
        from: inputs[0]?.recipient || 'Multiple Inputs',
        to: outputs[0]?.recipient || 'Multiple Outputs',
        value: Math.abs(valueChange) / 1e8, // Convert satoshis to BTC
        valueSats: Math.abs(valueChange),
        fee: tx.fee || 0,
        feeBtc: (tx.fee || 0) / 1e8,
        timestamp: tx.time ? new Date(tx.time).getTime() : Date.now(),
        blockNumber: tx.block_id || null,
        blockHeight: tx.block_id || null,
        confirmations: tx.confirmations || 0,
        status: (tx.confirmations || 0) > 0 ? 'confirmed' : 'pending',
        type: type,
        direction: type,
        network: 'bitcoin',
        cryptocurrency: 'BTC',
        inputCount: inputs.length,
        outputCount: outputs.length
      };
    });
  }

  /**
   * Format Ethereum transactions
   */
  formatEthereumTransactions(transactions, address) {
    return transactions.map(tx => ({
      hash: tx.transaction_hash || tx.hash,
      from: tx.sender || 'unknown',
      to: tx.recipient || 'unknown',
      value: tx.value ? (parseInt(tx.value) / 1e18).toString() : '0',
      timestamp: tx.time ? new Date(tx.time).getTime() : Date.now(),
      blockNumber: tx.block_id || null,
      gasUsed: tx.gas_used || 0,
      gasPrice: tx.gas_price || 0,
      status: 'confirmed',
      type: 'normal',
      network: 'ethereum',
      cryptocurrency: 'ETH'
    }));
  }

  /**
   * Get full transaction details for multiple hashes in one call.
   * Uses the Blockchair BATCH dashboard endpoint (docs v2.0.63):
   *   GET /{chain}/dashboards/transactions/{hash0},{hash1},...   (PLURAL)
   * Single-transaction form uses the singular /dashboards/transaction/{hash}.
   * Batches into groups of 10 (Blockchair's stated max per request).
   *
   * @param {string[]} hashes - Array of transaction hashes
   * @param {string}   chain  - Blockchain name (default: 'bitcoin')
   * @returns {Object} Map of { [hash]: { transaction, inputs, outputs } }
   */
  async getTransactionBatch(hashes, chain = 'bitcoin') {
    return this.executeWithTracking('getTransactionBatch', async () => {
      if (!hashes || hashes.length === 0) return {};

      const blockchainName = this.supportedChains[chain] || chain;
      const BATCH_SIZE = 10;
      const result = {};

      for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
        const batch = hashes.slice(i, i + BATCH_SIZE).join(',');
        // Plural /dashboards/transactions/ is the documented batch endpoint
        const url = `${this.baseUrl}/${blockchainName}/dashboards/transactions/${batch}`;

        const params = {};
        if (this.apiKey) params.key = this.apiKey;

        const response = await axios.get(url, { params, timeout: 20000 });
        const txData = response.data?.data || {};
        Object.assign(result, txData);
      }

      return result;
    }, { chain, count: hashes.length });
  }

  /**
   * Broadcast a raw signed transaction.
   * POST /{chain}/push/transaction
   * @param {string} rawHex - Raw transaction in hex
   * @param {string} chain  - Blockchain name (default: 'bitcoin')
   * @returns {string} Transaction hash on success
   */
  async pushTransaction(rawHex, chain = 'bitcoin') {
    return this.executeWithTracking('pushTransaction', async () => {
      const blockchainName = this.supportedChains[chain] || chain;
      const url = `${this.baseUrl}/${blockchainName}/push/transaction`;

      const params = {};
      if (this.apiKey) params.key = this.apiKey;

      const response = await axios.post(url, { data: rawHex }, { params, timeout: 30000 });
      // On success Blockchair returns { data: { transaction_hash: '...' } }
      return response.data?.data?.transaction_hash || response.data?.data || null;
    }, { chain });
  }

  /**
   * Bulk confirmed-balance check — up to 25,000 addresses in one call.
   * GET /{chain}/addresses/balances?addresses={:list}
   * Only returns addresses with a non-zero balance. Cost: ~26 points for 25k addresses.
   * Supported: bitcoin, bitcoin-cash, litecoin, dogecoin, dash, zcash, groestlcoin
   *
   * @param {string[]} addresses - Array of addresses
   * @param {string}   chain     - Blockchain name (default: 'bitcoin')
   * @returns {Object} { [address]: balance_in_satoshi }
   */
  async bulkBalances(addresses, chain = 'bitcoin') {
    return this.executeWithTracking('bulkBalances', async () => {
      if (!addresses || addresses.length === 0) return {};

      const blockchainName = this.supportedChains[chain] || chain;
      const url = `${this.baseUrl}/${blockchainName}/addresses/balances`;

      const params = { addresses: addresses.join(',') };
      if (this.apiKey) params.key = this.apiKey;

      const response = await axios.get(url, { params, timeout: 30000 });
      return response.data?.data || {};
    }, { chain, count: addresses.length });
  }

  /**
   * Get estimated confirmation wait time for a mempool transaction.
   * GET /{chain}/dashboards/transaction/{hash}/priority
   * Returns `eta_seconds` (approximate) and `position` ('confirmed' if already confirmed).
   *
   * @param {string} hash  - Transaction hash
   * @param {string} chain - Blockchain name (default: 'bitcoin')
   */
  async getTransactionPriority(hash, chain = 'bitcoin') {
    return this.executeWithTracking('getTransactionPriority', async () => {
      const blockchainName = this.supportedChains[chain] || chain;
      const url = `${this.baseUrl}/${blockchainName}/dashboards/transaction/${hash}/priority`;

      const params = {};
      if (this.apiKey) params.key = this.apiKey;

      const response = await axios.get(url, { params, timeout: 15000 });
      return response.data?.data || null;
    }, { hash, chain });
  }

  /**
   * Get HD wallet (xpub/ypub/zpub) dashboard.
   * GET /{chain}/dashboards/xpub/{extended_key}
   * Returns aggregated balance, transaction list, and UTXO set for all derived addresses.
   * Supports Bitcoin, Litecoin, Bitcoin Cash, Dash, Bitcoin SV, Dogecoin, Groestlcoin.
   *
   * @param {string} xpub  - Extended public key (xpub / ypub / zpub)
   * @param {string} chain - Blockchain name (default: 'bitcoin')
   * @param {Object} opts  - Optional: { limit, offset, state, transaction_details }
   */
  async getXpubDashboard(xpub, chain = 'bitcoin', opts = {}) {
    return this.executeWithTracking('getXpubDashboard', async () => {
      const blockchainName = this.supportedChains[chain] || chain;
      const url = `${this.baseUrl}/${blockchainName}/dashboards/xpub/${xpub}`;

      const params = { ...opts };
      if (this.apiKey) params.key = this.apiKey;

      const response = await axios.get(url, { params, timeout: 30000 });
      return response.data?.data || null;
    }, { chain });
  }

  /**
   * Fetch raw transaction data directly from Blockchair's node.
   * GET /{chain}/raw/transaction/{hash}
   * Returns { raw_transaction: hex, decoded_raw_transaction: JSON } for BTC-like chains.
   * NOTE: for development/debugging only — no backward compatibility guarantees.
   *
   * @param {string} hash  - Transaction hash
   * @param {string} chain - Blockchain name (default: 'bitcoin')
   */
  async getRawTransaction(hash, chain = 'bitcoin') {
    return this.executeWithTracking('getRawTransaction', async () => {
      const blockchainName = this.supportedChains[chain] || chain;
      const url = `${this.baseUrl}/${blockchainName}/raw/transaction/${hash}`;

      const params = {};
      if (this.apiKey) params.key = this.apiKey;

      const response = await axios.get(url, { params, timeout: 15000 });
      return response.data?.data?.[hash] || null;
    }, { hash, chain });
  }

  /**
   * Get current Bitcoin mempool transactions.
   * GET /bitcoin/mempool/transactions
   * NOTE: /bitcoin/mempool/blocks was DEPRECATED in API v2.0.11.
   * The correct endpoint is /mempool/transactions (or /mempool/outputs).
   *
   * @param {number} limit - Max rows to return (default 10, max 100)
   */
  async getMempoolData(limit = 10) {
    return this.executeWithTracking('getMempoolData', async () => {
      const url = `${this.baseUrl}/bitcoin/mempool/transactions`;

      const params = { limit, s: 'fee_per_kb(desc)' };
      if (this.apiKey) params.key = this.apiKey;

      const response = await axios.get(url, { params, timeout: 10000 });
      return response.data?.data || [];
    });
  }

  /**
   * Get recommended transaction fees (Bitcoin)
   */
  async getRecommendedFees() {
    return this.executeWithTracking('getRecommendedFees', async () => {
      const url = `${this.baseUrl}/bitcoin/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      const stats = response.data?.data;
      if (stats) {
        return {
          low: stats.suggested_transaction_fee_per_byte_sat || 1,
          medium: Math.ceil((stats.suggested_transaction_fee_per_byte_sat || 1) * 1.5),
          high: Math.ceil((stats.suggested_transaction_fee_per_byte_sat || 1) * 2),
          unit: 'sat/byte'
        };
      }

      return { low: 1, medium: 5, high: 10, unit: 'sat/byte' };
    });
  }

  /**
   * Get stats for all blockchains at once
   * Single API call for 15+ blockchains
   */
  async getAllStats() {
    return this.executeWithTracking('getAllStats', async () => {
      const url = `${this.baseUrl}/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 15000
      });

      return response.data?.data || {};
    });
  }

  /**
   * Get Bitcoin-like blockchain stats
   * Supports: bitcoin, bitcoin-cash, litecoin, bitcoin-sv, dogecoin, dash, groestlcoin, zcash, ecash
   * @param {string} chain - Blockchain name
   */
  async getBitcoinLikeStats(chain = 'bitcoin') {
    return this.executeWithTracking('getBitcoinLikeStats', async () => {
      const blockchainName = this.supportedChains[chain] || chain;
      const url = `${this.baseUrl}/${blockchainName}/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      return response.data?.data || null;
    }, { chain });
  }

  /**
   * Get Ethereum-like blockchain stats
   * Supports: ethereum, ethereum/testnet
   * @param {string} chain - Blockchain name (ethereum, bnb, polygon, etc.)
   * @param {boolean} testnet - Use testnet
   */
  async getEthereumLikeStats(chain = 'ethereum', testnet = false) {
    return this.executeWithTracking('getEthereumLikeStats', async () => {
      const blockchainName = this.supportedChains[chain] || chain;
      const networkPath = testnet ? `${blockchainName}/testnet` : blockchainName;
      const url = `${this.baseUrl}/${networkPath}/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      return response.data?.data || null;
    }, { chain, testnet });
  }

  /**
   * Get Ripple blockchain stats
   */
  async getRippleStats() {
    return this.executeWithTracking('getRippleStats', async () => {
      const url = `${this.baseUrl}/ripple/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      return response.data?.data || null;
    });
  }

  /**
   * Get Stellar blockchain stats
   */
  async getStellarStats() {
    return this.executeWithTracking('getStellarStats', async () => {
      const url = `${this.baseUrl}/stellar/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      return response.data?.data || null;
    });
  }

  /**
   * Get Monero blockchain stats
   */
  async getMoneroStats() {
    return this.executeWithTracking('getMoneroStats', async () => {
      const url = `${this.baseUrl}/monero/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      return response.data?.data || null;
    });
  }

  /**
   * Get Cardano blockchain stats
   */
  async getCardanoStats() {
    return this.executeWithTracking('getCardanoStats', async () => {
      const url = `${this.baseUrl}/cardano/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      return response.data?.data || null;
    });
  }

  /**
   * Get Mixin DAG stats
   */
  async getMixinStats() {
    return this.executeWithTracking('getMixinStats', async () => {
      const url = `${this.baseUrl}/mixin/stats`;
      
      const params = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      return response.data?.data || null;
    });
  }

  /**
   * Get Omni Layer stats (Bitcoin second layer).
   * Omni data is NOT a standalone endpoint — it is embedded inside the Bitcoin
   * stats response under data.layer_2.omni (if available), and can be retrieved
   * per-transaction with ?omni=true or per-address with ?omni=true.
   * This helper fetches Bitcoin stats and returns the layer_2.omni slice.
   * For transaction-level Omni data use:
   *   GET /bitcoin/dashboards/transaction/{hash}?omni=true
   */
  async getOmniStats() {
    return this.executeWithTracking('getOmniStats', async () => {
      const stats = await this.getBitcoinLikeStats('bitcoin');
      return stats?.layer_2?.omni || null;
    });
  }

  /**
   * Get blockchain stats by chain name (auto-detect chain type)
   * @param {string} chain - Blockchain name (bitcoin, ethereum, ripple, etc.)
   */
  async getStats(chain = 'bitcoin') {
    const chainLower = chain.toLowerCase();

    // Ethereum-like chains
    if (['ethereum', 'eth', 'bnb', 'bsc', 'polygon', 'matic', 'avalanche', 'arbitrum', 'optimism'].includes(chainLower)) {
      return this.getEthereumLikeStats(chainLower);
    }

    // Special chains
    if (chainLower === 'ripple' || chainLower === 'xrp') {
      return this.getRippleStats();
    }

    if (chainLower === 'stellar' || chainLower === 'xlm') {
      return this.getStellarStats();
    }

    if (chainLower === 'monero' || chainLower === 'xmr') {
      return this.getMoneroStats();
    }

    if (chainLower === 'cardano' || chainLower === 'ada') {
      return this.getCardanoStats();
    }

    if (chainLower === 'mixin' || chainLower === 'xin') {
      return this.getMixinStats();
    }

    // Bitcoin-like chains (default)
    return this.getBitcoinLikeStats(chainLower);
  }

  /**
   * Get market price and dominance for a specific blockchain
   * @param {string} chain - Blockchain name
   */
  async getMarketData(chain = 'bitcoin') {
    return this.executeWithTracking('getMarketData', async () => {
      const stats = await this.getStats(chain);
      
      if (!stats) {
        return null;
      }

      return {
        priceUsd: stats.market_price_usd || 0,
        priceBtc: stats.market_price_btc || 0,
        change24h: stats.market_price_usd_change_24h_percentage || 0,
        marketCap: stats.market_cap_usd || 0,
        dominance: stats.market_dominance_percentage || 0,
        circulation: stats.circulation || stats.circulation_approximate || 0
      };
    }, { chain });
  }

  /**
   * Get recommended gas prices for Ethereum-like chains
   * @param {string} chain - Blockchain name (ethereum, bsc, polygon, etc.)
   */
  async getGasPrices(chain = 'ethereum') {
    return this.executeWithTracking('getGasPrices', async () => {
      const stats = await this.getEthereumLikeStats(chain);
      
      if (!stats || !stats.suggested_transaction_fee_gwei_options) {
        return null;
      }

      const options = stats.suggested_transaction_fee_gwei_options;
      
      return {
        sloth: options.sloth || 0,      // Risk and wait
        slow: options.slow || 0,        // 5-10 minutes
        normal: options.normal || 0,    // 2-5 minutes
        fast: options.fast || 0,        // 1-2 minutes
        cheetah: options.cheetah || 0,  // Next block
        mempoolMedian: stats.mempool_median_gas_price || 0,
        unit: 'gwei'
      };
    }, { chain });
  }

  /**
   * Get ERC-20 token stats (Ethereum only)
   * Included in Ethereum stats
   */
  async getErc20Stats() {
    return this.executeWithTracking('getErc20Stats', async () => {
      const stats = await this.getEthereumLikeStats('ethereum');
      
      if (!stats || !stats.layer_2 || !stats.layer_2.erc_20) {
        return null;
      }

      return stats.layer_2.erc_20;
    });
  }

  /**
   * Get network health metrics
   * @param {string} chain - Blockchain name
   */
  async getNetworkHealth(chain = 'bitcoin') {
    return this.executeWithTracking('getNetworkHealth', async () => {
      const stats = await this.getStats(chain);
      
      if (!stats) {
        return null;
      }

      return {
        mempoolTransactions: stats.mempool_transactions || 0,
        mempoolSize: stats.mempool_size || 0,
        mempoolTps: stats.mempool_tps || stats.tps_24h || 0,
        transactions24h: stats.transactions_24h || 0,
        blocks24h: stats.blocks_24h || stats.ledgers_24h || 0,
        avgFee24h: stats.average_transaction_fee_usd_24h || 0,
        medianFee24h: stats.median_transaction_fee_usd_24h || 0,
        volume24h: stats.volume_24h || stats.volume_24h_approximate || 0,
        hashrate24h: stats.hashrate_24h || null,
        difficulty: stats.difficulty || null
      };
    }, { chain });
  }

  /**
   * Check if API key is configured
   */
  hasApiKey() {
    return Boolean(this.apiKey);
  }

  /**
   * Get rate limit status (requires API key)
   */
  async getRateLimitStatus() {
    if (!this.apiKey) {
      return { limit: 1440, remaining: 'unknown', resetTime: 'unknown' };
    }

    try {
      const url = `${this.baseUrl}/premium/stats`;
      const response = await axios.get(url, {
        params: { key: this.apiKey },
        timeout: 5000
      });

      return response.data?.context || {};
    } catch (error) {
      this.log('error', 'rate_limit_check_failed', { message: error.message });
      return { error: error.message };
    }
  }
}

module.exports = new BlockchairService();
