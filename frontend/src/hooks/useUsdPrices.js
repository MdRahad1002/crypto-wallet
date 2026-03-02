import { useEffect, useState } from 'react';
import { pricesAPI } from '../services/api';

export default function useUsdPrices(refreshMs = 15000) {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPrices = async () => {
    try {
      const res = await pricesAPI.getLivePrices();
      setPrices(res.data);
      setError(null);
    } catch (err) {
      setError('Failed to load prices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, refreshMs);
    return () => clearInterval(interval);
  }, [refreshMs]);

  return { prices, loading, error };
}
