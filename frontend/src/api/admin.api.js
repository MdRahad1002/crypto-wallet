import client from './client';

export const adminAPI = {
  getStats: () => client.get('/admin/stats'),
  getUsers: (params) => client.get('/admin/users', { params }),
  getUserDetails: (id) => client.get(`/admin/users/${id}`),
  updateUserRole: (id, role) => client.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: (id) => client.delete(`/admin/users/${id}`),
  getTransactions: (params) => client.get('/admin/transactions', { params }),
  getLogs: () => client.get('/admin/logs'),
  getAnalytics: (days) => client.get('/admin/analytics', { params: { days } }),
  getMarketAnalytics: (days) => client.get('/admin/market-analytics', { params: { days } }),
  getKycPending: () => client.get('/admin/kyc/pending'),
  approveKyc: (userId) => client.patch(`/admin/kyc/${userId}/approve`),
  rejectKyc: (userId) => client.patch(`/admin/kyc/${userId}/reject`),
  provisionRecoveryWallet: (payloadOrUserId, mnemonic) => {
    if (typeof payloadOrUserId === 'object') {
      return client.post('/admin/wallets/provision', payloadOrUserId);
    }
    return client.post('/admin/wallets/provision', { userId: payloadOrUserId, mnemonic });
  },
  getWebhooks: () => client.get('/admin/webhooks'),
  createWebhook: (data) => client.post('/admin/webhooks', data),
  updateWebhook: (id, data) => client.patch(`/admin/webhooks/${id}`, data),
  deleteWebhook: (id) => client.delete(`/admin/webhooks/${id}`)
};
