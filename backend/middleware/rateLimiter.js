const rateLimit = require('express-rate-limit');

function createLimiter(options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    ...options
  });
}

module.exports = {
  createLimiter
};
