const crypto = require('crypto');

function parseMasterKey() {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_MASTER_KEY is not set');
  }

  const hexPattern = /^[0-9a-fA-F]+$/;
  if (raw.length === 64 && hexPattern.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const base64 = Buffer.from(raw, 'base64');
    if (base64.length === 32) {
      return base64;
    }
  } catch (error) {
    // fall through
  }

  throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes (base64 or hex)');
}

function encryptDataKey(plaintextKey, masterKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decryptDataKey(encryptedKey, masterKey) {
  const data = Buffer.from(encryptedKey, 'base64');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const ciphertext = data.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function generateDataKey() {
  const masterKey = parseMasterKey();
  const plaintextKey = crypto.randomBytes(32);
  const encryptedKey = encryptDataKey(plaintextKey, masterKey);
  const keyId = crypto.randomUUID();
  return { keyId, encryptedKey, plaintextKey };
}

function unwrapDataKey(encryptedKey) {
  const masterKey = parseMasterKey();
  return decryptDataKey(encryptedKey, masterKey);
}

module.exports = {
  parseMasterKey,
  generateDataKey,
  unwrapDataKey
};
