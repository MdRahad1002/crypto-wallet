/**
 * WebSocket Authentication and Per-Socket Rate Limiting Middleware
 * Secures Socket.IO connections with JWT verification and rate limiting
 */

const jwt = require('jsonwebtoken');
const logger = require('../core/logger');
const metricsService = require('../services/metricsService');

/**
 * Socket.IO Authentication Middleware
 * Verifies JWT token on connection and attaches user info to socket
 */
function socketAuthMiddleware(socket, next) {
  try {
    // Get token from handshake auth
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logger.warn('websocket_auth_missing', {
        socketId: socket.id,
        ip: socket.handshake.address,
        reason: 'no_token_provided'
      });
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('websocket_auth_config_error', {
        errorType: 'websocket_auth_error',
        message: 'JWT_SECRET not configured'
      });
      return next(new Error('Authentication is not configured'));
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      
      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.authenticatedAt = Date.now();
      
      logger.info('websocket_authenticated', {
        type: 'websocket_event',
        event: 'auth_success',
        socketId: socket.id,
        userId: decoded.userId,
        ip: socket.handshake.address
      });
      
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.warn('websocket_auth_expired', {
          socketId: socket.id,
          ip: socket.handshake.address,
          reason: 'token_expired'
        });
        return next(new Error('Token expired'));
      }
      
      logger.warn('websocket_auth_invalid', {
        socketId: socket.id,
        ip: socket.handshake.address,
        reason: err.message
      });
      return next(new Error('Invalid authentication token'));
    }
  } catch (error) {
    logger.error('websocket_auth_middleware_error', {
      errorType: 'websocket_auth_error',
      message: error.message,
      socketId: socket?.id
    });
    next(new Error('Authentication failed'));
  }
}

/**
 * Per-Socket Rate Limiter
 * Tracks event frequency per socket to prevent abuse
 */
class SocketRateLimiter {
  constructor(maxEventsPerSecond = 10, maxEventsPerMinute = 300) {
    this.maxEventsPerSecond = maxEventsPerSecond;
    this.maxEventsPerMinute = maxEventsPerMinute;
    this.socketLimits = new Map(); // socketId -> { events: [], blockedUntil }
  }

  /**
   * Check if socket should be rate limited
   */
  isRateLimited(socketId) {
    const now = Date.now();
    
    if (!this.socketLimits.has(socketId)) {
      this.socketLimits.set(socketId, {
        events: [],
        blockedUntil: 0
      });
    }

    const limiter = this.socketLimits.get(socketId);

    // Check if currently blocked
    if (limiter.blockedUntil > now) {
      return true;
    }

    // Clean old events (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    limiter.events = limiter.events.filter(time => time > oneMinuteAgo);

    // Check minute limit
    if (limiter.events.length >= this.maxEventsPerMinute) {
      limiter.blockedUntil = now + 60000; // Block for 1 minute
      return true;
    }

    // Check second limit (events in last second)
    const oneSecondAgo = now - 1000;
    const eventsThisSecond = limiter.events.filter(time => time > oneSecondAgo).length;
    
    if (eventsThisSecond >= this.maxEventsPerSecond) {
      limiter.blockedUntil = now + 5000; // Block for 5 seconds
      return true;
    }

    // Record this event
    limiter.events.push(now);
    return false;
  }

  /**
   * Record rate limit violation
   */
  recordViolation(socketId) {
    metricsService.recordError('websocket_rate_limit');
  }

  /**
   * Clean up socket entry (call on disconnect)
   */
  cleanup(socketId) {
    this.socketLimits.delete(socketId);
  }

  /**
   * Get current rate limit status for socket
   */
  getStatus(socketId) {
    if (!this.socketLimits.has(socketId)) {
      return null;
    }

    const limiter = this.socketLimits.get(socketId);
    const oneMinuteAgo = Date.now() - 60000;
    const recentEvents = limiter.events.filter(time => time > oneMinuteAgo);

    return {
      totalEventsLastMinute: recentEvents.length,
      eventsPerSecondLimit: this.maxEventsPerSecond,
      eventsPerMinuteLimit: this.maxEventsPerMinute,
      isBlocked: limiter.blockedUntil > Date.now(),
      blockedUntilMs: Math.max(0, limiter.blockedUntil - Date.now())
    };
  }
}

/**
 * Create rate limiter middleware for Socket.IO
 * Returns a function that validates events against rate limits
 */
function createSocketRateLimitMiddleware(maxEventsPerSecond = 10, maxEventsPerMinute = 300) {
  const rateLimiter = new SocketRateLimiter(maxEventsPerSecond, maxEventsPerMinute);

  return (socket, next) => {
    // Attach rate limiter to socket
    socket.rateLimiter = rateLimiter;

    // Attach event interceptor to check rate limits
    const originalEmit = socket.emit;
    socket.emit = function(event, ...args) {
      // Allow internal events (starting with ':')
      if (event.startsWith(':')) {
        return originalEmit.apply(this, [event, ...args]);
      }

      if (rateLimiter.isRateLimited(socket.id)) {
        rateLimiter.recordViolation(socket.id);
        logger.warn('websocket_rate_limit_exceeded', {
          socketId: socket.id,
          userId: socket.userId,
          event: event,
          ip: socket.handshake.address
        });
        return false; // Don't emit
      }

      return originalEmit.apply(this, [event, ...args]);
    };

    // Clean up on disconnect
    socket.on('disconnect', () => {
      rateLimiter.cleanup(socket.id);
    });

    next();
  };
}

/**
 * Setup WebSocket security for Socket.IO server
 * Applies authentication and rate limiting to all connections
 */
function setupWebSocketSecurity(io, options = {}) {
  const {
    maxEventsPerSecond = 10,
    maxEventsPerMinute = 300,
    enableMetrics = true
  } = options;

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Apply rate limiting middleware
  io.use(createSocketRateLimitMiddleware(maxEventsPerSecond, maxEventsPerMinute));

  // Track socket events for metrics
  if (enableMetrics) {
    io.on('connection', (socket) => {
      metricsService.recordBusinessEvent('websocket_connected');
      
      logger.info('websocket_connection', {
        type: 'websocket_event',
        event: 'connection',
        socketId: socket.id,
        userId: socket.userId,
        ip: socket.handshake.address
      });

      socket.on('disconnect', (reason) => {
        logger.info('websocket_disconnection', {
          type: 'websocket_event',
          event: 'disconnection',
          socketId: socket.id,
          userId: socket.userId,
          reason: reason
        });
      });

      // Track errors
      socket.on('error', (error) => {
        logger.error('websocket_error', {
          socketId: socket.id,
          userId: socket.userId,
          message: error?.message || error,
          errorType: 'websocket_error'
        });
        metricsService.recordError('websocket_error');
      });
    });
  }
}

module.exports = {
  socketAuthMiddleware,
  SocketRateLimiter,
  createSocketRateLimitMiddleware,
  setupWebSocketSecurity
};
