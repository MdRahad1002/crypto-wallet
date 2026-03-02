const { createClient } = require('redis');
const logger = require('./logger');

let clientPromise = null;

async function connectClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const client = createClient({ url: redisUrl });
      client.on('error', (err) => {
        logger.error('Redis client error', { message: err.message });
      });
      await client.connect();
      logger.info('Redis connected');
      return client;
    })();
  }

  return clientPromise;
}

async function getRedisClient() {
  try {
    return await connectClient();
  } catch (error) {
    logger.error('Redis connection failed', { message: error.message });
    return null;
  }
}

module.exports = {
  getRedisClient
};
