#!/bin/bash

# Top up ICP canister with cycles
# Usage: ./scripts/top-up-canister.sh <canister-id> <cycles-amount>

set -e

CANISTER_ID=${1:-"sp5ye-2qaaa-aaaao-qkqla-cai"}
CYCLES=${2:-"5000000000000"}  # Default: 5 trillion cycles

echo "🔄 Topping up canister: $CANISTER_ID"
echo "💰 Amount: $CYCLES cycles (~5T)"
echo ""

# Check if dfx is installed
if ! command -v dfx &> /dev/null; then
    echo "❌ dfx not found. Install with:"
    echo "sh -ci \"\$(curl -fsSL https://internetcomputer.org/install.sh)\""
    exit 1
fi

# Check dfx identity
echo "📋 Current identity:"
dfx identity whoami

echo ""
echo "⚠️  This will use your current dfx identity's cycles."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Topping up..."

# Suppress plaintext identity warning
export DFX_WARNING=-mainnet_plaintext_identity

# Top up the canister
dfx cycles top-up "$CANISTER_ID" "$CYCLES" --network ic

echo ""
echo "✅ Top-up complete!"
echo "🔍 Verify at: https://dashboard.internetcomputer.org/canister/$CANISTER_ID"
