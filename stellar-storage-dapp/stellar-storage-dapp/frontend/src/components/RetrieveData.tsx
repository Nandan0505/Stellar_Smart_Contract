/**
 * RetrieveData.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Form that lets any user look up a stored entry by key.
 * Read-only — no wallet needed, no transaction fee.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { contractGet, Entry } from "@lib/contract";
import { shortenAddress } from "@lib/stellar";

type QueryStatus = "idle" | "loading" | "found" | "not_found" | "error";

export default function RetrieveData() {
  const [key, setKey]       = useState("");
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [entry, setEntry]   = useState<Entry | null>(null);
  const [error, setError]   = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;

    setStatus("loading");
    setEntry(null);
    setError(null);

    try {
      const result = await contractGet(key.trim());
      setEntry(result);
      setStatus("found");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("KeyNotFound") || msg.includes("1")) {
        setStatus("not_found");
      } else {
        setStatus("error");
        setError(msg);
      }
    }
  }

  function handleClear() {
    setKey("");
    setStatus("idle");
    setEntry(null);
    setError(null);
  }

  // Format unix timestamp (seconds) to readable date
  function formatTs(ts: number): string {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <section className="card retrieve-card">
      <h2 className="retrieve-card__heading">Retrieve data</h2>
      <p className="retrieve-card__sub">
        Look up any stored entry by key. No wallet required.
      </p>

      <form onSubmit={handleLookup} className="retrieve-card__form">
        <input
          className="input"
          type="text"
          placeholder="Enter a key…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={status === "loading"}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="retrieve-card__btn-row">
          <button
            type="submit"
            className="btn btn-accent"
            disabled={!key.trim() || status === "loading"}
          >
            {status === "loading" ? (
              <>
                <span className="spinner" />
                Looking up…
              </>
            ) : (
              "Look up"
            )}
          </button>
          {status !== "idle" && (
            <button type="button" className="btn btn-outline" onClick={handleClear}>
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Found */}
      {status === "found" && entry && (
        <div className="retrieve-card__result">
          <div className="result-row">
            <span className="result-label">Key</span>
            <code className="result-value">{entry.key}</code>
          </div>
          <div className="result-row result-row--value">
            <span className="result-label">Value</span>
            <pre className="result-value result-value--pre">{entry.value}</pre>
          </div>
          <div className="result-row">
            <span className="result-label">Owner</span>
            <code className="result-value" title={entry.owner}>
              {shortenAddress(entry.owner, 8)}
            </code>
          </div>
          <div className="result-row">
            <span className="result-label">Stored at</span>
            <span className="result-value">{formatTs(entry.timestamp)}</span>
          </div>
        </div>
      )}

      {/* Not found */}
      {status === "not_found" && (
        <div className="alert alert-info retrieve-card__alert">
          <span>ℹ</span>
          <span>No entry found for key <code>"{key}"</code>.</span>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="alert alert-error retrieve-card__alert">
          <span>✕</span>
          <span>{error}</span>
        </div>
      )}

      <style>{`
        .retrieve-card__heading {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .retrieve-card__sub {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          margin-bottom: 1.25rem;
        }
        .retrieve-card__form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .retrieve-card__btn-row {
          display: flex;
          gap: 8px;
        }
        .retrieve-card__result {
          margin-top: 1.25rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .result-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--color-border);
          font-size: 0.85rem;
        }
        .result-row:last-child { border-bottom: none; }
        .result-label {
          flex-shrink: 0;
          width: 72px;
          color: var(--color-text-muted);
          font-weight: 500;
          padding-top: 1px;
        }
        .result-value {
          color: var(--color-text);
          word-break: break-all;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.8rem;
        }
        .result-value--pre {
          white-space: pre-wrap;
          background: var(--color-surface-2);
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          width: 100%;
        }
        .retrieve-card__alert {
          margin-top: 1rem;
        }
      `}</style>
    </section>
  );
}