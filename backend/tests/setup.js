/**
 * Jest Test Setup and Global Configuration
 * Handles test environment initialization, database setup/teardown, and utilities
 */

const mongoose = require('mongoose');
const redis = require('redis');
const dotenv = require('dotenv');

// Load test environment
dotenv.config({ path: '.env.test' });

// Test configuration
const crypto = require('crypto');
const TEST_CONFIG = {
  mongoUri: process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/crypto-wallet-test',
  redisUrl: process.env.REDIS_URL_TEST || 'redis://localhost:6379/1',
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  port: 3001,
  timeout: 10000
};

// Suppress logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(), // Keep errors for debugging
};

// Global test utilities
global.testConfig = TEST_CONFIG;

// Setup test timeout
jest.setTimeout(TEST_CONFIG.timeout);

// MongoDB connection helper
global.connectTestDB = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_CONFIG.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
};

// MongoDB disconnection helper
global.disconnectTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

// Clear database helper
global.clearTestDB = async () => {
  const collections = Object.keys(mongoose.connection.collections);
  for (const collectionName of collections) {
    const collection = mongoose.connection.collections[collectionName];
    await collection.deleteMany({});
  }
};

// Redis connection helper
let redisClient = null;
global.connectTestRedis = async () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: TEST_CONFIG.redisUrl,
      socket: { reconnectStrategy: () => 50 }
    });
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    await redisClient.connect();
  }
  return redisClient;
};

// Redis disconnection helper
global.disconnectTestRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

// Clear Redis helper
global.clearTestRedis = async () => {
  if (redisClient) {
    await redisClient.flushDb();
  }
};

// Get Redis client helper
global.getTestRedis = () => redisClient;

// Mock crypto operations
global.generateTestMnemonic = () => {
  return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
};

global.generateTestPrivateKey = () => {
  return '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
};

global.generateTestAddress = () => {
  return '0x742d35Cc6634C0532925a3b844Bc859D5b2C1c0e';
};

// JWT token generator for tests
global.generateTestJWT = (payload = {}, secret = TEST_CONFIG.jwtSecret, expiresIn = '15m') => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId: 'test-user-id', ...payload },
    secret,
    { expiresIn }
  );
};

// Request builder helper
global.buildTestRequest = (method, path, options = {}) => {
  return {
    method,
    path,
    headers: options.headers || {},
    body: options.body || {},
    cookies: options.cookies || {},
    user: options.user || null,
    authenticated: options.authenticated || false
  };
};

// Response helper
global.mockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    getHeader: jest.fn(),
    setHeader: jest.fn(),
    end: jest.fn()
  };
  return res;
};

// Next helper
global.mockNext = () => jest.fn();

// Request helper
global.mockRequest = (options = {}) => {
  return {
    method: options.method || 'GET',
    path: options.path || '/',
    headers: options.headers || {},
    body: options.body || {},
    cookies: options.cookies || {},
    user: options.user || null,
    session: options.session || {},
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn()
  };
};

module.exports = { TEST_CONFIG };
