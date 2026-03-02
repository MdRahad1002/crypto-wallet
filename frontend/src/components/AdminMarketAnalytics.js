import React, { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

export default function AdminMarketAnalytics() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setErr('');
        const res = await adminAPI.getMarketAnalytics(days);
        if (!mounted) return;
        setData(res.data);
      } catch (error) {
        if (!mounted) return;
        setErr('Failed to load analytics');
      }
    }

    load();
    return () => { mounted = false; };
  }, [days]);

  return (
    <div className="analytics-card">
      <h3>Market Analytics</h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn btn-secondary ${days === 7 ? 'active' : ''}`} onClick={() => setDays(7)}>
          7D
        </button>
        <button className={`btn btn-secondary ${days === 30 ? 'active' : ''}`} onClick={() => setDays(30)}>
          30D
        </button>
      </div>

      {err && <div className="error-message">{err}</div>}
      {!err && !data && <div>Loading…</div>}

      {data && (
        <>
          <div><b>Recovery Success:</b> {data.totals.success}</div>
          <div><b>Recovery Failed:</b> {data.totals.failed}</div>

          <div style={{ marginTop: 10 }}>
            <b>By network</b>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(data.totals.byNetwork, null, 2)}
            </pre>
          </div>

          <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
            Price snapshot: BTC ${data.pricesSnapshotUsd.bitcoin.usd.toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
