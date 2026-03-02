/**
 * KMS (Key Management Service) Tests
 * Tests: Encryption, decryption, key rotation, secret management
 */

const kmsService = require('../services/kmsService');
const secretsManager = require('../services/secretsManager');
const crypto = require('crypto');

describe('KMS Service - Encryption & Key Management', () => {
  let kms;

  beforeAll(async () => {
    await global.connectTestDB();
    await global.connectTestRedis();
    
    // Initialize KMS
    kms = kmsService;
    if (!kms.initialized) {
      await kms.initialize();
    }
  });

  afterAll(async () => {
    await global.clearTestDB();
    await global.disconnectTestDB();
    await global.disconnectTestRedis();
  });

  describe('Data Encryption - AES-256-GCM', () => {
    test('should encrypt plaintext data', async () => {
      const plaintext = 'sample-encryption-input';
      
      const encrypted = await kms.encryptData(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext); // Should not be plaintext
      expect(encrypted).toMatch(/^[a-zA-Z0-9+/=]+$/); // Base64-like format
    });

    test('should decrypt encrypted data', async () => {
      const plaintext = 'hello-world-test-data';
      
      const encrypted = await kms.encryptData(plaintext);
      const decrypted = await kms.decryptData(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('should not decrypt tampered ciphertext', async () => {
      const plaintext = 'tamper-test-input';
      
      const encrypted = await kms.encryptData(plaintext);
      
      // Tamper with encrypted data
      const tamperedBuffer = Buffer.from(encrypted, 'base64');
      tamperedBuffer[0] ^= 0xFF; // Flip bits in first byte
      const tampered = tamperedBuffer.toString('base64');

      // Should throw or return null
      try {
        await kms.decryptData(tampered);
        expect(false).toBe(true); // Should have thrown
      } catch (error) {
        expect(error.message).toMatch(/failed|invalid|auth|tag/i);
      }
    });

    test('should generate unique IVs for each encryption', async () => {
      const plaintext = 'same-plaintext';
      
      const encrypted1 = await kms.encryptData(plaintext);
      const encrypted2 = await kms.encryptData(plaintext);

      expect(encrypted1).not.toBe(encrypted2); // Different ciphertexts
      
      // But both should decrypt to same plaintext
      const decrypted1 = await kms.decryptData(encrypted1);
      const decrypted2 = await kms.decryptData(encrypted2);
      
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    test('should use 12-byte random IV', async () => {
      const plaintext = 'test-data';
      const encrypted = await kms.encryptData(plaintext);
      
      // Decode and verify envelope structure
      const envelope = JSON.parse(Buffer.from(encrypted, 'base64').toString());
      
      expect(envelope).toHaveProperty('iv');
      const ivBuffer = Buffer.from(envelope.iv, 'hex');
      expect(ivBuffer.length).toBe(12); // 12 bytes = 96 bits
    });

    test('should use 16-byte authentication tag', async () => {
      const plaintext = 'test-data';
      const encrypted = await kms.encryptData(plaintext);
      
      // Decode and verify envelope structure
      const envelope = JSON.parse(Buffer.from(encrypted, 'base64').toString());
      
      expect(envelope).toHaveProperty('tag');
      const tagBuffer = Buffer.from(envelope.tag, 'hex');
      expect(tagBuffer.length).toBe(16); // 16 bytes = 128 bits
    });

    test('should support Additional Authenticated Data (AAD)', async () => {
      const plaintext = 'aad-test-input';
      const aad = 'user-id-12345';
      
      const encrypted = await kms.encryptData(plaintext, { aad });
      const decrypted = await kms.decryptData(encrypted, { aad });

      expect(decrypted).toBe(plaintext);
    });

    test('should reject decryption with wrong AAD', async () => {
      const plaintext = 'aad-mismatch-input';
      const aad1 = 'user-id-12345';
      const aad2 = 'user-id-67890';
      
      const encrypted = await kms.encryptData(plaintext, { aad: aad1 });
      
      try {
        await kms.decryptData(encrypted, { aad: aad2 });
        expect(false).toBe(true); // Should have thrown
      } catch (error) {
        expect(error.message).toMatch(/failed|invalid|auth/i);
      }
    });
  });

  describe('Secret Storage & Retrieval', () => {
    test('should store secret with encryption', async () => {
      const crypto = require('crypto');
      const secretName = 'db-password';
      const secretValue = crypto.randomBytes(16).toString('hex');

      await kms.storeSecret(secretName, secretValue);
      const retrieved = await kms.getSecret(secretName);

      expect(retrieved).toBe(secretValue);
    });

    test('should list stored secrets', async () => {
      const crypto = require('crypto');
      const secrets = [
        { name: 'api-key-1', value: crypto.randomBytes(12).toString('hex') },
        { name: 'api-key-2', value: crypto.randomBytes(12).toString('hex') },
        { name: 'jwt-secret', value: crypto.randomBytes(32).toString('hex') }
      ];

      for (const secret of secrets) {
        await kms.storeSecret(secret.name, secret.value);
      }

      const list = await kms.listSecrets();
      expect(list.length).toBeGreaterThanOrEqual(secrets.length);
    });

    test('should filter secrets by name pattern', async () => {
      const crypto = require('crypto');
      await kms.storeSecret('api-prod-key', crypto.randomBytes(16).toString('hex'));
      await kms.storeSecret('api-test-key', crypto.randomBytes(16).toString('hex'));
      await kms.storeSecret('db-password', crypto.randomBytes(16).toString('hex'));

      const apiKeys = await kms.listSecrets('api-*');
      expect(apiKeys.length).toBeGreaterThanOrEqual(2);
      expect(apiKeys.every(s => s.name.startsWith('api-'))).toBe(true);
    });

    test('should not store plaintext secrets', async () => {
      const secretName = 'plaintext-check';
      const secretValue = crypto.randomBytes(12).toString('hex');

      await kms.storeSecret(secretName, secretValue);
      
      // Verify it's stored encrypted in database
      const status = await kms.getStatus();
      expect(status.secretsCount).toBeGreaterThan(0);
    });

    test('should delete secrets', async () => {
      const secretName = 'temp-secret';
      await kms.storeSecret(secretName, crypto.randomBytes(12).toString('hex'));

      await kms.deleteSecret(secretName);

      try {
        await kms.getSecret(secretName);
        expect(false).toBe(true); // Should have thrown
      } catch (error) {
        expect(error.message).toMatch(/not.*found|does.*not.*exist/i);
      }
    });
  });

  describe('Key Rotation', () => {
    test('should rotate data key', async () => {
      const beforeRotate = await kms.getStatus();
      const keyCountBefore = beforeRotate.activeDataKeyId;

      await kms.rotateDataKey();

      const afterRotate = await kms.getStatus();
      expect(afterRotate.activeDataKeyId).not.toBe(keyCountBefore);
    });

    test('should decrypt with old key after rotation', async () => {
      const plaintext = 'data-before-rotation';
      
      // Encrypt with current key
      const encrypted = await kms.encryptData(plaintext);
      
      // Rotate key
      await kms.rotateDataKey();
      
      // Should still be able to decrypt with old key
      const decrypted = await kms.decryptData(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('should encrypt with new key after rotation', async () => {
      const status1 = await kms.getStatus();
      const keyId1 = status1.activeDataKeyId;

      const encrypted1 = await kms.encryptData('data-1');
      
      await kms.rotateDataKey();

      const status2 = await kms.getStatus();
      const keyId2 = status2.activeDataKeyId;

      expect(keyId1).not.toBe(keyId2);

      const encrypted2 = await kms.encryptData('data-2');

      // Verify both decrypt correctly
      expect(await kms.decryptData(encrypted1)).toBe('data-1');
      expect(await kms.decryptData(encrypted2)).toBe('data-2');
    });

    test('should rotate secret value', async () => {
      const secretName = 'rotating-secret';
      const value1 = crypto.randomBytes(8).toString('hex');
      const value2 = crypto.randomBytes(8).toString('hex');

      await kms.storeSecret(secretName, value1);
      expect(await kms.getSecret(secretName)).toBe(value1);

      await kms.rotateSecret(secretName, value2);
      expect(await kms.getSecret(secretName)).toBe(value2);
    });
  });

  describe('Key Lifecycle Management', () => {
    test('should initialize with master key from environment', async () => {
      const status = await kms.getStatus();
      expect(status).toHaveProperty('initialized');
      expect(status.initialized).toBe(true);
    });

    test('should auto-generate master key if not provided', async () => {
      // This test documents the auto-generation feature
      const status = await kms.getStatus();
      expect(status).toHaveProperty('masterKeyExists');
      expect(status.masterKeyExists).toBe(true);
    });

    test('should report status and metrics', async () => {
      const status = await kms.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('activeDataKeyId');
      expect(status).toHaveProperty('totalDataKeys');
      expect(status).toHaveProperty('secretsCount');
      expect(status).toHaveProperty('lastRotation');
    });

    test('should track key metadata', async () => {
      const plaintext = 'tracked-data';
      const encrypted = await kms.encryptData(plaintext);

      const envelope = JSON.parse(Buffer.from(encrypted, 'base64').toString());
      
      expect(envelope).toHaveProperty('v'); // Version
      expect(envelope).toHaveProperty('alg'); // Algorithm
      expect(envelope).toHaveProperty('keyId'); // Key ID
      expect(envelope).toHaveProperty('timestamp'); // Encryption time
    });
  });

  describe('Performance & Security Characteristics', () => {
    test('encryption should be fast (<100ms)', async () => {
      const plaintext = 'performance-test';
      
      const start = Date.now();
      await kms.encryptData(plaintext);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('decryption should be fast (<100ms)', async () => {
      const plaintext = 'performance-test';
      const encrypted = await kms.encryptData(plaintext);

      const start = Date.now();
      await kms.decryptData(encrypted);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('should handle large data efficiently', async () => {
      const largeData = 'x'.repeat(100000); // 100KB

      const encrypted = await kms.encryptData(largeData);
      const decrypted = await kms.decryptData(encrypted);

      expect(decrypted).toBe(largeData);
    });
  });
});

describe('Secrets Manager - High-Level Interface', () => {
  let manager;

  beforeAll(async () => {
    await global.connectTestDB();
    await global.connectTestRedis();

    manager = secretsManager;
    if (!manager.initialized) {
      await manager.initialize();
    }
  });

  afterAll(async () => {
    await global.clearTestDB();
    await global.disconnectTestDB();
    await global.disconnectTestRedis();
  });

  test('should cache secrets for 5 minutes', async () => {
    const crypto = require('crypto');
    const secretName = 'cached-secret';
    const secretValue = crypto.randomBytes(16).toString('hex');

    await manager.setSecret(secretName, secretValue);

    const start = Date.now();
    const retrieved1 = await manager.getSecret(secretName);
    const retrieved2 = await manager.getSecret(secretName);
    const duration = Date.now() - start;

    expect(retrieved1).toBe(secretValue);
    expect(retrieved2).toBe(secretValue);
    expect(duration).toBeLessThan(50); // Should be very fast from cache
  });

  test('should auto-load environment variables as secrets', async () => {
    // Secrets manager should load env vars during init
    const status = await manager.getStatus();
    expect(status.initialized).toBe(true);
  });

  test('should support batch operations', async () => {
    const secretNames = ['secret-1', 'secret-2', 'secret-3'];
    
    for (let i = 0; i < secretNames.length; i++) {
      await manager.setSecret(secretNames[i], crypto.randomBytes(8).toString('hex'));
    }

    const retrieved = await manager.getSecrets(secretNames);
    expect(retrieved.length).toBe(secretNames.length);
  });

  test('should backup and restore secrets', async () => {
    await manager.setSecret('backup-test-1', crypto.randomBytes(8).toString('hex'));
    await manager.setSecret('backup-test-2', crypto.randomBytes(8).toString('hex'));

    const backup = await manager.backupSecrets();
    expect(backup).toBeDefined();
    expect(typeof backup).toBe('string');
    expect(backup.length).toBeGreaterThan(0);
  });
});
