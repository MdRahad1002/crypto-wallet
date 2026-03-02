/**
 * Key Management Service (KMS)
 * Centralized secrets management with encryption, rotation, and audit logging
 */

const crypto = require('crypto');
const logger = require('../core/logger');
const { BaseService } = require('./BaseService');

/**
 * KMSService - Manages encryption keys and secrets
 */
class KMSService extends BaseService {
  constructor() {
    super('KMSService');
    this.masterKey = null;
    this.dataKeys = new Map(); // keyId -> { key, createdAt, rotatedAt, isActive }
    this.secrets = new Map(); // secretName -> { encrypted, keyId, createdAt, expiresAt }
    this.initialized = false;
  }

  /**
   * Initialize KMS with master key
   */
  async initialize() {
    return this.executeWithTracking('initialize', async () => {
      if (this.initialized) {
        this.log('warn', 'already_initialized', {});
        return false;
      }

      // Load or generate master key
      this.masterKey = await this.loadOrGenerateMasterKey();

      // Generate initial data key
      const dataKeyId = 'default-' + Date.now();
      const dataKey = this.generateDataKey();
      this.dataKeys.set(dataKeyId, {
        key: dataKey,
        createdAt: new Date(),
        rotatedAt: new Date(),
        isActive: true,
        version: 1
      });

      this.initialized = true;
      this.log('info', 'kms_initialized', {
        masterKeyPresent: !!this.masterKey,
        dataKeysCount: this.dataKeys.size
      });

      return true;
    });
  }

  /**
   * Load or generate master key
   */
  async loadOrGenerateMasterKey() {
    return this.executeWithTracking('loadOrGenerateMasterKey', async () => {
      const envKey = process.env.KMS_MASTER_KEY;

      if (envKey) {
        // Load from environment (base64 encoded)
        try {
          const key = Buffer.from(envKey, 'base64');
          if (key.length !== 32) {
            throw new Error('Master key must be 32 bytes');
          }
          this.log('info', 'master_key_loaded_from_env', { length: key.length });
          return key;
        } catch (error) {
          this.log('error', 'invalid_master_key_format', {
            message: error.message
          });
          throw error;
        }
      }

      // Generate new key if not found
      const key = crypto.randomBytes(32);
      this.log('warn', 'master_key_generated', {
        length: key.length,
        action: 'save_to_KMS_MASTER_KEY_env_var'
      });

      return key;
    });
  }

  /**
   * Generate a new data key
   */
  generateDataKey() {
    return crypto.randomBytes(32);
  }

  /**
   * Encrypt data with a data key
   */
  async encryptData(plaintext, options = {}) {
    return this.executeWithTracking('encryptData', async () => {
      if (!this.initialized) {
        throw new Error('KMS not initialized');
      }

      if (!plaintext) {
        throw new Error('Plaintext required');
      }

      // Get active data key
      let dataKeyId = options.keyId;
      let dataKeyEntry = null;

      if (dataKeyId) {
        dataKeyEntry = this.dataKeys.get(dataKeyId);
        if (!dataKeyEntry) {
          throw new Error(`Data key not found: ${dataKeyId}`);
        }
      } else {
        // Use latest active key
        for (const [id, entry] of this.dataKeys.entries()) {
          if (entry.isActive) {
            dataKeyId = id;
            dataKeyEntry = entry;
            break;
          }
        }
      }

      if (!dataKeyEntry) {
        throw new Error('No active data keys available');
      }

      // Encrypt with AES-256-GCM
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', dataKeyEntry.key, iv);

      // Optional: add authenticated additional data
      const aad = options.aad ? Buffer.from(options.aad) : null;
      if (aad) {
        cipher.setAAD(aad);
      }

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();

      // Create encrypted envelope
      const envelope = {
        v: 1, // Version
        alg: 'aes-256-gcm',
        keyId: dataKeyId,
        iv: iv.toString('base64'),
        tag: authTag.toString('base64'),
        ciphertext: encrypted.toString('base64'),
        aad: aad ? aad.toString('base64') : null,
        timestamp: Date.now()
      };

      this.log('info', 'data_encrypted', {
        keyId: dataKeyId,
        plaintextLength: plaintext.length,
        encryptedLength: encrypted.length
      });

      return envelope;
    });
  }

  /**
   * Decrypt data with envelope
   */
  async decryptData(envelope, options = {}) {
    return this.executeWithTracking('decryptData', async () => {
      if (!this.initialized) {
        throw new Error('KMS not initialized');
      }

      if (!envelope || !envelope.ciphertext) {
        throw new Error('Invalid envelope');
      }

      // Get data key
      const dataKeyEntry = this.dataKeys.get(envelope.keyId);
      if (!dataKeyEntry) {
        throw new Error(`Data key not found: ${envelope.keyId}`);
      }

      try {
        // Prepare buffers
        const iv = Buffer.from(envelope.iv, 'base64');
        const tag = Buffer.from(envelope.tag, 'base64');
        const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
        const aad = envelope.aad ? Buffer.from(envelope.aad, 'base64') : null;

        // Decrypt
        const decipher = crypto.createDecipheriv('aes-256-gcm', dataKeyEntry.key, iv);
        decipher.setAuthTag(tag);

        if (aad) {
          decipher.setAAD(aad);
        }

        const plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]).toString('utf8');

        this.log('info', 'data_decrypted', {
          keyId: envelope.keyId,
          age: Date.now() - envelope.timestamp
        });

        return plaintext;
      } catch (error) {
        this.log('error', 'decryption_failed', {
          keyId: envelope.keyId,
          message: error.message
        });
        throw new Error('Decryption failed - authentication tag verification failed');
      }
    });
  }

  /**
   * Store a secret with automatic rotation policy
   */
  async storeSecret(name, plaintext, options = {}) {
    return this.executeWithTracking('storeSecret', async () => {
      this.validateRequired({ name, plaintext }, ['name', 'plaintext']);

      // Encrypt the secret
      const envelope = await this.encryptData(plaintext, {
        keyId: options.keyId,
        aad: name // Use secret name as AAD for binding
      });

      // Calculate expiry
      const ttlDays = options.ttlDays || 90;
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

      // Store
      this.secrets.set(name, {
        envelope,
        keyId: envelope.keyId,
        createdAt: new Date(),
        expiresAt,
        rotationPolicy: options.rotationPolicy || 'manual',
        tags: options.tags || {}
      });

      this.log('info', 'secret_stored', {
        name,
        expiresInDays: ttlDays,
        rotationPolicy: options.rotationPolicy || 'manual'
      });

      return true;
    });
  }

  /**
   * Retrieve a secret
   */
  async getSecret(name) {
    return this.executeWithTracking('getSecret', async () => {
      const secret = this.secrets.get(name);

      if (!secret) {
        this.log('warn', 'secret_not_found', { name });
        throw new Error(`Secret not found: ${name}`);
      }

      // Check expiration
      if (new Date() > secret.expiresAt) {
        this.secrets.delete(name);
        this.log('warn', 'secret_expired', { name });
        throw new Error(`Secret expired: ${name}`);
      }

      // Decrypt
      const plaintext = await this.decryptData(secret.envelope, { aad: name });

      this.log('info', 'secret_retrieved', {
        name,
        keyId: secret.keyId,
        age: Date.now() - secret.createdAt.getTime()
      });

      return plaintext;
    });
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(name, newPlaintext) {
    return this.executeWithTracking('rotateSecret', async () => {
      const oldSecret = this.secrets.get(name);

      if (!oldSecret) {
        throw new Error(`Secret not found: ${name}`);
      }

      // Store with new key (forces re-encryption with active key)
      const newKeyId = Array.from(this.dataKeys.entries())
        .find(([, entry]) => entry.isActive)?.[0];

      await this.storeSecret(name, newPlaintext, {
        keyId: newKeyId,
        ttlDays: 90,
        rotationPolicy: oldSecret.rotationPolicy,
        tags: oldSecret.tags
      });

      this.log('info', 'secret_rotated', {
        name,
        oldKeyId: oldSecret.keyId,
        newKeyId
      });

      return true;
    });
  }

  /**
   * Rotate data keys
   */
  async rotateDataKey() {
    return this.executeWithTracking('rotateDataKey', async () => {
      // Mark current active keys as inactive
      for (const [, entry] of this.dataKeys.entries()) {
        if (entry.isActive) {
          entry.isActive = false;
        }
      }

      // Generate new key
      const newKeyId = 'default-' + Date.now();
      const newKey = this.generateDataKey();

      this.dataKeys.set(newKeyId, {
        key: newKey,
        createdAt: new Date(),
        rotatedAt: new Date(),
        isActive: true,
        version: 1
      });

      // Optional: Re-encrypt all secrets with new key
      // (skipped for now to avoid blocking, can be async job)

      this.log('info', 'data_key_rotated', {
        newKeyId,
        totalKeys: this.dataKeys.size
      });

      return newKeyId;
    });
  }

  /**
   * List secret names and metadata (without values)
   */
  listSecrets(filter = {}) {
    const secrets = [];

    for (const [name, secret] of this.secrets.entries()) {
      // Check filters
      if (filter.tag) {
        if (!secret.tags[filter.tag]) continue;
      }

      secrets.push({
        name,
        createdAt: secret.createdAt,
        expiresAt: secret.expiresAt,
        keyId: secret.keyId,
        rotationPolicy: secret.rotationPolicy,
        tags: secret.tags,
        isExpired: new Date() > secret.expiresAt
      });
    }

    return secrets;
  }

  /**
   * Delete a secret
   */
  deleteSecret(name) {
    return this.executeWithTracking('deleteSecret', async () => {
      const existed = this.secrets.has(name);
      this.secrets.delete(name);

      if (existed) {
        this.log('info', 'secret_deleted', { name });
      }

      return existed;
    });
  }

  /**
   * Get KMS status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      masterKeyPresent: !!this.masterKey,
      dataKeysCount: this.dataKeys.size,
      activeDataKeys: Array.from(this.dataKeys.entries())
        .filter(([, entry]) => entry.isActive)
        .map(([id]) => id),
      secretsCount: this.secrets.size,
      expiredSecretsCount: Array.from(this.secrets.values())
        .filter(s => new Date() > s.expiresAt).length
    };
  }
}

// Export singleton
const kmsService = new KMSService();

module.exports = {
  initialize: () => kmsService.initialize(),
  encryptData: (plaintext, opts) => kmsService.encryptData(plaintext, opts),
  decryptData: (envelope, opts) => kmsService.decryptData(envelope, opts),
  storeSecret: (name, plaintext, opts) => kmsService.storeSecret(name, plaintext, opts),
  getSecret: (name) => kmsService.getSecret(name),
  rotateSecret: (name, newPlaintext) => kmsService.rotateSecret(name, newPlaintext),
  rotateDataKey: () => kmsService.rotateDataKey(),
  listSecrets: (filter) => kmsService.listSecrets(filter),
  deleteSecret: (name) => kmsService.deleteSecret(name),
  getStatus: () => kmsService.getStatus(),
  instance: kmsService
};
