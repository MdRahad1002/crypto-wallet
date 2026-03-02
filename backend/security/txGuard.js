const idempotencyStore = new Map();
const { getRedisClient } = require('../core/redisClient');
const logger = require('../core/logger');

function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (record.expiresAt <= now) {
      idempotencyStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredRecords, 60 * 1000).unref?.();

function idempotencyGuard({ ttlMs = 10 * 60 * 1000 } = {}) {
  return async (req, res, next) => {
    const key =
      req.header('Idempotency-Key') ||
      req.header('X-Idempotency-Key') ||
      req.body?.idempotencyKey;

    if (!key) {
      return next();
    }

    const scopedKey = `idem:${key}`;
    const redis = await getRedisClient();

    if (redis) {
      try {
        const cached = await redis.get(scopedKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          return res.status(parsed.status).json(parsed.body);
        }
      } catch (error) {
        logger.error('Idempotency redis read failed', { message: error.message });
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const payload = JSON.stringify({ status: res.statusCode, body });
        redis
          .set(scopedKey, payload, { PX: ttlMs })
          .catch((error) => logger.error('Idempotency redis write failed', { message: error.message }));
        return originalJson(body);
      };

      return next();
    }

    cleanupExpiredRecords();

    const existing = idempotencyStore.get(scopedKey);
    if (existing) {
      return res.status(existing.status).json(existing.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      idempotencyStore.set(scopedKey, {
        status: res.statusCode,
        body,
        expiresAt: Date.now() + ttlMs
      });
      return originalJson(body);
    };

    return next();
  };
}

module.exports = {
  idempotencyGuard
};
