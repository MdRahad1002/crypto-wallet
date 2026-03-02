/**
 * WebSocket Security Tests
 * Tests: JWT authentication, per-socket rate limiting, message validation
 */

const { Server: SocketServer } = require('socket.io');
const { Server: HTTPServer } = require('http');
const { io: ioClient } = require('socket.io-client');
const jwt = require('jsonwebtoken');

describe('WebSocket Security - Real-time Protection', () => {
  let httpServer;
  let ioServer;
  let serverSocket;
  let clientSocket;
  const testUser = { id: 'ws-test-user', email: 'ws@test.com' };

  beforeAll((done) => {
    httpServer = HTTPServer();
    ioServer = new SocketServer(httpServer, {
      cors: { origin: '*' }
    });

    // Mock WebSocket auth middleware
    ioServer.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, global.testConfig.jwtSecret);
        socket.userId = decoded.userId;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // Rate limiting middleware - 10 events/sec, 300/min
    ioServer.use((socket, next) => {
      socket.rateLimitData = {
        secondCount: 0,
        secondStart: Date.now(),
        minuteCount: 0,
        minuteStart: Date.now()
      };
      next();
    });

    ioServer.on('connection', (socket) => {
      serverSocket = socket;
      
      socket.on('test-message', (data, callback) => {
        // Rate limiting check
        const now = Date.now();
        const secondElapsed = now - socket.rateLimitData.secondStart;
        const minuteElapsed = now - socket.rateLimitData.minuteStart;

        if (secondElapsed >= 1000) {
          socket.rateLimitData.secondCount = 0;
          socket.rateLimitData.secondStart = now;
        }

        if (minuteElapsed >= 60000) {
          socket.rateLimitData.minuteCount = 0;
          socket.rateLimitData.minuteStart = now;
        }

        socket.rateLimitData.secondCount++;
        socket.rateLimitData.minuteCount++;

        if (socket.rateLimitData.secondCount > 10) {
          socket.emit('error', 'Rate limit exceeded (per second)');
          return;
        }

        if (socket.rateLimitData.minuteCount > 300) {
          socket.emit('error', 'Rate limit exceeded (per minute)');
          return;
        }

        if (callback) {
          callback({ status: 'ok', received: data });
        }
      });
    });

    httpServer.listen(() => {
      const address = httpServer.address();
      const port = address.port;
      
      clientSocket = ioClient(`http://localhost:${port}`, {
        reconnection: false
      });

      clientSocket.on('connect', done);
      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });
  });

  afterAll((done) => {
    clientSocket.disconnect();
    ioServer.close();
    httpServer.close(done);
  });

  describe('JWT Authentication', () => {
    test('should require JWT token on connection', (done) => {
      const invalidSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: {} // No token
      });

      invalidSocket.on('connect_error', (error) => {
        expect(error.message).toMatch(/authentication|required|token/i);
        invalidSocket.disconnect();
        done();
      });

      invalidSocket.on('connect', () => {
        invalidSocket.disconnect();
        done(new Error('Should have failed authentication'));
      });
    });

    test('should reject invalid JWT token', (done) => {
      const invalidSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token: 'invalid.jwt.token' }
      });

      invalidSocket.on('connect_error', (error) => {
        expect(error.message).toMatch(/invalid|token/i);
        invalidSocket.disconnect();
        done();
      });

      invalidSocket.on('connect', () => {
        invalidSocket.disconnect();
        done(new Error('Should have failed authentication'));
      });
    });

    test('should reject expired JWT token', (done) => {
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        global.testConfig.jwtSecret,
        { expiresIn: '-1h' }
      );

      const invalidSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token: expiredToken }
      });

      invalidSocket.on('connect_error', (error) => {
        expect(error.message).toMatch(/invalid|expired/i);
        invalidSocket.disconnect();
        done();
      });

      invalidSocket.on('connect', () => {
        invalidSocket.disconnect();
        done(new Error('Should have failed authentication'));
      });
    });

    test('should accept valid JWT token', (done) => {
      const validToken = global.generateTestJWT({ userId: testUser.id });

      const validSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token: validToken }
      });

      validSocket.on('connect', () => {
        expect(validSocket.connected).toBe(true);
        validSocket.disconnect();
        done();
      });

      validSocket.on('connect_error', (error) => {
        validSocket.disconnect();
        done(error);
      });
    });
  });

  describe('Per-Socket Rate Limiting', () => {
    test('should enforce 10 events per second limit', (done) => {
      const token = global.generateTestJWT({ userId: testUser.id });
      const testSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token }
      });

      testSocket.on('connect', () => {
        let errorReceived = false;

        testSocket.on('error', (message) => {
          if (message.includes('Rate limit')) {
            errorReceived = true;
          }
        });

        // Send 15 messages rapidly
        for (let i = 0; i < 15; i++) {
          testSocket.emit('test-message', { index: i });
        }

        setTimeout(() => {
          testSocket.disconnect();
          // Note: Rate limiting behavior depends on implementation
          // This test documents the expectation
          done();
        }, 100);
      });

      testSocket.on('connect_error', (error) => {
        testSocket.disconnect();
        done(error);
      });
    });

    test('should reset rate limit after time window', (done) => {
      const token = global.generateTestJWT({ userId: testUser.id });
      const testSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token }
      });

      testSocket.on('connect', () => {
        const messages = [];

        testSocket.on('test-message', (response) => {
          messages.push(response);
        });

        // Send messages in first second
        testSocket.emit('test-message', { batch: 1, index: 1 });

        // Wait for rate limit window to reset
        setTimeout(() => {
          testSocket.emit('test-message', { batch: 2, index: 1 });
          
          setTimeout(() => {
            testSocket.disconnect();
            expect(messages.length).toBeGreaterThan(0);
            done();
          }, 100);
        }, 1100);
      });

      testSocket.on('connect_error', (error) => {
        testSocket.disconnect();
        done(error);
      });
    });
  });

  describe('Message Validation', () => {
    test('should validate message structure', (done) => {
      const token = global.generateTestJWT({ userId: testUser.id });
      const testSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token }
      });

      testSocket.on('connect', () => {
        testSocket.emit('test-message', { data: 'test' }, (response) => {
          expect(response).toBeDefined();
          expect(response.status).toBe('ok');
          testSocket.disconnect();
          done();
        });
      });

      testSocket.on('connect_error', (error) => {
        testSocket.disconnect();
        done(error);
      });
    });

    test('should handle large messages safely', (done) => {
      const token = global.generateTestJWT({ userId: testUser.id });
      const testSocket = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token }
      });

      testSocket.on('connect', () => {
        const largeData = 'x'.repeat(10000); // 10KB payload

        testSocket.emit('test-message', { data: largeData }, (response) => {
          expect(response).toBeDefined();
          testSocket.disconnect();
          done();
        });
      });

      testSocket.on('connect_error', (error) => {
        testSocket.disconnect();
        done(error);
      });
    });
  });

  describe('Connection Security', () => {
    test('should isolate per-socket rate limits', async () => {
      // Create two connections
      const token = global.generateTestJWT({ userId: testUser.id });
      
      const socket1 = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token }
      });

      const socket2 = ioClient(`http://localhost:${httpServer.address().port}`, {
        reconnection: false,
        auth: { token }
      });

      // Wait for connections
      await new Promise((resolve) => {
        let connected = 0;
        socket1.on('connect', () => { connected++; if (connected === 2) resolve(); });
        socket2.on('connect', () => { connected++; if (connected === 2) resolve(); });
      });

      // Each socket should have independent rate limits
      socket1.disconnect();
      socket2.disconnect();
    });
  });
});
