/**
 * Cookie Management Service
 * Handles secure cookie operations with CSRF protection, encryption, and domain management
 */

const crypto = require('crypto');
const { BaseService } = require('./BaseService');

/**
 * CookieManagerService - Secure cookie handling with CSRF protection
 */
class CookieManagerService extends BaseService {
  constructor() {
    super('CookieManager');
    this.csrfTokens = new Map(); // In production, use Redis
  }

  /**
   * Set secure cookie with best practices
   */
  setSecureCookie(res, name, value, options = {}) {
    return this.executeWithTracking('setSecureCookie', async () => {
      const isProd = process.env.NODE_ENV === 'production';
      const config = {
        httpOnly: true, // Prevent XSS access
        secure: isProd, // HTTPS only in production
        // Cross-domain (Vercel frontend → remote backend) requires sameSite:'none'; dev uses 'strict'
        sameSite: isProd ? 'none' : 'strict',
        path: '/',
        maxAge: options.maxAge || 24 * 60 * 60 * 1000, // 24 hours default
        ...options
      };

      this.validateRequired(
        { name, value },
        ['name', 'value']
      );

      // Don't log sensitive cookie values
      this.log('info', 'cookie_set', {
        name,
        maxAge: config.maxAge,
        sameSite: config.sameSite
      });

      res.cookie(name, value, config);
      return true;
    });
  }

  /**
   * Get cookie value from request
   */
  getCookie(req, name) {
    try {
      return req.cookies?.[name] || null;
    } catch (error) {
      this.log('error', 'cookie_read_error', {
        name,
        message: error.message
      });
      return null;
    }
  }

  /**
   * Clear cookie securely
   */
  clearCookie(res, name) {
    return this.executeWithTracking('clearCookie', async () => {
      res.clearCookie(name, { path: '/' });
      this.log('info', 'cookie_cleared', { name });
      return true;
    });
  }

  /**
   * Generate CSRF token
   */
  generateCsrfToken(sessionId) {
    return this.executeWithTracking('generateCsrfToken', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(token).digest('hex');

      // Store hashed token with TTL (30 minutes)
      this.csrfTokens.set(sessionId, {
        hash,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000
      });

      return token;
    });
  }

  /**
   * Verify CSRF token
   */
  verifyCsrfToken(sessionId, token) {
    return this.executeWithTracking('verifyCsrfToken', async () => {
      if (!token || !sessionId) {
        this.log('warn', 'csrf_validation_missing_params', {});
        return false;
      }

      const stored = this.csrfTokens.get(sessionId);
      if (!stored) {
        this.log('warn', 'csrf_token_not_found', { sessionId });
        return false;
      }

      // Check expiration
      if (Date.now() > stored.expiresAt) {
        this.csrfTokens.delete(sessionId);
        this.log('warn', 'csrf_token_expired', { sessionId });
        return false;
      }

      // Verify hash
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const valid = hash === stored.hash;

      if (valid) {
        this.log('info', 'csrf_token_verified', { sessionId });
      } else {
        this.log('warn', 'csrf_token_invalid', { sessionId });
      }

      return valid;
    });
  }

  /**
   * Set refresh token cookie with all best practices
   */
  setRefreshTokenCookie(res, refreshToken, expiryDays = 30) {
    return this.executeWithTracking('setRefreshTokenCookie', async () => {
      const maxAge = expiryDays * 24 * 60 * 60 * 1000;

      const isProd = process.env.NODE_ENV === 'production';
      return this.setSecureCookie(res, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'strict',
        path: '/api/auth',
        maxAge,
        domain: this.getCookieDomain()
      });
    });
  }

  /**
   * Set CSRF token cookie (httpOnly: true)
   * Note: The CSRF token is also returned in the response body for SPA usage.
   * Clients should read the token from the response body and send it in the
   * X-CSRF-Token header — not from the cookie.
   */
  setCsrfTokenCookie(res, csrfToken) {
    return this.executeWithTracking('setCsrfTokenCookie', async () => {
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('csrfToken', csrfToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'strict',
        path: '/',
        maxAge: 30 * 60 * 1000 // 30 minutes
      });

      this.log('info', 'csrf_cookie_set', {});
      return true;
    });
  }

  /**
   * Clear all auth cookies
   */
  clearAuthCookies(res) {
    return this.executeWithTracking('clearAuthCookies', async () => {
      this.clearCookie(res, 'refreshToken');
      this.clearCookie(res, 'csrfToken');
      this.clearCookie(res, 'sessionId');
      this.log('info', 'all_auth_cookies_cleared', {});
      return true;
    });
  }

  /**
   * Get appropriate cookie domain
   */
  getCookieDomain() {
    const domain = process.env.COOKIE_DOMAIN;
    if (domain) return domain;

    // Default: no explicit domain means current domain
    return undefined;
  }

  /**
   * Get cookie configuration based on environment
   */
  /**
   * Cleanup expired CSRF tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, data] of this.csrfTokens.entries()) {
      if (now > data.expiresAt) {
        this.csrfTokens.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.log('info', 'expired_tokens_cleaned', { count: cleaned });
    }

    return cleaned;
  }

}

// Export singleton
const cookieManager = new CookieManagerService();

// Periodically cleanup expired tokens (every 15 minutes)
setInterval(() => {
  cookieManager.cleanupExpiredTokens();
}, 15 * 60 * 1000);

module.exports = {
  setSecureCookie: (res, name, value, opts) => cookieManager.setSecureCookie(res, name, value, opts),
  getCookie: (req, name) => cookieManager.getCookie(req, name),
  clearCookie: (res, name) => cookieManager.clearCookie(res, name),
  generateCsrfToken: (sid) => cookieManager.generateCsrfToken(sid),
  verifyCsrfToken: (sid, token) => cookieManager.verifyCsrfToken(sid, token),
  setRefreshTokenCookie: (res, token, days) => cookieManager.setRefreshTokenCookie(res, token, days),
  setCsrfTokenCookie: (res, token) => cookieManager.setCsrfTokenCookie(res, token),
  clearAuthCookies: (res) => cookieManager.clearAuthCookies(res)
};
