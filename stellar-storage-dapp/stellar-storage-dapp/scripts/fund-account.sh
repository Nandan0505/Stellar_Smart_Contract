#!/usr/bin/env bash
# =============================================================================
# fund-account.sh
# Generate a new Stellar keypair (or use an existing one) and fund it
# using the Testnet Friendbot — gives you 10,000 XLM for free.
#
# Usage:
#   chmod +x scripts/fund-account.sh
#   ./scripts/fund-account.sh                    # generate a new keypair
#   ./scripts/fund-account.sh --key S...         # fund an existing secret key
#   ./scripts/fund-account.sh --public G...      # fund by public key only
#
# Output:
#   Writes DEPLOYER_SECRET and DEPLOYER_PUBLIC to .env in the project root.
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
echo "  ║   Stellar Testnet — Fund Account         ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# ── Parse arguments ──────────────────────────────────────────────────────────
SECRET_KEY=""
PUBLIC_KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key)       SECRET_KEY="$2"; shift 2 ;;
    --public)    PUBLIC_KEY="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--key S...] [--public G...]"
      echo ""
      echo "  --key S...     Fund using an existing secret key"
      echo "  --public G...  Fund using a public key (no secret saved)"
      echo ""
      echo "  If no flags are given, a brand new keypair is generated."
      exit 0
      ;;
    *) error "Unknown argument: $1" ;;
  esac
done

# ── Check dependencies ───────────────────────────────────────────────────────
info "Checking dependencies…"

if ! command -v stellar &>/dev/null; then
  error "stellar-cli not found.\nInstall with: cargo install --locked stellar-cli --features opt"
fi
success "stellar-cli $(stellar --version)"

if ! command -v curl &>/dev/null; then
  error "curl not found — required to call Friendbot"
fi
success "curl available"

# ── Generate or use keypair ───────────────────────────────────────────────────
if [[ -n "$PUBLIC_KEY" ]]; then
  # ── Mode: public key only (just fund, no secret) ─────────────────────────
  info "Using provided public key: $PUBLIC_KEY"

elif [[ -n "$SECRET_KEY" ]]; then
  # ── Mode: existing secret key ─────────────────────────────────────────────
  info "Deriving public key from provided secret key…"

  # Add key to stellar-cli keystore temporarily
  stellar keys add temp-deployer --secret-key "$SECRET_KEY" 2>/dev/null || true
  PUBLIC_KEY=$(stellar keys address temp-deployer 2>/dev/null)
  stellar keys remove temp-deployer 2>/dev/null || true

  if [[ -z "$PUBLIC_KEY" ]]; then
    error "Could not derive public key from secret. Is the secret key valid?"
  fi
  success "Public key: $PUBLIC_KEY"

else
  # ── Mode: generate a brand new keypair ────────────────────────────────────
  info "Generating a new Stellar keypair…"

  KEYPAIR_JSON=$(stellar keys generate --no-fund --network testnet deployer-new 2>/dev/null || \
                 stellar keys generate deployer-new 2>/dev/null || \
                 echo "")

  # stellar keys generate may output differently across CLI versions
  # Try to extract secret from the keystore instead
  PUBLIC_KEY=$(stellar keys address deployer-new 2>/dev/null || echo "")

  if [[ -z "$PUBLIC_KEY" ]]; then
    # Last resort: use stellar-cli's generate --show to get both keys
    RAW=$(stellar keys generate --show deployer-new 2>&1 || echo "")
    PUBLIC_KEY=$(echo "$RAW" | grep -oP 'G[A-Z0-9]{55}' | head -1)
    SECRET_KEY=$(echo  "$RAW" | grep -oP 'S[A-Z0-9]{55}' | head -1)
  else
    # Get secret from show command
    SECRET_KEY=$(stellar keys show deployer-new 2>/dev/null | grep -oP 'S[A-Z0-9]{55}' | head -1 || echo "")
  fi

  # Clean up temp key name
  stellar keys remove deployer-new 2>/dev/null || true

  if [[ -z "$PUBLIC_KEY" ]]; then
    error "Failed to generate keypair. Try: stellar keys generate mykey --network testnet"
  fi

  echo ""
  echo -e "  ${BOLD}New keypair generated:${RESET}"
  echo -e "  Public key  : ${GREEN}$PUBLIC_KEY${RESET}"
  if [[ -n "$SECRET_KEY" ]]; then
    echo -e "  Secret key  : ${YELLOW}$SECRET_KEY${RESET}"
    echo ""
    warn "KEEP YOUR SECRET KEY SAFE. Never commit it to git."
  fi
  echo ""
fi

# ── Fund via Friendbot ────────────────────────────────────────────────────────
FRIENDBOT_URL="https://friendbot.stellar.org/?addr=$PUBLIC_KEY"

info "Requesting Testnet XLM from Friendbot…"
info "URL: $FRIENDBOT_URL"

HTTP_STATUS=$(curl -s -o /tmp/friendbot_response.json -w "%{http_code}" "$FRIENDBOT_URL")
RESPONSE=$(cat /tmp/friendbot_response.json)

if [[ "$HTTP_STATUS" == "200" ]]; then
  TX_HASH=$(echo "$RESPONSE" | grep -oP '"hash"\s*:\s*"\K[^"]+' | head -1 || echo "")
  success "Account funded successfully!"
  if [[ -n "$TX_HASH" ]]; then
    success "Funding tx: https://stellar.expert/explorer/testnet/tx/$TX_HASH"
  fi
elif [[ "$HTTP_STATUS" == "400" ]]; then
  # 400 often means already funded — check the error
  ERROR_MSG=$(echo "$RESPONSE" | grep -oP '"detail"\s*:\s*"\K[^"]+' || echo "$RESPONSE")
  if echo "$ERROR_MSG" | grep -qi "already funded\|createAccountAlreadyExist"; then
    warn "Account is already funded — skipping Friendbot (this is fine)."
  else
    error "Friendbot returned 400:\n$ERROR_MSG"
  fi
else
  error "Friendbot request failed (HTTP $HTTP_STATUS):\n$RESPONSE"
fi

# ── Verify balance ────────────────────────────────────────────────────────────
info "Verifying balance on Testnet…"
sleep 3  # give ledger a moment to settle

HORIZON_URL="https://horizon-testnet.stellar.org/accounts/$PUBLIC_KEY"
BALANCE_RESP=$(curl -s "$HORIZON_URL")
BALANCE=$(echo "$BALANCE_RESP" | grep -oP '"balance"\s*:\s*"\K[\d.]+' | head -1 || echo "")

if [[ -n "$BALANCE" ]]; then
  success "Balance confirmed: ${BOLD}$BALANCE XLM${RESET}"
else
  warn "Could not confirm balance yet — it may take a few seconds to appear."
  info "Check manually: https://stellar.expert/explorer/testnet/account/$PUBLIC_KEY"
fi

# ── Write to .env ─────────────────────────────────────────────────────────────
if [[ -n "$SECRET_KEY" ]]; then
  info "Writing credentials to $ENV_FILE…"

  if [[ -f "$ENV_FILE" ]]; then
    # Update existing file
    if grep -q "^DEPLOYER_SECRET=" "$ENV_FILE"; then
      sed -i.bak "s|^DEPLOYER_SECRET=.*|DEPLOYER_SECRET=$SECRET_KEY|" "$ENV_FILE"
      rm -f "$ENV_FILE.bak"
    else
      echo "DEPLOYER_SECRET=$SECRET_KEY" >> "$ENV_FILE"
    fi

    if grep -q "^DEPLOYER_PUBLIC=" "$ENV_FILE"; then
      sed -i.bak "s|^DEPLOYER_PUBLIC=.*|DEPLOYER_PUBLIC=$PUBLIC_KEY|" "$ENV_FILE"
      rm -f "$ENV_FILE.bak"
    else
      echo "DEPLOYER_PUBLIC=$PUBLIC_KEY" >> "$ENV_FILE"
    fi
  else
    # Create .env from the example if it exists
    if [[ -f "$ROOT_DIR/.env.example" ]]; then
      cp "$ROOT_DIR/.env.example" "$ENV_FILE"
      sed -i.bak "s|^DEPLOYER_SECRET=.*|DEPLOYER_SECRET=$SECRET_KEY|" "$ENV_FILE"
      sed -i.bak "s|^DEPLOYER_PUBLIC=.*|DEPLOYER_PUBLIC=$PUBLIC_KEY|" "$ENV_FILE"
      rm -f "$ENV_FILE.bak"
    else
      cat > "$ENV_FILE" <<EOF
# Stellar Storage DApp — Environment Variables
# Generated by fund-account.sh — DO NOT COMMIT THIS FILE

DEPLOYER_SECRET=$SECRET_KEY
DEPLOYER_PUBLIC=$PUBLIC_KEY
STELLAR_NETWORK=testnet
CONTRACT_ID=
EOF
    fi
  fi

  success ".env updated"
else
  warn "No secret key available to save (public-key-only mode)."
  warn "Add DEPLOYER_SECRET manually to .env before running deploy.sh"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════════${RESET}"
echo -e "${GREEN}  Account ready!${RESET}"
echo -e "${BOLD}════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Network    : ${CYAN}Testnet${RESET}"
echo -e "  Public key : ${CYAN}$PUBLIC_KEY${RESET}"
echo -e "  Balance    : ${CYAN}${BALANCE:-see explorer} XLM${RESET}"
echo ""
echo -e "  Explorer:"
echo -e "  ${CYAN}https://stellar.expert/explorer/testnet/account/$PUBLIC_KEY${RESET}"
echo ""
echo -e "  Next step:"
echo -e "  ${BOLD}./scripts/deploy.sh${RESET}"
echo ""