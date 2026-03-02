const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Token = require('../models/Token');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const walletService = require('../utils/walletService');
const TokenService = require('../services/tokenService');
const { validate, schemas } = require('../utils/validation');
const logger = require('../core/logger');

const nonceLock = require('../security/nonceLock');
const { idempotencyGuard } = require('../security/txGuard');
const tokenService = new TokenService(walletService);

function requireString(value, fieldName, res) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    res.status(400).json({ message: `${fieldName} must be a non-empty string` });
    return false;
  }
  return true;
}

// Get popular tokens for a network
router.get('/popular', auth, async (req, res) => {
  try {
    const { network = 'ethereum' } = req.query;
    const tokens = tokenService.getPopularTokens(network);
    res.json({ network, tokens });
  } catch (error) {
    logger.error('Error fetching popular tokens', { message: error.message });
    res.status(500).json({ message: 'Error fetching popular tokens' });
  }
});

// Get user's saved tokens
router.get('/list', auth, async (req, res) => {
  try {
    const { walletAddress, network } = req.query;
    
    const query = { userId: req.userId };
    if (walletAddress) query.walletAddress = walletAddress;
    if (network) query.network = network;
    
    const tokens = await Token.find(query).sort({ symbol: 1 });
    res.json(tokens);
  } catch (error) {
    logger.error('Error fetching tokens', { message: error.message });
    res.status(500).json({ message: 'Error fetching tokens' });
  }
});

// Get token info
router.get('/info/:address', auth, async (req, res) => {
  try {
    const { address } = req.params;
    const { network = 'ethereum' } = req.query;
    
    if (!tokenService.isValidTokenAddress(address)) {
      return res.status(400).json({ message: 'Invalid token address' });
    }
    
    const tokenInfo = await tokenService.getTokenInfo(address, network);
    res.json(tokenInfo);
  } catch (error) {
    logger.error('Error fetching token info', { message: error.message });
    res.status(500).json({ 
      message: 'Error fetching token info. Make sure the address is a valid ERC-20 token.',
      error: error.message 
    });
  }
});

// Add custom token to user's list
router.post('/add', auth, async (req, res) => {
  try {
    const { walletAddress, contractAddress, network = 'ethereum' } = req.body;
    
    if (!walletAddress || !contractAddress) {
      return res.status(400).json({ message: 'Wallet address and contract address are required' });
    }

    if (!requireString(walletAddress, 'Wallet address', res) || !requireString(contractAddress, 'Contract address', res)) {
      return;
    }
    
    if (!tokenService.isValidTokenAddress(contractAddress)) {
      return res.status(400).json({ message: 'Invalid token contract address' });
    }
    
    // Verify user owns the wallet
    const user = await User.findById(req.userId);
    const wallet = user.wallets.find(w => 
      w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    // Check if token already added
    const existingToken = await Token.findOne({
      userId: req.userId,
      walletAddress: walletAddress,
      contractAddress: contractAddress,
      network: network
    });
    
    if (existingToken) {
      return res.status(400).json({ message: 'Token already added' });
    }
    
    // Get token info from blockchain
    const tokenInfo = await tokenService.getTokenInfo(contractAddress, network);
    
    // Get initial balance
    const balance = await tokenService.getTokenBalance(walletAddress, contractAddress, network);
    
    // Save token
    const token = new Token({
      userId: req.userId,
      walletAddress,
      contractAddress,
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      decimals: tokenInfo.decimals,
      balance,
      network,
      isCustom: true
    });
    
    await token.save();
    
    res.json({
      message: 'Token added successfully',
      token
    });
  } catch (error) {
    logger.error('Error adding token', { message: error.message });
    res.status(500).json({ 
      message: 'Error adding token',
      error: error.message 
    });
  }
});

// Get token balance
router.get('/balance/:walletAddress/:tokenAddress', auth, async (req, res) => {
  try {
    const { walletAddress, tokenAddress } = req.params;
    const { network = 'ethereum' } = req.query;

    if (!requireString(walletAddress, 'Wallet address', res) || !requireString(tokenAddress, 'Token address', res)) {
      return;
    }
    
    // Verify user owns the wallet
    const user = await User.findById(req.userId);
    const wallet = user.wallets.find(w => 
      w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    const balance = await tokenService.getTokenBalance(walletAddress, tokenAddress, network);
    const tokenInfo = await tokenService.getTokenInfo(tokenAddress, network);
    
    res.json({
      ...tokenInfo,
      balance,
      walletAddress
    });
  } catch (error) {
    logger.error('Error getting token balance', { message: error.message });
    res.status(500).json({ 
      message: 'Error getting token balance',
      error: error.message 
    });
  }
});

// Get all token balances for a wallet
router.get('/balances/:walletAddress', auth, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { network = 'ethereum' } = req.query;

    if (!requireString(walletAddress, 'Wallet address', res)) {
      return;
    }
    
    // Verify user owns the wallet
    const user = await User.findById(req.userId);
    const wallet = user.wallets.find(w => 
      w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    // Get user's saved tokens
    const savedTokens = await Token.find({
      userId: req.userId,
      walletAddress: walletAddress,
      network: network
    });
    
    // Get balances for all saved tokens
    const tokenAddresses = savedTokens.map(t => t.contractAddress);
    const balances = await tokenService.getTokenBalances(walletAddress, tokenAddresses, network);
    
    // Update saved token balances
    for (const balance of balances) {
      await Token.findOneAndUpdate(
        {
          userId: req.userId,
          walletAddress: walletAddress,
          contractAddress: balance.address,
          network: network
        },
        { 
          balance: balance.balance,
          lastUpdated: Date.now()
        }
      );
    }
    
    res.json({ walletAddress, network, tokens: balances });
  } catch (error) {
    logger.error('Error getting token balances', { message: error.message });
    res.status(500).json({ 
      message: 'Error getting token balances',
      error: error.message 
    });
  }
});

// Transfer token
router.post('/transfer', auth, idempotencyGuard(), async (req, res) => {
  try {
    const { fromAddress, toAddress, tokenAddress, amount, network = 'ethereum', password } = req.body;
    
    if (!fromAddress || !toAddress || !tokenAddress || !amount || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!requireString(fromAddress, 'From address', res) || !requireString(toAddress, 'To address', res) || !requireString(tokenAddress, 'Token address', res)) {
      return;
    }
    
    // Verify user owns the wallet
    const user = await User.findById(req.userId);
    const wallet = user.wallets.find(w => 
      w.address.toLowerCase() === fromAddress.toLowerCase()
    );
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    if (wallet.watchOnly) {
      return res.status(403).json({ message: 'Cannot send from watch-only wallet' });
    }
    
    await nonceLock.withNonceLock(`wallet:${wallet.address}`, async () => {
      // Decrypt private key
      const privateKey = walletService.decryptPrivateKey(wallet, password);

      // Get token info
      const tokenInfo = await tokenService.getTokenInfo(tokenAddress, network);

      // Create transaction record
      const transaction = new Transaction({
        userId: req.userId,
        type: 'send',
        cryptocurrency: tokenInfo.symbol,
        amount,
        fromAddress,
        toAddress,
        network,
        status: 'pending'
      });
      await transaction.save();

      try {
        // Transfer token
        const receipt = await tokenService.transferToken(
          privateKey,
          tokenAddress,
          toAddress,
          amount,
          network
        );

        // Update transaction
        transaction.txHash = receipt.hash;
        transaction.blockNumber = receipt.blockNumber;
        transaction.gasUsed = receipt.gasUsed;
        transaction.status = receipt.status;
        await transaction.save();

        // Update token balance
        const newBalance = await tokenService.getTokenBalance(fromAddress, tokenAddress, network);
        await Token.findOneAndUpdate(
          {
            userId: req.userId,
            walletAddress: fromAddress,
            contractAddress: tokenAddress,
            network
          },
          { 
            balance: newBalance,
            lastUpdated: Date.now()
          }
        );

        res.json({
          message: 'Token transfer successful',
          transaction: {
            id: transaction._id,
            hash: receipt.hash,
            status: receipt.status
          }
        });
      } catch (txError) {
        transaction.status = 'failed';
        await transaction.save();
        throw txError;
      }
    });
  } catch (error) {
    logger.error('Error transferring token', { message: error.message });
    res.status(500).json({ 
      message: 'Error transferring token',
      error: error.message 
    });
  }
});

// Remove token from user's list
router.delete('/:id', auth, async (req, res) => {
  try {
    const token = await Token.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!token) {
      return res.status(404).json({ message: 'Token not found' });
    }
    
    await Token.deleteOne({ _id: req.params.id });
    
    res.json({ message: 'Token removed successfully' });
  } catch (error) {
    logger.error('Error removing token', { message: error.message });
    res.status(500).json({ message: 'Error removing token' });
  }
});

// Update token balance manually
router.post('/refresh/:id', auth, async (req, res) => {
  try {
    const token = await Token.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!token) {
      return res.status(404).json({ message: 'Token not found' });
    }
    
    const balance = await tokenService.getTokenBalance(
      token.walletAddress,
      token.contractAddress,
      token.network
    );
    
    token.balance = balance;
    token.lastUpdated = Date.now();
    await token.save();
    
    res.json({
      message: 'Token balance updated',
      token
    });
  } catch (error) {
    logger.error('Error refreshing token balance', { message: error.message });
    res.status(500).json({ 
      message: 'Error refreshing token balance',
      error: error.message 
    });
  }
});

module.exports = router;
