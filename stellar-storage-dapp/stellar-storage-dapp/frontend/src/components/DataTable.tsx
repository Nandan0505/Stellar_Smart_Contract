
/**
 * DataTable.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Lists every key currently stored in the contract.
 * Connected wallet owners can update or delete their own entries inline.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react";
import {
  contractListKeys,
  contractGet,
  contractUpdate,
  contractDelete,
  Entry,
  TxResult,
} from "@lib/contract";
import { explorerTxLink, shortenAddress } from "@lib/stellar";

interface Props {
  publicKey: string | null;  // null = not connected (read-only mode)
  refreshTrigger?: number;   // increment this to trigger a refresh from parent
}

interface RowState {
  entry: Entry;
  isEditing: boolean;
  editValue: string;
  isUpdating: boolean;
  isDeleting: boolean;
  rowError: string | null;
  lastTx: TxResult | null;
}

type LoadStatus = "idle" | "loading" | "loaded" | "error";

export default function DataTable({ publicKey, refreshTrigger }: Props) {
  const [rows, setRows]         = useState<RowState[]>([]);
  const [loadStatus, setLoad]   = useState<LoadStatus>("idle");
  const [loadError, setLoadErr] = useState<string | null>(null);

  // ── Load all entries ─────────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    setLoad("loading");
    setLoadErr(null);

    try {
      const keys = await contractListKeys();

      if (keys.length === 0) {
        setRows([]);
        setLoad("loaded");
        return;
      }

      // Fetch all entries in parallel
      const entries = await Promise.all(
        keys.map((k) => contractGet(k).catch(() => null))
      );

      const rowStates: RowState[] = entries
        .filter((e): e is Entry => e !== null)
        .map((entry) => ({
          entry,
          isEditing: false,
          editValue: entry.value,
          isUpdating: false,
          isDeleting: false,
          rowError: null,
          lastTx: null,
        }));

      setRows(rowStates);
      setLoad("loaded");
    } catch (err) {
      setLoad("error");
      setLoadErr(err instanceof Error ? err.message : "Failed to load entries");
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries, refreshTrigger]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function setRowProp(key: string, props: Partial<RowState>) {
    setRows((prev) =>
      prev.map((r) => (r.entry.key === key ? { ...r, ...props } : r))
    );
  }

  function isOwner(entry: Entry): boolean {
    return !!publicKey && entry.owner === publicKey;
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async function handleUpdate(row: RowState) {
    if (!publicKey || !row.editValue.trim()) return;
    setRowProp(row.entry.key, { isUpdating: true, rowError: null });

    try {
      const tx = await contractUpdate(publicKey, row.entry.key, row.editValue.trim());
      setRowProp(row.entry.key, {
        isUpdating: false,
        isEditing: false,
        lastTx: tx,
        entry: { ...row.entry, value: row.editValue.trim() },
      });
    } catch (err) {
      setRowProp(row.entry.key, {
        isUpdating: false,
        rowError: err instanceof Error ? err.message : "Update failed",
      });
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(row: RowState) {
    if (!publicKey) return;
    if (!window.confirm(`Delete key "${row.entry.key}"? This cannot be undone.`)) return;

    setRowProp(row.entry.key, { isDeleting: true, rowError: null });

    try {
      await contractDelete(publicKey, row.entry.key);
      setRows((prev) => prev.filter((r) => r.entry.key !== row.entry.key));
    } catch (err) {
      setRowProp(row.entry.key, {
        isDeleting: false,
        rowError: err instanceof Error ? err.message : "Delete failed",
      });
    }
  }

  function formatTs(ts: number): string {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="card table-card">
      <div className="table-card__header">
        <div>
          <h2 className="table-card__heading">All stored entries</h2>
          <p className="table-card__sub">
            {loadStatus === "loaded"
              ? `${rows.length} entr${rows.length === 1 ? "y" : "ies"} on-chain`
              : "Reading from ledger…"}
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={loadEntries}
          disabled={loadStatus === "loading"}
        >
          {loadStatus === "loading" ? (
            <><span className="spinner" /> Refreshing</>
          ) : "↺ Refresh"}
        </button>
      </div>

      {/* Error */}
      {loadStatus === "error" && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          <span>✕</span> {loadError}
        </div>
      )}

      {/* Empty */}
      {loadStatus === "loaded" && rows.length === 0 && (
        <div className="table-card__empty">
          No entries stored yet. Use the form above to add one.
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Owner</th>
                <th>Stored at</th>
                {publicKey && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entry.key}>
                  {/* Key */}
                  <td>
                    <code className="table-key">{row.entry.key}</code>
                  </td>

                  {/* Value — editable if this row is in edit mode */}
                  <td>
                    {row.isEditing ? (
                      <textarea
                        className="input table-edit-input"
                        value={row.editValue}
                        maxLength={256}
                        rows={2}
                        onChange={(e) =>
                          setRowProp(row.entry.key, { editValue: e.target.value })
                        }
                      />
                    ) : (
                      <span className="table-value">{row.entry.value}</span>
                    )}
                  </td>

                  {/* Owner */}
                  <td>
                    <code
                      className={`table-owner ${isOwner(row.entry) ? "table-owner--mine" : ""}`}
                      title={row.entry.owner}
                    >
                      {shortenAddress(row.entry.owner, 5)}
                      {isOwner(row.entry) && " (you)"}
                    </code>
                  </td>

                  {/* Timestamp */}
                  <td className="table-ts">{formatTs(row.entry.timestamp)}</td>

                  {/* Actions (owner only) */}
                  {publicKey && (
                    <td className="table-actions">
                      {isOwner(row.entry) ? (
                        row.isEditing ? (
                          <>
                            <button
                              className="btn btn-accent btn-sm"
                              disabled={row.isUpdating}
                              onClick={() => handleUpdate(row)}
                            >
                              {row.isUpdating ? <span className="spinner" /> : "Save"}
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() =>
                                setRowProp(row.entry.key, {
                                  isEditing: false,
                                  editValue: row.entry.value,
                                })
                              }
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() =>
                                setRowProp(row.entry.key, { isEditing: true })
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={row.isDeleting}
                              onClick={() => handleDelete(row)}
                            >
                              {row.isDeleting ? <span className="spinner" /> : "Delete"}
                            </button>
                          </>
                        )
                      ) : (
                        <span className="table-no-action">—</span>
                      )}

                      {/* Per-row tx link */}
                      {row.lastTx?.txHash && (
                        <a
                          href={explorerTxLink(row.lastTx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="table-tx-link"
                          title="View transaction"
                        >
                          ↗ tx
                        </a>
                      )}

                      {/* Per-row error */}
                      {row.rowError && (
                        <span className="table-row-error" title={row.rowError}>
                          ✕ error
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .table-card__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        .table-card__heading {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .table-card__sub {
          font-size: 0.78rem;
          color: var(--color-text-muted);
        }
        .table-card__empty {
          text-align: center;
          padding: 2.5rem 1rem;
          color: var(--color-text-muted);
          font-size: 0.875rem;
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-md);
        }
        .table-wrap {
          overflow-x: auto;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.825rem;
        }
        .data-table th {
          text-align: left;
          padding: 9px 12px;
          background: var(--color-surface-2);
          color: var(--color-text-muted);
          font-weight: 500;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
        }
        .data-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--color-border);
          vertical-align: top;
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: var(--color-surface-2); }
        .table-key {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.8rem;
          color: var(--color-primary);
        }
        .table-value {
          color: var(--color-text);
          word-break: break-word;
          white-space: pre-wrap;
        }
        .table-owner {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.78rem;
          color: var(--color-text-muted);
        }
        .table-owner--mine { color: var(--color-accent); }
        .table-ts {
          color: var(--color-text-muted);
          white-space: nowrap;
          font-size: 0.78rem;
        }
        .table-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .btn-sm {
          padding: 0.35rem 0.75rem;
          font-size: 0.78rem;
        }
        .table-edit-input {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.8rem;
          min-width: 160px;
        }
        .table-no-action { color: var(--color-text-dim); }
        .table-tx-link {
          font-size: 0.75rem;
          color: var(--color-accent);
        }
        .table-row-error {
          font-size: 0.75rem;
          color: var(--color-error);
          cursor: help;
        }
      `}</style>
    </section>
  );
}