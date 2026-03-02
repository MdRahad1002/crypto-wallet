import client from './client';

export const pricesAPI = {
  getLivePrices: () => client.get('/prices/live'),
  getHistory: (coinId, days) => client.get(`/prices/history/${coinId}`, { params: { days } })
};
