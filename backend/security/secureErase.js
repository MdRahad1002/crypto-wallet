function secureEraseString(str) {
  try {
    if (!str) return;
    // Attempt best-effort memory overwrite by creating a buffer and zeroing it.
    const buf = Buffer.from(str, 'utf8');
    buf.fill(0);
  } catch (e) {
    // best-effort only; swallow errors to avoid breaking flows
  }
}

module.exports = { secureEraseString };
