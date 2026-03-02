/**
 * CSRF Protection Middleware
 * Validates CSRF tokens on state-changing operations
 */

const logger = require('../core/logger');
const { verifyCsrfToken, setCsrfTokenCookie, generateCsrfToken } = require('../services/cookieManager');
const crypto = require('crypto');

/**
 * Generate session ID from request
 */
function getSessionId(req) {
  // Use user ID if authenticated, otherwise use a request-based identifier
  if (req.user?.userId) {
    return req.user.userId;
  }

  // Generate consistent ID from IP + User-Agent hash
  const identifier = `${req.ip}:${req.get('user-agent') || 'unknown'}`;
  return crypto.createHash('sha256').update(identifier).digest('hex');
}

/**
 * CSRF Middleware - GET requests receive token, POST/PUT/DELETE validate token
 */
function csrfProtection(req, res, next) {
  try {
    const sessionId = getSessionId(req);
    
    // Store session ID for later use
    req.csrfSessionId = sessionId;

    // GET requests: provide CSRF token
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Generate new token for GET requests
      generateCsrfToken(sessionId).then(token => {
        setCsrfTokenCookie(res, token);
        next();
      }).catch(error => {
        logger.error('csrf_token_generation_error', {
          message: error.message
        });
        next(); // Continue without CSRF (non-blocking)
      });
      return;
    }

    // State-changing requests: validate token
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      // Skip CSRF for specific safe endpoints
      const safePaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout'
      ];

      if (safePaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Get token from header (X-CSRF-Token) or body
      const token = req.get('X-CSRF-Token') || req.body?.csrfToken;

      if (!token) {
        logger.warn('csrf_token_missing', {
          path: req.path,
          method: req.method,
          sessionId
        });
        return res.status(403).json({
          message: 'CSRF token missing',
          code: 'CSRF_TOKEN_MISSING'
        });
      }

      // Verify token
      verifyCsrfToken(sessionId, token).then(valid => {
        if (!valid) {
          logger.warn('csrf_token_invalid', {
            path: req.path,
            method: req.method,
            sessionId
          });
          return res.status(403).json({
            message: 'CSRF token invalid',
            code: 'CSRF_TOKEN_INVALID'
          });
        }

        // Token valid, continue
        next();
      }).catch(error => {
        logger.error('csrf_verification_error', {
          message: error.message
        });
        res.status(500).json({
          message: 'CSRF verification failed',
          code: 'CSRF_VERIFICATION_ERROR'
        });
      });

      return;
    }

    next();
  } catch (error) {
    logger.error('csrf_middleware_error', {
      message: error.message,
      path: req.path
    });
    // Don't block request on middleware errors
    next();
  }
}

/**
 * Double-submit cookie pattern middleware
 * Validates that CSRF token in header matches token in cookie
 */
function doubleSubmitCsrfProtection(req, res, next) {
  try {
    // Only validate state-changing requests
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Skip auth endpoints
    if (req.path.includes('/auth/')) {
      return next();
    }

    const cookieToken = req.cookies?.csrfToken;
    const headerToken = req.get('X-CSRF-Token');

    if (!headerToken) {
      logger.warn('double_submit_csrf_missing', {
        path: req.path,
        hasCookie: !!cookieToken
      });
      return res.status(403).json({
        message: 'CSRF token missing in header',
        code: 'CSRF_HEADER_MISSING'
      });
    }

    if (!cookieToken) {
      logger.warn('double_submit_csrf_missing_cookie', {
        path: req.path
      });
      return res.status(403).json({
        message: 'CSRF token missing in cookie',
        code: 'CSRF_COOKIE_MISSING'
      });
    }

    // Tokens must match
    if (cookieToken !== headerToken) {
      logger.warn('double_submit_csrf_mismatch', {
        path: req.path,
        method: req.method
      });
      return res.status(403).json({
        message: 'CSRF token mismatch',
        code: 'CSRF_TOKEN_MISMATCH'
      });
    }

    next();
  } catch (error) {
    logger.error('double_submit_csrf_error', {
      message: error.message
    });
    next();
  }
}

module.exports = {
  csrfProtection,
  doubleSubmitCsrfProtection
};
