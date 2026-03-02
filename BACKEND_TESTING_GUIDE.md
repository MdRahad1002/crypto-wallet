# Backend Automated Testing Guide

Complete guide for running, writing, and maintaining automated tests for the backend security features.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [Coverage Requirements](#coverage-requirements)
- [CI/CD Pipeline](#cicd-pipeline)
- [Debugging Tests](#debugging-tests)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

```bash
# Node.js 18+ required
node --version

# MongoDB and Redis running (required)
mongod --dbpath ./data &
redis-server &
```

### Install Test Dependencies

```bash
npm ci
```

### Run All Critical Tests

```bash
npm run test:critical
```

## Test Structure

```
backend/tests/
├── setup.js                 # Global test utilities & database setup
├── auth.test.js            # Authentication flow tests (35+ tests)
├── kms.test.js             # KMS/encryption tests (25+ tests)
├── websocket.test.js       # WebSocket security tests (20+ tests)
└── cookies-csrf.test.js    # Cookie/CSRF protection tests (20+ tests)
```

### Coverage Target: >80% for security-critical code

**By Component:**
- Authentication & Sessions: **90%+**
- KMS & Encryption: **95%+**
- WebSocket Security: **85%+**
- Cookie & CSRF: **90%+**
- Middleware: **80%+**

## Running Tests

### All Tests with Coverage

```bash
npm test
```

### Watch Mode (Auto-rerun on changes)

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
open coverage/index.html
```

### Test Individual Components

```bash
npm run test:auth         # Authentication tests
npm run test:kms          # KMS/encryption tests
npm run test:websocket    # WebSocket tests
npm run test:cookies      # Cookie/CSRF tests
npm run test:critical     # All critical + coverage
```

### CI Mode (GitHub Actions)

```bash
npm run test:ci
```

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:auth

# Generate coverage report
npm run test:coverage
```

### Test Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Auto-rerun on changes |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:auth` | Authentication tests only |
| `npm run test:kms` | KMS/encryption tests only |
| `npm run test:websocket` | WebSocket tests only |
| `npm run test:cookies` | Cookie/CSRF tests only |
| `npm run test:critical` | All critical tests + coverage |
| `npm run test:ci` | CI mode (used in GitHub Actions) |

## Coverage Requirements

### Minimum Thresholds

```javascript
{
  branches: 70,      // 70% of branches
  functions: 80,     // 80% of functions
  lines: 80,         // 80% of lines
  statements: 80     // 80% of statements
}
```

### Security-Critical Code (Higher Standards)

| Component | Threshold | Notes |
|-----------|-----------|-------|
| KMS Service | 95%+ | Encryption security-critical |
| Auth Middleware | 90%+ | Identity/access control |
| Token Services | 95%+ | Session management |
| CSRF Protection | 90%+ | Attack prevention |
| WebSocket Auth | 85%+ | Real-time security |
| Cookies | 90%+ | Client data protection |

## CI/CD Pipeline

### GitHub Actions Workflow

**File**: `.github/workflows/ci-security.yml`

**Triggers:**
- Push to main/develop
- Pull requests to main/develop

**Jobs:**
1. **Test Matrix** (Node 18, 20)
   - Install dependencies
   - Run auth tests
   - Run KMS tests
   - Run WebSocket tests
   - Run cookie/CSRF tests
   - Upload coverage to Codecov

2. **Security Scan**
   - Run Snyk vulnerability scan
   - Fail if high-severity issues

3. **Build**
   - Build backend
   - Build frontend

4. **Deploy** (main only)
   - Deploy to staging
   - Run smoke tests

### PR Merge Requirements

✅ All tests pass
✅ Coverage >80%
✅ No security issues
✅ Build successful

## Debugging Tests

### Run Single Test

```bash
# Specific test
npm test -- --testNamePattern="should reject invalid mnemonic"

# Specific file
npm test -- auth.test.js

# Verbose output
npm test -- --verbose
```

### Debug in VS Code

1. Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--testPathPattern=auth"],
      "console": "integratedTerminal"
    }
  ]
}
```

2. Set breakpoints
3. Press F5 to debug

### Common Issues

| Issue | Solution |
|-------|----------|
| Tests timeout | `jest.setTimeout(30000)` in test file |
| Cannot connect to MongoDB | Start: `mongod --dbpath ./data` |
| Cannot connect to Redis | Start: `redis-server` |
| Cannot find module | Run: `npm ci` to reinstall |
| Coverage shows 0% | Run: `rm -rf coverage && npm run test:coverage` |

## Best Practices

### 1. Test Isolation

```javascript
beforeEach(async () => {
  await global.clearTestDB();
  jest.clearAllMocks();
});
```

### 2. Clear Test Names

```javascript
// ✅ Good
test('should reject login without mnemonic', async () => {});

// ❌ Bad
test('login test', async () => {});
```

### 3. Arrange-Act-Assert Pattern

```javascript
test('should encrypt and decrypt data', async () => {
  // Arrange
  const plaintext = 'secret-data';

  // Act
  const encrypted = await kms.encryptData(plaintext);
  const decrypted = await kms.decryptData(encrypted);

  // Assert
  expect(decrypted).toBe(plaintext);
});
```

### 4. Test Happy and Sad Paths

```javascript
describe('Authentication', () => {
  test('should login with valid credentials', async () => {});
  test('should reject invalid mnemonic', async () => {});
  test('should reject missing email', async () => {});
});
```

### 5. Use Global Utilities

```javascript
// JWT tokens
const token = global.generateTestJWT({ userId: 'test' });

// Crypto data
const mnemonic = global.generateTestMnemonic();
const address = global.generateTestAddress();

// Database
await global.connectTestDB();
await global.clearTestDB();
```

## Test Suites Overview

### Authentication Tests (auth.test.js)

**Coverage**: Login, refresh tokens, logout, CSRF, session management

```bash
npm run test:auth
```

**Key Tests:**
- ✅ Reject login without mnemonic
- ✅ Reject invalid mnemonic format
- ✅ Never log plaintext mnemonic
- ✅ Return access token + refresh token cookie
- ✅ Refresh token validation and expiry
- ✅ Token revocation on logout
- ✅ HttpOnly/Secure/SameSite cookie flags
- ✅ CSRF token validation

### KMS Tests (kms.test.js)

**Coverage**: Encryption, decryption, key rotation, secrets management

```bash
npm run test:kms
```

**Key Tests:**
- ✅ AES-256-GCM encryption/decryption
- ✅ 12-byte random IVs
- ✅ 16-byte authentication tags
- ✅ Tamper detection
- ✅ Key rotation
- ✅ Secret storage + retrieval
- ✅ Performance (<100ms)
- ✅ Large data handling (100KB+)

### WebSocket Tests (websocket.test.js)

**Coverage**: JWT auth, per-socket rate limiting, message validation

```bash
npm run test:websocket
```

**Key Tests:**
- ✅ Require JWT on connection
- ✅ Reject invalid/expired tokens
- ✅ Enforce 10 events/sec limit
- ✅ Enforce 300 events/min limit
- ✅ Per-socket isolation
- ✅ Large message handling
- ✅ Rate limit reset

### Cookie/CSRF Tests (cookies-csrf.test.js)

**Coverage**: Cookie security, CSRF protection

```bash
npm run test:cookies
```

**Key Tests:**
- ✅ HttpOnly flag set
- ✅ Secure flag set
- ✅ SameSite=Strict enforcement
- ✅ TTL refresh on auth requests
- ✅ Cookie clearing on logout
- ✅ CSRF token generation/validation
- ✅ Cross-site request rejection

## Test Utilities Reference

### Global Functions

```javascript
// JWT generation
global.generateTestJWT(payload, secret, expiresIn)

// Crypto data
global.generateTestMnemonic()
global.generateTestPrivateKey()
global.generateTestAddress()

// Database
global.connectTestDB()
global.disconnectTestDB()
global.clearTestDB()

// Redis
global.connectTestRedis()
global.disconnectTestRedis()
global.clearTestRedis()
global.getTestRedis()

// HTTP mocking
global.mockResponse()
global.mockRequest(options)
global.mockNext()
```

## Troubleshooting

### MongoDB Connection Issues

```bash
# Start MongoDB
mongod --dbpath ./data &

# Or with Docker
docker run -d -p 27017:27017 mongo:6.0

# Verify connection
mongo --eval "db.version()"
```

### Redis Connection Issues

```bash
# Start Redis
redis-server &

# Or with Docker
docker run -d -p 6379:6379 redis:7-alpine

# Verify connection
redis-cli ping
```

### Test Timeout

```javascript
// In test file
jest.setTimeout(30000); // 30 seconds

// Or in jest.config.js
module.exports = {
  testTimeout: 30000
};
```

### Coverage Issues

```bash
# Clear cache and regenerate
rm -rf coverage node_modules/.cache
npm ci
npm run test:coverage
```

### Environment Variable Issues

```bash
# Verify .env.test exists
cat .env.test

# Check NODE_ENV
echo $NODE_ENV

# Set for single test
NODE_ENV=test npm test
```

## Sample Test Output

```
PASS  backend/tests/auth.test.js (15.2s)
  Authentication Flow - Critical Security Tests
    POST /auth/login - Login Flow
      ✓ should reject login without mnemonic (45ms)
      ✓ should reject invalid mnemonic (52ms)
      ✓ should validate mnemonic format (12-24 words) (48ms)
      ✓ should never log plaintext mnemonic (38ms)
      ✓ should return access token and refresh token cookie (125ms)

Test Suites: 4 passed, 4 total
Tests:       100 passed, 100 total
Time:        48.2s
Coverage:    85.2% Statements | 84.1% Branches | 86.3% Functions | 85.4% Lines
```

## Next Steps

1. **Add tests** as new features developed
2. **Monitor coverage** - maintain >90% for security code
3. **Use IDE integration** - Jest extensions for real-time feedback
4. **Profile slow tests** - optimize where needed
5. **Keep docs updated** - add new test suites as created

## References

- [Jest Docs](https://jestjs.io/)
- [Supertest Docs](https://github.com/visionmedia/supertest)
- [Socket.IO Testing](https://socket.io/docs/v4/socket-io-testing-guide/)
- [Testing Best Practices](https://testingjavascript.com/)
