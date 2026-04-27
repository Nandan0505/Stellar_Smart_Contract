#!/usr/bin/env bash
# =============================================================================
# deploy.sh
# Compile the Soroban storage contract and deploy it to Stellar Testnet.
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# Prerequisites:
#   - Rust + cargo (https://rustup.rs)
#   - stellar-cli  (cargo install --locked stellar-cli --features opt)
#   - A funded Testnet account (run fund-account.sh first)
#   - DEPLOYER_SECRET set in .env  (your Stellar secret key S...)
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

# ── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   Stellar Storage Contract — Deploy      ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACT_DIR="$ROOT_DIR/contracts/storage"
WASM_PATH="$CONTRACT_DIR/target/wasm32-unknown-unknown/release/stellar_storage_contract.wasm"
ENV_FILE="$ROOT_DIR/.env"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"

# ── Load .env ────────────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  info "Loading environment from .env"
  # Export only lines that look like KEY=VALUE (skip comments and blanks)
  set -o allexport
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Z_]+=.+' "$ENV_FILE")
  set +o allexport
else
  warn ".env not found — will use environment variables directly"
fi

# ── Validate required env vars ───────────────────────────────────────────────
: "${DEPLOYER_SECRET:?DEPLOYER_SECRET is not set. Add it to .env (your Stellar secret key S...)}"

NETWORK="${STELLAR_NETWORK:-testnet}"
info "Target network: ${BOLD}$NETWORK${RESET}"

# ── Check dependencies ───────────────────────────────────────────────────────
info "Checking dependencies…"

if ! command -v cargo &>/dev/null; then
  error "cargo not found. Install Rust: https://rustup.rs"
fi
success "cargo $(cargo --version)"

if ! command -v stellar &>/dev/null; then
  error "stellar-cli not found. Install with:\n  cargo install --locked stellar-cli --features opt"
fi
success "stellar-cli $(stellar --version)"

if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
  info "Adding wasm32-unknown-unknown target…"
  rustup target add wasm32-unknown-unknown
fi
success "wasm32-unknown-unknown target available"

# ── Derive deployer public key ───────────────────────────────────────────────
info "Resolving deployer account…"
DEPLOYER_PUBLIC=$(stellar keys address --secret-key "$DEPLOYER_SECRET" 2>/dev/null || true)

if [[ -z "$DEPLOYER_PUBLIC" ]]; then
  # Fallback: use stellar-cli key management
  stellar keys add deployer --secret-key "$DEPLOYER_SECRET" --network "$NETWORK" 2>/dev/null || true
  DEPLOYER_PUBLIC=$(stellar keys address deployer 2>/dev/null)
fi

if [[ -z "$DEPLOYER_PUBLIC" ]]; then
  error "Could not resolve public key from DEPLOYER_SECRET"
fi

success "Deployer: $DEPLOYER_PUBLIC"

# ── Check account balance ────────────────────────────────────────────────────
info "Checking account balance on $NETWORK…"
BALANCE=$(stellar account balance \
  --account "$DEPLOYER_PUBLIC" \
  --network "$NETWORK" 2>/dev/null | grep -oP '\d+\.\d+' | head -1 || echo "0")

if [[ "$BALANCE" == "0" ]] || [[ -z "$BALANCE" ]]; then
  warn "Account balance is 0 or unreadable."
  warn "Run ./scripts/fund-account.sh first to get Testnet XLM."
  read -r -p "Continue anyway? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
else
  success "Balance: $BALANCE XLM"
fi

# ── Build the contract ───────────────────────────────────────────────────────
echo ""
info "Building contract (this may take a minute on first run)…"
cd "$CONTRACT_DIR"

stellar contract build 2>&1 | while IFS= read -r line; do
  echo "  $line"
done

if [[ ! -f "$WASM_PATH" ]]; then
  error "Build failed — WASM file not found at:\n  $WASM_PATH"
fi

WASM_SIZE=$(du -h "$WASM_PATH" | cut -f1)
success "Build complete — WASM size: $WASM_SIZE"
success "WASM: $WASM_PATH"

# ── Optimize the WASM (optional but recommended) ─────────────────────────────
if command -v wasm-opt &>/dev/null; then
  info "Optimizing WASM with wasm-opt…"
  OPTIMIZED_PATH="$CONTRACT_DIR/target/stellar_storage_contract.optimized.wasm"
  wasm-opt -Oz "$WASM_PATH" -o "$OPTIMIZED_PATH"
  WASM_PATH="$OPTIMIZED_PATH"
  OPT_SIZE=$(du -h "$WASM_PATH" | cut -f1)
  success "Optimized WASM size: $OPT_SIZE"
else
  warn "wasm-opt not found — skipping WASM optimization (install binaryen for smaller deployments)"
fi

# ── Deploy the contract ───────────────────────────────────────────────────────
echo ""
info "Deploying contract to $NETWORK…"

CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source-account "$DEPLOYER_SECRET" \
  --network "$NETWORK" \
  --fee 1000000 \
  2>&1)

# stellar contract deploy outputs the contract ID to stdout on success
# Validate it looks like a Stellar contract ID (56 chars, starts with C)
if [[ ! "$CONTRACT_ID" =~ ^C[A-Z0-9]{55}$ ]]; then
  error "Deployment failed or returned unexpected output:\n$CONTRACT_ID"
fi

success "Contract deployed!"
echo ""
echo -e "  ${BOLD}Contract ID:${RESET} ${GREEN}$CONTRACT_ID${RESET}"
echo ""

# ── Write contract ID to frontend .env ──────────────────────────────────────
info "Writing VITE_CONTRACT_ID to frontend/.env…"

if [[ -f "$FRONTEND_ENV" ]]; then
  # Update existing VITE_CONTRACT_ID line
  if grep -q "^VITE_CONTRACT_ID=" "$FRONTEND_ENV"; then
    sed -i.bak "s|^VITE_CONTRACT_ID=.*|VITE_CONTRACT_ID=$CONTRACT_ID|" "$FRONTEND_ENV"
    rm -f "$FRONTEND_ENV.bak"
  else
    echo "VITE_CONTRACT_ID=$CONTRACT_ID" >> "$FRONTEND_ENV"
  fi
else
  # Create frontend/.env from scratch
  cat > "$FRONTEND_ENV" <<EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_STELLAR_NETWORK=$NETWORK
EOF
fi

success "frontend/.env updated"

# ── Write contract ID back to root .env ──────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^CONTRACT_ID=" "$ENV_FILE"; then
    sed -i.bak "s|^CONTRACT_ID=.*|CONTRACT_ID=$CONTRACT_ID|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    echo "CONTRACT_ID=$CONTRACT_ID" >> "$ENV_FILE"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════════${RESET}"
echo -e "${GREEN}  Deployment complete!${RESET}"
echo -e "${BOLD}════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Network     : ${CYAN}$NETWORK${RESET}"
echo -e "  Contract ID : ${CYAN}$CONTRACT_ID${RESET}"
echo -e "  Deployer    : ${CYAN}$DEPLOYER_PUBLIC${RESET}"
echo ""
echo -e "  Explorer:"
echo -e "  ${CYAN}https://stellar.expert/explorer/$NETWORK/contract/$CONTRACT_ID${RESET}"
echo ""
echo -e "  Next steps:"
echo -e "  ${BOLD}cd frontend && npm install && npm run dev${RESET}"
echo ""