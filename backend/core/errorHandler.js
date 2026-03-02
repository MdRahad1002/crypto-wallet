const logger = require('./logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, { path: req.path, method: req.method });
  // body-parser sets err.status (not err.statusCode) for parse failures
  const status = err.statusCode || err.status || 500;
  let message = err.publicMessage || err.message || 'Internal server error';
  // Give a meaningful message for JSON parse errors
  if (err.type === 'entity.parse.failed' || err.name === 'SyntaxError') {
    message = 'Invalid JSON in request body';
  }
  // CSRF errors from csrf-csrf (ForbiddenError)
  if (err.code === 'EBADCSRFTOKEN' || message.toLowerCase().includes('csrf') || message.toLowerCase().includes('invalid csrf')) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token. Please refresh the page and try again.' });
  }
  // Don't leak internal details
  if (status >= 500) {
    message = 'Internal server error';
  }
  res.status(status).json({ message });
}

module.exports = errorHandler;
