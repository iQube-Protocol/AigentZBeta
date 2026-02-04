#!/bin/bash

echo "🧪 Verifying Network Ops APIs..."
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ Server not running on port 3000"
    echo "   Start with: npm run dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Test 1: Environment Variables
echo "1️⃣  Testing Environment Variables..."
ENV_CHECK=$(curl -s "http://localhost:3000/api/admin/debug/check-env")
HAS_PEM=$(echo "$ENV_CHECK" | grep -o '"hasDfxIdentityPem":[^,]*' | cut -d':' -f2)
PEM_LENGTH=$(echo "$ENV_CHECK" | grep -o '"dfxIdentityPemLength":[^,]*' | cut -d':' -f2)

if [ "$HAS_PEM" = "true" ]; then
    echo "   ✅ DFX_IDENTITY_PEM loaded (${PEM_LENGTH} characters)"
else
    echo "   ❌ DFX_IDENTITY_PEM not loaded"
    echo "   💡 Make sure it's in .env.local and you restarted the server"
fi
echo ""

# Test 2: ICP Cycles Check
echo "2️⃣  Testing ICP Cycles API..."
CYCLES_CHECK=$(curl -s "http://localhost:3000/api/admin/debug/check-canister-cycles?canisterId=sp5ye-2qaaa-aaaao-qkqla-cai")
CYCLES_VALUE=$(echo "$CYCLES_CHECK" | grep -o '"cycles":"[^"]*"' | cut -d'"' -f4)

if [[ "$CYCLES_VALUE" =~ ^[0-9]+\.[0-9]+T ]]; then
    echo "   ✅ DVN Cycles: $CYCLES_VALUE"
else
    echo "   ⚠️  DVN Cycles: $CYCLES_VALUE (not showing actual count)"
    if [ "$HAS_PEM" != "true" ]; then
        echo "   💡 Add DFX_IDENTITY_PEM to .env.local"
    fi
fi
echo ""

# Test 3: ETH Balance Check
echo "3️⃣  Testing ETH Balance API..."
ETH_CHECK=$(curl -s "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=11155111" 2>&1)

if echo "$ETH_CHECK" | grep -q '"humanEthBalance"'; then
    ETH_BALANCE=$(echo "$ETH_CHECK" | grep -o '"humanEthBalance":"[^"]*"' | cut -d'"' -f4)
    echo "   ✅ ETH Balance: $ETH_BALANCE"
elif echo "$ETH_CHECK" | grep -q "522"; then
    echo "   ❌ ETH RPC Error (522 - Bad Gateway)"
    echo "   💡 Primary RPC down, fallback not working. Check if server was restarted."
else
    ERROR_MSG=$(echo "$ETH_CHECK" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -c 80)
    echo "   ❌ ETH Error: $ERROR_MSG..."
fi
echo ""

# Test 4: BTC Testnet
echo "4️⃣  Testing BTC Testnet API..."
BTC_CHECK=$(curl -s "http://localhost:3000/api/ops/btc/testnet")
BTC_STATUS=$(echo "$BTC_CHECK" | grep -o '"ok":[^,]*' | cut -d':' -f2)

if [ "$BTC_STATUS" = "true" ]; then
    BLOCK_HEIGHT=$(echo "$BTC_CHECK" | grep -o '"blockHeight":[^,]*' | cut -d':' -f2)
    echo "   ✅ BTC Testnet: Block $BLOCK_HEIGHT"
else
    echo "   ⚠️  BTC Testnet: Check response"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$HAS_PEM" = "true" ] && [[ "$CYCLES_VALUE" =~ ^[0-9]+\.[0-9]+T ]]; then
    echo "🟢 ICP Cycles: WORKING"
else
    echo "🟡 ICP Cycles: Needs DFX_IDENTITY_PEM in .env.local + restart"
fi

if echo "$ETH_CHECK" | grep -q '"humanEthBalance"'; then
    echo "🟢 ETH Balance: WORKING"
else
    echo "🔴 ETH Balance: RPC issues (server needs restart for fallback)"
fi

echo ""
echo "Open dashboard at: http://localhost:3000/ops"
