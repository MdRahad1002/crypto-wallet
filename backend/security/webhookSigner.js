const crypto = require('crypto');

function signPayload(payload, secret, timestamp = Date.now().toString()) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const data = `${timestamp}.${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  return { signature, timestamp, body };
}

module.exports = {
  signPayload
};
