import client from '../api/client';

// Auth API
export const authAPI = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  logout: (revokeAll = false) => client.post('/auth/logout', { revokeAll }),
  changePassword: (data) => client.post('/auth/change-password', data),
  // Fetches + sets the CSRF cookie. Must be called after login/refresh
  // so the refreshToken cookie is present for session binding.
  fetchCsrfToken: () => client.get('/auth/csrf-token')
};

// Wallet API
export const walletAPI = {
  create: (data) => client.post('/wallet/create', data),
  list: () => client.get('/wallet/list'),
  getBalance: (address, network) => client.get(`/wallet/balance/${address}`, { params: { network } }),
  getAllBalances: () => client.get('/wallet/balances'),
  import: (data) => client.post('/wallet/import', data),
  addWatchOnly: (data) => client.post('/wallet/watch-only', data),
  getWatchOnly: () => client.get('/wallet/watch-only'),
  renameWallet: (address, label) => client.patch('/wallet/rename', { address, label }),
  submitKyc: (data) => client.post('/wallet/kyc-submit', data),
  getKycStatus: () => client.get('/wallet/kyc-status'),
  getRecoveryStatus: () => client.get('/wallet/recovery-status'),
  getRecoveryWallet: () => client.get('/wallet/my-wallet'),
  getRecoverySeed: () => client.get('/wallet/recovery-seed'),
  getSeed: () => client.get('/wallet/seed'),
  recoverWallet: (payloadOrMnemonic, network) => {
    if (typeof payloadOrMnemonic === 'object') {
      return client.post('/wallet/recover', payloadOrMnemonic);
    }
    return client.post('/wallet/recover', { mnemonic: payloadOrMnemonic, network });
  },
  getSeedOnce: () => client.get('/wallet/seed-once'),
  // Notification APIs
  getNotifications: () => client.get('/wallet/notifications'),
  markNotificationAsRead: (notificationId) => client.patch(`/wallet/notifications/${notificationId}/read`),
  markAllNotificationsAsRead: () => client.patch('/wallet/notifications/read-all'),
  deleteNotification: (notificationId) => client.delete(`/wallet/notifications/${notificationId}`),
  // Transaction History APIs
  getRecoveryTransactions: () => client.get('/wallet/recovery-transactions')
};

// Transaction API
export const transactionAPI = {
  getHistory: (params) => client.get('/transactions/history', { params }),
  getBlockchainHistory: (address, network) => client.get(`/transactions/blockchain/${address}`, { params: { network } }),
  send: (data) => client.post('/transactions/send', data),
  sendBatch: (data) => client.post('/transactions/send-batch', data),
  deposit: (data) => client.post('/transactions/deposit', data),
  withdraw: (data) => client.post('/transactions/withdraw', data),
  getById: (id) => client.get(`/transactions/${id}`),
  estimateGas: (data) => client.post('/transactions/estimate-gas', data),
  getPublicDepositAddresses: () => client.get('/transactions/deposit-addresses'),
};

// Prices API
export const pricesAPI = {
  getLivePrices: () => client.get('/prices/live'),
  getHistory: (coinId, days) => client.get(`/prices/history/${coinId}`, { params: { days } }),
  getMarketData: (chain) => client.get(`/prices/market/${chain}`),
  getChainStats: (chain) => client.get(`/prices/stats/${chain}`),
  getNetworkHealth: (chain) => client.get(`/prices/network-health/${chain}`)
};

// Token API
export const tokenAPI = {
  getPopular: (network) => client.get('/tokens/popular', { params: { network } }),
  getList: (params) => client.get('/tokens/list', { params }),
  getInfo: (address, network) => client.get(`/tokens/info/${address}`, { params: { network } }),
  add: (data) => client.post('/tokens/add', data),
  getBalance: (walletAddress, tokenAddress, network) => 
    client.get(`/tokens/balance/${walletAddress}/${tokenAddress}`, { params: { network } }),
  getBalances: (walletAddress, network) => 
    client.get(`/tokens/balances/${walletAddress}`, { params: { network } }),
  transfer: (data) => client.post('/tokens/transfer', data),
  delete: (id) => client.delete(`/tokens/${id}`),
  refresh: (id) => client.post(`/tokens/refresh/${id}`)
};

export const supportAPI = {
  submit: (data) => client.post('/support', data),
  getMyTickets: () => client.get('/support/my-tickets'),
};

// Admin API
export const adminAPI = {
  getStats: () => client.get('/admin/stats'),
  getUsers: (params) => client.get('/admin/users', { params }),
  getUserDetails: (id) => client.get(`/admin/users/${id}`),
  updateUserRole: (id, role) => client.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: (id) => client.delete(`/admin/users/${id}`),
  revokeUserTokens: (id) => client.post(`/admin/users/${id}/revoke-tokens`),
  getTransactions: (params) => client.get('/admin/transactions', { params }),
  getLogs: () => client.get('/admin/logs'),
  getAnalytics: (days) => client.get('/admin/analytics', { params: { days } }),
  getMarketAnalytics: (days) => client.get('/admin/market-analytics', { params: { days } }),
  getKycPending: () => client.get('/admin/kyc/pending'),
  getKycApproved: () => client.get('/admin/kyc/approved'),
  approveKyc: (userId) => client.patch(`/admin/kyc/${userId}/approve`, {}),
  rejectKyc: (userId, message) => client.patch(`/admin/kyc/${userId}/reject`, { message }),
  requestKycDocs: (userId, message) => client.patch(`/admin/kyc/${userId}/request-docs`, { message }),
  setKycProcessing: (userId) => client.patch(`/admin/kyc/${userId}/processing`),
  provisionRecoveryWallet: (payloadOrUserId, mnemonic) => {
    if (typeof payloadOrUserId === 'object') {
      return client.post('/admin/wallets/provision', payloadOrUserId);
    }
    return client.post('/admin/wallets/provision', { userId: payloadOrUserId, mnemonic });
  },
  getWebhooks: () => client.get('/admin/webhooks'),
  createWebhook: (data) => client.post('/admin/webhooks', data),
  updateWebhook: (id, data) => client.patch(`/admin/webhooks/${id}`, data),
  deleteWebhook: (id) => client.delete(`/admin/webhooks/${id}`),
  // Notification APIs
  sendNotification: (data) => client.post('/admin/notifications/send', data),
  sendBulkNotification: (data) => client.post('/admin/notifications/send-bulk', data),
  deleteUserNotification: (userId, notificationId) => client.delete(`/admin/notifications/${userId}/${notificationId}`),
  // Create user (admin only)
  createUser: (data) => client.post('/admin/users', data),

  // Wallet import — fetch BTC balance + history from Blockchair, attach to user
  importWallet: (userId, data) => client.post(`/admin/users/${userId}/wallet-import`, data),

  // Edit user wallet display balance
  updateBalance: (userId, data) => client.patch(`/admin/users/${userId}/balance`, data),

  // Rename a user wallet label
  renameWallet: (userId, address, label) => client.patch(`/admin/users/${userId}/wallet-rename`, { address, label }),
  generateSeed: (words = 12) => client.get(`/admin/wallets/generate-seed`, { params: { words } }),
  getSupportTickets: (status) => client.get('/admin/support-tickets', { params: status ? { status } : {} }),
  updateSupportTicket: (id, data) => client.patch(`/admin/support-tickets/${id}`, data),

  // Add a manual transaction to a user
  addTransaction: (userId, data) => client.post(`/admin/users/${userId}/transactions`, data),

  // Edit an existing transaction
  editTransaction: (txId, data) => client.patch(`/admin/transactions/${txId}`, data),
  deleteTransaction: (txId) => client.delete(`/admin/transactions/${txId}`),

  // Reset a user's password (admin only)
  resetUserPassword: (userId, newPassword) => client.patch(`/admin/users/${userId}/reset-password`, { newPassword }),

  // Send a custom message/notification to a user
  sendMessage: (userId, data) => client.post(`/admin/users/${userId}/send-message`, data),

  // Edit an existing notification
  editNotification: (userId, notificationId, data) => client.patch(`/admin/notifications/${userId}/${notificationId}`, data),

  // Banner override for user dashboard top alert
  setBanner: (userId, data) => client.put(`/admin/users/${userId}/banner`, data),
  clearBanner: (userId) => client.delete(`/admin/users/${userId}/banner`),

  // Pending withdrawal approvals
  getPendingWithdrawals: () => client.get('/admin/withdrawals/pending'),
  approveWithdrawal: (txId) => client.patch(`/admin/withdrawals/${txId}/approve`),
  rejectWithdrawal: (txId, reason) => client.patch(`/admin/withdrawals/${txId}/reject`, { reason }),

  // Per-user deposit addresses
  setupUserDepositAddressesTable: () => client.post('/admin/setup/user-deposit-addresses'),
  getUserDepositAddresses: (userId) => client.get(`/admin/users/${userId}/deposit-addresses`),
  addUserDepositAddress: (userId, data) => client.post(`/admin/users/${userId}/deposit-addresses`, data),
  updateUserDepositAddress: (id, data) => client.put(`/admin/deposit-addresses/${id}`, data),
  deleteUserDepositAddress: (id) => client.delete(`/admin/deposit-addresses/${id}`),
};

export default client;
