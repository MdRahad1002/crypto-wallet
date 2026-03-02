import client from './client';

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
