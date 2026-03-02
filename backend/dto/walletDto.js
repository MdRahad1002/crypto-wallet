function toWalletSummary(wallet) {
  return {
    address: wallet.address,
    network: wallet.network,
    createdAt: wallet.createdAt,
    watchOnly: wallet.watchOnly,
    label: wallet.label
  };
}

module.exports = {
  toWalletSummary
};
