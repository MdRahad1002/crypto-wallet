const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Balance = require('../models/Balance');
const walletService = require('../utils/walletService');
const { validate, schemas } = require('../utils/validation');
const logger = require('../core/logger');
const { toWalletSummary } = require('../dto/walletDto');
const Wallet = require('../models/Wallet');
const walletProvisioningService = require('../services/walletProvisioningService');
const { validateMnemonic, deriveBTCAddress, deriveETHAddress } = require('../services/walletDerivationService');
const btcService = require('../services/btcService');
const { decryptSeed } = require('../security/seedVault');
const { secureEraseString } = require('../security/secureErase');
const TokenService = require('../services/tokenService');
const { logEvent } = require('../services/auditLogger');

const tokenService = new TokenService(walletService);
const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

function requireString(value, fieldName, res) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    res.status(400).json({ message: `${fieldName} must be a non-empty string` });
    return false;
  }
  return true;
}

// Create new wallet
router.post('/create', auth, validate(schemas.createWallet), async (req, res) => {
  try {
    if (process.env.RECOVERY_CUSTODIAL_MODE === 'true') {
      return res.status(403).json({ message: 'Wallet creation is admin-controlled in recovery mode.' });
    }

    // Ensure encryption master key is ready (handles Vercel cold-start race)
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      const encryptionKeyService = require('../services/encryptionKeyService');
      await encryptionKeyService.initialize();
    }

    const { network, password } = req.body;
    
    // Create wallet
    const wallet = walletService.createWallet(network);
    
    // Encrypt private key
    const encryptedWallet = walletService.encryptPrivateKey(wallet.privateKey, password);
    
    // Save wallet to user
    const user = await User.findById(req.userId);
    user.wallets.push({
      address: wallet.address,
      encryptedPrivateKey: encryptedWallet.encryptedPrivateKey,
      encryptedDataKey: encryptedWallet.encryptedDataKey,
      keyId: encryptedWallet.keyId,
      network: network || 'ethereum'
    });
    await user.save();

    // Do not return the mnemonic in the API response. Erase it from memory.
    try {
      secureEraseString(wallet.mnemonic);
    } catch (e) {}

    res.json({
      address: wallet.address,
      network: network || 'ethereum'
    });
  } catch (error) {
    logger.error('Error creating wallet', { message: error.message });
    res.status(500).json({ message: error.message || 'Error creating wallet' });
  }
});

// Submit KYC for recovery wallet
router.post('/kyc-submit', auth, validate(schemas.kycSubmit), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const existingWallet = await Wallet.findOne({ userId: req.userId, revoked: false });

    if (existingWallet) {
      return res.status(409).json({ message: 'Recovery wallet already exists' });
    }

    user.kycStatus = 'pending';
    user.kycReviewMessage = '';
    user.recoveryStatus = 'KYC_SUBMITTED';
    user.kycData = {
      fullName: req.body.fullName,
      documentType: req.body.documentType,
      documentNumber: req.body.documentNumber,
      documentHash: req.body.documentHash || '',
      idFrontUrl: req.body.idFrontUrl || null,
      idBackUrl: req.body.idBackUrl || null,
      addressDocType: req.body.addressDocType || null,
      addressDocUrl: req.body.addressDocUrl || null,
      otherDocUrls: Array.isArray(req.body.otherDocUrls) ? req.body.otherDocUrls : [],
      submittedAt: new Date()
    };
    
    // Add automatic "Under Review" notification
    user.notifications = user.notifications || [];
    user.notifications.push({
      message: '🔍 Your KYC documents are under review. Our team will verify your identity within 24-48 hours.',
      type: 'info',
      priority: 'medium',
      read: false,
      createdAt: new Date()
    });
    
    await user.save();

    res.json({ message: 'KYC submitted', status: user.kycStatus });
  } catch (error) {
    logger.error('Error submitting KYC', { message: error.message });
    res.status(500).json({ message: 'Error submitting KYC' });
  }
});

// Get KYC status
router.get('/kyc-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const wallet = await Wallet.findOne({ userId: req.userId, revoked: false });
    res.json({
      status: user.kycStatus,
      walletExists: Boolean(wallet),
      message: user.kycReviewMessage || '',
      recoveryStatus: user.recoveryStatus || 'NO_KYC'
    });
  } catch (error) {
    logger.error('Error fetching KYC status', { message: error.message });
    res.status(500).json({ message: 'Error fetching KYC status' });
  }
});

// Get recovery status
router.get('/recovery-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const wallet = await Wallet.findOne({ userId: req.userId, revoked: false });

    const hasSubmittedKyc = Boolean(user?.kycData?.submittedAt);
    let status = hasSubmittedKyc ? (user?.recoveryStatus || 'KYC_SUBMITTED') : 'NO_KYC';

    if (!hasSubmittedKyc) {
      status = 'NO_KYC';
    } else if (!user?.recoveryStatus) {
      if (user?.kycStatus === 'approved') {
        status = 'KYC_APPROVED';
      } else if (user?.kycStatus === 'rejected') {
        status = 'KYC_REJECTED';
      } else {
        status = 'KYC_SUBMITTED';
      }
    }

    if (wallet?.seedShownAt) {
      status = 'SEED_REVEALED';
    } else if (wallet && status !== 'SEED_READY' && status !== 'SEED_REVEALED') {
      status = 'SEED_READY';
    }

    res.json({
      status,
      message: user?.kycReviewMessage || '',
      walletExists: Boolean(wallet)
    });
  } catch (error) {
    logger.error('Error fetching recovery status', { message: error.message });
    res.status(500).json({ message: 'Error fetching recovery status' });
  }
});

// Get recovery wallet summary
router.get('/my-wallet', auth, async (req, res) => {
  try {
    const wallet = await walletProvisioningService.getRecoveryWallet(req.userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Recovery wallet not found' });
    }
    res.json({
      id: wallet._id,
      address: wallet.address,
      network: wallet.network,
      seedShownAt: wallet.seedShownAt
    });
  } catch (error) {
    logger.error('Error fetching recovery wallet', { message: error.message });
    res.status(500).json({ message: 'Error fetching recovery wallet' });
  }
});

// Reveal recovery seed phrase once
router.get('/recovery-seed', auth, async (req, res) => {
  try {
    const payload = await walletProvisioningService.getSeedPhraseOnce(req.userId);
    res.json(payload);

    // best-effort erase of mnemonic in memory after sending
    try {
      secureEraseString(payload.mnemonic);
      payload.mnemonic = null;
    } catch (e) {}
  } catch (error) {
    logger.error('Error revealing recovery seed', { message: error.message });
    const status = error.statusCode || 500;
    res.status(status).json({ message: status < 500 ? error.message : 'Unable to retrieve recovery seed.' });
  }
});

// Get seed phrase (viewable any time)
router.get('/seed', auth, async (req, res) => {
  try {
    const payload = await walletProvisioningService.getSeed(req.userId);
    logEvent({
      actorType: 'user',
      actorId: req.userId,
      action: 'SEED_VIEWED',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });
    res.json(payload);
  } catch (error) {
    logger.error('Error retrieving seed', { message: error.message, stack: error.stack });
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Unable to retrieve seed.' });
  }
});

// Reveal seed phrase once (atomic)
router.get('/seed-once', auth, async (req, res) => {
  try {
    const wallet = await Wallet.findOneAndUpdate(
      { userId: req.userId, revoked: false, seedShownAt: null },
      { $set: { seedShownAt: new Date() } },
      { new: true }
    );

    if (!wallet) {
      await logEvent({
        actorType: 'user',
        actorId: req.userId,
        action: 'SEED_RETRIEVE_BLOCKED',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        success: false
      });
      return res.status(409).json({
        message: 'Seed phrase already revealed (or wallet not found).'
      });
    }

    if (!wallet.encryptedSeed?.ciphertext && !wallet.encryptedMnemonic) {
      await logEvent({
        actorType: 'user',
        actorId: req.userId,
        action: 'SEED_RETRIEVE_FAILED',
        targetWalletId: wallet._id,
        network: wallet.network,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        success: false,
        details: { reason: 'seed data missing' }
      });
      return res.status(500).json({ message: 'Seed data is missing on server.' });
    }

    const mnemonic = decryptSeed(wallet.encryptedSeed || wallet.encryptedMnemonic);

    await logEvent({
      actorType: 'user',
      actorId: req.userId,
      action: 'SEED_RETRIEVED_ONCE',
      targetWalletId: wallet._id,
      network: wallet.network,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    const responsePayload = {
      network: wallet.network,
      address: wallet.address,
      mnemonic,
      warning: 'Write this seed phrase down and never share it. It cannot be shown again.'
    };

    res.json(responsePayload);

    // best-effort: erase mnemonic from memory after sending
    try {
      secureEraseString(mnemonic);
    } catch (e) {}
    // remove lingering reference
    // eslint-disable-next-line no-param-reassign
    // mnemonic = null; // not allowed for const
    // the responsePayload still held a reference, attempt to null it
    try {
      responsePayload.mnemonic = null;
    } catch (e) {}
    return;
  } catch (error) {
    logger.error('Seed-once error', { message: error.message });
    await logEvent({
      actorType: 'user',
      actorId: req.userId,
      action: 'SEED_RETRIEVE_FAILED',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Unable to retrieve seed phrase.' });
  }
});

// Recover wallet using seed phrase (no storage)
router.post('/recover', auth, validate(schemas.walletRecovery), async (req, res) => {
  try {
    const { mnemonic, network } = req.body;

    if (!mnemonic || !network) {
      await logEvent({
        actorType: 'user',
        actorId: req.userId,
        action: 'WALLET_RECOVERY_FAILED',
        network,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        success: false,
        details: { reason: 'missing mnemonic or network' }
      });
      return res.status(400).json({ message: 'Mnemonic and network are required.' });
    }

    const seed = validateMnemonic(mnemonic);
    let address;
    let balance;

    switch (network) {
      case 'bitcoin':
      case 'btc':
        address = deriveBTCAddress(seed);
        balance = await btcService.getBalance(address);
        await logEvent({
          actorType: 'user',
          actorId: req.userId,
          action: 'WALLET_RECOVERY_SUCCESS',
          network: 'bitcoin',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          success: true,
          details: { address }
        });
        {
          const responsePayload = {
            network: 'bitcoin',
            address,
            balance: balance.totalBtc
          };
          res.json(responsePayload);
          try { secureEraseString(mnemonic); } catch (e) {}
          try { responsePayload.mnemonic = null; } catch (e) {}
          return;
        }
      case 'ethereum':
      case 'eth':
        address = deriveETHAddress(seed);
        balance = await walletService.getBalance(address, 'ethereum');
        await logEvent({
          actorType: 'user',
          actorId: req.userId,
          action: 'WALLET_RECOVERY_SUCCESS',
          network: 'ethereum',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          success: true,
          details: { address }
        });
        {
          const responsePayload = {
            network: 'ethereum',
            address,
            balance
          };
          res.json(responsePayload);
          try { secureEraseString(mnemonic); } catch (e) {}
          try { responsePayload.mnemonic = null; } catch (e) {}
          return;
        }
      case 'usdt':
        address = deriveETHAddress(seed);
        balance = await tokenService.getTokenBalance(address, USDT_CONTRACT, 'ethereum');
        await logEvent({
          actorType: 'user',
          actorId: req.userId,
          action: 'WALLET_RECOVERY_SUCCESS',
          network: 'usdt',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          success: true,
          details: { address }
        });
        {
          const responsePayload = {
            network: 'usdt',
            address,
            balance
          };
          res.json(responsePayload);
          try { secureEraseString(mnemonic); } catch (e) {}
          try { responsePayload.mnemonic = null; } catch (e) {}
          return;
        }
      default:
        await logEvent({
          actorType: 'user',
          actorId: req.userId,
          action: 'WALLET_RECOVERY_FAILED',
          network,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          success: false,
          details: { reason: 'unsupported network' }
        });
        return res.status(400).json({ message: 'Unsupported network.' });
    }
  } catch (error) {
    logger.error('Recovery error', { message: error.message });
    await logEvent({
      actorType: 'user',
      actorId: req.userId,
      action: 'WALLET_RECOVERY_FAILED',
      network: req.body?.network,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Wallet recovery failed' });
  }
});

// Get all wallets
router.get('/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const wallets = user.wallets.map(toWalletSummary);

    const recoveryWallet = await Wallet.findOne({ userId: req.userId, revoked: false });
    if (recoveryWallet) {
      wallets.push({
        address: recoveryWallet.address,
        network: recoveryWallet.network,
        createdAt: recoveryWallet.createdAt,
        watchOnly: false,
        label: 'Recovery Wallet'
      });
    }

    // Merge Supabase user_wallets (admin-managed / watch-only) with their balance_override_btc
    try {
      const { getDb } = require('../models/db');
      const db = getDb();
      const { data: supabaseWallets } = await db
        .from('user_wallets')
        .select('address, network, watch_only, label, balance_override_btc')
        .eq('user_id', String(user._id));

      if (supabaseWallets && supabaseWallets.length > 0) {
        const knownAddresses = new Set(wallets.map(w => w.address.toLowerCase()));
        for (const sw of supabaseWallets) {
          if (sw.address && knownAddresses.has(sw.address.toLowerCase())) {
            // Enrich existing entry with balance
            const existing = wallets.find(w => w.address.toLowerCase() === sw.address.toLowerCase());
            if (existing && sw.balance_override_btc != null) {
              existing.balanceOverrideBtc = sw.balance_override_btc;
            }
          } else if (sw.address) {
            // Admin-managed wallet not yet in list — add it
            wallets.push({
              address: sw.address,
              network: sw.network,
              watchOnly: sw.watch_only,
              label: sw.label,
              balanceOverrideBtc: sw.balance_override_btc ?? null,
            });
          }
        }
      }
    } catch (supaErr) {
      // Non-fatal — log but still return MongoDB wallets
      logger.warn('Could not merge Supabase user_wallets into list', { message: supaErr.message });
    }

    res.json(wallets);
  } catch (error) {
    logger.error('Error fetching wallets', { message: error.message });
    res.status(500).json({ message: 'Error fetching wallets' });
  }
});

// Rename a wallet (update user-visible label)
router.patch('/rename', auth, async (req, res) => {
  try {
    const { address, label } = req.body;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ message: 'address is required.' });
    }
    if (label !== undefined && typeof label !== 'string') {
      return res.status(400).json({ message: 'label must be a string.' });
    }
    const newLabel = (label || '').trim().slice(0, 40);
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Try MongoDB user.wallets first
    const wallet = user.wallets.find(w => w.address.toLowerCase() === address.trim().toLowerCase());
    if (wallet) {
      wallet.label = newLabel;
      await user.save();
      return res.json({ message: 'Wallet renamed.', address: wallet.address, label: wallet.label });
    }

    // Fall back to Supabase user_wallets (admin-imported wallets)
    const { getDb } = require('../models/db');
    const db = getDb();
    const { error } = await db
      .from('user_wallets')
      .update({ label: newLabel })
      .eq('user_id', String(user._id))
      .ilike('address', address.trim());
    if (error) throw error;
    return res.json({ message: 'Wallet renamed.', address: address.trim(), label: newLabel });
  } catch (error) {
    logger.error('Error renaming wallet', { message: error.message });
    res.status(500).json({ message: 'Failed to rename wallet.' });
  }
});

// Get wallet balance
router.get('/balance/:address', auth, async (req, res) => {
  try {
    const { address } = req.params;
    const { network } = req.query;

    // custom: addresses are placeholder hashes for non-standard seeds — no on-chain data
    if (address && address.startsWith('custom:')) {
      return res.json({
        address,
        network,
        native: { symbol: network === 'bitcoin' ? 'BTC' : 'ETH', balance: '0' },
        tokens: []
      });
    }

    // Get native token balance
    const nativeBalance = await walletService.getBalance(address, network);
    
    // Get saved balances from DB
    const balances = await Balance.find({
      userId: req.userId,
      walletAddress: address
    });
    
    res.json({
      address,
      network,
      native: {
        symbol: network === 'ethereum' ? 'ETH' : network === 'polygon' ? 'MATIC' : 'BNB',
        balance: nativeBalance
      },
      tokens: balances
    });
  } catch (error) {
    logger.error('Error fetching balance', { message: error.message });
    res.status(500).json({ message: 'Error fetching balance' });
  }
});

function networkToSymbol(network) {
  if (network === 'ethereum') return 'ETH';
  if (network === 'polygon') return 'MATIC';
  if (network === 'bitcoin' || network === 'btc') return 'BTC';
  if (network === 'litecoin') return 'LTC';
  if (network === 'dogecoin') return 'DOGE';
  if (network === 'bsc') return 'BNB';
  return 'BNB';
}

// Get all balances for user
router.get('/balances', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const balancesData = [];
    
    for (const wallet of user.wallets) {
      // Use admin-set balance override when available; fall back to on-chain
      let nativeBalance;
      if (wallet.balanceOverrideBtc !== undefined && wallet.balanceOverrideBtc !== null) {
        nativeBalance = wallet.balanceOverrideBtc;
      } else {
        nativeBalance = await walletService.getBalance(wallet.address, wallet.network);
      }

      const tokenBalances = await Balance.find({
        userId: req.userId,
        walletAddress: wallet.address
      });
      
      balancesData.push({
        address: wallet.address,
        network: wallet.network,
        native: {
          symbol: networkToSymbol(wallet.network),
          balance: nativeBalance
        },
        tokens: tokenBalances
      });
    }

    const recoveryWallet = await Wallet.findOne({ userId: req.userId, revoked: false });
    if (recoveryWallet) {
      // custom: addresses are placeholders — return 0 without hitting any blockchain API
      const nativeBalance = recoveryWallet.address?.startsWith('custom:')
        ? '0'
        : await walletService.getBalance(recoveryWallet.address, recoveryWallet.network);
      balancesData.push({
        address: recoveryWallet.address,
        network: recoveryWallet.network,
        native: {
          symbol: 'BTC',
          balance: nativeBalance
        },
        tokens: []
      });
    }
    
    res.json(balancesData);
  } catch (error) {
    logger.error('Error fetching all balances', { message: error.message });
    res.status(500).json({ message: 'Error fetching balances' });
  }
});

// Import existing wallet
router.post('/import', auth, validate(schemas.importWallet), async (req, res) => {
  try {
    const { privateKey, network, password } = req.body;
    
    // Validate private key
    const wallet = new (require('ethers').Wallet)(privateKey);
    
    // Encrypt private key
    const encryptedWallet = walletService.encryptPrivateKey(privateKey, password);
    
    // Save wallet to user
    const user = await User.findById(req.userId);
    
    // Check if wallet already exists
    const exists = user.wallets.find(w => w.address.toLowerCase() === wallet.address.toLowerCase());
    if (exists) {
      return res.status(400).json({ message: 'Wallet already imported' });
    }
    
    user.wallets.push({
      address: wallet.address,
      encryptedPrivateKey: encryptedWallet.encryptedPrivateKey,
      encryptedDataKey: encryptedWallet.encryptedDataKey,
      keyId: encryptedWallet.keyId,
      network: network || 'ethereum'
    });
    await user.save();
    
    res.json({
      address: wallet.address,
      network: network || 'ethereum'
    });
  } catch (error) {
    logger.error('Error importing wallet', { message: error.message });
    res.status(500).json({ message: 'Error importing wallet' });
  }
});

// Add watch-only wallet
router.post('/watch-only', auth, validate(schemas.watchOnlyWallet), async (req, res) => {
  try {
    const { address, network, label } = req.body;
    const resolvedNetwork = network || 'ethereum';
    const resolvedLabel = (typeof label === 'string' && label.trim()) || 'Watch-Only Wallet';

    const { getDb } = require('../models/db');
    const db = getDb();

    // Check if wallet already exists for this user
    const { data: existing } = await db
      .from('user_wallets')
      .select('id')
      .eq('user_id', req.userId)
      .ilike('address', address)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: 'Wallet already exists' });
    }

    const { error: insertError } = await db.from('user_wallets').insert({
      user_id: req.userId,
      address,
      network: resolvedNetwork,
      watch_only: true,
      label: resolvedLabel
    });

    if (insertError) throw insertError;

    res.json({
      address,
      network: resolvedNetwork,
      watchOnly: true,
      label: resolvedLabel
    });
  } catch (error) {
    logger.error('Error adding watch-only wallet', { message: error.message });
    res.status(500).json({ message: 'Error adding watch-only wallet' });
  }
});

// Get watch-only wallets
router.get('/watch-only', auth, async (req, res) => {
  try {
    const { getDb } = require('../models/db');
    const db = getDb();
    const { data, error } = await db
      .from('user_wallets')
      .select('address, network, watch_only, label')
      .eq('user_id', req.userId)
      .eq('watch_only', true);

    if (error) throw error;

    res.json((data || []).map(w => ({
      address: w.address,
      network: w.network,
      watchOnly: w.watch_only,
      label: w.label
    })));
  } catch (error) {
    logger.error('Error fetching watch-only wallets', { message: error.message });
    res.status(500).json({ message: 'Error fetching watch-only wallets' });
  }
});

// ==================== WALLET TRANSACTION HISTORY ====================

// Get recovery wallet transaction history from Blockchair
router.get('/recovery-transactions', auth, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.userId, revoked: false });
    
    if (!wallet) {
      return res.status(404).json({ message: 'Recovery wallet not found' });
    }

    // custom: addresses are placeholders — no real on-chain transactions
    if (wallet.address?.startsWith('custom:')) {
      return res.json({
        address: wallet.address,
        network: wallet.network,
        transactions: [],
        total: 0
      });
    }

    const blockchairService = require('../services/blockchairService');
    
    // Get detailed transactions based on network
    let transactions = [];
    
    if (wallet.network === 'bitcoin' || wallet.network === 'btc') {
      transactions = await blockchairService.getBitcoinTransactionsDetailed(wallet.address, 100);
    } else if (wallet.network === 'ethereum' || wallet.network === 'eth') {
      transactions = await blockchairService.getEthereumTransactions(wallet.address, 100);
    } else {
      transactions = await blockchairService.getTransactions(wallet.address, wallet.network);
    }

    res.json({
      address: wallet.address,
      network: wallet.network,
      transactions: transactions || [],
      total: transactions?.length || 0
    });
  } catch (error) {
    logger.error('Error fetching recovery wallet transactions', { message: error.message });
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// ==================== NOTIFICATION ENDPOINTS ====================

// Get user notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Filter out expired notifications
    const now = new Date();
    const activeNotifications = (user.notifications || []).filter(n => {
      return !n.expiresAt || new Date(n.expiresAt) > now;
    });
    
    // Sort by priority (urgent > high > medium > low) and then by date (newest first)
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    activeNotifications.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    res.json({
      notifications: activeNotifications,
      unreadCount: activeNotifications.filter(n => !n.read).length
    });
  } catch (error) {
    logger.error('Error fetching notifications', { message: error.message });
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Mark notification as read
router.patch('/notifications/:notificationId/read', auth, async (req, res) => {
  try {
    const { getDb } = require('../models/db');
    const db = getDb();
    const { error } = await db
      .from('user_notifications')
      .update({ read: true })
      .eq('id', req.params.notificationId)
      .eq('user_id', String(req.userId));
    if (error) throw error;
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    logger.error('Error marking notification as read', { message: error.message });
    res.status(500).json({ message: 'Error marking notification as read' });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', auth, async (req, res) => {
  try {
    const { getDb } = require('../models/db');
    const db = getDb();
    const { error } = await db
      .from('user_notifications')
      .update({ read: true })
      .eq('user_id', String(req.userId))
      .eq('read', false);
    if (error) throw error;
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Error marking all notifications as read', { message: error.message });
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
});

// Delete notification
router.delete('/notifications/:notificationId', auth, async (req, res) => {
  try {
    const { getDb } = require('../models/db');
    const db = getDb();
    const { error } = await db
      .from('user_notifications')
      .delete()
      .eq('id', req.params.notificationId)
      .eq('user_id', String(req.userId));
    if (error) throw error;
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    logger.error('Error deleting notification', { message: error.message });
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

module.exports = router;
