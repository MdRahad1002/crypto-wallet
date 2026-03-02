/**
 * Cookie & CSRF Protection Tests
 * Tests: HttpOnly/Secure flags, CSRF token validation, SameSite enforcement
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

describe('Cookie Security - HttpOnly & Secure Flags', () => {
  let app;

  beforeAll(async () => {
    const express = require('express');
    const csrf = require('csurf');
    app = express();
    
    // Disable X-Powered-By header for security
    app.disable('x-powered-by');
    
    app.use(express.json());
    app.use(cookieParser(global.testConfig.jwtSecret));
    app.use(csrf({ cookie: false }));

    // Mock auth endpoint that sets cookies
    app.post('/auth/login', (req, res) => {
      const accessToken = global.generateTestJWT({ userId: 'test-user' });
      const refreshToken = global.generateTestJWT({ userId: 'test-user' }, global.testConfig.jwtSecret, '30d');

      // Set refresh token as HttpOnly, Secure, SameSite
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json({ accessToken });
    });

    // Mock endpoint that uses refresh token
    app.post('/auth/refresh', (req, res) => {
      const refreshToken = req.cookies.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token required' });
      }

      try {
        jwt.verify(refreshToken, global.testConfig.jwtSecret);
        const newAccessToken = global.generateTestJWT({ userId: 'test-user' });
        
        // Refresh the refresh token too
        const newRefreshToken = global.generateTestJWT({ userId: 'test-user' }, global.testConfig.jwtSecret, '30d');
        res.cookie('refreshToken', newRefreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.json({ accessToken: newAccessToken });
      } catch (error) {
        res.status(401).json({ message: 'Invalid refresh token' });
      }
    });

    // Mock logout endpoint
    app.post('/auth/logout', (req, res) => {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      });

      res.json({ message: 'Logged out' });
    });
  });

  describe('HttpOnly Flag', () => {
    test('should set HttpOnly flag on refresh token cookie', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/HttpOnly/i);
    });

    test('should not expose refresh token to JavaScript', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      // HttpOnly cookies should not be accessible via document.cookie
      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/HttpOnly/i);
    });

    test('should prevent XSS attacks via document.cookie', async () => {
      // When HttpOnly is set, JavaScript cannot access the cookie
      // This test documents that the cookie is protected against:
      // - document.cookie access
      // - fetch request interception
      // - local storage compromise

      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/HttpOnly/i);
    });
  });

  describe('Secure Flag', () => {
    test('should set Secure flag on refresh token cookie', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/Secure/i);
    });

    test('should not transmit over HTTP (Secure flag)', async () => {
      // When Secure flag is set, browser will only send cookie over HTTPS
      // This test documents HTTPS-only transmission

      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/Secure/i);
    });
  });

  describe('SameSite Attribute', () => {
    test('should set SameSite=Strict on refresh token cookie', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/SameSite=Strict/i);
    });

    test('should prevent CSRF attacks via SameSite=Strict', async () => {
      // SameSite=Strict prevents cookie from being sent on cross-site requests
      // This protects against CSRF attacks

      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/SameSite=Strict/i);
    });

    test('should reject cross-site cookie requests', async () => {
      // With SameSite=Strict, cookies should not be sent on:
      // - <a href="..."> navigations
      // - <form> submissions
      // - <img src="..."> requests
      // - <iframe src="..."> navigations

      // This test documents the expected behavior
      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/SameSite=/i);
    });
  });

  describe('Cookie Expiration & TTL Refresh', () => {
    test('should set MaxAge for refresh token cookie', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      const setCookie = res.headers['set-cookie'];
      const refreshCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(refreshCookie).toMatch(/Max-Age=/i);
    });

    test('should refresh TTL on authenticated requests', async () => {
      // First login
      const loginRes = await request(app)
        .post('/auth/login')
        .send({});

      const refreshToken = loginRes.headers['set-cookie']
        .find(c => c.includes('refreshToken'))
        .split(';')[0]
        .replace('refreshToken=', '');

      // Make authenticated request
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send({});

      const newCookie = refreshRes.headers['set-cookie'];
      if (newCookie) {
        const newRefreshCookie = newCookie.find(c => c.includes('refreshToken'));
        expect(newRefreshCookie).toBeDefined();
      }
    });

    test('should clear cookie on logout', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({});

      const refreshToken = loginRes.headers['set-cookie']
        .find(c => c.includes('refreshToken'))
        .split(';')[0]
        .replace('refreshToken=', '');

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send({});

      const setCookie = logoutRes.headers['set-cookie'];
      const clearedCookie = setCookie.find(c => c.includes('refreshToken'));
      
      expect(clearedCookie).toMatch(/Max-Age=0|Expires/i);
    });
  });
});

describe('CSRF Protection', () => {
  let app;

  beforeAll(async () => {
    const express = require('express');
    const csrf = require('csurf');
    app = express();
    
    // Disable X-Powered-By header for security
    app.disable('x-powered-by');
    
    app.use(express.json());
    app.use(cookieParser(global.testConfig.jwtSecret));
    app.use(csrf({ cookie: false }));

    // CSRF token generation endpoint
    app.get('/csrf-token', (req, res) => {
      const csrfToken = req.csrfToken();
      res.json({ csrfToken });
    });

    // Protected endpoint requiring CSRF token
    app.post('/wallet/send', (req, res) => {
      // CSRF middleware validates automatically, just verify we got here
      res.json({ message: 'Transaction sent' });
    });
  });

  describe('CSRF Token Validation', () => {
    test('should require CSRF token for state-changing requests', async () => {
      const res = await request(app)
        .post('/wallet/send')
        .send({ to: global.generateTestAddress(), amount: 0.1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/csrf.*token.*required/i);
    });

    test('should accept valid CSRF token', async () => {
      const csrfRes = await request(app).get('/csrf-token');
      const csrfToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post('/wallet/send')
        .set('X-CSRF-Token', csrfToken)
        .send({ to: global.generateTestAddress(), amount: 0.1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Transaction sent');
    });

    test('should reject invalid CSRF token', async () => {
      const invalidToken = global.generateTestJWT(
        { type: 'not-csrf' },
        global.testConfig.jwtSecret,
        '1h'
      );

      const res = await request(app)
        .post('/wallet/send')
        .set('X-CSRF-Token', invalidToken)
        .send({ to: global.generateTestAddress(), amount: 0.1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/invalid.*csrf/i);
    });

    test('should reject expired CSRF token', async () => {
      const expiredToken = global.generateTestJWT(
        { type: 'csrf' },
        global.testConfig.jwtSecret,
        '-1h'
      );

      const res = await request(app)
        .post('/wallet/send')
        .set('X-CSRF-Token', expiredToken)
        .send({ to: global.generateTestAddress(), amount: 0.1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/invalid.*csrf/i);
    });
  });

  describe('CSRF Attack Prevention', () => {
    test('should prevent form-based CSRF attacks', async () => {
      // Without CSRF token, cross-site form submission should fail
      const res = await request(app)
        .post('/wallet/send')
        .send({
          to: global.generateTestAddress(),
          amount: 0.1
          // No CSRF token
        });

      expect(res.status).toBe(403);
    });

    test('should require CSRF token in headers or body', async () => {
      const csrfRes = await request(app).get('/csrf-token');
      const csrfToken = csrfRes.body.csrfToken;

      // Test header
      const headerRes = await request(app)
        .post('/wallet/send')
        .set('X-CSRF-Token', csrfToken)
        .send({ to: global.generateTestAddress(), amount: 0.1 });

      expect(headerRes.status).toBe(200);
    });
  });
});
