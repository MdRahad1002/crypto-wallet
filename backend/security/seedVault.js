const crypto = require('crypto');
const { loadMasterKey } = require('./masterKey');

const VERSION = 'v1';

function encryptSeed(mnemonic) {
  const masterKey = loadMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

  let ciphertext = cipher.update(mnemonic, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    v: VERSION
  };
}

function decryptSeed(payload) {
  if (!payload) {
    throw new Error('Encrypted mnemonic is required');
  }

  if (typeof payload === 'string') {
    const [version, data] = payload.split(':');
    if (version !== VERSION || !data) {
      throw new Error('Unsupported mnemonic format');
    }

    const buffer = Buffer.from(data, 'base64');
    const iv = buffer.slice(0, 12);
    const tag = buffer.slice(12, 28);
    const ciphertext = buffer.slice(28);
    return decryptSeed({
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      v: VERSION
    });
  }

  const { ciphertext, iv, tag } = payload;
  if (!ciphertext || !iv || !tag) {
    throw new Error('Invalid encrypted seed payload');
  }

  const masterKey = loadMasterKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    masterKey,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptMnemonic(mnemonic) {
  const payload = encryptSeed(mnemonic);
  const buffer = Buffer.concat([
    Buffer.from(payload.iv, 'base64'),
    Buffer.from(payload.tag, 'base64'),
    Buffer.from(payload.ciphertext, 'base64')
  ]);
  return `${VERSION}:${buffer.toString('base64')}`;
}

function decryptMnemonic(encrypted) {
  return decryptSeed(encrypted);
}

module.exports = {
  encryptSeed,
  decryptSeed,
  encryptMnemonic,
  decryptMnemonic
};
