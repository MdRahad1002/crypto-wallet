/**
 * Base Service Layer
 * Provides consistent patterns for all services in the application
 * Includes: error handling, logging, metrics, caching, validation
 */

const logger = require('../core/logger');
const metricsService = require('./metricsService');

/**
 * BaseService - Abstract base class for all services
 * Provides common functionality: logging, error handling, metrics
 */
class BaseService {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.cache = new Map();
  }

  /**
   * Log service action
   */
  log(level, action, data = {}) {
    logger[level](`${this.serviceName}_${action}`, {
      service: this.serviceName,
      action,
      ...data
    });
  }

  /**
   * Record service metrics
   */
  recordMetric(metricType, value = 1) {
    try {
      switch (metricType) {
        case 'error':
          metricsService.recordError(`${this.serviceName}_error`);
          break;
        case 'success':
          this.log('info', 'success', { metric: metricType });
          break;
        case 'warning':
          this.log('warn', 'warning', { metric: metricType });
          break;
      }
    } catch (err) {
      // Don't let metrics recording block service
      console.error(`Metrics recording failed for ${this.serviceName}:`, err.message);
    }
  }

  /**
   * Cache data with TTL
   */
  setCache(key, data, ttlMs = 60000) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs
    });
  }

  /**
   * Get cached data if not expired
   */
  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear specific cache key
   */
  clearCacheKey(key) {
    this.cache.delete(key);
  }

  /**
   * Validate required fields
   */
  validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => 
      data[field] === undefined || data[field] === null
    );
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Wrap service method with error handling and logging
   */
  async executeWithTracking(methodName, method, params = {}) {
    const startTime = Date.now();
    
    try {
      this.log('info', `${methodName}_start`, params);
      
      const result = await method();
      
      const duration = Date.now() - startTime;
      this.log('info', `${methodName}_success`, { durationMs: duration });
      this.recordMetric('success');
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', `${methodName}_error`, {
        durationMs: duration,
        errorType: error.name,
        message: error.message
      });
      this.recordMetric('error');
      
      throw error;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  async retry(method, maxAttempts = 3, backoffMs = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await method();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = backoffMs * Math.pow(2, attempt - 1);
        this.log('warn', 'retry_attempt', {
          attempt,
          maxAttempts,
          delayMs: delay
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Parallel execution with error collection
   */
  async executeParallel(tasks) {
    const results = await Promise.allSettled(tasks);
    
    const successful = [];
    const failed = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push({ index, value: result.value });
      } else {
        failed.push({ index, reason: result.reason });
      }
    });
    
    return { successful, failed };
  }
}

/**
 * DatabaseService - Base for database operations
 */
class DatabaseService extends BaseService {
  constructor(serviceName, model) {
    super(serviceName);
    this.model = model;
  }

  /**
   * Create document
   */
  async create(data) {
    return this.executeWithTracking('create', async () => {
      const doc = new this.model(data);
      return await doc.save();
    });
  }

  /**
   * Find by ID
   */
  async findById(id) {
    return this.executeWithTracking('findById', async () => {
      return await this.model.findById(id);
    });
  }

  /**
   * Find with query
   */
  async find(query = {}, options = {}) {
    return this.executeWithTracking('find', async () => {
      return await this.model.find(query, null, options);
    });
  }

  /**
   * Update document
   */
  async update(id, data) {
    return this.executeWithTracking('update', async () => {
      return await this.model.findByIdAndUpdate(id, data, { new: true });
    });
  }

  /**
   * Delete document
   */
  async delete(id) {
    return this.executeWithTracking('delete', async () => {
      return await this.model.findByIdAndDelete(id);
    });
  }

  /**
   * Count documents
   */
  async count(query = {}) {
    return this.executeWithTracking('count', async () => {
      return await this.model.countDocuments(query);
    });
  }
}

/**
 * APIService - Base for external API calls
 */
class APIService extends BaseService {
  constructor(serviceName, baseUrl, options = {}) {
    super(serviceName);
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || 8000;
    this.retryAttempts = options.retryAttempts || 3;
  }

  /**
   * Make API request with retry logic
   */
  async request(endpoint, options = {}) {
    const axios = require('axios');
    
    return this.retry(async () => {
      return this.executeWithTracking('api_request', async () => {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          timeout: this.timeout,
          ...options
        });
        return response.data;
      });
    }, this.retryAttempts);
  }

  /**
   * Get with caching
   */
  async getCached(endpoint, ttlMs = 15000) {
    const cacheKey = `api:${endpoint}`;
    const cached = this.getCache(cacheKey);
    
    if (cached) {
      this.log('info', 'cache_hit', { endpoint });
      return cached;
    }
    
    const data = await this.request(endpoint);
    this.setCache(cacheKey, data, ttlMs);
    this.log('info', 'cache_miss', { endpoint });
    
    return data;
  }
}

/**
 * CacheService - Dedicated caching service
 */
class CacheService extends BaseService {
  constructor(serviceName = 'cache') {
    super(serviceName);
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Set value with auto-cleanup
   */
  set(key, value, ttlMs = 60000) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set cache
    this.cache.set(key, value);

    // Set auto-cleanup timer
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
      this.log('info', 'cache_expired', { key });
    }, ttlMs);

    this.timers.set(key, timer);
  }

  /**
   * Get value
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete key
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  /**
   * Clear all
   */
  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get all keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }
}

module.exports = {
  BaseService,
  DatabaseService,
  APIService,
  CacheService
};
