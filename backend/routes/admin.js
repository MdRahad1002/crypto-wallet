const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminGuard = require('../security/adminGuard');
const { getDb } = require('../models/db');
const { logAdminAction } = require('../security/auditLog');
const { logEvent } = require('../services/auditLogger');
const logger = require('../core/logger');
const { toAdminListUser, toUserDetails } = require('../dto/userDto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Token = require('../models/Token');
const Balance = require('../models/Balance');
const Webhook = require('../models/Webhook');
const Wallet = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');
const SupportTicket = require('../models/SupportTicket');
const bip39 = require('bip39');
const walletProvisioningService = require('../services/walletProvisioningService');
const { validateMnemonic } = require('../services/walletDerivationService');
const { getLiveUsdPrices } = require('../services/pricesService');
const { secureEraseString } = require('../security/secureErase');
const { revokeAllUserTokens } = require('../security/tokenRevocation');
const metricsService = require('../services/metricsService');

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE RECALCULATION HELPER
// Replays ALL confirmed transactions for a user+network in chronological order.
// receive/deposit → add; send/withdraw → subtract (floor at 0).
// A send/withdraw whose timestamp is before any receive will not produce a
// negative balance, so it will be absorbed (capped at 0) at that point in
// the replay, leaving later receives untouched.
// ─────────────────────────────────────────────────────────────────────────────
async function recalcBalance(userId, network) {
  const db = getDb();
  const { data: txRows, error } = await db
    .from('transactions')
    .select('type, amount, timestamp')
    .eq('user_id', String(userId))
    .eq('network', network)
    .eq('status', 'confirmed')
    .order('timestamp', { ascending: true });

  if (error) throw error;

  const balance = (txRows || []).reduce((acc, row) => {
    const amt = parseFloat(row.amount) || 0;
    if (row.type === 'receive' || row.type === 'deposit') return acc + amt;
    if (row.type === 'send'    || row.type === 'withdraw') return Math.max(0, acc - amt);
    return acc;
  }, 0);

  // Upsert the wallet row for this user+network
  const { data: existing } = await db
    .from('user_wallets')
    .select('id')
    .eq('user_id', String(userId))
    .eq('network', network);

  if (existing && existing.length > 0) {
    await db
      .from('user_wallets')
      .update({ balance_override_btc: balance, balance_updated_at: new Date().toISOString() })
      .eq('id', existing[0].id);
  } else {
    const cryptoLabel = {
      bitcoin: 'BTC', ethereum: 'ETH', polygon: 'MATIC',
      bsc: 'BNB', litecoin: 'LTC', dogecoin: 'DOGE'
    }[network] || network.toUpperCase();
    await db.from('user_wallets').insert({
      user_id: String(userId),
      address: `admin-managed-${network}-${userId}`,
      network,
      watch_only: true,
      label: cryptoLabel,
      balance_override_btc: balance,
      balance_updated_at: new Date().toISOString()
    });
  }
  return balance;
}

// Get dashboard statistics
router.get('/stats', adminAuth, adminGuard(), async (req, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = {
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      totalTransactions: await Transaction.countDocuments(),
      pendingTransactions: await Transaction.countDocuments({ status: 'pending' }),
      completedTransactions: await Transaction.countDocuments({ status: 'completed' }),
      failedTransactions: await Transaction.countDocuments({ status: 'failed' }),
      recoveries24h: await Transaction.countDocuments({ status: 'completed', timestamp: { $gte: since24h } }),
      failedTransactions24h: await Transaction.countDocuments({ status: 'failed', timestamp: { $gte: since24h } }),
      totalWallets: await User.aggregate([
        { $project: { walletCount: { $size: '$wallets' } } },
        { $group: { _id: null, total: { $sum: '$walletCount' } } }
      ]).then(result => result[0]?.total || 0),
      totalTokens: await Token.countDocuments(),
      recentUsers: await User.find()
        .select('name email createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      recentTransactions: await Transaction.find()
        .select('type cryptocurrency amount status timestamp')
        .sort({ timestamp: -1 })
        .limit(10)
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching admin stats', { message: error.message });
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// Get all users with pagination
router.get('/users', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;

    // Allowlist-sanitize search: only permit characters valid in emails and names.
    // This prevents ReDoS and NoSQL injection without relying solely on escaping.
    const rawSearch = typeof search === 'string' ? search.slice(0, 100) : '';
    const sanitizedSearch = rawSearch.replace(/[^a-zA-Z0-9 @.\-_]/g, '');

    const query = sanitizedSearch ? {
      $or: [
        { email: { $regex: sanitizedSearch, $options: 'i' } },
        { name: { $regex: sanitizedSearch, $options: 'i' } }
      ]
    } : {};

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    res.json({
      users: users.map(toAdminListUser),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error fetching users', { message: error.message });
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get specific user details
router.get('/users/:id', adminAuth, adminGuard(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const transactions = await Transaction.find({ userId: user._id })
      .sort({ timestamp: -1 })
      .limit(20);

    const tokens = await Token.find({ userId: user._id });

    // Fetch notifications directly from DB so admin always sees latest
    const db = getDb();
    const { data: notifRows } = await db
      .from('user_notifications')
      .select('*')
      .eq('user_id', String(user._id))
      .order('created_at', { ascending: false });

    const notifications = (notifRows || []).map(r => ({
      id: r.id, _id: r.id,
      message: r.message,
      type: r.type || 'info',
      priority: r.priority || 'medium',
      read: r.read || false,
      createdAt: r.created_at
    }));

    res.json({
      user: toUserDetails(user),
      transactions,
      tokens,
      notifications
    });
  } catch (error) {
    logger.error('Error fetching user details', { message: error.message });
    res.status(500).json({ message: 'Error fetching user details' });
  }
});

// Update user role
router.patch('/users/:id/role', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-demotion
    if (user._id.toString() === req.userId.toString() && role === 'user') {
      return res.status(400).json({ message: 'Cannot demote yourself' });
    }

    user.role = role;
    user.isAdmin = role === 'admin';
    await user.save();

    logAdminAction({
      userId: req.userId,
      action: 'update_user_role',
      targetId: user._id.toString(),
      ip: req.ip,
      metadata: { role }
    });

    res.json({ 
      message: 'User role updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    logger.error('Error updating user role', { message: error.message });
    res.status(500).json({ message: 'Error updating user role' });
  }
});

// Delete user
router.delete('/users/:id', adminAuth, adminGuard(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-deletion
    if (user._id.toString() === req.userId.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user's associated data
    await Transaction.deleteMany({ userId: user._id });
    await Token.deleteMany({ userId: user._id });
    await Balance.deleteMany({ userId: user._id });
    
    await User.findByIdAndDelete(req.params.id);

    logAdminAction({
      userId: req.userId,
      action: 'delete_user',
      targetId: req.params.id,
      ip: req.ip
    });

    res.json({ message: 'User and associated data deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user', { message: error.message });
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Create a new user (admin only)
router.post('/users', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    // Reject non-string inputs to prevent type confusion before accessing .length
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Name, email and password must be strings.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'A user with that email already exists.' });
    }

    const user = new User({ name, email, password, role: role === 'admin' ? 'admin' : 'user' });
    if (role === 'admin') user.isAdmin = true;
    await user.save();

    logAdminAction({
      userId: req.userId,
      action: 'create_user',
      targetId: user._id,
      ip: req.ip
    });

    res.status(201).json({ message: 'User created successfully.', userId: user._id });
  } catch (error) {
    logger.error('Error creating user', { message: error.message });
    res.status(500).json({ message: 'Error creating user.' });
  }
});

// Get all transactions with filters
router.get('/transactions', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { page = 1, limit = 50, status, type, userId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (userId) query.userId = userId;

    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('userId', 'name email');

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error fetching transactions', { message: error.message });
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// Get system logs (last 100 activities)
router.get('/logs', adminAuth, adminGuard(), async (req, res) => {
  try {
    const {
      action,
      actorType,
      actorId,
      targetUserId,
      network,
      success,
      limit = 100
    } = req.query;

    const query = {};
    if (action) query.action = action;
    if (actorType) query.actorType = actorType;
    if (actorId) query.actorId = actorId;
    if (targetUserId) query.targetUserId = targetUserId;
    if (network) query.network = network;
    if (typeof success !== 'undefined') {
      query.success = success === 'true' || success === true;
    }

    const limitValue = Math.min(parseInt(limit, 10) || 100, 500);

    const auditLogs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limitValue)
      .lean();

    const userIds = new Set();
    auditLogs.forEach((log) => {
      if (log.actorId) userIds.add(log.actorId.toString());
      if (log.targetUserId) userIds.add(log.targetUserId.toString());
    });

    const users = await User.find({ _id: { $in: Array.from(userIds) } })
      .select('name email')
      .lean();

    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const formatUser = (userId) => {
      if (!userId) return null;
      const user = userMap.get(userId.toString());
      return user ? `${user.name} (${user.email})` : userId.toString();
    };

    const logs = auditLogs.map((log) => {
      const actorLabel = formatUser(log.actorId) || log.actorType || 'system';
      const targetLabel = formatUser(log.targetUserId);

      const detailParts = [];
      if (targetLabel) detailParts.push(`target user: ${targetLabel}`);
      if (log.targetWalletId) detailParts.push(`wallet: ${log.targetWalletId}`);
      if (log.network) detailParts.push(`network: ${log.network}`);
      if (log.ip) detailParts.push(`ip: ${log.ip}`);
      if (log.details && Object.keys(log.details).length > 0) {
        detailParts.push(`details: ${JSON.stringify(log.details)}`);
      }

      return {
        id: log._id,
        action: log.action,
        user: actorLabel,
        details: detailParts.join(' | ') || '—',
        timestamp: log.createdAt,
        status: log.success ? 'completed' : 'failed'
      };
    });

    res.json({ logs });
  } catch (error) {
    logger.error('Error fetching logs', { message: error.message });
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

// Get analytics data
router.get('/analytics', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    // User growth
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { 
        $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Transaction volume
    const transactionVolume = await Transaction.aggregate([
      { $match: { timestamp: { $gte: startDate }, status: 'completed' } },
      { 
        $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Popular cryptocurrencies
    const popularCrypto = await Transaction.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$cryptocurrency',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      userGrowth,
      transactionVolume,
      popularCrypto
    });
  } catch (error) {
    logger.error('Error fetching analytics', { message: error.message });
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// Market analytics (recovery attempts + price snapshot)
router.get('/market-analytics', adminAuth, adminGuard(), async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days || 7)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const match = {
      createdAt: { $gte: since },
      action: { $in: ['WALLET_RECOVERY_SUCCESS', 'WALLET_RECOVERY_FAILED'] }
    };

    const agg = await AuditLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { action: '$action', network: '$network' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totals = {
      success: 0,
      failed: 0,
      byNetwork: {
        bitcoin: { success: 0, failed: 0 },
        ethereum: { success: 0, failed: 0 },
        usdt: { success: 0, failed: 0 }
      }
    };

    for (const row of agg) {
      const action = row._id.action;
      const network = row._id.network || 'unknown';
      const count = row.count;
      const isSuccess = action === 'WALLET_RECOVERY_SUCCESS';

      if (isSuccess) totals.success += count;
      else totals.failed += count;

      if (totals.byNetwork[network]) {
        if (isSuccess) totals.byNetwork[network].success += count;
        else totals.byNetwork[network].failed += count;
      }
    }

    const prices = await getLiveUsdPrices();

    res.json({
      days,
      totals,
      pricesSnapshotUsd: prices
    });
  } catch (error) {
    next(error);
  }
});

// List webhooks
router.get('/webhooks', adminAuth, adminGuard(), async (req, res) => {
  try {
    const webhooks = await Webhook.find().sort({ createdAt: -1 });
    res.json({ webhooks });
  } catch (error) {
    logger.error('Error fetching webhooks', { message: error.message });
    res.status(500).json({ message: 'Error fetching webhooks' });
  }
});

// List pending KYC users
router.get('/kyc/pending', adminAuth, adminGuard(), async (req, res) => {
  try {
    const users = await User.find({ kycStatus: 'pending' })
      .select('name email kycData kycStatus createdAt')
      .sort({ 'kycData.submittedAt': -1 });

    res.json({ users });
  } catch (error) {
    logger.error('Error fetching pending KYC', { message: error.message });
    res.status(500).json({ message: 'Error fetching pending KYC' });
  }
});

// List KYC-approved users who are awaiting seed provisioning
router.get('/kyc/approved', adminAuth, adminGuard(), async (req, res) => {
  try {
    const users = await User.find({ kycStatus: 'approved', recoveryStatus: 'KYC_APPROVED' })
      .select('name email kycData kycStatus recoveryStatus createdAt')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    logger.error('Error fetching approved KYC users', { message: error.message });
    res.status(500).json({ message: 'Error fetching approved KYC users' });
  }
});

// Approve KYC
router.patch('/kyc/:userId/approve', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { seedPhrase } = req.body || {};

    // Reject non-string seed phrase to prevent type confusion attacks
    if (seedPhrase !== undefined && typeof seedPhrase !== 'string') {
      return res.status(400).json({ message: 'seedPhrase must be a string' });
    }

    // Validate seed phrase if provided
    if (seedPhrase) {
      const words = seedPhrase.trim().split(/\s+/);
      if (words.length !== 12) {
        return res.status(400).json({ message: 'Seed phrase must be exactly 12 words' });
      }
      // Validate BIP39 wordlist + checksum here so the admin gets a clear 400
      // instead of a 500 from deep inside provisionRecoveryWallet
      try {
        validateMnemonic(seedPhrase.trim());
      } catch (bip39Err) {
        return res.status(400).json({
          message: 'Invalid seed phrase: words must be from the BIP39 wordlist with a valid checksum. Try generating one at https://iancoleman.io/bip39/'
        });
      }
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Persist kycStatus change FIRST so that walletProvisioningService.provisionRecoveryWallet
    // sees kycStatus:'approved' when it re-loads the user from Supabase internally.
    user.kycStatus = 'approved';
    user.kycReviewMessage = '';
    user.recoveryStatus = 'KYC_APPROVED'; // default; overwritten below if seed provided
    await user.save();

    // If admin provided a seed phrase, provision the recovery wallet immediately
    if (seedPhrase) {
      try {
        await walletProvisioningService.provisionRecoveryWallet({
          userId: user._id.toString(),
          adminId: req.userId,
          mnemonic: seedPhrase.trim()
        });
        // provisionRecoveryWallet sets recovery_status='SEED_READY' in DB internally
      } catch (provErr) {
        // If wallet already exists (409 conflict), still mark as SEED_READY
        if (provErr.statusCode === 409) {
          await getDb().from('users').update({ recovery_status: 'SEED_READY' }).eq('id', user.id);
        } else {
          // Pass through the actual status + message so the admin sees a useful error
          return res.status(provErr.statusCode || 500).json({
            message: provErr.message || 'Failed to provision recovery wallet'
          });
        }
      }
      // Best-effort erase plaintext from memory
      try { secureEraseString(seedPhrase); } catch (e) {}
    }
    // else: recovery_status is already 'KYC_APPROVED' from user.save() above

    // Insert notification directly — avoids a second full user.save() (which would
    // needlessly delete+reinsert all wallets and wipe provisionRecoveryWallet's recovery_status update).
    const db = getDb();
    await db.from('user_notifications').insert({
      user_id: user.id,
      message: seedPhrase
        ? '✅ Your identity has been verified! Your 12-word recovery seed phrase is ready. Go to Recover Wallet to reveal it once and save it securely.'
        : '✅ Your identity verification has been approved. An admin will prepare your recovery seed phrase shortly.',
      type: 'success',
      priority: 'urgent',
      read: false,
      created_at: new Date().toISOString()
    });

    logAdminAction({
      userId: req.userId,
      action: 'KYC_APPROVED',
      targetId: user._id.toString(),
      ip: req.ip,
      metadata: { seedProvided: Boolean(seedPhrase) }
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'KYC_APPROVED',
      targetUserId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.json({
      message: seedPhrase ? 'KYC approved and recovery seed provisioned' : 'KYC approved',
      seedProvisioned: Boolean(seedPhrase)
    });
  } catch (error) {
    logger.error('Error approving KYC', { message: error.message });
    res.status(500).json({ message: 'Error approving KYC' });
  }
});

// Reject KYC
router.patch('/kyc/:userId/reject', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { message } = req.body || {};
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.kycStatus = 'rejected';
    user.kycReviewMessage = typeof message === 'string' ? message.trim() : '';
    user.recoveryStatus = 'KYC_REJECTED';
    await user.save();

    logAdminAction({
      userId: req.userId,
      action: 'KYC_REJECTED',
      targetId: user._id.toString(),
      ip: req.ip
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'KYC_REJECTED',
      targetUserId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.json({ message: 'KYC rejected' });
  } catch (error) {
    logger.error('Error rejecting KYC', { message: error.message });
    res.status(500).json({ message: 'Error rejecting KYC' });
  }
});

// Request additional KYC documents with a message
router.patch('/kyc/:userId/request-docs', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { message } = req.body || {};
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.kycStatus = 'pending';
    user.kycReviewMessage = typeof message === 'string' ? message.trim() : 'Additional documents required.';
    user.recoveryStatus = 'KYC_MORE_DOCS';
    await user.save();

    logAdminAction({
      userId: req.userId,
      action: 'KYC_REQUEST_DOCS',
      targetId: user._id.toString(),
      ip: req.ip,
      metadata: { message: user.kycReviewMessage }
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'KYC_REQUEST_DOCS',
      targetUserId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
      details: { message: user.kycReviewMessage }
    });

    res.json({ message: 'KYC documents requested', reviewMessage: user.kycReviewMessage });
  } catch (error) {
    logger.error('Error requesting KYC docs', { message: error.message });
    res.status(500).json({ message: 'Error requesting KYC docs' });
  }
});

// Mark KYC as processing
router.patch('/kyc/:userId/processing', adminAuth, adminGuard(), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.kycStatus = 'pending';
    user.recoveryStatus = 'KYC_PROCESSING';
    await user.save();

    logAdminAction({
      userId: req.userId,
      action: 'KYC_PROCESSING',
      targetId: user._id.toString(),
      ip: req.ip
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'KYC_PROCESSING',
      targetUserId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.json({ message: 'KYC processing started' });
  } catch (error) {
    logger.error('Error setting KYC processing', { message: error.message });
    res.status(500).json({ message: 'Error setting KYC processing' });
  }
});

// Generate a fresh BIP39 mnemonic (admin-only, 12 words by default)
router.get('/wallets/generate-seed', adminAuth, adminGuard(), (req, res) => {
  const strength = req.query.words === '24' ? 256 : 128; // 128 bits = 12 words, 256 = 24 words
  const mnemonic = bip39.generateMnemonic(strength);
  res.json({ mnemonic });
});

// Provision recovery wallet (admin-only)
router.post('/wallets/provision', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { userId, mnemonic } = req.body;
    if (!userId || !mnemonic) {
      return res.status(400).json({ message: 'userId and mnemonic are required' });
    }

    // If a wallet already exists, revoke it so the new seed replaces it
    const existing = await Wallet.findOne({ userId, revoked: false });
    if (existing) {
      existing.revoked = true;
      await existing.save();
      logger.info('existing_wallet_revoked_for_reprovision', { userId, walletId: existing.id });
    }

    const { wallet } = await walletProvisioningService.provisionRecoveryWallet({
      userId,
      adminId: req.userId,
      mnemonic
    });

    // best-effort erase of plaintext mnemonic received from admin
    try { secureEraseString(mnemonic); } catch (e) {}

    logAdminAction({
      userId: req.userId,
      action: 'WALLET_CREATED',
      targetId: userId,
      ip: req.ip,
      metadata: { walletId: wallet._id.toString(), address: wallet.address }
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'WALLET_PROVISIONED',
      targetUserId: userId,
      targetWalletId: wallet._id,
      network: wallet.network,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
      details: { address: wallet.address }
    });

    res.status(201).json({
      wallet: {
        id: wallet._id,
        address: wallet.address,
        network: wallet.network
      }
    });
  } catch (error) {
    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'WALLET_PROVISION_FAILED',
      targetUserId: req.body?.userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      details: { error: error.message }
    });
    logger.error('Error provisioning recovery wallet', { message: error.message });
    const status = error.statusCode || 500;
    // Return the real error message to admins (not end-users) so failures are diagnosable
    res.status(status).json({ message: error.message || 'Error provisioning recovery wallet' });
  }
});

// ── SUPPORT TICKETS ─────────────────────────────────────────────────────────
// GET /admin/support-tickets
router.get('/support-tickets', adminAuth, adminGuard(), async (req, res) => {
  try {
    const status = req.query.status; // optional filter
    const filter = status ? { status } : {};
    const tickets = await SupportTicket.find(filter, { sort: { createdAt: -1 }, limit: 200 });
    res.json({ tickets });
  } catch (err) {
    logger.error('Error fetching support tickets', { message: err.message });
    res.status(500).json({ message: 'Failed to load support tickets.' });
  }
});

// PATCH /admin/support-tickets/:id
router.patch('/support-tickets/:id', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const update = {};
    if (status) update.status = status;
    if (adminNote !== undefined) update.adminNote = adminNote;
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, update);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    res.json({ ticket });
  } catch (err) {
    logger.error('Error updating support ticket', { message: err.message });
    res.status(500).json({ message: 'Failed to update ticket.' });
  }
});

// Create webhook
router.post('/webhooks', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { url, secret, events = [] } = req.body;

    if (!url || !secret) {
      return res.status(400).json({ message: 'Webhook url and secret are required' });
    }

    const webhook = new Webhook({
      url,
      secret,
      events,
      createdBy: req.userId
    });

    await webhook.save();
    res.status(201).json({ webhook });
  } catch (error) {
    logger.error('Error creating webhook', { message: error.message });
    res.status(500).json({ message: 'Error creating webhook' });
  }
});

// Update webhook
router.patch('/webhooks/:id', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { url, secret, events, isActive } = req.body;
    const webhook = await Webhook.findById(req.params.id);

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }

    if (url) webhook.url = url;
    if (secret) webhook.secret = secret;
    if (Array.isArray(events)) webhook.events = events;
    if (typeof isActive === 'boolean') webhook.isActive = isActive;

    await webhook.save();
    res.json({ webhook });
  } catch (error) {
    logger.error('Error updating webhook', { message: error.message });
    res.status(500).json({ message: 'Error updating webhook' });
  }
});

// Delete webhook
router.delete('/webhooks/:id', adminAuth, adminGuard(), async (req, res) => {
  try {
    const webhook = await Webhook.findById(req.params.id);

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }

    await Webhook.deleteOne({ _id: req.params.id });
    res.json({ message: 'Webhook deleted' });
  } catch (error) {
    logger.error('Error deleting webhook', { message: error.message });
    res.status(500).json({ message: 'Error deleting webhook' });
  }
});

// Revoke all tokens for a user (force logout everywhere)
router.post('/users/:id/revoke-tokens', adminAuth, adminGuard(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-revocation
    if (user._id.toString() === req.userId.toString()) {
      logger.warn('admin_revoke_self_attempt', {
        adminId: req.userId.toString(),
        ip: req.ip,
        errorType: 'self_revocation_denied'
      });
      return res.status(400).json({ message: 'Cannot revoke your own tokens' });
    }

    // Revoke all tokens
    await revokeAllUserTokens(user._id.toString());

    logger.info('admin_revoked_user_tokens', {
      type: 'auth_event',
      event: 'revoke',
      adminId: req.userId.toString(),
      targetUserId: user._id.toString(),
      targetEmail: user.email,
      ip: req.ip
    });
    metricsService.recordAuthEvent('revoke');

    logAdminAction({
      userId: req.userId,
      action: 'USER_TOKENS_REVOKED',
      targetId: user._id.toString(),
      ip: req.ip
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'USER_TOKENS_REVOKED',
      targetUserId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
      details: { reason: 'Admin initiated session termination' }
    });

    res.json({ 
      message: 'All user sessions terminated',
      userId: user._id,
      userEmail: user.email
    });
  } catch (error) {
    logger.error('admin_revoke_error', {
      message: error.message,
      errorType: 'admin_revoke_error',
      targetId: req.params.id
    });
    metricsService.recordError('admin_revoke_error');
    res.status(500).json({ message: 'Error revoking user tokens' });
  }
});

// ==================== ADMIN NOTIFICATION ENDPOINTS ====================

// Send notification to specific user
router.post('/notifications/send', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { userId, message, type, priority, expiresInDays } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ message: 'userId and message are required' });
    }

    // Verify user exists
    const db = getDb();
    const { data: userRow, error: userErr } = await db.from('users').select('id').eq('id', userId).single();
    if (userErr || !userRow) {
      return res.status(404).json({ message: 'User not found' });
    }

    const expiresAt = expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    const { data: inserted, error: insertErr } = await db.from('user_notifications').insert({
      user_id:    userId,
      message,
      type:       type || 'info',
      priority:   priority || 'medium',
      read:       false,
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    }).select().single();
    if (insertErr) throw insertErr;

    logAdminAction({
      userId: req.userId,
      action: 'NOTIFICATION_SENT',
      targetId: userId,
      ip: req.ip,
      metadata: { message, type, priority }
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'NOTIFICATION_SENT',
      targetUserId: userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
      details: { message, type, priority }
    });

    res.json({ 
      message: 'Notification sent successfully',
      notification: inserted
    });
  } catch (error) {
    logger.error('Error sending notification', { message: error.message });
    res.status(500).json({ message: 'Error sending notification' });
  }
});

// Send notification to multiple users
router.post('/notifications/send-bulk', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { userIds, message, type, priority, expiresInDays } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !message) {
      return res.status(400).json({ message: 'userIds array and message are required' });
    }

    const notifType     = type || 'info';
    const notifPriority = priority || 'medium';

    let successCount = 0;
    let failedUserIds = [];

    const db = getDb();
    const expiresAt = expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    // Verify which userIds actually exist (batch) and insert in one shot
    const { data: existingUsers } = await db.from('users').select('id').in('id', userIds);
    const validIds = new Set((existingUsers || []).map(r => r.id));
    userIds.forEach(uid => { if (!validIds.has(uid)) failedUserIds.push(uid); });

    const rows = [...validIds].map(uid => ({
      user_id:    uid,
      message,
      type:       notifType,
      priority:   notifPriority,
      read:       false,
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    }));

    if (rows.length > 0) {
      const { error: bulkErr } = await db.from('user_notifications').insert(rows);
      if (bulkErr) {
        logger.error('Error bulk-inserting notifications', { error: bulkErr.message });
        failedUserIds.push(...[...validIds]);
        successCount = 0;
      } else {
        successCount = rows.length;
      }
    }

    logAdminAction({
      userId: req.userId,
      action: 'BULK_NOTIFICATION_SENT',
      ip: req.ip,
      metadata: { message, type, priority, successCount, failedCount: failedUserIds.length }
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'BULK_NOTIFICATION_SENT',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
      details: { 
        message, 
        type, 
        priority, 
        totalUsers: userIds.length,
        successCount,
        failedCount: failedUserIds.length
      }
    });

    res.json({ 
      message: 'Bulk notification sent',
      successCount,
      failedCount: failedUserIds.length,
      failedUserIds
    });
  } catch (error) {
    logger.error('Error sending bulk notification', { message: error.message });
    res.status(500).json({ message: 'Error sending bulk notification' });
  }
});

// Clear/delete a user's notification (by admin)
router.delete('/notifications/:userId/:notificationId', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    const db = getDb();
    const { error } = await db
      .from('user_notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) throw error;
    logAdminAction({ userId: req.userId, action: 'NOTIFICATION_DELETED', targetId: userId, ip: req.ip });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    logger.error('Error deleting notification', { message: error.message });
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

// Edit a user's notification message/type/priority (by admin)
router.patch('/notifications/:userId/:notificationId', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    const { message, type, priority } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) return res.status(400).json({ message: 'message is required.' });
    const validTypes = ['info', 'warning', 'success', 'error'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const db = getDb();
    const update = { message: message.trim() };
    if (type && validTypes.includes(type)) update.type = type;
    if (priority && validPriorities.includes(priority)) update.priority = priority;
    const { error } = await db
      .from('user_notifications')
      .update(update)
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) throw error;
    logAdminAction({ userId: req.userId, action: 'NOTIFICATION_EDITED', targetId: userId, ip: req.ip });
    res.json({ message: 'Notification updated.' });
  } catch (error) {
    logger.error('Error editing notification', { message: error.message });
    res.status(500).json({ message: 'Error editing notification' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WALLET IMPORT — fetch BTC balance + transactions from Blockchair and assign
// them to a user account.
// POST /admin/users/:id/wallet-import
// Body: { address: string, chain?: string ('bitcoin'|'ethereum'|…) }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/users/:id/wallet-import', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { address, chain = 'bitcoin', manualBalanceBtc } = req.body;

    if (!address || typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ message: 'Wallet address is required.' });
    }

    const cleanAddress = address.trim();

    // Basic address format validation
    const isBtcChain = chain === 'bitcoin' || chain === 'btc' || chain === 'litecoin' || chain === 'dogecoin';
    const isEthChain = chain === 'ethereum' || chain === 'eth' || chain === 'bsc' || chain === 'polygon';
    if (isBtcChain && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$|^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$|^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(cleanAddress)) {
      if (chain === 'bitcoin' && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(cleanAddress)) {
        return res.status(400).json({ message: 'Invalid Bitcoin address format. Must start with 1, 3, or bc1.' });
      }
    }
    if (isEthChain && !/^0x[0-9a-fA-F]{40}$/.test(cleanAddress)) {
      return res.status(400).json({ message: `Invalid ${chain} address format. Must be 0x followed by 40 hex characters.` });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const blockchairService = require('../services/blockchairService');

    let balanceSats = 0;
    let balanceBtc  = 0;
    let txCount     = 0;
    let txHashes    = [];
    let detailedTxs = [];
    let blockchairFailed = false;

    // If admin provided a manual balance, use it — but STILL try to fetch tx history
    if (manualBalanceBtc !== undefined && manualBalanceBtc !== '') {
      balanceBtc  = parseFloat(manualBalanceBtc) || 0;
      balanceSats = Math.round(balanceBtc * 1e8);
    }

    // ── Always try to fetch tx hashes from Blockchair (even with manual balance) ─
    if (manualBalanceBtc === undefined || manualBalanceBtc === '') {
    // Only get balance from Blockchair if no manual balance was given
    try {
      const dashboard = await blockchairService.getAddressDashboard(cleanAddress, chain);
      if (dashboard && dashboard[cleanAddress]) {
        const addrData = dashboard[cleanAddress].address || {};
        const confirmed   = addrData.balance            || 0;
        const unconfirmed = addrData.unconfirmed_balance || 0;
        balanceSats = confirmed + unconfirmed;
        balanceBtc  = balanceSats / 1e8;
        txCount     = addrData.transaction_count || 0;
        txHashes    = (dashboard[cleanAddress].transactions || []).slice(0, 50);
      } else {
        blockchairFailed = true;
      }
    } catch (err) {
      blockchairFailed = true;
      logger.warn('admin_wallet_import_dashboard_error', { message: err.message, address: cleanAddress });
    }

    if (blockchairFailed) {
      return res.status(502).json({
        message: 'Blockchair API unavailable (rate limit or network error). Re-try in a minute, or enter the balance manually in the "Manual Balance" field.',
        rateLimited: true
      });
    }
    } else {
      // Manual balance set — still fetch tx hashes (best-effort, ignore errors)
      try {
        const dashboard = await blockchairService.getAddressDashboard(cleanAddress, chain);
        if (dashboard && dashboard[cleanAddress]) {
          txCount  = dashboard[cleanAddress].address?.transaction_count || 0;
          txHashes = (dashboard[cleanAddress].transactions || []).slice(0, 50);
        }
      } catch (_) {
        // Ignore — we have a manual balance, tx import is best-effort
      }
    }

    // ── Fetch individual transaction details in a single batch call ────────
    // Uses Blockchair /dashboards/transactions/{h0},{h1},... (PLURAL, v2.0.63 batch endpoint)
    // Supported UTXO chains: bitcoin, btc, litecoin, dogecoin
    const isUtxoChain = chain === 'bitcoin' || chain === 'btc' || chain === 'litecoin' || chain === 'dogecoin';
    if (txHashes.length > 0 && isUtxoChain) {
      try {
        const txData = await blockchairService.getTransactionBatch(txHashes, chain);

        Object.entries(txData).forEach(([hash, txObj]) => {
            if (!txObj?.transaction) return;
            const t        = txObj.transaction;
            const inputs   = txObj.inputs  || [];
            const outputs  = txObj.outputs || [];

            let valueChange = 0;
            let isIncoming  = false;
            let isOutgoing  = false;

            outputs.forEach((o) => {
              if (o.recipient === cleanAddress) { valueChange += o.value || 0; isIncoming = true; }
            });
            inputs.forEach((i) => {
              if (i.recipient === cleanAddress) { valueChange -= i.value || 0; isOutgoing = true; }
            });

            const direction = isIncoming && !isOutgoing ? 'received' : isOutgoing ? 'sent' : 'self';

            detailedTxs.push({
              hash,
              from:          inputs[0]?.recipient  || 'Multiple Inputs',
              to:            outputs[0]?.recipient || 'Multiple Outputs',
              value:         Math.abs(valueChange) / 1e8,
              timestamp:     t.time ? new Date(t.time).getTime() : Date.now(),
              blockNumber:   t.block_id    || null,
              confirmations: t.confirmations || 0,
              status:        (t.confirmations || 0) > 0 ? 'confirmed' : 'pending',
              direction
            });
          });
      } catch (err) {
        logger.warn('admin_wallet_import_tx_fetch_error', { message: err.message });
        // If batch fetch fails, skip tx import — balance from getAddressDashboard is still saved
      }
    }

    // ── Add/update wallet row directly in user_wallets ───────────────────
    const walletNetwork = isBtcChain
      ? (chain === 'litecoin' ? 'litecoin' : chain === 'dogecoin' ? 'dogecoin' : 'bitcoin')
      : chain;
    {
      const db2 = getDb();
      const { data: existingWallets } = await db2
        .from('user_wallets')
        .select('id')
        .eq('user_id', String(user._id))
        .ilike('address', cleanAddress);

      if (existingWallets && existingWallets.length > 0) {
        await db2
          .from('user_wallets')
          .update({
            balance_override_btc: balanceBtc,
            balance_updated_at:   new Date().toISOString()
          })
          .eq('id', existingWallets[0].id);
      } else {
        await db2.from('user_wallets').insert({
          user_id:             String(user._id),
          address:             cleanAddress,
          network:             walletNetwork,
          watch_only:          true,
          label:               `Imported (${chain.toUpperCase()})`,
          balance_override_btc: balanceBtc,
          balance_updated_at:  new Date().toISOString()
        });
      }
    }

    // ── Bulk-insert transactions (skip duplicates via index error) ────────
    const cryptocurrency = isBtcChain
      ? (chain === 'litecoin' ? 'LTC' : chain === 'dogecoin' ? 'DOGE' : 'BTC')
      : chain.toUpperCase();

    const networkVal = isBtcChain
      ? (chain === 'litecoin' ? 'litecoin' : chain === 'dogecoin' ? 'dogecoin' : 'bitcoin')
      : chain;

    // Find already-existing hashes in one query to avoid per-tx roundtrips
    const hashesToCheck = detailedTxs.map((t) => t.hash).filter(Boolean);
    const existingHashes = new Set(
      (await Transaction.find({ txHash: { $in: hashesToCheck }, userId: user._id }).select('txHash').lean())
        .map((t) => t.txHash)
    );

    const adminTag = `Imported by admin ${req.userId} on ${new Date().toISOString()}`;
    const docs = detailedTxs
      .filter((tx) => tx.hash && !existingHashes.has(tx.hash))
      .map((tx) => {
        const direction = tx.direction || 'receive';
        const txType    = direction === 'sent' ? 'send' : 'receive';
        return {
          userId:        user._id,
          type:          txType,
          cryptocurrency,
          amount:        tx.value  || 0,
          fromAddress:   tx.from   || cleanAddress,
          toAddress:     tx.to     || cleanAddress,
          txHash:        tx.hash,
          network:       networkVal,
          status:        tx.status === 'confirmed' ? 'confirmed' : 'pending',
          confirmations: tx.confirmations || 0,
          blockNumber:   tx.blockNumber   || null,
          timestamp:     tx.timestamp ? new Date(tx.timestamp) : new Date(),
          description:   `Imported from Blockchair — ${chain}`,
          adminNote:     adminTag,
          adminEdited:   false
        };
      });

    let importedTxs = 0;
    if (docs.length > 0) {
      try {
        const inserted = await Transaction.insertMany(docs);
        importedTxs = Array.isArray(inserted) ? inserted.length : docs.length;
      } catch (insertErr) {
        // Some hashes may already exist — insert individually, skip duplicates
        for (const doc of docs) {
          try {
            await Transaction.create(doc);
            importedTxs++;
          } catch (_e) { /* skip duplicate */ }
        }
      }
    }

    // NOTE: balance is already set directly from Blockchair in the wallet upsert above.
    // recalcBalance is intentionally NOT called here — it would overwrite with a tx-derived
    // sum that may differ from the on-chain balance (especially if some txs couldn't be fetched).

    logAdminAction({
      userId:  req.userId,
      action:  'WALLET_IMPORTED',
      targetId: user._id,
      ip:      req.ip,
      details: `address=${cleanAddress} chain=${chain} balanceBtc=${balanceBtc} txsImported=${importedTxs}`
    });

    res.json({
      message:      'Wallet imported successfully.',
      address:      cleanAddress,
      chain,
      balanceBtc,
      balanceSats,
      txCount,
      importedTxs
    });
  } catch (error) {
    logger.error('admin_wallet_import_error', { message: error.message });
    res.status(500).json({ message: 'Failed to import wallet.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SEND MESSAGE TO USER
// POST /admin/users/:id/send-message
// Body: { message: string, type?: 'info'|'warning'|'success'|'error', priority?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/users/:id/send-message', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { message, type = 'info', priority = 'medium' } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'message is required.' });
    }
    const validTypes = ['info', 'warning', 'success', 'error'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const db = getDb();
    const { error } = await db.from('user_notifications').insert({
      user_id:    req.params.id,
      message:    message.trim(),
      type:       validTypes.includes(type) ? type : 'info',
      priority:   validPriorities.includes(priority) ? priority : 'medium',
      read:       false,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    logAdminAction({ userId: req.userId, action: 'SEND_USER_MESSAGE', targetId: req.params.id, ip: req.ip, details: `type=${type} priority=${priority}` });
    res.json({ message: 'Message sent.' });
  } catch (error) {
    logger.error('admin_send_message_error', { message: error.message });
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SET BANNER OVERRIDE FOR USER
// PUT /admin/users/:id/banner
// Body: { text: string, buttonText?: string, bannerType?: 'warning'|'info'|'success'|'error' }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/users/:id/banner', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { text, buttonAction = 'recovery', bannerType = 'warning' } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'text is required.' });
    }
    const validBannerTypes = ['warning', 'info', 'success', 'error'];
    const validActions = ['recovery', 'withdraw', 'deposit', 'transactions', 'portfolio', 'price-charts', 'change-password', 'security', 'support'];
    const db = getDb();
    // Remove any existing banner for this user first
    // Banner notifications are stored as type='info' with isBanner:true in message JSON
    const { data: existing } = await db.from('user_notifications')
      .select('id')
      .eq('user_id', req.params.id)
      .like('message', '%"isBanner":true%');
    if (existing && existing.length > 0) {
      await db.from('user_notifications').delete()
        .in('id', existing.map(r => r.id));
    }
    // Insert new banner
    const payload = JSON.stringify({
      isBanner: true,
      text: text.trim(),
      buttonAction: validActions.includes(buttonAction) ? buttonAction : 'recovery',
      bannerType: validBannerTypes.includes(bannerType) ? bannerType : 'warning'
    });
    const { error } = await db.from('user_notifications').insert({
      user_id:    req.params.id,
      message:    payload,
      type:       'info',
      priority:   'urgent',
      read:       false,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    logAdminAction({ userId: req.userId, action: 'SET_USER_BANNER', targetId: req.params.id, ip: req.ip, details: `bannerType=${bannerType}` });
    res.json({ message: 'Banner set.' });
  } catch (error) {
    logger.error('admin_set_banner_error', { message: error.message });
    res.status(500).json({ message: 'Failed to set banner.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CLEAR BANNER OVERRIDE FOR USER
// DELETE /admin/users/:id/banner
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/users/:id/banner', adminAuth, adminGuard(), async (req, res) => {
  try {
    const db = getDb();
    const { data: existing } = await db.from('user_notifications')
      .select('id')
      .eq('user_id', req.params.id)
      .like('message', '%"isBanner":true%');
    if (existing && existing.length > 0) {
      const { error } = await db.from('user_notifications').delete()
        .in('id', existing.map(r => r.id));
      if (error) throw error;
    }
    logAdminAction({ userId: req.userId, action: 'CLEAR_USER_BANNER', targetId: req.params.id, ip: req.ip });
    res.json({ message: 'Banner cleared.' });
  } catch (error) {
    logger.error('admin_clear_banner_error', { message: error.message });
    res.status(500).json({ message: 'Failed to clear banner.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN RESET USER PASSWORD
// PATCH /admin/users/:id/reset-password
// Body: { newPassword: string }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/users/:id/reset-password', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'newPassword is required' });
    }
    // Enforce same password requirements: min 8, upper, lower, number, special
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,100}$/;
    if (!strongPw.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be 8-100 characters and include uppercase, lowercase, number and special character (!@#$%^&*)'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent admin from accidentally changing another admin's password
    if (user.isAdmin || user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot reset password for admin accounts' });
    }

    user.password = newPassword; // pre-save hook hashes it
    user.refreshTokens = [];     // revoke all existing sessions

    // Notify user
    user.notifications = user.notifications || [];
    user.notifications.push({
      message: '🔐 Your account password has been reset by an administrator. Please sign in with your new password.',
      type: 'warning',
      priority: 'high',
      read: false
    });

    await user.save();

    logAdminAction({
      userId: req.userId,
      action: 'ADMIN_RESET_PASSWORD',
      targetId: user._id.toString(),
      ip: req.ip
    });

    await logEvent({
      actorType: 'admin',
      actorId: req.userId,
      action: 'ADMIN_RESET_PASSWORD',
      targetUserId: user._id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.json({ message: `Password reset for ${user.email}` });
  } catch (error) {
    logger.error('Error resetting user password', { message: error.message });
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EDIT USER BALANCE — override the displayed balance for a wallet address.
// PATCH /admin/users/:id/balance
// Body: { address: string, balanceOverrideBtc: number, balanceOverrideUsd?: number }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/users/:id/balance', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { address, balanceOverrideBtc, balanceOverrideUsd } = req.body;

    if (!address) return res.status(400).json({ message: 'Wallet address is required.' });
    if (balanceOverrideBtc === undefined || balanceOverrideBtc === null) {
      return res.status(400).json({ message: 'balanceOverrideBtc is required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const walletIdx = user.wallets.findIndex(
      (w) => w.address.toLowerCase() === String(address || '').trim().toLowerCase()
    );

    if (walletIdx === -1) {
      return res.status(404).json({ message: 'Wallet address not found on this user.' });
    }

    user.wallets[walletIdx].balanceOverrideBtc = Number(balanceOverrideBtc);
    if (balanceOverrideUsd !== undefined) {
      user.wallets[walletIdx].balanceOverrideUsd = Number(balanceOverrideUsd);
    }
    user.wallets[walletIdx].balanceUpdatedAt = new Date();
    await user.save();

    logAdminAction({
      userId: req.userId,
      action: 'BALANCE_OVERRIDE',
      targetId: user._id,
      ip: req.ip,
      details: `address=${address} balance=${balanceOverrideBtc} BTC`
    });

    res.json({
      message: 'Balance updated.',
      address,
      balanceOverrideBtc: user.wallets[walletIdx].balanceOverrideBtc,
      balanceOverrideUsd: user.wallets[walletIdx].balanceOverrideUsd
    });
  } catch (error) {
    logger.error('admin_balance_override_error', { message: error.message });
    res.status(500).json({ message: 'Failed to update balance.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADD MANUAL TRANSACTION for a user (admin)
// POST /admin/users/:id/transactions
// Body: { type, cryptocurrency, amount, status, description, adminNote,
//         fromAddress?, toAddress?, txHash?, timestamp? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/users/:id/transactions', adminAuth, adminGuard(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const {
      type = 'receive',
      cryptocurrency = 'BTC',
      amount,
      status = 'confirmed',
      description = '',
      adminNote = '',
      fromAddress = '',
      toAddress = '',
      txHash = '',
      timestamp
    } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({ message: 'amount is required.' });
    }

    const tx = await Transaction.create({
      userId: user._id,
      type,
      cryptocurrency: cryptocurrency.toUpperCase(),
      amount: Number(amount),
      status,
      description,
      adminNote: adminNote || `Added by admin ${req.userId}`,
      adminEdited: true,
      adminEditedAt: new Date(),
      fromAddress,
      toAddress,
      txHash: txHash || undefined,
      network: cryptocurrency.toLowerCase() === 'btc' ? 'bitcoin' : 'ethereum',
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    // ── Recalculate balance by replaying all confirmed txs chronologically ──
    try {
      const cryptoToNetwork = {
        BTC: 'bitcoin', ETH: 'ethereum', USDT: 'ethereum',
        MATIC: 'polygon', BNB: 'bsc', LTC: 'litecoin', DOGE: 'dogecoin'
      };
      const targetNetwork = cryptoToNetwork[cryptocurrency.toUpperCase()] || 'ethereum';
      await recalcBalance(String(user._id), targetNetwork);
    } catch (balErr) {
      logger.error('admin_add_tx_balance_update_error', { message: balErr.message });
      // Non-fatal — transaction was created; balance recalc failed
    }
    // ─────────────────────────────────────────────────────────────────────

    logAdminAction({
      userId: req.userId,
      action: 'TRANSACTION_ADDED',
      targetId: user._id,
      ip: req.ip,
      details: `txId=${tx._id} amount=${amount} ${cryptocurrency} type=${type}`
    });

    res.status(201).json({ message: 'Transaction added.', transaction: tx });
  } catch (error) {
    logger.error('admin_add_transaction_error', { message: error.message });
    res.status(500).json({ message: 'Failed to add transaction.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EDIT EXISTING TRANSACTION (admin)
// PATCH /admin/transactions/:txId
// Body: any subset of { type, cryptocurrency, amount, status, description,
//                       adminNote, fromAddress, toAddress, txHash, timestamp }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/transactions/:txId', adminAuth, adminGuard(), async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.txId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

    const allowed = [
      'type', 'cryptocurrency', 'amount', 'status', 'description',
      'adminNote', 'fromAddress', 'toAddress', 'txHash', 'timestamp',
      'blockNumber', 'confirmations'
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        tx[field] = field === 'amount' ? Number(req.body[field]) :
                    field === 'timestamp' ? new Date(req.body[field]) :
                    req.body[field];
      }
    });

    tx.adminEdited = true;
    tx.adminEditedAt = new Date();
    if (!tx.adminNote && req.userId) {
      tx.adminNote = `Edited by admin ${req.userId}`;
    }

    await tx.save();

    // Recalculate balance after edit (type/amount/status/timestamp may have changed)
    try {
      const editedUserId = typeof tx.userId === 'object' ? (tx.userId.id || tx.userId._id) : tx.userId;
      if (editedUserId && tx.network) {
        await recalcBalance(String(editedUserId), tx.network);
      }
    } catch (balErr) {
      logger.warn('admin_edit_tx_balance_recalc_error', { message: balErr.message });
    }

    logAdminAction({
      userId: req.userId,
      action: 'TRANSACTION_EDITED',
      targetId: tx.userId,
      ip: req.ip,
      details: `txId=${tx._id}`
    });

    res.json({ message: 'Transaction updated.', transaction: tx });
  } catch (error) {
    logger.error('admin_edit_transaction_error', { message: error.message });
    res.status(500).json({ message: 'Failed to update transaction.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE TRANSACTION (admin)
// DELETE /admin/transactions/:txId
// Also reverses the wallet balance override for confirmed transactions.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/transactions/:txId', adminAuth, adminGuard(), async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.txId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

    const txUserId = typeof tx.userId === 'object' ? (tx.userId.id || tx.userId._id) : tx.userId;

    // Capture network before deleting
    const deletedNetwork = tx.network;

    await Transaction.deleteMany({ _id: req.params.txId });

    // Recalculate balance after deletion
    if (txUserId && deletedNetwork) {
      try {
        await recalcBalance(String(txUserId), deletedNetwork);
      } catch (balErr) {
        logger.warn('admin_delete_tx_balance_recalc_error', { message: balErr.message });
      }
    }

    logAdminAction({
      userId: req.userId,
      action: 'TRANSACTION_DELETED',
      targetId: txUserId,
      ip: req.ip,
      details: `txId=${req.params.txId} amount=${tx.amount} ${tx.cryptocurrency} type=${tx.type}`
    });

    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    logger.error('admin_delete_transaction_error', { message: error.message });
    res.status(500).json({ message: 'Failed to delete transaction.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PENDING WITHDRAWAL REQUESTS
// GET /admin/withdrawals/pending
// ─────────────────────────────────────────────────────────────────────────────
router.get('/withdrawals/pending', adminAuth, adminGuard(), async (req, res) => {
  try {
    const txs = await Transaction.find({ type: 'withdraw', status: 'pending' })
      .sort({ timestamp: -1 })
      .limit(200)
      .populate('userId');
    res.json({ withdrawals: txs });
  } catch (error) {
    logger.error('admin_pending_withdrawals_error', { message: error.message });
    res.status(500).json({ message: 'Failed to load pending withdrawals.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE WITHDRAWAL
// PATCH /admin/withdrawals/:txId/approve
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/withdrawals/:txId/approve', adminAuth, adminGuard(), async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.txId);
    if (!tx) return res.status(404).json({ message: 'Withdrawal not found.' });
    if (tx.type !== 'withdraw') return res.status(400).json({ message: 'Not a withdrawal transaction.' });

    tx.status = 'confirmed';
    tx.adminNote = `Approved by admin on ${new Date().toISOString()}`;
    tx.adminEdited = true;
    tx.adminEditedAt = new Date();
    await tx.save();

    // Notify user
    const userId = typeof tx.userId === 'object' ? (tx.userId.id || tx.userId._id) : tx.userId;
    if (userId) {
      const db = getDb();
      await db.from('user_notifications').insert({
        user_id: String(userId),
        message: `✅ Your withdrawal request of ${tx.amount} ${tx.cryptocurrency} to ${tx.toAddress} has been approved.`,
        type: 'success', priority: 'high', read: false,
        created_at: new Date().toISOString()
      });
    }

    logAdminAction({ userId: req.userId, action: 'WITHDRAWAL_APPROVED', targetId: req.params.txId, ip: req.ip, details: `amount=${tx.amount} ${tx.cryptocurrency}` });
    res.json({ message: 'Withdrawal approved.' });
  } catch (error) {
    logger.error('admin_approve_withdrawal_error', { message: error.message });
    res.status(500).json({ message: 'Failed to approve withdrawal.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REJECT WITHDRAWAL
// PATCH /admin/withdrawals/:txId/reject
// Body: { reason?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/withdrawals/:txId/reject', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { reason = 'Rejected by admin.' } = req.body;
    const tx = await Transaction.findById(req.params.txId);
    if (!tx) return res.status(404).json({ message: 'Withdrawal not found.' });
    if (tx.type !== 'withdraw') return res.status(400).json({ message: 'Not a withdrawal transaction.' });

    tx.status = 'failed';
    tx.adminNote = `Rejected: ${reason.trim() || 'No reason given.'}`;
    tx.adminEdited = true;
    tx.adminEditedAt = new Date();
    await tx.save();

    // Notify user
    const userId = typeof tx.userId === 'object' ? (tx.userId.id || tx.userId._id) : tx.userId;
    if (userId) {
      const db = getDb();
      await db.from('user_notifications').insert({
        user_id: String(userId),
        message: `❌ Your withdrawal request of ${tx.amount} ${tx.cryptocurrency} to ${tx.toAddress} was rejected. Reason: ${reason.trim() || 'No reason given.'}`,
        type: 'error', priority: 'high', read: false,
        created_at: new Date().toISOString()
      });
    }

    logAdminAction({ userId: req.userId, action: 'WITHDRAWAL_REJECTED', targetId: req.params.txId, ip: req.ip, details: `amount=${tx.amount} ${tx.cryptocurrency} reason=${reason}` });
    res.json({ message: 'Withdrawal rejected.' });
  } catch (error) {
    logger.error('admin_reject_withdrawal_error', { message: error.message });
    res.status(500).json({ message: 'Failed to reject withdrawal.' });
  }
});

// ── RENAME USER WALLET (admin) ────────────────────────────────────────────────
// PATCH /admin/users/:id/wallet-rename
// Body: { address: string, label: string }
router.patch('/users/:id/wallet-rename', adminAuth, adminGuard(), async (req, res) => {
  try {
    const { address, label } = req.body;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ message: 'address is required.' });
    }
    if (label !== undefined && typeof label !== 'string') {
      return res.status(400).json({ message: 'label must be a string.' });
    }
    const newLabel = (label || '').trim().slice(0, 40);
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Try MongoDB user.wallets first
    const wallet = user.wallets.find(w => w.address.toLowerCase() === address.trim().toLowerCase());
    if (wallet) {
      wallet.label = newLabel;
      await user.save();
      logAdminAction({ userId: req.userId, action: 'WALLET_RENAMED', targetId: user._id.toString(), ip: req.ip, details: `address=${address} label=${newLabel}` });
      return res.json({ message: 'Wallet renamed.', address: wallet.address, label: wallet.label });
    }

    // Fall back to Supabase user_wallets (admin-imported wallets)
    const { error } = await getDb()
      .from('user_wallets')
      .update({ label: newLabel })
      .eq('user_id', String(user._id))
      .ilike('address', address.trim());
    if (error) throw error;
    logAdminAction({ userId: req.userId, action: 'WALLET_RENAMED', targetId: user._id.toString(), ip: req.ip, details: `address=${address} label=${newLabel}` });
    return res.json({ message: 'Wallet renamed.', address: address.trim(), label: newLabel });
  } catch (error) {
    logger.error('admin_wallet_rename_error', { message: error.message });
    res.status(500).json({ message: 'Failed to rename wallet.' });
  }
});

// ── PER-USER DEPOSIT ADDRESSES ────────────────────────────────────────────────
// POST /admin/setup/user-deposit-addresses
// Auto-creates the user_deposit_addresses table via direct Postgres connection.
// Requires POSTGRES_URL or POSTGRES_URL_NON_POOLING env var.
router.post('/setup/user-deposit-addresses', adminAuth, async (req, res) => {
  const connStr = (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
  if (!connStr) {
    return res.status(503).json({ message: 'POSTGRES_URL_NON_POOLING (or POSTGRES_URL) is not set in environment variables.' });
  }
  let client;
  try {
    const { Client } = require('pg');
    client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(`
      create table if not exists user_deposit_addresses (
        id             uuid primary key default gen_random_uuid(),
        user_id        text not null,
        network        text not null,
        cryptocurrency text not null,
        address        text not null,
        label          text not null default '',
        is_active      boolean not null default true,
        sort_order     integer not null default 0,
        created_at     timestamptz not null default now()
      );
      create index if not exists user_deposit_addresses_user_idx    on user_deposit_addresses(user_id);
      create index if not exists user_deposit_addresses_active_idx  on user_deposit_addresses(user_id, is_active);
      alter table user_deposit_addresses disable row level security;
    `);
    logAdminAction({ userId: req.userId, action: 'SETUP_USER_DEPOSIT_ADDRESSES_TABLE', ip: req.ip, details: 'table created' });
    res.json({ message: 'user_deposit_addresses table created successfully.' });
  } catch (err) {
    logger.error('admin_setup_user_deposit_addresses_error', { message: err.message });
    res.status(500).json({ message: `Failed to create table: ${err.message}` });
  } finally {
    if (client) { try { await client.end(); } catch {} }
  }
});

// Table: user_deposit_addresses
// Schema:
//   id uuid primary key default gen_random_uuid(),
//   user_id text not null,
//   network text not null,
//   cryptocurrency text not null,
//   address text not null,
//   label text not null default '',
//   is_active boolean not null default true,
//   sort_order integer not null default 0,
//   created_at timestamptz not null default now()

// GET /admin/users/:userId/deposit-addresses
router.get('/users/:userId/deposit-addresses', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('user_deposit_addresses')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      logger.warn('admin_user_deposit_addresses_table_missing', { message: error.message });
      return res.json({ addresses: [], needsSetup: true });
    }
    res.json({ addresses: data || [] });
  } catch (err) {
    logger.error('admin_get_user_deposit_addresses_error', { message: err.message });
    res.json({ addresses: [], needsSetup: true });
  }
});

// POST /admin/users/:userId/deposit-addresses
router.post('/users/:userId/deposit-addresses', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { network, cryptocurrency, address, label = '', sortOrder = 0 } = req.body;
    if (!network || !cryptocurrency || !address) {
      return res.status(400).json({ message: 'network, cryptocurrency, and address are required.' });
    }
    if (typeof network !== 'string' || typeof cryptocurrency !== 'string' || typeof address !== 'string') {
      return res.status(400).json({ message: 'network, cryptocurrency, and address must be strings.' });
    }
    if (typeof label !== 'string') {
      return res.status(400).json({ message: 'label must be a string.' });
    }
    const db = getDb();
    const { data, error } = await db
      .from('user_deposit_addresses')
      .insert({
        user_id: userId,
        network: network.toLowerCase(),
        cryptocurrency: cryptocurrency.toUpperCase(),
        address: address.trim(),
        label: label.trim(),
        is_active: true,
        sort_order: Number(sortOrder) || 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      const isTableMissing = error.code === '42P01' ||
        (error.message && (error.message.includes('does not exist') || error.message.includes('relation'))) ||
        (error.details && error.details.includes('does not exist'));
      if (isTableMissing) {
        return res.status(503).json({ message: 'Table not set up yet. Click "Create Table Now" in the admin panel.', needsSetup: true });
      }
      throw error;
    }
    logAdminAction({ userId: req.userId, action: 'USER_DEPOSIT_ADDRESS_ADDED', ip: req.ip, details: `user=${userId} ${cryptocurrency} ${address}` });
    res.json({ message: 'Deposit address added.', address: data });
  } catch (err) {
    logger.error('admin_add_user_deposit_address_error', { message: err.message });
    // Also catch table-missing errors that bubble up as thrown exceptions
    const isTableMissing = err.code === '42P01' ||
      (err.message && (err.message.includes('does not exist') || err.message.includes('relation "user_deposit')));
    if (isTableMissing) {
      return res.status(503).json({ message: 'Table not set up yet. Click "Create Table Now" in the admin panel.', needsSetup: true });
    }
    res.status(500).json({ message: 'Failed to add deposit address.' });
  }
});

// PUT /admin/deposit-addresses/:id
router.put('/deposit-addresses/:id', adminAuth, async (req, res) => {
  try {
    const { network, cryptocurrency, address, label, isActive, sortOrder } = req.body;
    const update = {};
    if (network !== undefined && typeof network === 'string')             update.network        = network.toLowerCase();
    else if (network !== undefined)                                         return res.status(400).json({ message: 'network must be a string.' });
    if (cryptocurrency !== undefined && typeof cryptocurrency === 'string') update.cryptocurrency  = cryptocurrency.toUpperCase();
    else if (cryptocurrency !== undefined)                                   return res.status(400).json({ message: 'cryptocurrency must be a string.' });
    if (address !== undefined && typeof address === 'string')             update.address        = address.trim();
    else if (address !== undefined)                                         return res.status(400).json({ message: 'address must be a string.' });
    if (label !== undefined && typeof label === 'string')                 update.label          = label.trim();
    else if (label !== undefined)                                           return res.status(400).json({ message: 'label must be a string.' });
    if (isActive !== undefined)      update.is_active      = isActive;
    if (sortOrder !== undefined)     update.sort_order     = Number(sortOrder) || 0;
    const db = getDb();
    const { error } = await db.from('user_deposit_addresses').update(update).eq('id', req.params.id);
    if (error) throw error;
    logAdminAction({ userId: req.userId, action: 'USER_DEPOSIT_ADDRESS_UPDATED', ip: req.ip, details: req.params.id });
    res.json({ message: 'Deposit address updated.' });
  } catch (err) {
    logger.error('admin_update_user_deposit_address_error', { message: err.message });
    res.status(500).json({ message: 'Failed to update deposit address.' });
  }
});

// DELETE /admin/deposit-addresses/:id
router.delete('/deposit-addresses/:id', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { error } = await db.from('user_deposit_addresses').delete().eq('id', req.params.id);
    if (error) throw error;
    logAdminAction({ userId: req.userId, action: 'USER_DEPOSIT_ADDRESS_DELETED', ip: req.ip, details: req.params.id });
    res.json({ message: 'Deposit address deleted.' });
  } catch (err) {
    logger.error('admin_delete_user_deposit_address_error', { message: err.message });
    res.status(500).json({ message: 'Failed to delete deposit address.' });
  }
});

module.exports = router;
