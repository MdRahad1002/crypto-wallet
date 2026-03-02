import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, pricesAPI, walletAPI } from '../services/api';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../lib/supabaseClient';

const initialForm = {
  fullName: '',
  documentType: 'passport',
  documentNumber: '',
  idFrontFile: null,
  idBackFile: null,
  addressDocType: 'bank_statement',
  addressDocFile: null,
  otherDocFiles: []
};

const KYC_BUCKET = 'kyc-documents';

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function uploadFile(file, userId, fieldName) {
  if (!file) throw new Error(`No file provided for ${fieldName}`);
  if (!supabase) throw new Error('Storage not configured. Please contact support.');
  const ext = file.name.split('.').pop();
  const path = `${userId}/${fieldName}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Failed to upload ${fieldName}: ${error.message}`);
  const { data } = supabase.storage.from(KYC_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error(`Could not get public URL for ${fieldName}. Ensure the '${KYC_BUCKET}' Supabase bucket exists and is set to public.`);
  return data.publicUrl;
}

function FileUploadField({ label, hint, file, onChange, accept, required }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
        {hint && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.82rem' }}>{hint}</span>}
      </label>
      <label className={`kyc-upload-area${file ? ' has-file' : ''}`}>
        <input type="file" accept={accept || 'image/*,.pdf'} style={{ display: 'none' }} onChange={(e) => onChange(e.target.files?.[0] || null)} />
        {file
          ? <span>✓ {file.name}</span>
          : <span>Click to upload or drag &amp; drop</span>}
      </label>
    </div>
  );
}

const statusCopy = {
  NO_KYC: {
    title: 'Identity verification required',
    body: 'To protect your assets, wallet recovery is only possible after completing identity verification.'
  },
  KYC_SUBMITTED: {
    title: 'Documents submitted',
    body: 'Your documents have been received and are pending review.'
  },
  KYC_PROCESSING: {
    title: 'Verifying identity',
    body: 'Verification is in progress. Please wait.'
  },
  KYC_MORE_DOCS: {
    title: 'Additional documents required',
    body: 'Please review the admin request and submit the requested documents.'
  },
  KYC_APPROVED: {
    title: 'Identity verified successfully',
    body: 'Your identity verification is approved.'
  },
  KYC_REJECTED: {
    title: 'Verification failed',
    body: 'Your verification was rejected. Please review the admin notes and resubmit.'
  },
  SEED_READY: {
    title: 'Recovery seed available',
    body: 'Your recovery seed has been securely prepared. You may reveal it once.'
  },
  SEED_REVEALED: {
    title: 'Recovery seed available',
    body: 'Your recovery seed phrase is stored securely and can be revealed at any time.'
  }
};

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function RecoverWalletPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('NO_KYC');
  const [message, setMessage] = useState('');
  const [walletExists, setWalletExists] = useState(false);
  const [recoveryBalance, setRecoveryBalance] = useState(null);
  const [livePrices, setLivePrices] = useState(null);
  const livePricesRef = useRef(null); // ref so loadStatus doesn't need livePrices as a dep
  const shouldPollRef = useRef(true);  // set to false on 401 to stop polling after session expiry
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true); // hide UI until first loadStatus completes
  const [submitMessage, setSubmitMessage] = useState('');
  const [revealLoading, setRevealLoading] = useState(false);
  const [seedPayload, setSeedPayload] = useState(null);
  const [copied, setCopied] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const statusText = statusCopy[status] || statusCopy.NO_KYC;

  const needsBack = form.documentType === 'national_id' || form.documentType === 'drivers_license';
  const canSubmitKyc = !loading &&
    form.fullName.trim() &&
    form.documentNumber.trim() &&
    form.idFrontFile &&
    (!needsBack || form.idBackFile) &&
    form.addressDocFile;

  const showKycForm = status === 'NO_KYC' || status === 'KYC_MORE_DOCS' || status === 'KYC_REJECTED';
  const showSubmitted = status === 'KYC_SUBMITTED';
  const showProcessing = status === 'KYC_PROCESSING';
  const showApproved = status === 'KYC_APPROVED';
  const showRejected = status === 'KYC_REJECTED';
  const showSeedReady = status === 'SEED_READY';
  const showSeedRevealed = status === 'SEED_REVEALED';

  const loadStatus = useCallback(async () => {
    if (!shouldPollRef.current) return;

    // ── Step 1: fetch recovery status — this drives the UI view ──────────────
    // Keep status/wallet state completely isolated from the balance fetch so
    // a failing balance request can never wipe out a valid SEED_READY status.
    let statusValue = 'NO_KYC';
    let walletReady = false;
    try {
      const response = await walletAPI.getRecoveryStatus();
      statusValue = response.data?.status || 'NO_KYC';
      walletReady = Boolean(response.data?.walletExists);
      setStatus(statusValue);
      setMessage(response.data?.message || '');
      setWalletExists(walletReady);
    } catch (error) {
      // 401 means session expired — stop polling and let the auth interceptor handle logout
      if (error?.response?.status === 401) {
        shouldPollRef.current = false;
        return;
      }
      // 404 is expected when recovery wallet doesn't exist yet
      if (error?.response?.status !== 404) {
        console.error('Error loading recovery status:', error);
      }
      setStatus('NO_KYC');
      setWalletExists(false);
      setRecoveryBalance(null);
      return;
    }

    // ── Step 2: fetch balance (best-effort, never affects status) ────────────
    if (!walletReady) {
      setRecoveryBalance(null);
      return;
    }
    try {
      const walletRes = await walletAPI.getRecoveryWallet();
      const wallet = walletRes.data;
      if (wallet?.address && wallet?.network && !wallet.address.startsWith('custom:')) {
        const balanceRes = await walletAPI.getBalance(wallet.address, wallet.network);
        const amount = toNumber(
          balanceRes.data?.native?.balance
          ?? balanceRes.data?.balance
          ?? balanceRes.data?.totalBtc
        );
        const symbol = wallet.network === 'bitcoin' ? 'BTC' : wallet.network.toUpperCase();
        const prices = livePricesRef.current;
        const rate = symbol === 'BTC'
          ? prices?.bitcoin?.usd
          : symbol === 'ETH'
            ? prices?.ethereum?.usd
            : symbol === 'USDT'
              ? prices?.tether?.usd
              : null;
        const usd = typeof rate === 'number' && typeof amount === 'number' ? amount * rate : null;
        setRecoveryBalance({ amount, symbol, usd });
      }
    } catch (balanceErr) {
      // balance fetch failing is non-critical — do not change status or wallet state
      console.warn('Balance fetch failed (non-critical):', balanceErr?.message);
    }
  }, []); // stable — reads livePricesRef.current instead of livePrices state

  const loadPrices = useCallback(async () => {
    try {
      const response = await pricesAPI.getLivePrices();
      livePricesRef.current = response.data;
      setLivePrices(response.data);
    } catch (error) {
      setLivePrices(null);
    }
  }, []); // stable — no state dependencies

  useEffect(() => {
    const fetchNow = async () => {
      await loadPrices();
      await loadStatus();
      setInitializing(false);
    };

    fetchNow();

    const statusInterval = setInterval(loadStatus, 30000);
    const priceInterval = setInterval(loadPrices, 60000);

    return () => {
      shouldPollRef.current = false;
      clearInterval(statusInterval);
      clearInterval(priceInterval);
    };
  }, [loadPrices, loadStatus]);

  const onSubmitKyc = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSubmitMessage('');
    setUploadProgress('Preparing documents...');

    try {
      try { await authAPI.fetchCsrfToken(); } catch (_) { /* non-fatal */ }

      const userId = user?.id || user?._id || 'unknown';

      // Upload identity document front
      setUploadProgress('Uploading ID front...');
      const idFrontUrl = await uploadFile(form.idFrontFile, userId, 'id_front');

      // Upload identity document back (if required)
      let idBackUrl = null;
      if (needsBack && form.idBackFile) {
        setUploadProgress('Uploading ID back...');
        idBackUrl = await uploadFile(form.idBackFile, userId, 'id_back');
      }

      // Upload address document
      setUploadProgress('Uploading address document...');
      const addressDocUrl = await uploadFile(form.addressDocFile, userId, 'address_doc');

      // Upload optional other documents
      const otherDocUrls = [];
      for (let i = 0; i < form.otherDocFiles.length; i++) {
        setUploadProgress(`Uploading additional document ${i + 1}...`);
        const url = await uploadFile(form.otherDocFiles[i], userId, `other_doc_${i}`);
        if (url) otherDocUrls.push(url);
      }

      // Hash the front doc as legacy hash field
      const documentHash = form.idFrontFile ? await hashFile(form.idFrontFile) : '';

      setUploadProgress('Submitting...');
      await walletAPI.submitKyc({
        fullName: form.fullName,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        documentHash,
        idFrontUrl: idFrontUrl || '',
        idBackUrl: idBackUrl || '',
        addressDocType: form.addressDocType,
        addressDocUrl: addressDocUrl || '',
        otherDocUrls
      });

      setSubmitMessage('KYC submitted. Your documents are under review.');
      setForm(initialForm);
      await loadStatus();
    } catch (error) {
      setSubmitMessage(error?.response?.data?.message || error?.message || 'Unable to submit KYC.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const onRevealSeed = async () => {
    setRevealLoading(true);
    setSeedPayload(null);

    try {
      const response = await walletAPI.getSeed();
      setSeedPayload(response.data);
      await loadStatus();
    } catch (error) {
      setSubmitMessage(error?.response?.data?.message || 'Unable to reveal seed phrase.');
    } finally {
      setRevealLoading(false);
    }
  };

  const showSeedButton = showSeedReady || showSeedRevealed || (showApproved && walletExists);

  const navigate = useNavigate();

  return (
    <div className="rw-theme rw-page rw-recover">
      <div className="rw-recover-container">
        <button
          onClick={() => navigate('/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: 0 }}
        >
          &#8592; Back to Dashboard
        </button>
        <div className="rw-recover-header">
          <h1>Recover Wallet</h1>
          <p className="rw-muted">KYC approval is required before recovery credentials are released.</p>
        </div>

        {initializing ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            Loading…
          </div>
        ) : (<>
          {showKycForm && (
          <div className="rw-recover-box">
            <p><strong>{statusText.title}</strong></p>
            <p>{statusText.body}</p>
            <form onSubmit={onSubmitKyc} className="rw-recover-form">

              {/* ── Section 1: Identity Document ── */}
              <div style={{ margin: '1.5rem 0 0.5rem', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
                1. Identity Document
              </div>
              <div className="form-group">
                <label className="form-label">Full name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="As it appears on your document"
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Document type <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  className="form-input form-select"
                  value={form.documentType}
                  onChange={(e) => setForm((p) => ({ ...p, documentType: e.target.value, idBackFile: null }))}
                >
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="drivers_license">Driver&apos;s License</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Document number <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. AB123456"
                  value={form.documentNumber}
                  onChange={(e) => setForm((p) => ({ ...p, documentNumber: e.target.value }))}
                  required
                />
              </div>
              <FileUploadField
                label="Front of document"
                hint={form.documentType === 'passport' ? '(photo page)' : '(front side)'}
                file={form.idFrontFile}
                onChange={(f) => setForm((p) => ({ ...p, idFrontFile: f }))}
                required
              />
              {needsBack && (
                <FileUploadField
                  label="Back of document"
                  hint="(reverse side)"
                  file={form.idBackFile}
                  onChange={(f) => setForm((p) => ({ ...p, idBackFile: f }))}
                  required
                />
              )}

              {/* ── Section 2: Address Verification ── */}
              <div style={{ margin: '1.5rem 0 0.5rem', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
                2. Proof of Address
              </div>
              <div className="form-group">
                <label className="form-label">Document type <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  className="form-input form-select"
                  value={form.addressDocType}
                  onChange={(e) => setForm((p) => ({ ...p, addressDocType: e.target.value }))}
                >
                  <option value="bank_statement">Bank Statement</option>
                  <option value="utility_bill">Utility Bill</option>
                </select>
              </div>
              <FileUploadField
                label="Address document"
                hint="must show name and address, issued within last 3 months"
                file={form.addressDocFile}
                onChange={(f) => setForm((p) => ({ ...p, addressDocFile: f }))}
                required
              />

              {/* ── Section 3: Other Documents (optional) ── */}
              <div style={{ margin: '1.5rem 0 0.5rem', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
                3. Additional Documents <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem' }}>(optional)</span>
              </div>
              <div className="form-group">
                <label className="form-label">Upload any supporting documents</label>
                <label className="kyc-upload-area">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => setForm((p) => ({ ...p, otherDocFiles: Array.from(e.target.files || []) }))}
                  />
                  {form.otherDocFiles.length > 0
                    ? <span>✓ {form.otherDocFiles.length} file{form.otherDocFiles.length > 1 ? 's' : ''} selected</span>
                    : <span>Click to upload (multiple files allowed)</span>}
                </label>
              </div>

              {uploadProgress && (
                <div style={{ padding: '8px 12px', background: 'rgba(102,126,234,0.1)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {uploadProgress}
                </div>
              )}

              <button className="rw-btn rw-btn-primary" type="submit" disabled={!canSubmitKyc} style={{ marginTop: '1rem' }}>
                {loading ? 'Submitting...' : 'Submit for Verification'}
              </button>
              {submitMessage && <div className="rw-admin-message" style={{ marginTop: 12 }}>{submitMessage}</div>}
            </form>
          </div>
        )}

        {showSubmitted && (
          <div className="rw-recover-box">
            <p><strong>{statusText.title}</strong></p>
            <p>{statusText.body}</p>
          </div>
        )}

        {showProcessing && (
          <div className="rw-recover-loader">Verifying identity… please wait</div>
        )}

        {status === 'KYC_MORE_DOCS' && (
          <div className="rw-recover-warning">
            Additional documents required:<br /><br />
            <em>“{message || 'Please submit the requested documents.'}”</em>
          </div>
        )}

        {showRejected && (
          <div className="rw-recover-error">
            Verification failed. {message || 'Please upload another ID and resubmit.'}
          </div>
        )}

        {showApproved && (
          <div className="rw-recover-success">Identity verified successfully.</div>
        )}

        {showSeedButton && (
          <div className="rw-recover-box">
            <p><strong>Recovery seed available</strong></p>
            <p>Your recovery seed phrase is stored securely and can be revealed at any time. Make sure no one can see your screen before clicking Reveal.</p>
            <div style={{
              background: 'rgba(255, 170, 0, 0.1)',
              border: '1px solid rgba(255, 170, 0, 0.4)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: '0.87rem',
              color: '#ffc107',
              marginBottom: 14,
              lineHeight: 1.6
            }}>
              ⚠️ Make sure you are in a private location. Have pen and paper ready to write down the 12 words before clicking reveal.
            </div>
            {recoveryBalance && (
              <div className="rw-recover-frozen">
                Frozen balance: {typeof recoveryBalance.amount === 'number'
                  ? `${recoveryBalance.amount.toFixed(6)} ${recoveryBalance.symbol}`
                  : '—'}
                {typeof recoveryBalance.usd === 'number' && (
                  <span className="rw-recover-frozen-usd">({recoveryBalance.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})</span>
                )}
              </div>
            )}
            <button className="rw-btn rw-btn-primary" onClick={onRevealSeed} disabled={revealLoading}>
              {revealLoading ? 'Decrypting...' : seedPayload ? 'Refresh Seed' : 'Reveal Seed Phrase'}
            </button>
          </div>
        )}

        {revealLoading && (
          <div className="rw-recover-loader">
            <img src="/images/recovery-cyber.svg" alt="system processing" />
          </div>
        )}

        {showSeedRevealed && !seedPayload && (
          <div className="rw-recover-box">
            <p><strong>Recovery seed available</strong></p>
            <p>Your recovery seed phrase is stored securely. Click below to reveal it.</p>
          </div>
        )}

        {seedPayload && (
          <div className="rw-recover-seed">
            <div className="rw-recover-seed-warning">
              ⚠️ <strong>Save these 12 words immediately.</strong> Write them down on paper and store them offline in a safe location. This phrase <strong>will NOT be shown again</strong> — it is the only way to recover your wallet.
            </div>

            {/* Seed grid — always visible once revealed */}
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <div className="rw-recover-seed-grid">
                {seedPayload.mnemonic.trim().split(/\s+/).map((word, i) => (
                  <div key={i} className="rw-recover-seed-word">
                    <span className="rw-recover-seed-num">{i + 1}</span>
                    <span className="rw-recover-seed-word-text">{word}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Copy button */}
            <button
              className="rw-btn rw-btn-secondary"
              style={{ width: '100%' }}
              onClick={() => {
                navigator.clipboard.writeText(seedPayload.mnemonic).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }).catch(() => {});
              }}
            >
              {copied ? '✅ Copied!' : '📋 Copy All 12 Words'}
            </button>

            <div className="rw-recover-seed-tip">
              💡 Do not store this phrase in email, cloud storage, or screenshots. Write it on paper and keep it in a secure location like a safe.
            </div>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

export default RecoverWalletPage;
