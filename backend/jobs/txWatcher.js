const Transaction = require('../models/Transaction');
const walletService = require('../utils/walletService');
const logger = require('../core/logger');
const Webhook = require('../models/Webhook');
const WebhookEvent = require('../models/WebhookEvent');

const DEFAULT_INTERVAL_MS = 30 * 1000;
const DEFAULT_BATCH_SIZE = 25;

async function enqueueWebhookEvents(eventType, payload) {
  const webhooks = await Webhook.find({ isActive: true, events: eventType });
  if (!webhooks.length) {
    return;
  }

  const events = webhooks.map((webhook) => ({
    webhookId: webhook._id,
    eventType,
    payload
  }));

  await WebhookEvent.insertMany(events);
}

async function updateTransactionStatus(tx, receipt, currentBlock, minConfirmations) {
  if (!receipt) {
    if (tx.status === 'confirmed') {
      tx.status = 'reorged';
      tx.reorged = true;
      await tx.save();
      await enqueueWebhookEvents('transaction.reorged', {
        id: tx._id,
        hash: tx.txHash,
        network: tx.network
      });
    }
    return;
  }

  const confirmations = Math.max(0, currentBlock - receipt.blockNumber + 1);
  tx.confirmations = confirmations;
  tx.blockNumber = receipt.blockNumber;
  tx.gasUsed = receipt.gasUsed?.toString?.() || tx.gasUsed;
  tx.lastCheckedAt = new Date();

  if (receipt.status !== 1) {
    if (tx.status !== 'failed') {
      tx.status = 'failed';
      await tx.save();
      await enqueueWebhookEvents('transaction.failed', {
        id: tx._id,
        hash: tx.txHash,
        network: tx.network
      });
    } else {
      await tx.save();
    }
    return;
  }

  if (confirmations >= minConfirmations && tx.status !== 'confirmed') {
    tx.status = 'confirmed';
    tx.confirmedAt = new Date();
    tx.reorged = false;
    await tx.save();
    await enqueueWebhookEvents('transaction.confirmed', {
      id: tx._id,
      hash: tx.txHash,
      network: tx.network,
      confirmations
    });
    return;
  }

  await tx.save();
}

async function processPendingTransactions(batchSize) {
  const candidates = await Transaction.find({
    status: { $in: ['pending', 'confirmed', 'reorged'] },
    txHash: { $exists: true, $ne: '' }
  })
    .sort({ timestamp: 1 })
    .limit(batchSize);

  const minConfirmations = Number(process.env.MIN_CONFIRMATIONS || 3);

  for (const tx of candidates) {
    try {
      const provider = walletService.providers[tx.network];
      if (!provider) {
        continue;
      }

      const currentBlock = await provider.getBlockNumber();
      const receipt = await provider.getTransactionReceipt(tx.txHash);
      await updateTransactionStatus(tx, receipt, currentBlock, minConfirmations);
    } catch (error) {
      logger.error('txWatcher failed to update transaction', {
        txHash: tx.txHash,
        message: error.message
      });
    }
  }
}

function startTxWatcher({ intervalMs = DEFAULT_INTERVAL_MS, batchSize = DEFAULT_BATCH_SIZE } = {}) {
  logger.info('txWatcher started', { intervalMs, batchSize });

  const timer = setInterval(() => {
    processPendingTransactions(batchSize).catch((error) => {
      logger.error('txWatcher loop error', { message: error.message });
    });
  }, intervalMs);

  timer.unref?.();
  return timer;
}

module.exports = {
  startTxWatcher
};
