const crypto = require('crypto');

function loadMasterKey() {
  const raw = process.env.WALLET_MASTER_KEY;
  if (!raw) {
    throw new Error('WALLET_MASTER_KEY is not set');
  }

  const hexPattern = /^[0-9a-fA-F]+$/;
  if (raw.length === 64 && hexPattern.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  const base64 = Buffer.from(raw, 'base64');
  if (base64.length === 32) {
    return base64;
  }

  throw new Error('WALLET_MASTER_KEY must be 32 bytes (base64 or hex)');
}

function rotateMasterKey() {
  return crypto.randomBytes(32).toString('base64');
}

module.exports = {
  loadMasterKey,
  rotateMasterKey
};
