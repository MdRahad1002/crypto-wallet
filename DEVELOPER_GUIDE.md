# Developer Documentation & Contribution Guide

Complete guide for developers contributing to the crypto-wallet-platform with focus on security best practices.

## 📚 Table of Contents

- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Code Organization](#code-organization)
- [Security Best Practices](#security-best-practices)
- [Adding Features](#adding-features)
- [Testing Requirements](#testing-requirements)
- [Code Review Process](#code-review-process)
- [Debugging Guide](#debugging-guide)
- [Common Patterns](#common-patterns)

## Getting Started

### Prerequisites

```bash
# Required
Node.js 18+ 
MongoDB 5+
Redis 6+
npm 8+

# Optional (for development)
Git
VS Code with Extensions:
  - ESLint
  - Prettier
  - Thunder Client (API testing)
  - MongoDB for VS Code
```

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/org/crypto-wallet-platform.git
cd crypto-wallet-platform

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# 4. Start services
mongod --dbpath ./data &
redis-server &

# 5. Start development servers
npm run dev
# Backend: http://localhost:5000
# Frontend: http://localhost:3000
```

### Development Environment Variables

```bash
# Copy to .env.local (gitignored)

# Server
NODE_ENV=development
PORT=5000
HOST=localhost

# Security
JWT_SECRET=dev-secret-key-change-in-production
REFRESH_TOKEN_SECRET=dev-refresh-secret-change-in-production
COOKIE_SECRET=dev-cookie-secret-change-in-production
KMS_MASTER_KEY=dev-master-key-change-in-production

# Database
MONGO_URI=mongodb://localhost:27017/crypto-wallet-dev
REDIS_URL=redis://localhost:6379

# Development
LOG_LEVEL=debug
DEBUG=*
CORS_ORIGIN=http://localhost:3000
```

## Architecture Overview

### System Components

```
┌─────────────────┐
│    Frontend     │
│   (React App)   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────┐
│    Express API      │
│  (Backend Server)   │
└────────┬────────────┘
         │
    ┌────┴─────┬────────┬──────────┐
    ▼          ▼        ▼          ▼
┌────────┐ ┌──────┐ ┌────────┐ ┌────────┐
│MongoDB │ │Redis │ │Socket.IO│ │External│
│ (Data) │ │Cache │ │(Events) │ │ APIs   │
└────────┘ └──────┘ └────────┘ └────────┘
```

### Key Services

| Service | Purpose | Location |
|---------|---------|----------|
| **KMS Service** | Encryption/decryption | `backend/services/kmsService.js` |
| **Auth Service** | Authentication/authorization | `backend/services/authService.js` |
| **Wallet Service** | Wallet operations | `backend/services/walletService.js` |
| **Metrics Service** | Monitoring/metrics | `backend/services/metricsService.js` |
| **Prices Service** | Live price data | `backend/services/pricesService.js` |

### Middleware Stack

```
Request →
  Helmet (security headers) →
  CORS (cross-origin) →
  Express JSON (body parsing) →
  Cookie Parser (cookies) →
  CSRF Protection (token validation) →
  Session Middleware (TTL refresh) →
  Rate Limiter (request limiting) →
  Auth Middleware (JWT verification) →
  Route Handler →
Response
```

## Development Workflow

### Creating a Feature Branch

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/user-authentication

# Branch naming conventions:
# feature/[description]     - New feature
# fix/[description]         - Bug fix
# docs/[description]        - Documentation
# refactor/[description]    - Code refactoring
# security/[description]    - Security improvement
# test/[description]        - Test improvement

# 2. Make changes
# ... edit files ...

# 3. Run linting and tests
npm run lint
npm run test

# 4. Commit changes
git add .
git commit -m "feat(auth): Add multi-factor authentication

- Implements TOTP-based MFA
- Validates MFA codes before login
- Stores MFA status in user document

Closes #123"

# 5. Push branch
git push origin feature/user-authentication

# 6. Create pull request
# https://github.com/org/repo/pull/new/feature/user-authentication
```

### Commit Message Format

**Template:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style (no logic change)
- `refactor` - Code refactoring
- `test` - Test additions
- `chore` - Build, dependencies

**Example:**
```
feat(kms): Add key rotation endpoint

Implements automatic key rotation with zero-downtime.
- Rotates data keys monthly
- Re-encrypts secrets with new key
- Maintains backward compatibility

Closes #456
Fixes: https://github.com/org/repo/issues/789
```

### Pull Request Process

1. **Create PR with description:**
   ```markdown
   ## Description
   [What does this PR accomplish?]
   
   ## Related Issues
   Closes #123
   
   ## Type of Change
   - [ ] New feature
   - [ ] Bug fix
   - [ ] Security improvement
   - [ ] Documentation
   
   ## Testing
   [How did you test this?]
   
   ## Security Checklist
   - [ ] No hardcoded secrets
   - [ ] Input validation added
   - [ ] Error handling added
   - [ ] Tests added (>80% coverage)
   ```

2. **Automated Checks:**
   - Tests must pass (>80% coverage)
   - Linting must pass
   - Security scan must pass (Snyk)
   - No hardcoded secrets detected

3. **Code Review:**
   - At least 2 approvals required
   - All comments resolved
   - No requested changes

4. **Merge:**
   - Squash and merge to main
   - Automatic deployment triggered

## Code Organization

### Backend Structure

```
backend/
├── core/              # Core utilities
│   ├── config.js      # Configuration
│   ├── logger.js      # Logging
│   └── errorHandler.js
├── services/          # Business logic
│   ├── kmsService.js
│   ├── authService.js
│   ├── walletService.js
│   └── metricsService.js
├── middleware/        # Express middleware
│   ├── auth.js
│   ├── rateLimiter.js
│   ├── csrfProtection.js
│   └── errorHandler.js
├── routes/            # API routes
│   ├── auth.js
│   ├── wallet.js
│   ├── transactions.js
│   └── admin.js
├── models/            # Database schemas
│   ├── User.js
│   ├── Wallet.js
│   ├── Transaction.js
│   └── AuditLog.js
├── tests/             # Test files
│   ├── setup.js
│   ├── auth.test.js
│   └── kms.test.js
└── server.js          # Main entry point
```

### Creating a New Service

**Template: `backend/services/myService.js`**

```javascript
const BaseService = require('./BaseService');

/**
 * MyService - Handles [functionality]
 * 
 * Features:
 * - [feature 1]
 * - [feature 2]
 */
class MyService extends BaseService {
  constructor() {
    super('MyService');
  }

  async initialize() {
    // Setup service
    this.logger.info('MyService initialized');
  }

  async doSomething(input) {
    try {
      // Validate input
      if (!input) throw new Error('Input required');

      // Do work
      const result = await this.processInput(input);

      // Log success
      this.logger.info('Operation successful', { result });

      return result;
    } catch (error) {
      this.logger.error('Operation failed', { error: error.message });
      throw error;
    }
  }

  async handleError(error) {
    // Custom error handling
    return {
      status: 'error',
      message: error.message
    };
  }
}

module.exports = new MyService();
```

### Creating a New Route

**Template: `backend/routes/myRoute.js`**

```javascript
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrfProtection');
const { validate } = require('express-validator');

const router = express.Router();

/**
 * GET /api/my-resource
 * 
 * Query Parameters:
 * - filter (string) - Filter results
 * 
 * Security: Requires authentication
 * Rate limit: 100 requests/minute
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { filter } = req.query;

    // Input validation
    if (filter && filter.length > 100) {
      return res.status(400).json({
        message: 'Filter too long'
      });
    }

    // Business logic
    const myService = require('../services/myService');
    const results = await myService.fetch(filter);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/my-resource
 * 
 * Body:
 * {
 *   "name": "string (required)",
 *   "value": "number (required)"
 * }
 * 
 * Security: Requires authentication + CSRF token
 */
router.post('/', authenticate, csrfProtection, async (req, res) => {
  try {
    const { name, value } = req.body;

    // Input validation
    if (!name || !value) {
      return res.status(400).json({
        message: 'Name and value required'
      });
    }

    // Business logic
    const myService = require('../services/myService');
    const result = await myService.create({ name, value });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
```

## Security Best Practices

### 1. Never Log Sensitive Data

```javascript
// ❌ BAD: Logs password
logger.info('User login', { email, password });

// ✅ GOOD: Only logs necessary info
logger.info('User login attempt', { email, userId });

// ✅ GOOD: Masks sensitive fields
const sanitized = { ...user };
delete sanitized.password;
delete sanitized.mnemonic;
logger.info('User data retrieved', sanitized);
```

### 2. Validate All Input

```javascript
// ❌ BAD: No validation
const user = await User.findById(req.body.userId);

// ✅ GOOD: Validate and sanitize
const { body, validationResult } = require('express-validator');

router.post('/', body('userId').isMongoId(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ... process valid input
});
```

### 3. Always Encrypt Sensitive Data

```javascript
// ❌ BAD: Storing mnemonic unencrypted
await Wallet.create({ 
  mnemonic: userMnemonic 
});

// ✅ GOOD: Encrypt sensitive data
const kmsService = require('../services/kmsService');
const encrypted = await kmsService.encryptData(userMnemonic);
await Wallet.create({ 
  mnemonic: encrypted 
});
```

### 4. Implement Proper Error Handling

```javascript
// ❌ BAD: Exposing internal errors to client
try {
  // ... code ...
} catch (error) {
  res.status(500).json({ error: error.message }); // Exposes details!
}

// ✅ GOOD: Generic error, detailed logging
try {
  // ... code ...
} catch (error) {
  logger.error('Internal error', { 
    error: error.message, 
    stack: error.stack 
  });
  res.status(500).json({ 
    message: 'Internal server error' 
  });
}
```

### 5. Use Least Privilege

```javascript
// ❌ BAD: Admin checks for all endpoints
app.use((req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  next();
});

// ✅ GOOD: Specific endpoint protection
router.delete('/admin/users/:id', 
  authenticate, 
  requireRole('admin'), 
  async (req, res) => {
    // Only admin endpoints require admin role
  }
);
```

## Adding Features

### Feature Checklist

Before implementing a new feature, ensure:

- [ ] Feature request/issue created
- [ ] Design reviewed by team
- [ ] Security implications considered
- [ ] Database schema designed (if needed)
- [ ] API endpoints designed
- [ ] Input validation planned
- [ ] Error handling strategy defined
- [ ] Testing approach defined
- [ ] Documentation planned

### Implementation Steps

1. **Create test cases first (TDD)**
   ```bash
   npm run test:watch
   ```

2. **Implement feature**
   - Create service
   - Create route(s)
   - Add middleware if needed

3. **Add input validation**
   - Schema validation
   - Type checking
   - Range checking

4. **Add error handling**
   - Try-catch blocks
   - Proper error messages
   - Error logging

5. **Add security**
   - Authentication check
   - Authorization check
   - CSRF protection (for POST)
   - Input sanitization

6. **Write documentation**
   - API docs (inline comments)
   - README updates
   - Examples in guide

7. **Run test suite**
   ```bash
   npm run test:coverage
   ```

8. **Security review**
   - Check for hardcoded secrets
   - Verify no sensitive logging
   - Validate error messages
   - Check authentication/authorization

## Testing Requirements

### Test Coverage Requirements

- **Overall:** >80%
- **Services:** >90%
- **Middleware:** >85%
- **Routes:** >80%
- **Security-critical:** >95%

### Writing Tests

**Example Test File:**

```javascript
describe('MyService', () => {
  let service;

  beforeAll(async () => {
    await global.connectTestDB();
    service = require('../services/myService');
  });

  afterAll(async () => {
    await global.clearTestDB();
    await global.disconnectTestDB();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('doSomething', () => {
    test('should return result for valid input', async () => {
      // Arrange
      const input = { value: 'test' };

      // Act
      const result = await service.doSomething(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should throw error for invalid input', async () => {
      // Arrange
      const input = null;

      // Act & Assert
      await expect(service.doSomething(input))
        .rejects
        .toThrow('Input required');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific suite
npm run test:auth

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Code Review Process

### What Reviewers Look For

**Security:**
- No hardcoded secrets
- Input validation present
- Output encoding (if applicable)
- Authentication/authorization checks
- No sensitive data logging
- Error messages don't expose details

**Code Quality:**
- Follows naming conventions
- Clear and readable
- Well-documented (comments)
- Follows established patterns
- No duplicate code
- Proper error handling

**Testing:**
- Tests added for new code
- >80% coverage maintained
- Both happy and sad paths tested
- No flaky tests

**Performance:**
- No N+1 queries
- Efficient algorithms
- Appropriate caching
- No unnecessary operations

### Code Review Feedback

**When leaving feedback:**
- Be respectful and constructive
- Ask questions rather than demand changes
- Suggest improvements with examples
- Acknowledge good code

**When receiving feedback:**
- Ask for clarification if needed
- Consider suggestions seriously
- Push back respectfully if you disagree
- Thank reviewers for their time

## Debugging Guide

### Using VS Code Debugger

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Backend",
      "program": "${workspaceFolder}/backend/server.js",
      "cwd": "${workspaceFolder}",
      "envFile": "${workspaceFolder}/.env.local"
    }
  ]
}
```

### Common Debugging Scenarios

**Scenario 1: Auth middleware failing**

```javascript
// Add logging to middleware
app.use((req, res, next) => {
  console.log('Request:', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    user: req.user
  });
  next();
});
```

**Scenario 2: Database query failing**

```javascript
// Enable Mongoose query logging
mongoose.set('debug', true);
```

**Scenario 3: Express not starting**

```bash
# Check for port conflicts
lsof -i :5000

# Check environment variables
env | grep NODE

# Start with debug output
DEBUG=* npm start
```

## Common Patterns

### Service Pattern

Services handle business logic with consistent interface:

```javascript
class MyService extends BaseService {
  async operation(input) {
    // 1. Validate input
    // 2. Do business logic
    // 3. Return result or throw error
    // 4. Log activities
  }
}
```

### Middleware Pattern

Middleware processes requests uniformly:

```javascript
function myMiddleware(req, res, next) {
  // 1. Check condition
  // 2. Either call next() or respond with error
  // 3. Don't mix multiple concerns
}
```

### Route Pattern

Routes delegate to services:

```javascript
router.get('/', authenticate, async (req, res) => {
  try {
    // 1. Validate input
    // 2. Call service
    // 3. Return formatted response
  } catch (error) {
    // Handle errors consistently
  }
});
```

### Error Handling Pattern

```javascript
// Custom error class
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

// Usage
try {
  if (!input.email) throw new ValidationError('Email required');
} catch (error) {
  res.status(error.status || 500).json({
    message: error.message
  });
}
```

---

**Questions?** Contact the team or check existing code for examples.

**Last Updated:** February 2026
**Maintained By:** Development Team
