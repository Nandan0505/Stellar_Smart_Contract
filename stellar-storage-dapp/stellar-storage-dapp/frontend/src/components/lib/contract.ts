/**
 * stellar.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Low-level Stellar / Soroban SDK setup.
 * Everything that talks directly to the network lives here.
 * Components should use contract.ts (higher-level helpers) instead.
 * ──────────────────────────────────────────────────────────────────────────
 */

import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";

// ─────────────────────────────────────────────
//  Network Configuration
// ─────────────────────────────────────────────

export type Network = "testnet" | "mainnet";

interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
  explorerUrl: string;
}

export const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  testnet: {
    rpcUrl:           "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    horizonUrl:       "https://horizon-testnet.stellar.org",
    explorerUrl:      "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    rpcUrl:           "https://mainnet.sorobanrpc.com",
    networkPassphrase: Networks.PUBLIC,
    horizonUrl:       "https://horizon.stellar.org",
    explorerUrl:      "https://stellar.expert/explorer/public",
  },
};

// ─────────────────────────────────────────────
//  Active Network (from .env, defaults to testnet)
// ─────────────────────────────────────────────

export const ACTIVE_NETWORK: Network =
  (import.meta.env.VITE_STELLAR_NETWORK as Network) ?? "testnet";

export const CONTRACT_ID: string =
  import.meta.env.VITE_CONTRACT_ID ?? "";

export const config = NETWORK_CONFIG[ACTIVE_NETWORK];

// ─────────────────────────────────────────────
//  Soroban RPC Client (singleton)
// ─────────────────────────────────────────────

let _server: SorobanRpc.Server | null = null;

export function getServer(): SorobanRpc.Server {
  if (!_server) {
    _server = new SorobanRpc.Server(config.rpcUrl, {
      allowHttp: false,
    });
  }
  return _server;
}

// ─────────────────────────────────────────────
//  Contract Instance
// ─────────────────────────────────────────────

export function getContract(): Contract {
  if (!CONTRACT_ID) {
    throw new Error(
      "VITE_CONTRACT_ID is not set. Add it to your .env file."
    );
  }
  return new Contract(CONTRACT_ID);
}

// ─────────────────────────────────────────────
//  Transaction Helpers
// ─────────────────────────────────────────────

/** Default transaction timeout: 5 minutes */
export const TX_TIMEOUT_LEDGERS = 75;

/** Default base fee in stroops (0.001 XLM = 100 stroops minimum) */
export const TX_FEE = BASE_FEE;

/**
 * Build a base TransactionBuilder for a given source account.
 * Fetches the latest account state from the RPC first.
 */
export async function buildTransactionBuilder(
  sourcePublicKey: string
): Promise<TransactionBuilder> {
  const server = getServer();
  const account = await server.getAccount(sourcePublicKey);

  return new TransactionBuilder(account, {
    fee: TX_FEE,
    networkPassphrase: config.networkPassphrase,
  });
}

/**
 * Simulate a transaction and return the simulated result.
 * Used to estimate fees and check if a call will succeed before submitting.
 */
export async function simulateTransaction(
  tx: ReturnType<TransactionBuilder["build"]>
): Promise<SorobanRpc.Api.SimulateTransactionResponse> {
  const server = getServer();
  return server.simulateTransaction(tx);
}

/**
 * Submit a signed transaction and poll until it is confirmed.
 * Returns the final transaction result.
 */
export async function submitAndConfirm(
  signedXdr: string
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  const server = getServer();

  const sendResponse = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase)
  );

  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Transaction rejected: ${JSON.stringify(sendResponse.errorResult)}`
    );
  }

  // Poll until the transaction is confirmed or times out
  const txHash = sendResponse.hash;
  const pollIntervalMs = 1500;
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollIntervalMs);
    const result = await server.getTransaction(txHash);

    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return result;
    }
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(result)}`);
    }
    // Status is NOT_FOUND — still pending, keep polling
  }

  throw new Error(`Transaction ${txHash} timed out after ${maxAttempts} polls`);
}

// ─────────────────────────────────────────────
//  ScVal Conversion Helpers
// ─────────────────────────────────────────────

/** Convert a JS string to a Soroban ScVal string */
export function toScString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

/** Convert a Soroban ScVal back to a JS string */
export function fromScString(scVal: xdr.ScVal): string {
  return scValToNative(scVal) as string;
}

/** Convert a public key string to a Soroban Address ScVal */
export function toScAddress(publicKey: string): xdr.ScVal {
  return new Address(publicKey).toScVal();
}

// ─────────────────────────────────────────────
//  Utility
// ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build a link to view a transaction on Stellar Expert */
export function explorerTxLink(txHash: string): string {
  return `${config.explorerUrl}/tx/${txHash}`;
}

/** Build a link to view a contract on Stellar Expert */
export function explorerContractLink(): string {
  return `${config.explorerUrl}/contract/${CONTRACT_ID}`;
}

/** Shorten a Stellar address for display: GABCD…WXYZ */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}