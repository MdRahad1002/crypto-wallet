# Webhooks Guide

This platform supports outgoing webhooks for transaction lifecycle events.

## Events
- transaction.confirmed
- transaction.failed
- transaction.reorged

## Delivery
- Dispatcher runs when `JOBS_ENABLED=true`.
- Retries are exponential backoff up to `WEBHOOK_MAX_ATTEMPTS` (default 5).
- Each delivery includes headers:
  - `X-Webhook-Signature`
  - `X-Webhook-Timestamp`
  - `X-Webhook-Event`

## Signature Verification
The signature is an HMAC SHA-256 of:

`<timestamp>.<raw_body>`

Use the webhook secret you configured in Admin → Webhooks.

### Node.js example
```js
const crypto = require('crypto');

function verifyWebhook({ signature, timestamp, rawBody, secret }) {
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

## Admin API
- `GET /api/admin/webhooks`
- `POST /api/admin/webhooks`
- `PATCH /api/admin/webhooks/:id`
- `DELETE /api/admin/webhooks/:id`

## Environment
- `JOBS_ENABLED=true`
- `WEBHOOK_MAX_ATTEMPTS=5`
- `MIN_CONFIRMATIONS=3`

## Notes
- Reorgs will flip a confirmed transaction to `reorged` and fire `transaction.reorged`.
- Use HTTPS endpoints in production.
