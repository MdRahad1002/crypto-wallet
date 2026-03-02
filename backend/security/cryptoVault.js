const crypto = require('crypto');
const keyManager = require('./keyManager');

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decodePayload(encoded) {
  const json = Buffer.from(encoded, 'base64').toString('utf8');
  return JSON.parse(json);
}

function encryptSecret(plaintext, { dataKey, keyId, encryptedKey, aad }) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad));
  }

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = {
    v: 1,
    alg: 'aes-256-gcm',
    keyId,
    encryptedKey,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64')
  };

  return `v1:${encodePayload(payload)}`;
}

function decryptSecret(encrypted, { encryptedKey, aad, legacyDecrypt } = {}) {
  if (!encrypted || typeof encrypted !== 'string') {
    throw new Error('Encrypted payload is required');
  }

  if (!encrypted.startsWith('v1:')) {
    if (legacyDecrypt) {
      return legacyDecrypt(encrypted);
    }
    throw new Error('Unsupported encryption format');
  }

  const payload = decodePayload(encrypted.slice(3));
  const wrappedKey = payload.encryptedKey || encryptedKey;

  if (!wrappedKey) {
    throw new Error('Missing encrypted data key');
  }

  const dataKey = keyManager.unwrapDataKey(wrappedKey);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.data, 'base64');

  const decipher = crypto.createDecipheriv(payload.alg, dataKey, iv);
  if (aad) {
    decipher.setAAD(Buffer.from(aad));
  }
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = {
  encryptSecret,
  decryptSecret
};
