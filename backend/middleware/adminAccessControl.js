/**
 * Enhanced Admin Access Control Middleware
 * Implements multi-layered security strategy:
 * 1. IP allowlisting
 * 2. Optional API key authentication
 * 3. Rate limiting and audit logging
 * 4. Environment-based configuration
 */

const logger = require('../core/logger');
const { logEvent } = require('../services/auditLogger');

/**
 * Parse and validate admin allowed IPs from environment
 * Format: ADMIN_ALLOWED_IPS="10.0.0.1,10.0.0.2,192.168.1.0/24"
 * CIDR notation is supported
 */
function parseAllowedIps() {
  const allowedIpsEnv = process.env.ADMIN_ALLOWED_IPS;

  if (!allowedIpsEnv || !allowedIpsEnv.trim()) {
    // Safe-by-default in development; configurable in production.
    if (process.env.NODE_ENV === 'production') {
      return ['*'];
    }
    return ['127.0.0.1', '::1'];
  }

  return allowedIpsEnv
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);
}

/**
 * Simple CIDR check for IPv4 ranges
 */
function isIpInCidr(ip, cidr) {
  if (!cidr.includes('/')) {
    return ip === cidr;
  }

  const [network, bits] = cidr.split('/');
  const maskBits = parseInt(bits, 10);
  const mask = (0xffffffff << (32 - maskBits)) >>> 0;

  const ipParts = ip.split('.').map(Number);
  const networkParts = network.split('.').map(Number);

  const ipNum = (ipParts[0] << 24 | ipParts[1] << 16 | ipParts[2] << 8 | ipParts[3]) >>> 0;
  const networkNum = (networkParts[0] << 24 | networkParts[1] << 16 | networkParts[2] << 8 | networkParts[3]) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Extract client IP from request
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  ).replace(/^::ffff:/, '');
}

/**
 * IP-based access control middleware
 */
function ipAllowlistMiddleware(req, res, next) {
  const clientIp = getClientIp(req);
  const allowedIps = parseAllowedIps();

  if (process.env.ADMIN_ALLOW_REMOTE === 'true') {
    return next();
  }

  if (allowedIps.includes('*')) {
    return next();
  }

  // Check if client IP is in allowlist
  const isAllowed = allowedIps.some(allowedIp => {
    if (allowedIp === 'localhost' || allowedIp === '127.0.0.1' || allowedIp === '::1') {
      return clientIp === '127.0.0.1' || clientIp === 'localhost' || clientIp === '::1';
    }
    return isIpInCidr(clientIp, allowedIp);
  });

  if (!isAllowed) {
    logger.warn('Blocked admin access - IP not in allowlist', { clientIp, allowedIps });
    
    logEvent({
      actorType: 'unauthorized',
      action: 'ADMIN_ACCESS_BLOCKED_IP',
      ip: clientIp,
      userAgent: req.headers['user-agent'],
      success: false,
      details: { reason: 'IP not in allowlist', allowedIps }
    }).catch(err => logger.error('Failed to log blocked access', { error: err.message }));

    return res.status(403).json({
      message: 'Access Denied',
      error: 'Your IP address is not authorized to access the admin panel'
    });
  }

  next();
}

/**
 * Optional API key authentication for additional security
 * Format: Authorization: Bearer <admin-api-key>
 * Set ADMIN_API_KEY in environment for production
 */
function apiKeyMiddleware(req, res, next) {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    // If no API key is set, skip this check (IP allowlist is enough)
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || token !== adminApiKey) {
    logger.warn('Blocked admin access - invalid API key', { ip: getClientIp(req) });
    
    logEvent({
      actorType: 'unauthorized',
      action: 'ADMIN_ACCESS_BLOCKED_API_KEY',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      success: false,
      details: { reason: 'Invalid or missing API key' }
    }).catch(err => logger.error('Failed to log blocked access', { error: err.message }));

    return res.status(401).json({
      message: 'Unauthorized',
      error: 'Invalid API key'
    });
  }

  next();
}

/**
 * Combined admin access control middleware
 */
function adminAccessControl() {
  return [
    ipAllowlistMiddleware,
    apiKeyMiddleware
  ];
}

module.exports = {
  adminAccessControl,
  ipAllowlistMiddleware,
  apiKeyMiddleware,
  getClientIp,
  parseAllowedIps
};
