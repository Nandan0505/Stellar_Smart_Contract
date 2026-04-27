# ✦ Stellar Storage DApp

A decentralised key-value store built on the **Stellar blockchain** using **Soroban** smart contracts and a **React + TypeScript** frontend.

Users can connect their Freighter wallet and permanently store, retrieve, update, and delete arbitrary key-value data on-chain — no backend server, no database, no middlemen.

---

## 📸 Project Overview
| Layer | Technology | Purpose |
|---|---|---|
| Smart Contract | Rust + Soroban SDK | On-chain key-value storage |
| Frontend | React + TypeScript + Vite | User interface |
| Wallet | Freighter Browser Extension | Transaction signing |
| Network | Stellar Testnet / Mainnet | Blockchain infrastructure |

---

## ✨ Features

- **Store data** — Write any key-value pair permanently to the Stellar ledger
- **Retrieve data** — Read any entry by key (no wallet required)
- **Update data** — Overwrite your own entries (owner-only, signed transaction)
- **Delete data** — Remove your own entries from on-chain storage
- **List all keys** — Browse every entry currently stored in the contract
- **Wallet integration** — One-click connect via Freighter wallet
- **Owner enforcement** — Only the original creator can update or delete their entry
- **Testnet ready** — Free deployment with Friendbot-funded accounts
- **Explorer links** — Every transaction links directly to Stellar Expert

---

## 🗂 Project Structure
stellar-storage-dapp/
│
├── contracts/
│   └── storage/
│       ├── src/lib.rs              # Contract: set, get, update, delete, list
│       ├── Cargo.toml
│       └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── StoreData.tsx
│   │   │   ├── RetrieveData.tsx
│   │   │   └── DataTable.tsx
│   │   ├── lib/
│   │   │   ├── stellar.ts
│   │   │   └── contract.ts
│   │   ├── hooks/
│   │   │   └── useWallet.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
│
├── scripts/
│   ├── deploy.sh
│   └── fund-account.sh
│
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md

---

## ⚙️ Prerequisites

### 1. Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

### 2. Stellar CLI
```bash
cargo install --locked stellar-cli --features opt
```

### 3. Node.js
```bash
nvm install 20 && nvm use 20
```

### 4. Freighter Wallet
Install from [freighter.app](https://www.freighter.app) and switch to **Testnet**.

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/stellar-storage-dapp.git
cd stellar-storage-dapp

# 2. Environment
cp .env.example .env

# 3. Fund a testnet account
chmod +x scripts/fund-account.sh
./scripts/fund-account.sh

# 4. Deploy the contract
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# 5. Run the frontend
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🧪 Running Tests

```bash
cd contracts/storage
cargo test
```
---

## 📖 Smart Contract Reference

| Function | Type | Auth | Description |
|---|---|---|---|
| `set(owner, key, value)` | Write | Owner | Store a new key-value pair |
| `get(key)` | Read | None | Retrieve an entry by key |
| `update(owner, key, new_value)` | Write | Owner only | Overwrite an existing entry |
| `delete(owner, key)` | Write | Owner only | Remove an entry |
| `list_keys()` | Read | None | Return all stored keys |
| `has(key)` | Read | None | Check if a key exists |
| `count()` | Read | None | Total number of entries |

### Entry struct
```rust
pub struct Entry {
    pub key: String,       // max 64 chars
    pub value: String,     // max 256 chars
    pub owner: Address,    // Stellar public key of the creator
    pub timestamp: u64,    // ledger timestamp when stored
}
```

---

## 🌐 Network Endpoints

| | Testnet | Mainnet |
|---|---|---|
| Soroban RPC | `https://soroban-testnet.stellar.org` | `https://mainnet.sorobanrpc.com` |
| Horizon API | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| Explorer | `https://stellar.expert/explorer/testnet` | `https://stellar.expert/explorer/public` |
| Friendbot | `https://friendbot.stellar.org` | — |

---

## 🛠 Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Rust | >= 1.78 | Smart contract language |
| Soroban SDK | 21.0.0 | Stellar smart contract framework |
| stellar-cli | >= 21.0.0 | Contract build and deployment |
| React | 18.3.1 | Frontend UI library |
| TypeScript | 5.5.3 | Type-safe JavaScript |
| Vite | 5.4.1 | Frontend build tool |
| @stellar/stellar-sdk | 12.3.0 | Stellar JS SDK |
| @stellar/freighter-api | 2.0.0 | Freighter wallet integration |

---

## 🔗 Resources

- [Soroban Docs](https://developers.stellar.org/docs/smart-contracts)
- [Stellar Developer Docs](https://developers.stellar.org)
- [Freighter Wallet](https://www.freighter.app)
- [Stellar Expert Explorer](https://stellar.expert)
- [Soroban SDK Reference](https://docs.rs/soroban-sdk)

---

