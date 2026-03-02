/**
 * Token Revocation Service
 * Manages blacklisted access tokens and refresh tokens via Redis
 * Enables immediate session invalidation
 */

const { getRedisClient } = require('../core/redisClient');
const logger = require('../core/logger');
const crypto = require('crypto');

const ACCESS_TOKEN_PREFIX = 'blacklist:access:';
const REFRESH_TOKEN_PREFIX = 'blacklist:refresh:';
const SESSION_PREFIX = 'session:';

/**
 * Add an access token to the blacklist
 * Tokens are automatically removed after their expiry time
 */
async function revokeAccessToken(token, expiresIn = 7200) { // 7200s = 2h, matches JWT lifetime
  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    const tokenHash = hashToken(token);
    const key = `${ACCESS_TOKEN_PREFIX}${tokenHash}`;
    
    // Set key with TTL equal to token expiry (default 15 min)
    await redis.setEx(key, expiresIn, JSON.stringify({ revokedAt: new Date().toISOString() }));
    
    logger.debug('Access token revoked', { tokenHash: tokenHash.substring(0, 8) });
    return true;
  } catch (error) {
    logger.error('Failed to revoke access token', { message: error.message });
    return false;
  }
}

/**
 * Add a refresh token to the blacklist
 * Tokens are stored indefinitely until manually cleaned up
 */
async function revokeRefreshToken(tokenHash, expiresIn = 2592000) {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    const key = `${REFRESH_TOKEN_PREFIX}${tokenHash}`;
    
    // Set key with TTL equal to refresh token expiry (default 30 days)
    await redis.setEx(key, expiresIn, JSON.stringify({ revokedAt: new Date().toISOString() }));
    
    logger.debug('Refresh token revoked', { tokenHash: tokenHash.substring(0, 8) });
    return true;
  } catch (error) {
    logger.error('Failed to revoke refresh token', { message: error.message });
    return false;
  }
}

/**
 * Check if an access token is blacklisted
 */
async function isAccessTokenRevoked(token) {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    const tokenHash = hashToken(token);
    const key = `${ACCESS_TOKEN_PREFIX}${tokenHash}`;
    const exists = await redis.exists(key);
    
    return exists === 1;
  } catch (error) {
    logger.error('Failed to check access token revocation', { message: error.message });
    return false;
  }
}

/**
 * Check if a refresh token is blacklisted
 */
async function isRefreshTokenRevoked(tokenHash) {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    const key = `${REFRESH_TOKEN_PREFIX}${tokenHash}`;
    const exists = await redis.exists(key);
    
    return exists === 1;
  } catch (error) {
    logger.error('Failed to check refresh token revocation', { message: error.message });
    return false;
  }
}

/**
 * Revoke ALL tokens for a user (immediate logout across all sessions)
 */
async function revokeAllUserTokens(userId) {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    const sessionKey = `${SESSION_PREFIX}${userId}`;
    
    // Get all tokens for this user
    const sessionData = await redis.get(sessionKey);
    if (sessionData) {
      const { accessTokens = [], refreshTokens = [] } = JSON.parse(sessionData);
      
      // Revoke all access tokens
      for (const token of accessTokens) {
        await revokeAccessToken(token, 900);
      }
      
      // Revoke all refresh tokens
      for (const tokenHash of refreshTokens) {
        await revokeRefreshToken(tokenHash, 2592000);
      }
    }
    
    // Delete session record
    await redis.del(sessionKey);
    
    logger.info('All user tokens revoked', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to revoke all user tokens', { message: error.message });
    return false;
  }
}

/**
 * Track a new session for a user
 */
async function trackSession(userId, accessToken, refreshTokenHash) {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const sessionData = await redis.get(sessionKey);
    
    let tokens = { accessTokens: [], refreshTokens: [] };
    if (sessionData) {
      tokens = JSON.parse(sessionData);
    }
    
    // Limit to 10 concurrent sessions per user
    if (!tokens.accessTokens.includes(accessToken)) {
      tokens.accessTokens.push(accessToken);
      if (tokens.accessTokens.length > 10) {
        tokens.accessTokens.shift();
      }
    }
    
    if (!tokens.refreshTokens.includes(refreshTokenHash)) {
      tokens.refreshTokens.push(refreshTokenHash);
      if (tokens.refreshTokens.length > 10) {
        tokens.refreshTokens.shift();
      }
    }
    
    // Store session data; expires after 30 days
    await redis.setEx(sessionKey, 2592000, JSON.stringify(tokens));
    
    logger.debug('Session tracked', { userId, sessionKey });
    return true;
  } catch (error) {
    logger.error('Failed to track session', { message: error.message });
    return false;
  }
}

/**
 * Hash a token for storage (one-way)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get all active sessions for a user
 */
async function getUserSessions(userId) {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;

    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const sessionData = await redis.get(sessionKey);
    
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (error) {
    logger.error('Failed to get user sessions', { message: error.message });
    return null;
  }
}

/**
 * Clean up expired token entries (optional maintenance)
 */
async function cleanupExpiredTokens() {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    // Redis automatically cleans up expired keys, but this can be called for explicit cleanup
    logger.debug('Token cleanup completed (Redis handles expiry automatically)');
    return true;
  } catch (error) {
    logger.error('Failed to cleanup tokens', { message: error.message });
    return false;
  }
}

module.exports = {
  revokeAccessToken,
  revokeRefreshToken,
  isAccessTokenRevoked,
  isRefreshTokenRevoked,
  revokeAllUserTokens,
  trackSession,
  getUserSessions,
  cleanupExpiredTokens,
  hashToken
};
