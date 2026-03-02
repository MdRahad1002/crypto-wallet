const metricsService = require('../services/metricsService');

/**
 * Structured JSON logger
 * All logs are output as JSON for easy parsing and monitoring
 */
function createLogEntry(level, message, meta) {
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...meta
  };
}

const logger = {
  /**
   * Log info level messages
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info: (message, meta = {}) => {
    const entry = createLogEntry('info', message, meta);
    console.log(JSON.stringify(entry));
    
    // Update metrics for specific event types
    if (meta.type === 'auth_event') {
      metricsService.recordAuthEvent(meta.event, meta.success);
    } else if (meta.type === 'business_event') {
      metricsService.recordBusinessEvent(meta.event, meta.count);
    }
  },

  /**
   * Log warning level messages
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  warn: (message, meta = {}) => {
    const entry = createLogEntry('warn', message, meta);
    console.warn(JSON.stringify(entry));
  },

  /**
   * Log error level messages
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  error: (message, meta = {}) => {
    const entry = createLogEntry('error', message, meta);
    console.error(JSON.stringify(entry));
    
    // Track error metrics
    if (meta.errorType) {
      metricsService.recordError(meta.errorType);
    }
  },

  /**
   * Log debug level messages (development only)
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      const entry = createLogEntry('debug', message, meta);
      console.debug(JSON.stringify(entry));
    }
  }
};

module.exports = logger;
