const { ethers } = require('ethers');

// Popular tokens by network
const POPULAR_TOKENS = {
  ethereum: [
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg'
    },
    {
      symbol: 'LINK',
      name: 'Chainlink',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/877/small/chainlink.png'
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png'
    }
  ],
  polygon: [
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
    },
    {
      symbol: 'WMATIC',
      name: 'Wrapped Matic',
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic.png'
    }
  ],
  bsc: [
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      symbol: 'BUSD',
      name: 'Binance USD',
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/9576/small/BUSD.png'
    },
    {
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      decimals: 18,
      logoUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb.png'
    }
  ]
};

class TokenService {
  constructor(walletService) {
    this.walletService = walletService;
    this.erc20ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ];
  }

  // Get popular tokens for a network
  getPopularTokens(network = 'ethereum') {
    return POPULAR_TOKENS[network] || [];
  }

  // Get token balance
  async getTokenBalance(walletAddress, tokenAddress, network = 'ethereum') {
    try {
      const provider = this.walletService.providers[network];
      const contract = new ethers.Contract(tokenAddress, this.erc20ABI, provider);
      
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await contract.decimals();
      
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  // Get token info
  async getTokenInfo(tokenAddress, network = 'ethereum') {
    try {
      const provider = this.walletService.providers[network];
      const contract = new ethers.Contract(tokenAddress, this.erc20ABI, provider);
      
      const [symbol, name, decimals] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals()
      ]);
      
      return {
        address: tokenAddress,
        symbol,
        name,
        decimals: Number(decimals),
        network
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      throw error;
    }
  }

  // Get multiple token balances
  async getTokenBalances(walletAddress, tokenAddresses, network = 'ethereum') {
    try {
      const balances = await Promise.all(
        tokenAddresses.map(async (tokenAddress) => {
          try {
            const balance = await this.getTokenBalance(walletAddress, tokenAddress, network);
            const info = await this.getTokenInfo(tokenAddress, network);
            return {
              ...info,
              balance
            };
          } catch (error) {
            console.error(`Error fetching token ${tokenAddress}:`, error.message);
            return null;
          }
        })
      );
      
      return balances.filter(b => b !== null);
    } catch (error) {
      console.error('Error getting token balances:', error);
      throw error;
    }
  }

  // Transfer token
  async transferToken(privateKey, tokenAddress, toAddress, amount, network = 'ethereum') {
    try {
      const provider = this.walletService.providers[network];
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(tokenAddress, this.erc20ABI, wallet);
      
      // Get token decimals
      const decimals = await contract.decimals();
      
      // Convert amount to token units
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
      
      // Send transfer transaction
      const tx = await contract.transfer(toAddress, tokenAmount);
      const receipt = await tx.wait();
      
      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'confirmed' : 'failed'
      };
    } catch (error) {
      console.error('Error transferring token:', error);
      throw error;
    }
  }

  // Check token approval
  async checkAllowance(walletAddress, tokenAddress, spenderAddress, network = 'ethereum') {
    try {
      const provider = this.walletService.providers[network];
      const contract = new ethers.Contract(tokenAddress, this.erc20ABI, provider);
      
      const allowance = await contract.allowance(walletAddress, spenderAddress);
      const decimals = await contract.decimals();
      
      return ethers.formatUnits(allowance, decimals);
    } catch (error) {
      console.error('Error checking allowance:', error);
      throw error;
    }
  }

  // Approve token spending
  async approveToken(privateKey, tokenAddress, spenderAddress, amount, network = 'ethereum') {
    try {
      const provider = this.walletService.providers[network];
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(tokenAddress, this.erc20ABI, wallet);
      
      const decimals = await contract.decimals();
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
      
      const tx = await contract.approve(spenderAddress, tokenAmount);
      const receipt = await tx.wait();
      
      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'confirmed' : 'failed'
      };
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }

  // Validate token address
  isValidTokenAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

module.exports = TokenService;
