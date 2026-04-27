/**
 * useWallet.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Custom hook that manages Freighter wallet connection state.
 * Exposes: publicKey, isConnected, isLoading, error, connect, disconnect.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  isAllowed,
} from "@stellar/freighter-api";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type WalletStatus =
  | "idle"          // page just loaded, haven't checked yet
  | "checking"      // detecting Freighter
  | "not_installed" // Freighter extension not found
  | "disconnected"  // Freighter found but not connected
  | "connecting"    // user clicked Connect, waiting for approval
  | "connected"     // wallet connected, publicKey available
  | "error";        // something went wrong

export interface WalletState {
  status: WalletStatus;
  publicKey: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────

export function useWallet(): WalletState {
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Detect & auto-reconnect on mount ────────────────────────────────────
  const refresh = useCallback(async () => {
    setStatus("checking");
    setError(null);

    try {
      // Check if Freighter extension is installed
      const connected = await isConnected();

      if (!connected) {
        setStatus("not_installed");
        setPublicKey(null);
        return;
      }

      // Check if this site already has permission
      const allowed = await isAllowed();

      if (!allowed) {
        setStatus("disconnected");
        setPublicKey(null);
        return;
      }

      // Permission granted — fetch the current address
      const addressResult = await getAddress();

      // Handle both old string response and new object response from Freighter v2
      const address =
        typeof addressResult === "string"
          ? addressResult
          : (addressResult as { address: string }).address;

      if (address) {
        setPublicKey(address);
        setStatus("connected");
      } else {
        setStatus("disconnected");
        setPublicKey(null);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown wallet error");
      setPublicKey(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);

    try {
      // requestAccess prompts the user in the Freighter extension
      const accessResult = await requestAccess();

      const address =
        typeof accessResult === "string"
          ? accessResult
          : (accessResult as { address: string }).address;

      if (!address) {
        throw new Error("No address returned — user may have rejected the request.");
      }

      setPublicKey(address);
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      setPublicKey(null);
    }
  }, []);

  // ── Disconnect ───────────────────────────────────────────────────────────
  // Note: Freighter doesn't expose a programmatic disconnect.
  // We just clear local state — the user can revoke access in the extension.
  const disconnect = useCallback(() => {
    setPublicKey(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  return {
    status,
    publicKey,
    isConnected: status === "connected" && publicKey !== null,
    isLoading: status === "checking" || status === "connecting",
    error,
    connect,
    disconnect,
    refresh,
  };
}