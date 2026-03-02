import React, { useEffect, useMemo, useState } from 'react';
import useUsdPrices from '../hooks/useUsdPrices';
import { walletAPI } from '../services/api';

export default function PortfolioUsdWidget() {
  const { prices, loading: pricesLoading, error: pricesError } = useUsdPrices(15000);
  const [balances, setBalances] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadBalances() {
      try {
        setLoading(true);
        setErr('');
        const res = await walletAPI.getAllBalances();
        if (!mounted) return;
        setBalances(res.data);
      } catch (error) {
        if (!mounted) return;
        setErr('Failed to load balances');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBalances();
    return () => { mounted = false; };
  }, []);

  const totalUsd = useMemo(() => {
    if (!prices || !balances) return null;

    const priceMap = {
      BTC: prices.bitcoin?.usd ?? 0,
      ETH: prices.ethereum?.usd ?? 0,
      USDT: prices.tether?.usd ?? 0
    };

    const total = Array.isArray(balances)
      ? balances.reduce((sum, wallet) => {
        const symbol = wallet?.native?.symbol?.toUpperCase();
        const amount = Number(wallet?.native?.balance || 0);
        const rate = symbol ? priceMap[symbol] : 0;
        return sum + amount * rate;
      }, 0)
      : 0;

    return total;
  }, [prices, balances]);

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Total Portfolio Value (USD)</h3>

      {(loading || pricesLoading) && <div>Loading…</div>}
      {(err || pricesError) && <div className="error-message">{err || pricesError}</div>}

      {!loading && !pricesLoading && !err && !pricesError && totalUsd != null && (
        <>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            ${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>

          <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
            Live prices auto-refresh every ~15 seconds.
          </div>
        </>
      )}
    </div>
  );
}
