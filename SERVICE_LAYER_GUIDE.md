# Service Layer Architecture

## Overview

The service layer provides a consistent, maintainable abstraction for business logic across the platform. All services extend base classes that provide common functionality: error handling, logging, metrics, and caching.

## Base Service Classes

### 1. BaseService

Abstract base class for all services. Provides core functionality.

**Key Features:**
- Structured logging with automatic metric integration
- Cache management with TTL support
- Field validation
- Error tracking
- Retry logic with exponential backoff
- Parallel execution with error collection

**Usage:**

```javascript
const { BaseService } = require('./services/BaseService');

class MyService extends BaseService {
  constructor() {
    super('MyService'); // Service name for logging
  }

  async doSomething() {
    return this.executeWithTracking('doSomething', async () => {
      // Your implementation
    });
  }
}
```

**Common Methods:**

```javascript
// Logging
this.log('info', 'action', { key: 'value' });
this.log('warn', 'action', { reason: 'something' });
this.log('error', 'action', { error: err.message });

// Caching
this.setCache('key', data, 60000); // TTL: 60 seconds
const cached = this.getCache('key');
this.clearCache();
this.clearCacheKey('key');

// Validation
this.validateRequired(data, ['field1', 'field2']);

// Tracking
await this.executeWithTracking('method', async () => {
  // Logs start, success/error, duration automatically
});

// Retry with backoff
await this.retry(
  () => unreliableOperation(),
  3,    // maxAttempts
  1000  // backoffMs
);

// Parallel execution
const { successful, failed } = await this.executeParallel([
  task1(),
  task2(),
  task3()
]);
```

### 2. DatabaseService

Base for MongoDB operations. Extends BaseService with CRUD methods.

**Methods:**

```javascript
await service.create(data);           // Create document
await service.findById(id);           // Find by ID
await service.find(query, options);   // Find with filters
await service.update(id, data);       // Update document
await service.delete(id);             // Delete document
await service.count(query);           // Count documents
```

**Example:**

```javascript
const { DatabaseService } = require('./BaseService');
const User = require('../models/User');

class UserService extends DatabaseService {
  constructor() {
    super('UserService', User);
  }

  async getUserWithWallets(userId) {
    return this.executeWithTracking('getUserWithWallets', async () => {
      const cached = this.getCache(`user:${userId}`);
      if (cached) return cached;

      const user = await this.findById(userId);
      if (!user) throw new Error('User not found');

      this.setCache(`user:${userId}`, user, 30000);
      return user;
    });
  }
}
```

### 3. APIService

Base for external API calls. Extends BaseService with retry and caching.

**Constructor:**

```javascript
const { APIService } = require('./BaseService');

class ExternalService extends APIService {
  constructor() {
    super('ExternalService', 'https://api.example.com', {
      timeout: 8000,
      retryAttempts: 3
    });
  }
}
```

**Methods:**

```javascript
// Make request with retry and tracking
await service.request('/endpoint', { headers: {...} });

// Get with automatic caching
await service.getCached('/endpoint', 15000); // 15s TTL
```

**Example:**

```javascript
class BlockchainService extends APIService {
  constructor() {
    super('BlockchainService', 'https://blockchain.api', {
      timeout: 10000,
      retryAttempts: 5
    });
  }

  async getBalance(address) {
    return this.executeWithTracking('getBalance', async () => {
      return this.getCached(`/balance/${address}`, 5000);
    });
  }
}
```

### 4. CacheService

Dedicated caching service. Useful for shared caching needs.

**Methods:**

```javascript
cacheService.set('key', value, 60000);  // Set with TTL
const value = cacheService.get('key');  // Get value
cacheService.has('key');                // Check existence
cacheService.delete('key');             // Delete key
cacheService.clear();                   // Clear all
cacheService.keys();                    // Get all keys
cacheService.size();                    // Get cache size
```

**Example:**

```javascript
const { CacheService } = require('./BaseService');

const sessionCache = new CacheService('SessionCache');
sessionCache.set(`user:${userId}:session`, token, 1800000); // 30 min
```

## Service Patterns

### Pattern 1: Simple API Service (CacheService + APIService)

**Best for:** External API calls, simple data fetching

```javascript
const { APIService } = require('./BaseService');

class WeatherService extends APIService {
  constructor() {
    super('WeatherService', 'https://api.weather.com', {
      timeout: 5000,
      retryAttempts: 2
    });
  }

  async getWeather(city) {
    return this.getCached(`/weather/${city}`, 3600000); // 1 hour TTL
  }
}

module.exports = new WeatherService();
```

### Pattern 2: Database Service (CRUD)

**Best for:** Data persistence, model operations

```javascript
const { DatabaseService } = require('./BaseService');
const Transaction = require('../models/Transaction');

class TransactionService extends DatabaseService {
  constructor() {
    super('TransactionService', Transaction);
  }

  async createWithValidation(txData) {
    this.validateRequired(txData, ['userId', 'amount', 'type']);
    return this.create(txData);
  }

  async getRecentTransactions(userId, limit = 20) {
    return this.find(
      { userId },
      { limit, sort: { createdAt: -1 } }
    );
  }
}

module.exports = new TransactionService();
```

### Pattern 3: Business Logic Service

**Best for:** Complex operations combining multiple sources

```javascript
const { BaseService } = require('./BaseService');
const userService = require('./userService');
const walletService = require('./walletService');

class WalletManagementService extends BaseService {
  constructor() {
    super('WalletManagementService');
  }

  async transferFunds(fromUserId, toUserId, amount) {
    return this.executeWithTracking('transferFunds', async () => {
      const { successful, failed } = await this.executeParallel([
        userService.findById(fromUserId),
        userService.findById(toUserId)
      ]);

      if (failed.length > 0) {
        throw new Error('Failed to load users');
      }

      const [fromUser, toUser] = successful.map(s => s.value);

      // Perform transfer logic...
      
      return { fromUser, toUser };
    });
  }
}

module.exports = new WalletManagementService();
```

## Service Registry

Central location to import all services:

```javascript
// backend/services/index.js
module.exports = {
  // API Services
  pricesService: require('./pricesService'),
  explorerService: require('./explorerService'),
  
  // Database Services
  userService: require('./userService'),
  walletService: require('./walletService'),
  transactionService: require('./transactionService'),
  
  // Specialized Services
  auditLogger: require('./auditLogger'),
  metricsService: require('./metricsService'),
  
  // Utilities
  BaseService: require('./BaseService').BaseService,
  DatabaseService: require('./BaseService').DatabaseService,
  APIService: require('./BaseService').APIService,
  CacheService: require('./BaseService').CacheService
};
```

## Logging Integration

All services automatically log with these patterns:

```javascript
// Automatic logging structure
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "ServiceName_action",
  "service": "ServiceName",
  "action": "actionName",
  "durationMs": 145,
  // + any custom fields passed
}
```

**Logged Events:**
- `SERVICE_methodName_start` - Method begins
- `SERVICE_methodName_success` - Completes with duration
- `SERVICE_methodName_error` - Error with details

## Metrics Integration

Services automatically track metrics:

```javascript
metricsService.recordError('ServiceName_error'); // On error
// Logs tracked in Prometheus format at /api/metrics
```

## Error Handling

**Consistent Error Pattern:**

```javascript
class MyService extends BaseService {
  async riskyOperation() {
    return this.executeWithTracking('riskyOperation', async () => {
      try {
        // May throw
        return await someAsyncOp();
      } catch (error) {
        // Automatically logged as:
        // {message: "ServiceName_riskyOperation_error", errorType: "...", ...}
        throw error;
      }
    });
  }
}
```

## Caching Strategy

**Service-Level Caching:**

```javascript
// Automatic with TTL cleanup
this.setCache('key', data, 15000); // 15 seconds

// Automatic cache retrieval
const cached = this.getCache('key'); // Returns null if expired
```

**Global Caching (CacheService):**

```javascript
const globalCache = new CacheService('Global');
globalCache.set('expensive:operation', result, 300000); // 5 min
```

## Retry Strategy

**Automatic Exponential Backoff:**

```javascript
// Retry with 1s initial backoff, doubling each attempt
await this.retry(
  () => unreliableAPI.call(),
  3,    // maxAttempts: 1s, 2s, 4s
  1000  // backoffMs: 1s initial
);
```

## Testing Services

**Unit Test Pattern:**

```javascript
const { BaseService } = require('../BaseService');

describe('MyService', () => {
  let service;

  beforeEach(() => {
    service = new MyService();
  });

  it('should execute with tracking', async () => {
    const result = await service.executeWithTracking('test', async () => {
      return 'success';
    });

    expect(result).toBe('success');
  });

  it('should handle errors', async () => {
    expect.assertions(1);
    try {
      await service.executeWithTracking('test', async () => {
        throw new Error('Test error');
      });
    } catch (error) {
      expect(error.message).toBe('Test error');
    }
  });
});
```

## Migration Guide

### Before (Inconsistent Patterns)

```javascript
// pricesService.js - Functional pattern
const cache = new Map();
module.exports = { getLiveUsdPrices };

// auditLogger.js - Object pattern
module.exports = { logEvent };

// tokenService.js - Complex pattern
class TokenService { ... }
module.exports = new TokenService();
```

### After (Consistent Service Layer)

```javascript
// All services extend BaseService
class MyService extends BaseService {
  constructor() {
    super('MyService');
  }
  
  async myMethod() {
    return this.executeWithTracking('myMethod', async () => {
      // Implementation
    });
  }
}

module.exports = {
  myMethod: (args) => new MyService().myMethod(args),
  instance: new MyService()
};
```

## Configuration

Services inherit configuration from environment:

```javascript
// Cache TTLs
const CACHE_TTL = process.env.CACHE_TTL_MS || 15000;

// API timeouts
const API_TIMEOUT = process.env.API_TIMEOUT_MS || 8000;

// Retry attempts
const RETRY_ATTEMPTS = process.env.RETRY_ATTEMPTS || 3;
```

## Troubleshooting

**Issue: Metrics not appearing**
- Check `metricsService` initialization in `server.js`
- Verify `/api/metrics` endpoint is accessible

**Issue: Cache not working**
- Verify `setCache` is called before operations
- Check TTL hasn't expired: `Date.now() > expiresAt`

**Issue: Logs not appearing**
- Confirm service extends `BaseService`
- Check `executeWithTracking` wrapper is used
- Verify logger is initialized in `core/logger.js`

**Issue: Retries not triggering**
- Verify method throws error (not just returns error object)
- Check `maxAttempts` is > 1
- Monitor backoff delays with logging

## Best Practices

✅ **DO:**
- Extend base service classes
- Use `executeWithTracking` for important methods
- Cache external API responses
- Validate inputs with `validateRequired`
- Use retry for unreliable operations
- Log errors at decision points

❌ **DON'T:**
- Create ad-hoc error handling
- Mix logging patterns
- Ignore cache expiration
- Retry infinite loops
- Log sensitive data (passwords, tokens)
- Block requests on non-critical operations

## Performance Considerations

**Service Layer Overhead:**
- Logging: ~1-2ms per call
- Metrics recording: <1ms per call
- Caching lookup: <1ms per operation

**Optimization Tips:**
- Use longer TTLs for stable data
- Batch operations with `executeParallel`
- Implement circuit breakers for external APIs
- Monitor cache hit rates in metrics

## Security Considerations

- Services don't log sensitive data (tokens, passwords)
- Audit logs use non-blocking fire-and-forget pattern
- Errors logged with stacktraces only in dev environment
- Cache doesn't store sensitive information without encryption
