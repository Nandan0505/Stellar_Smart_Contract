/**
 * App.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Root component. Wires together:
 *  - WalletConnect   (top bar)
 *  - StoreData       (write panel, only when wallet connected)
 *  - RetrieveData    (read panel, always visible)
 *  - DataTable       (all entries, always visible)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { useWallet } from "@hooks/useWallet";
import WalletConnect from "@components/WalletConnect";
import StoreData from "@components/StoreData";
import RetrieveData from "@components/RetrieveData";
import DataTable from "@components/DataTable";
import { CONTRACT_ID } from "@lib/stellar";

export default function App() {
  const wallet = useWallet();

  // Increment to tell DataTable to reload after a successful write
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="app-shell">
      {/* ── Top bar ── */}
      <WalletConnect wallet={wallet} />

      {/* ── Main layout ── */}
      <main className="app-main">

        {/* No contract ID configured */}
        {!CONTRACT_ID && (
          <div className="alert alert-info app-banner">
            <span>ℹ</span>
            <div>
              <strong>Contract not configured.</strong> Add{" "}
              <code>VITE_CONTRACT_ID</code> to your <code>.env</code> file after
              deploying the Soroban contract.
            </div>
          </div>
        )}

        {/* Top row: write + read side by side */}
        <div className="app-grid">
          {/* Store — requires wallet */}
          <div>
            {wallet.isConnected && wallet.publicKey ? (
              <StoreData
                publicKey={wallet.publicKey}
                onSuccess={triggerRefresh}
              />
            ) : (
              <div className="card app-connect-prompt">
                <p className="app-connect-prompt__icon">🔑</p>
                <h3>Connect your wallet to store data</h3>
                <p>
                  Install the{" "}
                  <a
                    href="https://www.freighter.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Freighter extension
                  </a>
                  , then click <strong>Connect Wallet</strong> above.
                </p>
                {wallet.error && (
                  <div className="alert alert-error" style={{ marginTop: "1rem" }}>
                    {wallet.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Retrieve — always available */}
          <RetrieveData />
        </div>

        {/* Full-width table */}
        <DataTable
          publicKey={wallet.publicKey}
          refreshTrigger={refreshKey}
        />
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <span>Stellar Storage DApp</span>
        <span className="app-footer__sep">·</span>
        <a
          href="https://developers.stellar.org/docs/smart-contracts"
          target="_blank"
          rel="noopener noreferrer"
        >
          Soroban docs ↗
        </a>
        <span className="app-footer__sep">·</span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </footer>

      <style>{`
        .app-shell {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .app-main {
          flex: 1;
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
          padding: 1.5rem 1.25rem 3rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .app-banner {
          font-size: 0.875rem;
        }
        .app-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        @media (max-width: 700px) {
          .app-grid { grid-template-columns: 1fr; }
        }
        .app-connect-prompt {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
          padding: 2.5rem 1.5rem;
          height: 100%;
        }
        .app-connect-prompt__icon {
          font-size: 2rem;
        }
        .app-connect-prompt h3 {
          font-size: 0.95rem;
          font-weight: 600;
        }
        .app-connect-prompt p {
          font-size: 0.825rem;
          color: var(--color-text-muted);
          line-height: 1.6;
        }
        .app-footer {
          text-align: center;
          padding: 1rem;
          font-size: 0.78rem;
          color: var(--color-text-dim);
          border-top: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .app-footer a { color: var(--color-text-muted); }
        .app-footer a:hover { color: var(--color-accent); }
        .app-footer__sep { color: var(--color-border-light); }
      `}</style>
    </div>
  );
}