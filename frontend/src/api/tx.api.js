import client from './client';

export const transactionAPI = {
  getHistory: (params) => client.get('/transactions/history', { params }),
  getBlockchainHistory: (address, network) => client.get(`/transactions/blockchain/${address}`, { params: { network } }),
  send: (data) => client.post('/transactions/send', data),
  sendBatch: (data) => client.post('/transactions/send-batch', data),
  deposit: (data) => client.post('/transactions/deposit', data),
  withdraw: (data) => client.post('/transactions/withdraw', data),
  getById: (id) => client.get(`/transactions/${id}`),
  estimateGas: (data) => client.post('/transactions/estimate-gas', data)
};
