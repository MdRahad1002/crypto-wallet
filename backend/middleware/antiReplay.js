const seenRequests = new Map();

function cleanupExpired(windowMs) {
  const now = Date.now();
  for (const [key, expiresAt] of seenRequests.entries()) {
    if (expiresAt <= now) {
      seenRequests.delete(key);
    }
  }
}

function antiReplay({ windowMs = 5 * 60 * 1000, requireHeaders } = {}) {
  const mustRequire =
    typeof requireHeaders === 'boolean'
      ? requireHeaders
      : process.env.ANTI_REPLAY_REQUIRED === 'true';

  return (req, res, next) => {
    const requestId = req.header('X-Request-Id');
    const timestampHeader = req.header('X-Request-Timestamp');

    if (!requestId || !timestampHeader) {
      if (mustRequire) {
        return res.status(400).json({ message: 'Missing anti-replay headers' });
      }
      return next();
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
      return res.status(400).json({ message: 'Invalid request timestamp' });
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > windowMs) {
      return res.status(409).json({ message: 'Stale request rejected' });
    }

    cleanupExpired(windowMs);

    if (seenRequests.has(requestId)) {
      return res.status(409).json({ message: 'Replay detected' });
    }

    seenRequests.set(requestId, now + windowMs);
    next();
  };
}

module.exports = {
  antiReplay
};
