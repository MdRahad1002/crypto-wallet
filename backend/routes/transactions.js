const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const walletService = require('../utils/walletService');
const explorerService = require('../services/explorerService');
const btcService = require('../services/btcService');
const { validate, schemas } = require('../utils/validation');
const nonceLock = require('../security/nonceLock');
const { idempotencyGuard } = require('../security/txGuard');
const logger = require('../core/logger');

function requireString(value, fieldName, res) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    res.status(400).json({ message: `${fieldName} must be a non-empty string` });
    return false;
  }
  return true;
}

// Get transaction history (database only)
router.get('/history', auth, async (req, res) => {
  try {
    const { limit = 50, skip = 0, type, status } = req.query;
    
    const query = { userId: req.userId };
    if (type) query.type = type;
    if (status) query.status = status;
    
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await Transaction.countDocuments(query);
    
    res.json({
      transactions,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    logger.error('Error fetching transaction history', { message: error.message });
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// Get blockchain transaction history for a specific address
router.get('/blockchain/:address', auth, async (req, res) => {
  try {
    const { address } = req.params;
    const { network = 'ethereum' } = req.query;

    if (!requireString(address, 'Address', res)) {
      return;
    }

    // Verify user owns this address
    const user = await User.findById(req.userId);
    const wallet = user.wallets.find(w => 
      w.address.toLowerCase() === address.toLowerCase()
    );

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Fetch from blockchain explorer
    const transactions = network === 'bitcoin' || network === 'btc'
      ? btcService.mapTransactions(await btcService.getTransactions(address), address)
      : await explorerService.getAllTransactions(address, network);

    res.json({
      address,
      network,
      transactions,
      total: transactions.length
    });
  } catch (error) {
    logger.error('Error fetching blockchain history', { message: error.message });
    res.status(500).json({ 
      message: 'Error fetching blockchain transactions',
      error: error.message 
    });
  }
});

// Send cryptocurrency
router.post('/send', auth, idempotencyGuard(), validate(schemas.sendTransaction), async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, cryptocurrency, network, password } = req.body;
    
    // Validate inputs
    if (!fromAddress || !toAddress || !amount || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!requireString(fromAddress, 'From address', res) || !requireString(toAddress, 'To address', res)) {
      return;
    }
    
    // Get user and find wallet
    const user = await User.findById(req.userId);
    const wallet = user.wallets.find(w => 
      w.address.toLowerCase() === fromAddress.toLowerCase()
    );
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    await nonceLock.withNonceLock(`wallet:${wallet.address}`, async () => {
      // Decrypt private key
      const privateKey = walletService.decryptPrivateKey(wallet, password);

      // Create pending transaction
      const transaction = new Transaction({
        userId: req.userId,
        type: 'send',
        cryptocurrency: cryptocurrency || 'ETH',
        amount,
        fromAddress,
        toAddress,
        network: network || wallet.network,
        status: 'pending'
      });
      await transaction.save();

      try {
        // Send transaction on blockchain
        const receipt = await walletService.sendTransaction(
          privateKey,
          toAddress,
          amount,
          network || wallet.network
        );

        // Update transaction with receipt
        transaction.txHash = receipt.hash;
        transaction.blockNumber = receipt.blockNumber;
        transaction.gasUsed = receipt.gasUsed;
        transaction.status = receipt.status;
        await transaction.save();

        res.json({
          message: 'Transaction sent successfully',
          transaction: {
            id: transaction._id,
            hash: receipt.hash,
            status: receipt.status
          }
        });
      } catch (txError) {
        // Update transaction status to failed
        transaction.status = 'failed';
        await transaction.save();
        throw txError;
      }
    });
  } catch (error) {
    logger.error('Error sending transaction', { message: error.message });
    res.status(500).json({ 
      message: 'Error sending transaction',
      error: error.message 
    });
  }
});

// Record deposit (when receiving crypto)
router.post('/deposit', auth, async (req, res) => {
  try {
    const { toAddress, amount, cryptocurrency, txHash, network } = req.body;
    
    const transaction = new Transaction({
      userId: req.userId,
      type: 'deposit',
      cryptocurrency: cryptocurrency || 'ETH',
      amount,
      toAddress,
      txHash,
      network: network || 'ethereum',
      status: 'confirmed'
    });
    
    await transaction.save();
    
    res.json({
      message: 'Deposit recorded',
      transaction
    });
  } catch (error) {
    logger.error('Error recording deposit', { message: error.message });
    res.status(500).json({ message: 'Error recording deposit' });
  }
});

// Withdraw request — creates a pending withdrawal for admin approval
router.post('/withdraw', auth, validate(schemas.withdrawTransaction), async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, cryptocurrency, network, description } = req.body;

    // Get user and verify wallet belongs to them (any wallet type allowed)
    const user = await User.findById(req.userId);
    const fromAddrStr = typeof fromAddress === 'string' ? fromAddress : String(fromAddress || '');
    const wallet = (user.wallets || []).find(w =>
      (w.address || '').toLowerCase() === fromAddrStr.toLowerCase()
    );

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Create transaction in pending state — admin must approve before funds move
    const transaction = new Transaction({
      userId: req.userId,
      type: 'withdraw',
      cryptocurrency: cryptocurrency || wallet.network?.toUpperCase() || 'BTC',
      amount,
      fromAddress: fromAddrStr,
      toAddress,
      network: network || wallet.network || 'bitcoin',
      status: 'pending',
      description: description || '',
      adminNote: 'Awaiting admin approval'
    });
    await transaction.save();

    logger.info('withdrawal_request_created', { userId: req.userId, txId: transaction.id, amount, cryptocurrency });

    res.json({
      message: 'Withdrawal request submitted. Pending admin approval.',
      transaction: {
        id: transaction.id,
        status: 'pending',
        amount,
        cryptocurrency: transaction.cryptocurrency,
        toAddress
      }
    });
  } catch (error) {
    logger.error('Error creating withdrawal request', { message: error.message });
    res.status(500).json({ 
      message: 'Error submitting withdrawal request',
      error: error.message 
    });
  }
});

// Get deposit addresses (user-facing — returns only addresses assigned to this user)
router.get('/deposit-addresses', auth, async (req, res) => {
  try {
    const { getDb } = require('../models/db');
    const db = getDb();
    const { data, error } = await db
      .from('user_deposit_addresses')
      .select('id, network, cryptocurrency, address, label, sort_order')
      .eq('user_id', String(req.userId))
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      // Table doesn't exist yet — return empty list, not 500
      logger.warn('user_deposit_addresses_table_missing', { message: error.message });
      return res.json({ addresses: [], needsSetup: true });
    }
    res.json({ addresses: data || [] });
  } catch (err) {
    logger.error('get_user_deposit_addresses_error', { message: err.message });
    res.json({ addresses: [] }); // Graceful empty instead of 500
  }
});

// Get transaction by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    logger.error('Error fetching transaction', { message: error.message });
    res.status(500).json({ message: 'Error fetching transaction' });
  }
});

// Estimate gas fee
router.post('/estimate-gas', auth, validate(schemas.gasEstimation), async (req, res) => {
  try {
    const { toAddress, amount, network } = req.body;
    
    const estimate = await walletService.estimateGas(
      toAddress,
      amount,
      network || 'ethereum'
    );
    
    res.json(estimate);
  } catch (error) {
    logger.error('Error estimating gas', { message: error.message });
    res.status(500).json({ message: 'Error estimating gas fee' });
  }
});

// Send batch transactions
router.post('/send-batch', auth, idempotencyGuard(), validate(schemas.batchTransaction), async (req, res) => {
  try {
    const { fromAddress, recipients, cryptocurrency, network, password } = req.body;
    
    // Validate inputs
    if (!fromAddress || !recipients || !Array.isArray(recipients) || recipients.length === 0 || !password) {
      return res.status(400).json({ message: 'Missing required fields or invalid recipients' });
    }

    if (!requireString(fromAddress, 'From address', res)) {
      return;
    }
    
    // Validate each recipient
    for (const recipient of recipients) {
      if (!recipient.address || !recipient.amount) {
        return res.status(400).json({ message: 'Each recipient must have an address and amount' });
      }
      if (!requireString(recipient.address, 'Recipient address', res)) {
        return;
      }
    }
    
    // Get user and find wallet
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

      // Process each transaction
      const results = [];
      const transactions = [];

      for (const recipient of recipients) {
        try {
          // Create pending transaction
          const transaction = new Transaction({
            userId: req.userId,
            type: 'send',
            cryptocurrency: cryptocurrency || 'ETH',
            amount: recipient.amount,
            fromAddress,
            toAddress: recipient.address,
            network: network || wallet.network,
            status: 'pending'
          });
          await transaction.save();
          transactions.push(transaction);

          // Send transaction on blockchain
          const receipt = await walletService.sendTransaction(
            privateKey,
            recipient.address,
            recipient.amount,
            network || wallet.network
          );

          // Update transaction with receipt
          transaction.txHash = receipt.hash;
          transaction.blockNumber = receipt.blockNumber;
          transaction.gasUsed = receipt.gasUsed;
          transaction.status = receipt.status;
          await transaction.save();

          results.push({
            address: recipient.address,
            amount: recipient.amount,
            success: true,
            hash: receipt.hash,
            transactionId: transaction._id
          });
        } catch (txError) {
          logger.error('Error sending batch transaction', { address: recipient.address, message: txError.message });

          // Mark transaction as failed
          const failedTx = transactions[transactions.length - 1];
          if (failedTx) {
            failedTx.status = 'failed';
            await failedTx.save();
          }

          results.push({
            address: recipient.address,
            amount: recipient.amount,
            success: false,
            error: txError.message
          });
        }
      }

      // Calculate summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.json({
        message: 'Batch transaction processing completed',
        summary: {
          total: recipients.length,
          successful,
          failed
        },
        results
      });
    });
    
  } catch (error) {
    logger.error('Error processing batch transactions', { message: error.message });
    res.status(500).json({ 
      message: 'Error processing batch transactions',
      error: error.message 
    });
  }
});

module.exports = router;
