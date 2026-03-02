/**
 * Secure Configuration Loader
 * Loads configuration from environment variables and KMS
 * Validates and provides typed access to configuration
 */

const logger = require('../core/logger');
const { BaseService } = require('../services/BaseService');

/**
 * ConfigLoader - Loads configuration with validation
 */
class ConfigLoader extends BaseService {
  constructor() {
    super('ConfigLoader');
    this.config = {};
    this.validated = false;
  }

  /**
   * Load and validate configuration
   */
  async load(secretsManager) {
    return this.executeWithTracking('load', async () => {
      this.validateRequired({ secretsManager }, ['secretsManager']);

      // Environment variables (non-sensitive)
      this.config = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: parseInt(process.env.PORT || '3000', 10),
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',

        // HTTPS Configuration
        REQUIRE_HTTPS: process.env.REQUIRE_HTTPS === 'true',
        TLS_KEY_PATH: process.env.TLS_KEY_PATH,
        TLS_CERT_PATH: process.env.TLS_CERT_PATH,
        USE_HTTPS: process.env.USE_HTTPS === 'true',

        // Cookie Configuration
        COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
        COOKIE_SECURE: process.env.NODE_ENV === 'production',
        REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10),

        // Jobs Configuration
        JOBS_ENABLED: process.env.JOBS_ENABLED === 'true',
        BALANCE_REFRESH_INTERVAL: parseInt(process.env.BALANCE_REFRESH_INTERVAL || '300000', 10),

        // WebSocket Configuration
        SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || '*',
        SOCKET_MAX_EVENTS_PER_SECOND: parseInt(process.env.SOCKET_MAX_EVENTS_PER_SECOND || '10', 10),
        SOCKET_MAX_EVENTS_PER_MINUTE: parseInt(process.env.SOCKET_MAX_EVENTS_PER_MINUTE || '300', 10),

        // Admin Configuration
        ADMIN_IP_ALLOWLIST: (process.env.ADMIN_IP_ALLOWLIST || '')
          .split(',')
          .filter(ip => ip.trim()),
        ADMIN_API_KEY_HASH: process.env.ADMIN_API_KEY_HASH
      };

      // Retrieve secrets from KMS
      const secretNames = [
        'JWT_SECRET',
        'MONGODB_URI',
        'REDIS_URL',
        'ENCRYPTION_MASTER_KEY'
      ];

      const secrets = await secretsManager.getSecrets(secretNames);

      // Set secrets
      if (secrets.JWT_SECRET) this.config.JWT_SECRET = secrets.JWT_SECRET;
      if (secrets.MONGODB_URI) this.config.MONGODB_URI = secrets.MONGODB_URI;
      if (secrets.REDIS_URL) this.config.REDIS_URL = secrets.REDIS_URL;
      if (secrets.ENCRYPTION_MASTER_KEY) this.config.ENCRYPTION_MASTER_KEY = secrets.ENCRYPTION_MASTER_KEY;

      // Validate required configuration
      await this.validate();

      this.log('info', 'configuration_loaded', {
        environment: this.config.NODE_ENV,
        port: this.config.PORT,
        httpsRequired: this.config.REQUIRE_HTTPS
      });

      return this.config;
    });
  }

  /**
   * Validate configuration
   */
  async validate() {
    return this.executeWithTracking('validate', async () => {
      const required = ['JWT_SECRET'];
      const missing = required.filter(key => !this.config[key]);

      if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
      }

      // Validate types
      if (typeof this.config.PORT !== 'number' || this.config.PORT < 1 || this.config.PORT > 65535) {
        throw new Error('Invalid PORT configuration');
      }

      if (typeof this.config.JWT_SECRET !== 'string' || this.config.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters');
      }

      this.validated = true;
      this.log('info', 'configuration_validated', {});
      return true;
    });
  }

  /**
   * Get configuration value with type safety
   */
  get(key, defaultValue = undefined) {
    const value = this.config[key];

    if (value === undefined && defaultValue !== undefined) {
      return defaultValue;
    }

    if (value === undefined) {
      this.log('warn', 'config_key_missing', { key });
    }

    return value;
  }

  /**
   * Get all public configuration (no secrets)
   */
  getPublic() {
    const publicConfig = {};

    for (const [key, value] of Object.entries(this.config)) {
      // Exclude sensitive keys
      if (['JWT_SECRET', 'REDIS_URL', 'ENCRYPTION_MASTER_KEY'].includes(key)) {
        continue;
      }

      publicConfig[key] = value;
    }

    return publicConfig;
  }

  /**
   * Get connection strings (with masking)
   */
  getConnections() {
    return {
      mongodb: this.maskConnectionString(this.config.MONGODB_URI),
      redis: this.maskConnectionString(this.config.REDIS_URL)
    };
  }

  /**
   * Mask sensitive parts of connection string
   */
  maskConnectionString(uri) {
    if (!uri) return 'not configured';

    try {
      const url = new URL(uri);
      if (url.username) url.username = '****';
      if (url.password) url.password = '****';
      return url.toString();
    } catch (error) {
      return '<invalid-uri>';
    }
  }

  /**
   * Check if configuration is valid
   */
  isValid() {
    return this.validated && !!this.config.JWT_SECRET;
  }

  /**
   * Get configuration status
   */
  getStatus() {
    return {
      validated: this.validated,
      environment: this.config.NODE_ENV,
      https: {
        required: this.config.REQUIRE_HTTPS,
        enabled: this.config.USE_HTTPS
      },
      // connections removed — using Supabase, no MongoDB
      // connections: this.getConnections(),
      features: {
        jobsEnabled: this.config.JOBS_ENABLED,
        adminApiKey: !!this.config.ADMIN_API_KEY_HASH
      }
    };
  }
}

// Export singleton
const configLoader = new ConfigLoader();

module.exports = {
  load: (secretsManager) => configLoader.load(secretsManager),
  get: (key, defaultValue) => configLoader.get(key, defaultValue),
  getPublic: () => configLoader.getPublic(),
  getConnections: () => configLoader.getConnections(),
  isValid: () => configLoader.isValid(),
  getStatus: () => configLoader.getStatus(),
  instance: configLoader
};
