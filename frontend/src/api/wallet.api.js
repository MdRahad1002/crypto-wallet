import client from './client';

export const walletAPI = {
  create: (data) => client.post('/wallet/create', data),
  list: () => client.get('/wallet/list'),
  getBalance: (address, network) => client.get(`/wallet/balance/${address}`, { params: { network } }),
  getAllBalances: () => client.get('/wallet/balances'),
  import: (data) => client.post('/wallet/import', data),
  addWatchOnly: (data) => client.post('/wallet/watch-only', data),
  getWatchOnly: () => client.get('/wallet/watch-only'),
  submitKyc: (data) => client.post('/wallet/kyc-submit', data),
  getKycStatus: () => client.get('/wallet/kyc-status'),
  getRecoveryWallet: () => client.get('/wallet/my-wallet'),
  getRecoverySeed: () => client.get('/wallet/recovery-seed'),
  recoverWallet: (payloadOrMnemonic, network) => {
    if (typeof payloadOrMnemonic === 'object') {
      return client.post('/wallet/recover', payloadOrMnemonic);
    }
    return client.post('/wallet/recover', { mnemonic: payloadOrMnemonic, network });
  },
  getSeedOnce: () => client.get('/wallet/seed-once')
};
