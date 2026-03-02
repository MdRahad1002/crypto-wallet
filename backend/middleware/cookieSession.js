/**
 * Cookie-Based Session Middleware
 * Manages secure session handling with automatic refresh
 */

const logger = require('../core/logger');
const { getCookie, setSecureCookie } = require('../services/cookieManager');
const jwt = require('jsonwebtoken');

/**
 * Session middleware - loads session from refresh token cookie
 */
function sessionMiddleware(req, res, next) {
  try {
    const refreshToken = getCookie(req, 'refreshToken');
    const sessionId = getCookie(req, 'sessionId');

    if (refreshToken) {
      req.refreshToken = refreshToken;
    }

    if (sessionId) {
      req.sessionId = sessionId;
    }

    // Set Session-ID header if available (for client tracking)
    if (sessionId) {
      res.set('X-Session-ID', sessionId);
    }

    next();
  } catch (error) {
    logger.error('session_middleware_error', {
      message: error.message
    });
    next(); // Don't block request
  }
}

/**
 * Auto-refresh cookie TTL middleware
 * Extends cookie expiry on each successful request
 */
function autoRefreshCookieTTL(req, res, next) {
  try {
    const refreshToken = getCookie(req, 'refreshToken');
    const csrfToken = getCookie(req, 'csrfToken');

    // Only refresh if user is authenticated
    if (!req.user?.userId && !req.path.includes('/auth')) {
      return next();
    }

    const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(
      process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30',
      10
    );

    // Refresh token TTL
    if (refreshToken) {
      const maxAge = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
      setSecureCookie(res, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge
      });

      logger.info('cookie_ttl_refreshed', {
        type: 'session_management',
        daysUntilExpiry: REFRESH_TOKEN_EXPIRES_DAYS
      });
    }

    // Refresh CSRF token TTL
    if (csrfToken) {
      setSecureCookie(res, 'csrfToken', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 60 * 1000 // 30 minutes
      });
    }

    next();
  } catch (error) {
    logger.error('auto_refresh_cookie_error', {
      message: error.message
    });
    next();
  }
}

/**
 * Secure cookie storage validation middleware
 * Ensures sensitive operations have valid refresh token
 */
function validateRefreshCookie(req, res, next) {
  try {
    // Only validate sensitive endpoints
    const sensitiveEndpoints = ['/api/wallet', '/api/transactions'];
    const isSensitive = sensitiveEndpoints.some(ep =>
      req.path.startsWith(ep)
    );

    if (!isSensitive) {
      return next();
    }

    const refreshToken = getCookie(req, 'refreshToken');
    const accessToken = req.get('Authorization')?.replace('Bearer ', '');

    if (!refreshToken && !accessToken) {
      logger.warn('refresh_cookie_missing_sensitive', {
        path: req.path,
        method: req.method
      });
      return res.status(401).json({
        message: 'Authentication required',
        code: 'REFRESH_COOKIE_MISSING'
      });
    }

    next();
  } catch (error) {
    logger.error('refresh_cookie_validation_error', {
      message: error.message
    });
    next();
  }
}

/**
 * Cookie SameSite validation
 * Ensures cookies enforce same-site policy
 */
function validateCookieSameSite(req, res, next) {
  // This is mostly for logging/monitoring
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const requestHost = req.get('Host');

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const currentHost = new URL(`${req.protocol}://${requestHost}`);

      const isSameSite = originUrl.origin === currentHost.origin;

      if (!isSameSite) {
        logger.warn('cross_site_request_detected', {
          origin,
          currentHost: currentHost.origin,
          path: req.path,
          method: req.method
        });
        // Note: For most operations, CORS and other protections handle this
        // This is just logging for monitoring
      }
    } catch (error) {
      logger.error('samesite_validation_error', {
        message: error.message,
        origin
      });
    }
  }

  next();
}

/**
 * Cookie serialization settings
 */
const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined
};

/**
 * Get cookie configuration
 */
function getCookieDefaults(overrides = {}) {
  return {
    ...COOKIE_DEFAULTS,
    ...overrides
  };
}

module.exports = {
  sessionMiddleware,
  autoRefreshCookieTTL,
  validateRefreshCookie,
  validateCookieSameSite,
  getCookieDefaults,
  COOKIE_DEFAULTS
};
