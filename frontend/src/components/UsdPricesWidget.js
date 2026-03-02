import React from 'react';
import useUsdPrices from '../hooks/useUsdPrices';

export default function UsdPricesWidget() {
  const { prices, loading, error } = useUsdPrices();

  if (loading) return <div>Loading prices…</div>;
  if (error) return <div>{error}</div>;
  if (!prices) return null;

  return (
    <div className="card">
      <h3>Live Prices (USD)</h3>

      <div className="price-row">
        <span>BTC</span>
        <span>${prices.bitcoin?.usd?.toLocaleString()}</span>
        <span className={prices.bitcoin?.usd_24h_change >= 0 ? 'green' : 'red'}>
          {prices.bitcoin?.usd_24h_change?.toFixed(2)}%
        </span>
      </div>

      <div className="price-row">
        <span>ETH</span>
        <span>${prices.ethereum?.usd?.toLocaleString()}</span>
        <span className={prices.ethereum?.usd_24h_change >= 0 ? 'green' : 'red'}>
          {prices.ethereum?.usd_24h_change?.toFixed(2)}%
        </span>
      </div>

      <div className="price-row">
        <span>USDT</span>
        <span>${prices.tether?.usd?.toFixed(2)}</span>
      </div>
    </div>
  );
}
