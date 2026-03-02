const seedVault = require('../security/seedVault');
const { secureEraseString } = require('../security/secureErase');
const crypto = require('crypto');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const logger = require('../core/logger');
const { validateMnemonic, deriveBitcoinAddress } = require('./walletDerivationService');

/** Ensure WALLET_MASTER_KEY is available (handles Vercel cold-start race) */
async function ensureMasterKey() {
  if (!process.env.WALLET_MASTER_KEY) {
    const masterKeyService = require('./masterKeyService');
    await masterKeyService.initialize();
  }
}

async function provisionRecoveryWallet({ userId, adminId, mnemonic }) {
  await ensureMasterKey();
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const existing = await Wallet.findOne({ userId, revoked: false });
  if (existing) {
    const error = new Error('Recovery wallet already exists');
    error.statusCode = 409;
    throw error;
  }

  validateMnemonic(mnemonic);

  // Normalize to lowercase + single spaces (BIP39 is case-insensitive; BlueWallet
  // may export mixed-case mnemonics that fail derivation without normalization).
  const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');

  // Derive Bitcoin address from the normalized mnemonic.
  // If the seed is genuinely non-standard and derivation still fails, fall back
  // to a deterministic placeholder so the NOT NULL DB constraint is satisfied.
  let address;
  try {
    address = deriveBitcoinAddress(normalizedMnemonic);
  } catch (deriveErr) {
    logger.warn('address_derivation_fallback', { userId, reason: deriveErr.message });
    // Store a hash-prefixed placeholder (clearly not a real on-chain address)
    address = 'custom:' + crypto.createHash('sha256').update(normalizedMnemonic).digest('hex').slice(0, 40);
  }

  const encryptedSeed = seedVault.encryptSeed(normalizedMnemonic);

  const wallet = new Wallet({
    userId,
    network: 'bitcoin',
    address,
    encryptedSeed,
    createdByAdminId: adminId
  });

  await wallet.save();
  user.recoveryStatus = 'SEED_READY';
  await user.save();
  logger.info('Recovery wallet provisioned', { userId, walletId: wallet._id.toString() });

  // best-effort: erase plaintext mnemonic from memory after encrypting and saving
  try {
    secureEraseString(mnemonic);
  } catch (e) {}

  return { wallet };
}

async function getSeedPhraseOnce(userId) {
  await ensureMasterKey();
  const wallet = await Wallet.findOne({ userId, revoked: false });
  if (!wallet) {
    const error = new Error('No recovery wallet available');
    error.statusCode = 404;
    throw error;
  }

  if (wallet.seedShownAt) {
    const error = new Error('Seed phrase already shown');
    error.statusCode = 410;
    throw error;
  }

  const mnemonic = seedVault.decryptSeed(wallet.encryptedSeed || wallet.encryptedMnemonic);
  wallet.seedShownAt = new Date();
  await wallet.save();

  await User.findByIdAndUpdate(userId, { recoveryStatus: 'SEED_REVEALED' });

  return { mnemonic, address: wallet.address, network: wallet.network };
}

async function getSeed(userId) {
  try {
    await ensureMasterKey();
  } catch (keyErr) {
    const error = new Error('[step:masterKey] ' + keyErr.message);
    error.statusCode = 500;
    throw error;
  }

  let wallet;
  try {
    wallet = await Wallet.findOne({ userId, revoked: false });
  } catch (dbErr) {
    const error = new Error('[step:findWallet] ' + dbErr.message);
    error.statusCode = 500;
    throw error;
  }

  if (!wallet) {
    const error = new Error('No recovery wallet found for this account.');
    error.statusCode = 404;
    throw error;
  }

  const seedPayload = wallet.encryptedSeed || wallet.encryptedMnemonic;
  if (!seedPayload) {
    const error = new Error('[step:noSeedData] Wallet exists but has no encrypted seed stored.');
    error.statusCode = 500;
    throw error;
  }

  let mnemonic;
  try {
    mnemonic = seedVault.decryptSeed(seedPayload);
  } catch (decryptErr) {
    const error = new Error('[step:decrypt] ' + decryptErr.message);
    error.statusCode = 500;
    throw error;
  }

  return { mnemonic, address: wallet.address, network: wallet.network };
}

async function getRecoveryWallet(userId) {
  return Wallet.findOne({ userId, revoked: false });
}

module.exports = {
  provisionRecoveryWallet,
  getSeedPhraseOnce,
  getSeed,
  getRecoveryWallet
};
