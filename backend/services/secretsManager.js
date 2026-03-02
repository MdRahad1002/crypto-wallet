/**
 * Secrets Manager
 * Unified interface for managing application secrets
 * Integrates with KMS for encryption and storage
 */

const logger = require('../core/logger');
const { BaseService } = require('./BaseService');
const kmsService = require('./kmsService');

/**
 * SecretsManager - Manages application secrets lifecycle
 */
class SecretsManager extends BaseService {
  constructor() {
    super('SecretsManager');
    this.secretsCache = new Map(); // Cached decrypted secrets
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize secrets from environment and KMS
   */
  async initialize() {
    return this.executeWithTracking('initialize', async () => {
      const requiredSecrets = [
        { name: 'JWT_SECRET', env: 'JWT_SECRET', required: true },
        { name: 'MONGODB_URI', env: 'MONGODB_URI', required: false },
        { name: 'ENCRYPTION_MASTER_KEY', env: 'KMS_MASTER_KEY', required: false },
        { name: 'REDIS_URL', env: 'REDIS_URL', required: false }
      ];

      for (const secret of requiredSecrets) {
        const value = process.env[secret.env];

        if (!value) {
          if (secret.required) {
            throw new Error(`Required secret not found: ${secret.name}`);
          }
          continue;
        }

        // Store in KMS
        await kmsService.storeSecret(secret.name, value, {
          rotationPolicy: 'manual',
          ttlDays: 365,
          tags: { type: 'application_secret' }
        });
      }

      this.log('info', 'secrets_initialized', {
        count: requiredSecrets.filter(s => process.env[s.env]).length
      });

      return true;
    });
  }

  /**
   * Get secret with caching
   */
  async getSecret(name) {
    return this.executeWithTracking('getSecret', async () => {
      this.validateRequired({ name }, ['name']);

      // Check cache
      const cached = this.getCache(name);
      if (cached) {
        this.log('debug', 'secret_cache_hit', { name });
        return cached;
      }

      // Get from KMS
      const secret = await kmsService.getSecret(name);

      // Cache for TTL
      this.setCache(name, secret, this.cacheTTL);

      this.log('info', 'secret_retrieved', { name });
      return secret;
    });
  }

  /**
   * Store a new secret
   */
  async setSecret(name, value, options = {}) {
    return this.executeWithTracking('setSecret', async () => {
      this.validateRequired({ name, value }, ['name', 'value']);

      await kmsService.storeSecret(name, value, {
        rotationPolicy: options.rotationPolicy || 'manual',
        ttlDays: options.ttlDays || 365,
        tags: options.tags || {}
      });

      // Invalidate cache
      this.clearCacheKey(name);

      this.log('info', 'secret_set', {
        name,
        rotationPolicy: options.rotationPolicy || 'manual'
      });

      return true;
    });
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(name, newValue) {
    return this.executeWithTracking('rotateSecret', async () => {
      this.validateRequired({ name, newValue }, ['name', 'newValue']);

      await kmsService.rotateSecret(name, newValue);

      // Invalidate cache
      this.clearCacheKey(name);

      this.log('warn', 'secret_rotated', { name });
      return true;
    });
  }

  /**
   * List all secrets (metadata only)
   */
  listSecrets(filter = {}) {
    return this.executeWithTracking('listSecrets', async () => {
      return kmsService.listSecrets(filter);
    });
  }

  /**
   * Check if secret exists
   */
  async hasSecret(name) {
    try {
      await this.getSecret(name);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get multiple secrets at once
   */
  async getSecrets(names) {
    return this.executeWithTracking('getSecrets', async () => {
      const secrets = {};

      for (const name of names) {
        try {
          secrets[name] = await this.getSecret(name);
        } catch (error) {
          this.log('warn', 'secret_not_found_bulk', { name });
          secrets[name] = null;
        }
      }

      return secrets;
    });
  }

  /**
   * Backup secrets for disaster recovery
   */
  async backupSecrets() {
    return this.executeWithTracking('backupSecrets', async () => {
      const secrets = kmsService.listSecrets();
      const backup = {
        timestamp: new Date(),
        count: secrets.length,
        secrets: secrets.map(s => ({
          name: s.name,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          keyId: s.keyId,
          tags: s.tags
        }))
      };

      this.log('info', 'secrets_backup_created', {
        count: secrets.length
      });

      return backup;
    });
  }

  /**
   * Clear all cached secrets
   */
  clearCache() {
    return this.executeWithTracking('clearCache', async () => {
      const count = this.cache.size;
      super.clearCache();
      this.log('info', 'secrets_cache_cleared', { count });
      return true;
    });
  }

  /**
   * Get secrets manager status
   */
  getStatus() {
    return {
      cacheSize: this.cache.size,
      kmsStatus: kmsService.getStatus(),
      uptime: process.uptime()
    };
  }
}

// Export singleton
const secretsManager = new SecretsManager();

module.exports = {
  initialize: () => secretsManager.initialize(),
  getSecret: (name) => secretsManager.getSecret(name),
  setSecret: (name, value, opts) => secretsManager.setSecret(name, value, opts),
  rotateSecret: (name, newValue) => secretsManager.rotateSecret(name, newValue),
  listSecrets: (filter) => secretsManager.listSecrets(filter),
  hasSecret: (name) => secretsManager.hasSecret(name),
  getSecrets: (names) => secretsManager.getSecrets(names),
  backupSecrets: () => secretsManager.backupSecrets(),
  clearCache: () => secretsManager.clearCache(),
  getStatus: () => secretsManager.getStatus(),
  instance: secretsManager
};
