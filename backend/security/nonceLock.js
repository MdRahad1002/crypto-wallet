const crypto = require('crypto');
const { getRedisClient } = require('../core/redisClient');
const logger = require('../core/logger');

const locks = new Map();

function cleanupExpiredLocks() {
  const now = Date.now();
  for (const [key, value] of locks.entries()) {
    if (value.expiresAt <= now) {
      locks.delete(key);
    }
  }
}

setInterval(cleanupExpiredLocks, 30 * 1000).unref?.();

async function acquireLock(lockKey, ttlMs = 30 * 1000) {
  const redis = await getRedisClient();
  const scopedKey = `nonce:${lockKey}`;

  if (redis) {
    const token = crypto.randomUUID();
    const acquired = await redis.set(scopedKey, token, { NX: true, PX: ttlMs });
    if (!acquired) {
      return null;
    }

    return async () => {
      try {
        const current = await redis.get(scopedKey);
        if (current === token) {
          await redis.del(scopedKey);
        }
      } catch (error) {
        logger.error('Failed to release redis nonce lock', { message: error.message });
      }
    };
  }

  cleanupExpiredLocks();

  if (locks.has(scopedKey)) {
    return null;
  }

  const token = crypto.randomUUID();
  locks.set(scopedKey, { token, expiresAt: Date.now() + ttlMs });

  return async () => {
    const current = locks.get(scopedKey);
    if (current && current.token === token) {
      locks.delete(scopedKey);
    }
  };
}

async function withNonceLock(lockKey, fn, ttlMs) {
  const release = await acquireLock(lockKey, ttlMs);
  if (!release) {
    const error = new Error('Another transaction is already in progress for this wallet');
    error.statusCode = 409;
    throw error;
  }

  try {
    return await fn();
  } finally {
    await release();
  }
}

module.exports = {
  acquireLock,
  withNonceLock
};
