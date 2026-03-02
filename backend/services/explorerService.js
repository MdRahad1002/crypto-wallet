const axios = require('axios');
const { BaseService } = require('./BaseService');
const blockchairService = require('./blockchairService');

class ExplorerService extends BaseService {
  constructor() {
    super('ExplorerService');
    this.apiKeys = {
      etherscan: process.env.ETHERSCAN_API_KEY || '',
      polygonscan: process.env.POLYGONSCAN_API_KEY || '',
      bscscan: process.env.BSCSCAN_API_KEY || '',
      blockchair: process.env.BLOCKCHAIR_API_KEY || ''
    };

    this.baseUrls = {
      ethereum: 'https://api.etherscan.io/api',
      polygon: 'https://api.polygonscan.com/api',
      bsc: 'https://api.bscscan.com/api'
    };

    this.useBlockchairFallback = process.env.USE_BLOCKCHAIR_FALLBACK !== 'false';
  }

  // Get transaction history from blockchain explorer
  async getTransactionHistory(address, network = 'ethereum') {
    return this.executeWithTracking('getTransactionHistory', async () => {
      const baseUrl = this.baseUrls[network];
      const apiKey = this.getApiKey(network);

      if (!apiKey) {
        this.log('warn', 'missing_api_key', { network, address });
        
        // Try Blockchair as fallback if enabled
        if (this.useBlockchairFallback && this.apiKeys.blockchair) {
          try {
            this.log('info', 'trying_blockchair_fallback', { network, address });
            const txs = await blockchairService.getTransactions(address, network);
            if (txs && txs.length > 0) {
              return txs;
            }
          } catch (err) {
            this.log('warn', 'blockchair_fallback_failed', { error: err.message });
          }
        }
        
        return this.getMockHistory(address, network);
      }

      try {
        const response = await axios.get(baseUrl, {
          params: {
            module: 'account',
            action: 'txlist',
            address: address,
            startblock: 0,
            endblock: 99999999,
            page: 1,
            offset: 50, // Last 50 transactions
            sort: 'desc',
            apikey: apiKey
          },
          timeout: 10000 // 10 second timeout
        });

        if (response.data.status === '1' && Array.isArray(response.data.result)) {
          return this.formatTransactions(response.data.result, network);
        }

        // If primary API returns no results, try Blockchair
        if (this.useBlockchairFallback && this.apiKeys.blockchair) {
          this.log('info', 'primary_api_empty_trying_blockchair', { network, address });
          const txs = await blockchairService.getTransactions(address, network);
          if (txs && txs.length > 0) {
            return txs;
          }
        }

        this.log('warn', 'transactions_fetch_failed', { network, address });
        return [];
      } catch (error) {
        // On error, try Blockchair as fallback
        if (this.useBlockchairFallback && this.apiKeys.blockchair) {
          try {
            this.log('warn', 'primary_api_error_trying_blockchair', { 
              network, 
              address, 
              error: error.message 
            });
            const txs = await blockchairService.getTransactions(address, network);
            if (txs && txs.length > 0) {
              return txs;
            }
          } catch (fallbackError) {
            this.log('error', 'blockchair_fallback_error', { error: fallbackError.message });
          }
        }
        
        throw error;
      }
    }, { address, network });
  }

  // Get token transaction history (ERC-20)
  async getTokenTransactions(address, network = 'ethereum') {
    return this.executeWithTracking('getTokenTransactions', async () => {
      const baseUrl = this.baseUrls[network];
      const apiKey = this.getApiKey(network);

      if (!apiKey) {
        this.log('warn', 'missing_api_key', { network, address, type: 'token' });
        return [];
      }

      const response = await axios.get(baseUrl, {
        params: {
          module: 'account',
          action: 'tokentx',
          address: address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: 50,
          sort: 'desc',
          apikey: apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && Array.isArray(response.data.result)) {
        return this.formatTokenTransactions(response.data.result, network);
      }

      return [];
    }, { address, network });
  }

  // Get internal transactions (contract interactions)
  async getInternalTransactions(address, network = 'ethereum') {
    return this.executeWithTracking('getInternalTransactions', async () => {
      const baseUrl = this.baseUrls[network];
      const apiKey = this.getApiKey(network);

      if (!apiKey) {
        this.log('warn', 'missing_api_key', { network, address, type: 'internal' });
        return [];
      }

      const response = await axios.get(baseUrl, {
        params: {
          module: 'account',
          action: 'txlistinternal',
          address: address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: 50,
          sort: 'desc',
          apikey: apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && Array.isArray(response.data.result)) {
        return this.formatInternalTransactions(response.data.result, network);
      }

      return [];
    }, { address, network });
  }

  // Get all transactions (normal + token + internal)
  async getAllTransactions(address, network = 'ethereum') {
    return this.executeWithTracking('getAllTransactions', async () => {
      const [normal, token, internal] = await Promise.all([
        this.getTransactionHistory(address, network),
        this.getTokenTransactions(address, network),
        this.getInternalTransactions(address, network)
      ]);

      // Combine and sort by timestamp
      const allTx = [...normal, ...token, ...internal];
      return allTx.sort((a, b) => b.timestamp - a.timestamp);
    }, { address, network });
  }

  // Format normal transactions
  formatTransactions(transactions, network) {
    return transactions.map(tx => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: (parseInt(tx.value) / 1e18).toString(), // Convert wei to ETH
      timestamp: parseInt(tx.timeStamp) * 1000, // Convert to milliseconds
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      status: tx.isError === '0' ? 'confirmed' : 'failed',
      type: 'normal',
      network: network,
      cryptocurrency: this.getCryptocurrency(network)
    }));
  }

  // Format token transactions
  formatTokenTransactions(transactions, network) {
    return transactions.map(tx => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: (parseInt(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal))).toString(),
      timestamp: parseInt(tx.timeStamp) * 1000,
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      status: 'confirmed',
      type: 'token',
      network: network,
      cryptocurrency: tx.tokenSymbol,
      tokenName: tx.tokenName,
      tokenAddress: tx.contractAddress
    }));
  }

  // Format internal transactions
  formatInternalTransactions(transactions, network) {
    return transactions.map(tx => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: (parseInt(tx.value) / 1e18).toString(),
      timestamp: parseInt(tx.timeStamp) * 1000,
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: tx.gasUsed || '0',
      status: tx.isError === '0' ? 'confirmed' : 'failed',
      type: 'internal',
      network: network,
      cryptocurrency: this.getCryptocurrency(network)
    }));
  }

  // Get API key for network
  getApiKey(network) {
    const keyMap = {
      ethereum: this.apiKeys.etherscan,
      polygon: this.apiKeys.polygonscan,
      bsc: this.apiKeys.bscscan
    };
    return keyMap[network] || '';
  }

  // Get cryptocurrency symbol for network
  getCryptocurrency(network) {
    const cryptoMap = {
      ethereum: 'ETH',
      polygon: 'MATIC',
      bsc: 'BNB'
    };
    return cryptoMap[network] || 'ETH';
  }

  // Mock history for when API key is not available
  getMockHistory(address, network) {
    this.log('info', 'mock_history_returned', { address, network });
    return [];
  }
}

module.exports = new ExplorerService();
