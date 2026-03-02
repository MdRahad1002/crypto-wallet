/**
 * URL sanitization utilities.
 * Prevents DOM-based XSS by ensuring only safe http(s) URLs are used in
 * href / src attributes that receive data from API responses or React state.
 */

/**
 * Returns the URL only if its protocol is http: or https:.
 * Returns '#' for anything else (javascript:, data:, vbscript:, etc.).
 *
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '#';
    return url.trim();
  } catch {
    return '#';
  }
}

/**
 * Build a block-explorer URL for a transaction hash.
 * Validates that txHash contains only hex characters (prevents injection when
 * the hash is concatenated into the URL).
 *
 * @param {string} network  - e.g. 'bitcoin', 'ethereum'
 * @param {string} txHash
 * @returns {string}
 */
export function blockExplorerUrl(network, txHash) {
  if (!txHash || typeof txHash !== 'string') return '#';
  // Allow standard hex tx hashes (32–64 bytes = 64–128 hex chars) plus short ones
  if (!/^[0-9a-fA-F]{8,130}$/.test(txHash.trim())) return '#';
  const base =
    network === 'bitcoin' || network === 'btc'
      ? 'https://blockchair.com/bitcoin/transaction/'
      : network === 'litecoin'
      ? 'https://blockchair.com/litecoin/transaction/'
      : network === 'dogecoin'
      ? 'https://blockchair.com/dogecoin/transaction/'
      : 'https://etherscan.io/tx/';
  return base + txHash.trim();
}

/**
 * Build a QR-code image URL from an address.
 * The address is encoded with encodeURIComponent to prevent injection into the
 * query string; the base URL is always the trusted qrserver.com endpoint.
 *
 * @param {string} address
 * @param {string} [size='200x200']
 * @returns {string}
 */
export function qrCodeUrl(address, size = '200x200') {
  if (!address || typeof address !== 'string') return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(address.trim())}&ecc=M&margin=1`;
}
