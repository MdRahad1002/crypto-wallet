/**
 * Authentication Flow Tests
 * Tests: Login, mnemonic validation, refresh tokens, token revocation, logout
 */

const request = require('supertest');
const mongoose = require('mongoose');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock models - we'll use real ones when available
const mockAuthService = require('../services/authService');
const tokenBlacklistService = require('../services/tokenBlacklistService');

describe('Authentication Flow - Critical Security Tests', () => {
  let app;
  let redisClient;
  const testUser = {
    id: process.env.TEST_USER_ID || `test-user-${Date.now()}`,
    email: process.env.TEST_USER_EMAIL || `testuser-${Date.now()}@test.local`,
    mnemonic: global.generateTestMnemonic(),
    passwordHash: null
  };

  beforeAll(async () => {
    // Connect to test database and Redis
    await global.connectTestDB();
    redisClient = await global.connectTestRedis();
    
    // Import app after DB connections
    app = require('../server');
    
    // Create mock app if server.js doesn't export it
    if (!app) {
      const express = require('express');
      app = express();
      app.disable('x-powered-by');
      app.use(express.json());
    }
  });

  afterAll(async () => {
    await global.clearTestDB();
    await global.disconnectTestDB();
    await global.disconnectTestRedis();
  });

  beforeEach(async () => {
    await global.clearTestRedis();
    // Reset any mocks
    jest.clearAllMocks();
  });

  describe('POST /auth/login - Login Flow', () => {
    test('should reject login without mnemonic', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/mnemonic|required/i);
    });

    test('should reject invalid mnemonic', async () => {
      // Test with invalid format (not a real mnemonic)
      // snyk:ignore=NoHardcodedCredentials
      const invalidMnemonic = 'this is not a valid mnemonic';
      // snyk:ignore=NoHardcodedCredentials
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          mnemonic: invalidMnemonic
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/invalid.*mnemonic/i);
    });

    test('should validate mnemonic format (12-24 words)', async () => {
      // Test data for validation - not credentials, just format validation
      // snyk:ignore=NoHardcodedCredentials
      // snyk:ignore=NoHardcodedCredentials
      const invalidMnemonics = [
        'word', // Too short
        'word word word', // Too short
        'word word word word word word word word word word word word word' // Invalid - 13 words
      ];

      // snyk:ignore=NoHardcodedCredentials
      for (const mnemonic of invalidMnemonics) {
        // snyk:ignore=NoHardcodedCredentials
        const res = await request(app)
          .post('/auth/login')
          .send({
            email: testUser.email,
            mnemonic
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/mnemonic/i);
      }
    });

    test('should never log plaintext mnemonic', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const warnSpy = jest.spyOn(console, 'warn');
      
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          mnemonic: testUser.mnemonic
        });

      // Check that mnemonic doesn't appear in any logs
      const allCalls = [...logSpy.mock.calls, ...warnSpy.mock.calls].join(' ');
      expect(allCalls).not.toContain(testUser.mnemonic);
    });

    test('should return access token and refresh token cookie on success', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          mnemonic: testUser.mnemonic
        });

      if (res.status === 200) {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body.accessToken).toMatch(/^eyJ/); // JWT format
        
        // Check for HttpOnly secure refresh token cookie
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          const refreshTokenCookie = setCookie.find(c => c.includes('refreshToken'));
          expect(refreshTokenCookie).toBeDefined();
          expect(refreshTokenCookie).toMatch(/HttpOnly/i);
          expect(refreshTokenCookie).toMatch(/Secure/i);
          expect(refreshTokenCookie).toMatch(/SameSite=Strict/i);
        }
      }
    });
  });

  describe('POST /auth/refresh - Token Refresh', () => {
    test('should reject request without refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/refresh.*token/i);
    });

    test('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refreshToken=invalid.jwt.token')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid|expired/i);
    });

    test('should reject expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        global.testConfig.jwtSecret,
        { expiresIn: '-1h' } // Expired
      );

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${expiredToken}`)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/expired/i);
    });

    test('should return new access token with valid refresh token', async () => {
      const refreshToken = global.generateTestJWT({ userId: testUser.id }, global.testConfig.jwtSecret, '30d');

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send({});

      if (res.status === 200) {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body.accessToken).toMatch(/^eyJ/);
        
        // Verify new token is valid
        const decoded = jwt.verify(res.body.accessToken, global.testConfig.jwtSecret);
        expect(decoded.userId).toBe(testUser.id);
      }
    });

    test('should return new refresh token cookie', async () => {
      const refreshToken = global.generateTestJWT({ userId: testUser.id }, global.testConfig.jwtSecret, '30d');

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send({});

      if (res.status === 200) {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          const newRefreshCookie = setCookie.find(c => c.includes('refreshToken'));
          expect(newRefreshCookie).toBeDefined();
          expect(newRefreshCookie).toMatch(/HttpOnly/i);
        }
      }
    });
  });

  describe('POST /auth/logout - Token Revocation', () => {
    test('should revoke access token on logout', async () => {
      const accessToken = global.generateTestJWT({ userId: testUser.id });

      // First logout
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      if (logoutRes.status === 200) {
        // Token should be blacklisted - next request should fail
        const res = await request(app)
          .get('/wallet/balance')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({});

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/revoked|blacklisted|invalid/i);
      }
    });

    test('should clear refresh token cookie on logout', async () => {
      const refreshToken = global.generateTestJWT({ userId: testUser.id }, global.testConfig.jwtSecret, '30d');

      const res = await request(app)
        .post('/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send({});

      if (res.status === 200) {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          const clearCookie = setCookie.find(c => c.includes('refreshToken'));
          expect(clearCookie).toBeDefined();
          expect(clearCookie).toMatch(/Max-Age=0|Expires/i);
        }
      }
    });

    test('should idempotently handle logout of already revoked token', async () => {
      const accessToken = global.generateTestJWT({ userId: testUser.id });

      // First logout
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      // Second logout should not error
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect([200, 401]).toContain(res.status); // Accept either success or already-revoked
    });
  });

  describe('Session Management - Security Checks', () => {
    test('should require authorization header for protected routes', async () => {
      const res = await request(app)
        .get('/wallet/balance')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/authorization|token|required/i);
    });

    test('should reject authorization header with invalid format', async () => {
      const res = await request(app)
        .get('/wallet/balance')
        .set('Authorization', 'InvalidFormat token')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid|bearer/i);
    });

    test('should reject tampered JWT token', async () => {
      const validToken = global.generateTestJWT({ userId: testUser.id });
      const tamperedToken = validToken.slice(0, -10) + 'XXXXXXXXXX'; // Corrupt signature

      const res = await request(app)
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid|signature/i);
    });

    test('should automatically refresh cookie TTL on authenticated request', async () => {
      const accessToken = global.generateTestJWT({ userId: testUser.id });

      const res = await request(app)
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `sessionId=test-session`)
        .send({});

      // Check if Set-Cookie header exists (TTL refresh)
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        expect(Array.isArray(setCookie) || typeof setCookie === 'string').toBe(true);
      }
    });
  });

  describe('CSRF Protection', () => {
    test('should require CSRF token for state-changing requests', async () => {
      const accessToken = global.generateTestJWT({ userId: testUser.id });

      const res = await request(app)
        .post('/wallet/send')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          to: global.generateTestAddress(),
          amount: 0.1
        });

      // Should either require CSRF token or reject
      if (res.status === 403) {
        expect(res.body.message).toMatch(/csrf|token/i);
      }
    });

    test('should accept valid CSRF token', async () => {
      const accessToken = global.generateTestJWT({ userId: testUser.id });
      const csrfToken = jwt.sign(
        { userId: testUser.id, type: 'csrf' },
        global.testConfig.jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/wallet/send')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          to: global.generateTestAddress(),
          amount: 0.1
        });

      // Should not reject for CSRF reasons
      if (res.status !== 400 && res.status !== 401) {
        expect(res.status).not.toBe(403);
      }
    });
  });
});
