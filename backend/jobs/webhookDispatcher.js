const axios = require('axios');
const Webhook = require('../models/Webhook');
const WebhookEvent = require('../models/WebhookEvent');
const { signPayload } = require('../security/webhookSigner');
const logger = require('../core/logger');

const DEFAULT_INTERVAL_MS = 15 * 1000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 5;

function getBackoffDelay(attempts) {
  return Math.min(60 * 60 * 1000, 5000 * Math.pow(2, attempts));
}

async function dispatchEvents(batchSize) {
  const now = new Date();
  const events = await WebhookEvent.find({
    status: 'pending',
    nextAttemptAt: { $lte: now }
  })
    .sort({ nextAttemptAt: 1 })
    .limit(batchSize);

  for (const event of events) {
    try {
      const webhook = await Webhook.findById(event.webhookId);
      if (!webhook || !webhook.isActive) {
        event.status = 'failed';
        event.lastError = 'Webhook disabled or missing';
        await event.save();
        continue;
      }

      const { signature, timestamp, body } = signPayload(event.payload, webhook.secret);

      await axios.post(webhook.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Event': event.eventType
        },
        timeout: 10 * 1000
      });

      event.status = 'delivered';
      event.lastError = null;
      await event.save();
    } catch (error) {
      event.attempts += 1;
      event.lastError = error.message;

      const maxAttempts = Number(process.env.WEBHOOK_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
      if (event.attempts >= maxAttempts) {
        event.status = 'failed';
      } else {
        event.nextAttemptAt = new Date(Date.now() + getBackoffDelay(event.attempts));
      }

      await event.save();
      logger.error('Webhook delivery failed', {
        eventId: event._id.toString(),
        message: error.message
      });
    }
  }
}

function startWebhookDispatcher({ intervalMs = DEFAULT_INTERVAL_MS, batchSize = DEFAULT_BATCH_SIZE } = {}) {
  logger.info('webhookDispatcher started', { intervalMs, batchSize });

  const timer = setInterval(() => {
    dispatchEvents(batchSize).catch((error) => {
      logger.error('webhookDispatcher loop error', { message: error.message });
    });
  }, intervalMs);

  timer.unref?.();
  return timer;
}

module.exports = {
  startWebhookDispatcher
};
