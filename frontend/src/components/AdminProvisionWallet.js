import React, { useMemo, useState } from "react";
import { adminAPI } from "../services/api";
import Icon from './Icon';

function normalizeMnemonic(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function countWords(mnemonic) {
  if (!mnemonic) return 0;
  return normalizeMnemonic(mnemonic).split(" ").filter(Boolean).length;
}

export default function AdminProvisionWallet() {
  const [userId, setUserId] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const normalizedMnemonic = useMemo(() => normalizeMnemonic(mnemonic), [mnemonic]);
  const words = useMemo(() => countWords(normalizedMnemonic), [normalizedMnemonic]);

  const canSubmit = userId.trim() && words === 12 && !loading;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!userId.trim()) {
      setError("User ID is required.");
      return;
    }
    if (words !== 12) {
      setError("Seed phrase must be exactly 12 words.");
      return;
    }

    try {
      setLoading(true);

      const res = await adminAPI.provisionRecoveryWallet({
        userId: userId.trim(),
        mnemonic: normalizedMnemonic
      });

      setResult({
        address: res.data.address || res.data.wallet?.address,
        mnemonic: normalizedMnemonic,
        warning: res.data.warning || "Write this seed phrase down and never share it."
      });

      setUserId("");
      setMnemonic("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to provision recovery wallet.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard.");
    } catch {
      alert("Copy failed (browser permission).");
    }
  };

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h2 style={{ marginTop: 0 }}>Provision Recovery Wallet (Admin)</h2>

      <div
        style={{
          background: "rgba(255, 214, 10, 0.12)",
          border: "1px solid rgba(255, 214, 10, 0.35)",
          borderRadius: 12,
          padding: "0.9rem",
          marginBottom: "1rem"
        }}
      >
        <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon name="alertTriangle" size={18} color="#FFD60A" /> Important
        </strong>
        <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
          Admin enters a <b>12-word BIP39 seed phrase</b>. The server will validate, encrypt it,
          derive a BTC address, and return the seed <b>only once</b> for the user to write down.
        </div>
      </div>

      {error && (
        <div
          className="error-message"
          style={{
            marginBottom: "1rem",
            padding: "0.9rem",
            borderRadius: 12,
            background: "rgba(255, 69, 58, 0.12)"
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label className="form-label">User ID</label>
          <input
            className="form-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="MongoDB userId (ObjectId)"
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            12-word Seed Phrase{" "}
            <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
              ({words}/12)
            </span>
          </label>
          <textarea
            className="form-input"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            placeholder="Enter the 12 words separated by spaces"
            rows={3}
            style={{ resize: "vertical" }}
          />
          <small style={{ color: "var(--text-secondary)" }}>
            Tip: Paste the phrase; extra spaces are auto-normalized.
          </small>
        </div>

        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
          {loading ? "Provisioning..." : "Create Recovery Wallet"}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: "1.25rem" }}>
          <div
            style={{
              background: "rgba(48, 209, 88, 0.12)",
              border: "1px solid rgba(48, 209, 88, 0.35)",
              borderRadius: 12,
              padding: "1rem",
              marginBottom: "1rem"
            }}
          >
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="checkCircle" size={18} color="#30D158" /> Wallet created
            </strong>
            <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
              {result.warning}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bitcoin Address</label>
            <div
              style={{
                background: "var(--dark-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: 10,
                padding: "0.75rem",
                fontFamily: "monospace",
                wordBreak: "break-all"
              }}
            >
              {result.address}
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => copy(result.address)}
            >
              <Icon name="copy" size={16} /> Copy Address
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Seed Phrase (show once)</label>
            <div
              style={{
                background: "var(--dark-bg)",
                border: "2px solid var(--danger)",
                borderRadius: 10,
                padding: "0.9rem",
                fontFamily: "monospace",
                wordBreak: "break-word"
              }}
            >
              {result.mnemonic}
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => copy(result.mnemonic)}
            >
              <Icon name="copy" size={16} /> Copy Seed
            </button>
          </div>

          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            After you leave this page, you should treat the seed as <b>not retrievable</b>.
          </div>
        </div>
      )}
    </div>
  );
}
