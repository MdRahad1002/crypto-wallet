import React, { useState, useEffect } from 'react';
import { pricesAPI } from '../services/api';
import Icon from './Icon';

function CurrencyConverter() {
  const [amount, setAmount] = useState('1');
  const [fromCurrency, setFromCurrency] = useState('BTC');
  const [toCurrency, setToCurrency] = useState('USD');
  const [result, setResult] = useState(null);
  const [rates, setRates] = useState({});

  const currencies = ['BTC', 'ETH', 'USDT', 'USD'];

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      const response = await pricesAPI.getLivePrices();
      const cryptoRates = {
        BTC: response.data?.bitcoin?.usd,
        ETH: response.data?.ethereum?.usd,
        USDT: response.data?.tether?.usd
      };
      setRates(cryptoRates);
    } catch (error) {
      console.error('Error loading rates:', error);
    }
  };

  useEffect(() => {
    const performConversion = () => {
      if (!amount) return;

      const numericAmount = parseFloat(amount);
      if (Number.isNaN(numericAmount)) return;

      const fromRate = fromCurrency === 'USD' ? 1 : rates[fromCurrency];
      const toRate = toCurrency === 'USD' ? 1 : rates[toCurrency];

      if (!fromRate || !toRate) return;

      const converted = (numericAmount * fromRate) / toRate;
      setResult(converted.toFixed(6));
    };
    
    performConversion();
  }, [amount, fromCurrency, toCurrency, rates]);

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: '20px',
      padding: '1.5rem',
      border: '1px solid var(--border-color)',
      animation: 'fadeInUp 0.6s ease-out'
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '800',
        marginBottom: '1.5rem',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Icon name="repeat" size={20} /> Currency Converter
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <input
          type="number"
          className="form-input"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ padding: '0.75rem 1rem' }}
        />
        <select
          className="form-select"
          value={fromCurrency}
          onChange={(e) => setFromCurrency(e.target.value)}
          style={{ padding: '0.75rem 1rem' }}
        >
          {currencies.map(curr => (
            <option key={curr} value={curr}>{curr}</option>
          ))}
        </select>
      </div>

      <div style={{ textAlign: 'center', margin: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '1.25rem' }}>
        ⇅
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(96, 181, 255, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(96, 181, 255, 0.2)',
          color: 'var(--primary-blue)',
          fontWeight: '700',
          fontSize: '1.1rem',
          display: 'flex',
          alignItems: 'center'
        }}>
          {result || '0.000000'}
        </div>
        <select
          className="form-select"
          value={toCurrency}
          onChange={(e) => setToCurrency(e.target.value)}
          style={{ padding: '0.75rem 1rem' }}
        >
          {currencies.map(curr => (
            <option key={curr} value={curr}>{curr}</option>
          ))}
        </select>
      </div>

      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'rgba(96, 181, 255, 0.05)',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        textAlign: 'center'
      }}>
        Real-time conversion rates
      </div>
    </div>
  );
}

export default CurrencyConverter;
