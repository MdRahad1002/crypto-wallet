import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Icon from './Icon';

const QRScanner = ({ isOpen, onClose, onScan }) => {
  const [error, setError] = useState('');
  const [scanner, setScanner] = useState(null);

  useEffect(() => {
    if (isOpen) {
      // Initialize scanner
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      );

      const onScanSuccess = (decodedText) => {
        const trimmed = (decodedText || '').trim();
        // Accept any crypto address — ETH, BTC, LTC, etc.
        if (trimmed.length >= 10) {
          onScan(trimmed);
          html5QrcodeScanner.clear();
          onClose();
        } else {
          setError('Could not detect a valid wallet address. Please try again.');
        }
      };

      const onScanFailure = (error) => {
        // Ignore scan failures (too frequent)
        console.debug('QR scan error:', error);
      };

      html5QrcodeScanner.render(onScanSuccess, onScanFailure);
      setScanner(html5QrcodeScanner);

      return () => {
        if (html5QrcodeScanner) {
          html5QrcodeScanner.clear().catch(err => console.error('Error clearing scanner:', err));
        }
      };
    }
  }, [isOpen, onScan, onClose]);

  const handleClose = () => {
    if (scanner) {
      scanner.clear().catch(err => console.error('Error clearing scanner:', err));
    }
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Scan QR Code</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="qr-scanner-info">
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="qrCode" size={18} /> Position the QR code within the frame
            </p>
            <p>The scanner will automatically detect wallet addresses</p>
          </div>

          {error && (
            <div className="error-message">
              <span><Icon name="alertTriangle" size={18} /></span>
              <p>{error}</p>
            </div>
          )}

          <div id="qr-reader" className="qr-reader-container"></div>

          <div className="qr-scanner-tips">
            <h4>Tips for better scanning:</h4>
            <ul>
              <li>Ensure good lighting</li>
              <li>Hold steady and wait for focus</li>
              <li>Keep the QR code within the frame</li>
              <li>Try different distances if not working</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
