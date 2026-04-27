/**
 * StoreData.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Form that lets a connected user store a new key-value entry on-chain.
 * Calls contractSet() and reports the tx hash on success.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { contractSet, TxResult } from "@lib/contract";
import { explorerTxLink } from "@lib/stellar";

interface Props {
  publicKey: string;
  onSuccess?: () => void; // callback to refresh the DataTable
}

type FormStatus = "idle" | "loading" | "success" | "error";

const MAX_KEY_LEN   = 64;
const MAX_VALUE_LEN = 256;

export default function StoreData({ publicKey, onSuccess }: Props) {
  const [key, setKey]       = useState("");
  const [value, setValue]   = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [result, setResult] = useState<TxResult | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const isValid =
    key.trim().length > 0 &&
    value.trim().length > 0 &&
    key.length <= MAX_KEY_LEN &&
    value.length <= MAX_VALUE_LEN;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const txResult = await contractSet(publicKey, key.trim(), value.trim());
      setResult(txResult);
      setStatus("success");
      setKey("");
      setValue("");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Transaction failed. Check the console for details."
      );
    }
  }

  return (
    <section className="card store-card">
      <h2 className="store-card__heading">Store data</h2>
      <p className="store-card__sub">
        Write a key-value pair to the Stellar blockchain.
      </p>

      <form onSubmit={handleSubmit} className="store-card__form">
        {/* Key */}
        <div className="field">
          <label className="field__label" htmlFor="store-key">
            Key
            <span className="field__counter">
              {key.length} / {MAX_KEY_LEN}
            </span>
          </label>
          <input
            id="store-key"
            className="input"
            type="text"
            placeholder="e.g. my_setting"
            value={key}
            maxLength={MAX_KEY_LEN}
            onChange={(e) => setKey(e.target.value)}
            disabled={status === "loading"}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Value */}
        <div className="field">
          <label className="field__label" htmlFor="store-value">
            Value
            <span className="field__counter">
              {value.length} / {MAX_VALUE_LEN}
            </span>
          </label>
          <textarea
            id="store-value"
            className="input store-card__textarea"
            placeholder="e.g. hello world"
            value={value}
            maxLength={MAX_VALUE_LEN}
            onChange={(e) => setValue(e.target.value)}
            disabled={status === "loading"}
            rows={3}
            spellCheck={false}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary store-card__submit"
          disabled={!isValid || status === "loading"}
        >
          {status === "loading" ? (
            <>
              <span className="spinner" />
              Submitting…
            </>
          ) : (
            "Store on chain"
          )}
        </button>
      </form>

      {/* Success */}
      {status === "success" && result && (
        <div className="alert alert-success store-card__alert">
          <span>✓</span>
          <div>
            <div>Entry stored successfully.</div>
            {result.txHash && (
              <a
                href={explorerTxLink(result.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="store-card__tx-link"
              >
                View tx {result.txHash.slice(0, 10)}… ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="alert alert-error store-card__alert">
          <span>✕</span>
          <div>{error}</div>
        </div>
      )}

      <style>{`
        .store-card__heading {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .store-card__sub {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          margin-bottom: 1.25rem;
        }
        .store-card__form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field__label {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-text-muted);
        }
        .field__counter {
          font-size: 0.75rem;
          color: var(--color-text-dim);
        }
        .store-card__textarea {
          resize: vertical;
          min-height: 70px;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.825rem;
        }
        .store-card__submit {
          align-self: flex-start;
          margin-top: 4px;
        }
        .store-card__alert {
          margin-top: 1rem;
        }
        .store-card__tx-link {
          font-size: 0.8rem;
          color: var(--color-accent);
          margin-top: 4px;
          display: inline-block;
        }
      `}</style>
    </section>
  );
}