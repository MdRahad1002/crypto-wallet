# Service Layer Quick Reference

## Common Tasks

### Create a New Service

```javascript
const { BaseService } = require('./BaseService');

class MyService extends BaseService {
  constructor() {
    super('MyService');
  }

  async doSomething(data) {
    return this.executeWithTracking('doSomething', async () => {
      this.validateRequired(data, ['requiredField']);
      // Your logic
      return result;
    });
  }
}

module.exports = {
  doSomething: (data) => new MyService().doSomething(data),
  instance: new MyService()
};
```

### Create an API Service

```javascript
const { APIService } = require('./BaseService');

class ExternalService extends APIService {
  constructor() {
    super('ExternalService', 'https://api.example.com', {
      timeout: 8000,
      retryAttempts: 3
    });
  }

  async getData(id) {
    return this.getCached(`/data/${id}`, 15000); // 15s cache
  }
}

module.exports = new ExternalService();
```

### Create a Database Service

```javascript
const { DatabaseService } = require('./BaseService');
const MyModel = require('../models/MyModel');

class MyDataService extends DatabaseService {
  constructor() {
    super('MyDataService', MyModel);
  }

  async getById(id) {
    return this.findById(id);
  }

  async getAll(limit = 10) {
    return this.find({}, { limit });
  }
}

module.exports = new MyDataService();
```

## Common Patterns

### With Caching

```javascript
async getExpensiveData(id) {
  const cacheKey = `expensive:${id}`;
  const cached = this.getCache(cacheKey);
  if (cached) return cached;

  const data = await this.executeWithTracking('getExpensiveData', async () => {
    return await this.fetchFromDB(id);
  });

  this.setCache(cacheKey, data, 60000); // 1 minute
  return data;
}
```

### With Retry

```javascript
async unreliableOperation() {
  return this.retry(
    () => this.makeExternalCall(),
    5,    // maxAttempts
    1000  // backoffMs
  );
}
```

### With Parallel Operations

```javascript
async getRelatedData(userId) {
  const { successful, failed } = await this.executeParallel([
    this.getUserData(userId),
    this.getUserWallets(userId),
    this.getUserTransactions(userId)
  ]);

  if (failed.length > 0) {
    this.log('warn', 'parallel_operation_failed', { failed });
  }

  return successful.map(r => r.value);
}
```

### With Validation

```javascript
async createUser(userData) {
  this.validateRequired(userData, [
    'username',
    'email',
    'password'
  ]);

  return this.executeWithTracking('createUser', async () => {
    return await this.create(userData);
  });
}
```

### With Error Handling

```javascript
async riskyOperation() {
  return this.executeWithTracking('riskyOperation', async () => {
    try {
      return await this.doSomethingRisky();
    } catch (error) {
      this.log('error', 'riskyOperation_failed', {
        errorType: error.name,
        message: error.message
      });
      this.recordMetric('error');
      throw error;
    }
  });
}
```

## Logging Examples

```javascript
// Info log
this.log('info', 'user_created', {
  userId: user.id,
  email: user.email
});

// Warning log
this.log('warn', 'slow_operation', {
  operation: 'export',
  durationMs: 5000
});

// Error log (automatic with executeWithTracking)
this.log('error', 'database_error', {
  operation: 'update',
  errorMessage: error.message
});

// Debug log
this.log('debug', 'cache_hit', {
  key: 'user:123',
  age: 1500
});
```

## Service Methods Reference

### BaseService Methods
```javascript
log(level, action, data)              // Log with context
recordMetric(metricType, value)       // Track metrics
setCache(key, data, ttlMs)            // Cache with TTL
getCache(key)                         // Get cached value
clearCache()                          // Clear all cache
clearCacheKey(key)                    // Clear specific key
validateRequired(data, fields)        // Validate fields
executeWithTracking(name, method)     // Execute with logging
retry(method, attempts, backoff)      // Retry with backoff
executeParallel(tasks)                // Run tasks in parallel
```

### DatabaseService Methods (extends BaseService)
```javascript
create(data)                          // Create document
findById(id)                          // Find by ID
find(query, options)                  // Find with filters
update(id, data)                      // Update document
delete(id)                            // Delete document
count(query)                          // Count documents
```

### APIService Methods (extends BaseService)
```javascript
request(endpoint, options)            // Make API request
getCached(endpoint, ttlMs)            // Get with caching
```

### CacheService Methods
```javascript
set(key, value, ttlMs)                // Set with TTL
get(key)                              // Get value
has(key)                              // Check existence
delete(key)                           // Delete key
clear()                               // Clear all
keys()                                // Get all keys
size()                                // Get cache size
```

## Metrics

Services automatically record to Prometheus:
```
# HTTP Requests
http_requests_total{method="GET", status="200"}
http_request_duration_seconds{endpoint="/api/prices"}

# Errors
errors_total{service="PricesService", type="api_error"}

# Auth Events
auth_events_total{event="login", status="success"}
```

Access metrics at: `GET /api/metrics`

## Common Issues

### Issue: Logs not appearing
**Solution:**
```javascript
// Ensure executeWithTracking is used
async myMethod() {
  return this.executeWithTracking('myMethod', async () => {
    // This will be logged automatically
  });
}
```

### Issue: Cache not working
**Solution:**
```javascript
// Verify TTL hasn't expired
const cached = this.getCache(key); // null if expired
if (!cached) {
  const fresh = await fetchData();
  this.setCache(key, fresh, 30000); // 30 seconds
}
```

### Issue: Retry not happening
**Solution:**
```javascript
// Method MUST throw error for retry to trigger
async getWithRetry() {
  return this.retry(
    async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed');
      return response;
    },
    3 // maxAttempts
  );
}
```

### Issue: No metrics recorded
**Solution:**
```javascript
// Ensure metricsService is initialized in server.js
const metricsService = require('./services/metricsService');
app.use((req, res, next) => {
  metricsService.recordRequest(req.method, req.path);
  next();
});
```

## Environment Variables

```bash
# Cache TTLs
CACHE_TTL_MS=15000

# API timeouts
API_TIMEOUT_MS=8000

# Retry attempts
RETRY_ATTEMPTS=3

# Backoff multiplier (exponential)
BACKOFF_MS=1000

# Log level
LOG_LEVEL=info
```

## Testing Template

```javascript
const { BaseService } = require('../services/BaseService');

describe('MyService', () => {
  let service;

  beforeEach(() => {
    service = new MyService();
    // Clear cache before each test
    service.clearCache();
  });

  it('should cache results', async () => {
    const data = { id: 1, name: 'Test' };
    service.setCache('key', data, 1000);
    expect(service.getCache('key')).toEqual(data);
  });

  it('should validate required fields', () => {
    expect(() => {
      service.validateRequired({}, ['required']);
    }).toThrow('Missing required fields');
  });

  it('should execute with tracking', async () => {
    const result = await service.executeWithTracking('test', async () => {
      return 'success';
    });
    expect(result).toBe('success');
  });

  it('should retry failed operations', async () => {
    let attempts = 0;
    await service.retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      },
      3
    );
    expect(attempts).toBe(3);
  });
});
```

## Best Practices

✅ Always wrap business logic in `executeWithTracking`
✅ Validate inputs with `validateRequired` before processing
✅ Use `getCached` for external API calls
✅ Set appropriate TTLs for caching (shorter for real-time data)
✅ Use `retry` for unreliable operations
✅ Log errors with `error` level
✅ Use `warn` for degraded performance

❌ Don't create ad-hoc error handlers
❌ Don't mix logging patterns
❌ Don't cache sensitive data
❌ Don't retry infinite loops
❌ Don't log passwords or tokens

## Quick Checklist for New Service

- [ ] Extend appropriate base class (BaseService, DatabaseService, APIService)
- [ ] Call `super()` in constructor with service name
- [ ] Wrap methods with `executeWithTracking`
- [ ] Validate inputs with `validateRequired`
- [ ] Add caching for expensive operations
- [ ] Use retry for external APIs
- [ ] Export both functions and singleton instance
- [ ] Add tests using provided template
- [ ] Update documentation
- [ ] Verify metrics in `/api/metrics`
