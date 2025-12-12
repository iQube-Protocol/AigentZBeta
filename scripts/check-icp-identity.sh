#!/bin/bash

# Check ICP Identity Configuration
# This script verifies your ICP identity is properly set up for real cycles monitoring

echo "🔍 Checking ICP Identity Configuration..."
echo ""

# Check if dfx is installed
if ! command -v dfx &> /dev/null; then
    echo "❌ dfx not installed"
    echo "   Install: sh -ci \"\$(curl -fsSL https://internetcomputer.org/install.sh)\""
    exit 1
fi

echo "✅ dfx installed: $(dfx --version)"
echo ""

# Check current identity
CURRENT_IDENTITY=$(dfx identity whoami)
PRINCIPAL=$(dfx identity get-principal)

echo "📋 Current Identity: $CURRENT_IDENTITY"
echo "📋 Principal: $PRINCIPAL"
echo ""

# Check if identity has PEM file
IDENTITY_PATH="$HOME/.config/dfx/identity/$CURRENT_IDENTITY/identity.pem"
if [ -f "$IDENTITY_PATH" ]; then
    echo "✅ PEM file exists at: $IDENTITY_PATH"
    echo ""
    echo "📝 To use this in Next.js, add to .env.local:"
    echo ""
    echo "DFX_IDENTITY_PEM=\"\$(cat $IDENTITY_PATH)\""
    echo ""
    echo "Or run this command to append it:"
    echo ""
    echo "echo 'DFX_IDENTITY_PEM=\"'\$(cat $IDENTITY_PATH)'\"' >> .env.local"
else
    echo "⚠️  PEM file not found at: $IDENTITY_PATH"
fi
echo ""

# Check canister controllers
echo "🔐 Checking Canister Controllers..."
echo ""

export DFX_WARNING=-mainnet_plaintext_identity

echo "DVN Canister (sp5ye-2qaaa-aaaao-qkqla-cai):"
DVN_INFO=$(dfx canister info sp5ye-2qaaa-aaaao-qkqla-cai --network ic 2>&1)
if echo "$DVN_INFO" | grep -q "$PRINCIPAL"; then
    echo "  ✅ You are a controller"
else
    echo "  ❌ You are NOT a controller"
fi
echo "  Controllers: $(echo "$DVN_INFO" | grep "Controllers:" | sed 's/Controllers: //')"
echo ""

echo "RQH Canister (zdjf3-2qaaa-aaaas-qck4q-cai):"
RQH_INFO=$(dfx canister info zdjf3-2qaaa-aaaas-qck4q-cai --network ic 2>&1)
if echo "$RQH_INFO" | grep -q "$PRINCIPAL"; then
    echo "  ✅ You are a controller"
else
    echo "  ❌ You are NOT a controller"
fi
echo "  Controllers: $(echo "$RQH_INFO" | grep "Controllers:" | sed 's/Controllers: //')"
echo ""

# Check canister status (requires controller permissions)
echo "🔋 Checking Canister Cycles..."
echo ""

echo "DVN Canister:"
DVN_STATUS=$(dfx canister status sp5ye-2qaaa-aaaao-qkqla-cai --network ic 2>&1)
if echo "$DVN_STATUS" | grep -q "Balance:"; then
    BALANCE=$(echo "$DVN_STATUS" | grep "Balance:" | awk '{print $2, $3}')
    echo "  ✅ Cycles: $BALANCE"
else
    echo "  ❌ Cannot query cycles (not a controller or other error)"
fi
echo ""

echo "RQH Canister:"
RQH_STATUS=$(dfx canister status zdjf3-2qaaa-aaaas-qck4q-cai --network ic 2>&1)
if echo "$RQH_STATUS" | grep -q "Balance:"; then
    BALANCE=$(echo "$RQH_STATUS" | grep "Balance:" | awk '{print $2, $3}')
    echo "  ✅ Cycles: $BALANCE"
else
    echo "  ❌ Cannot query cycles (not a controller or other error)"
fi
echo ""

echo "✅ Configuration check complete!"
echo ""
echo "Next Steps:"
echo "1. Make sure DFX_IDENTITY_PEM is in .env.local (see command above)"
echo "2. Restart Next.js dev server: npm run dev"
echo "3. Check cycles API: curl http://localhost:3000/api/admin/debug/check-canister-cycles?canisterId=sp5ye-2qaaa-aaaao-qkqla-cai"
