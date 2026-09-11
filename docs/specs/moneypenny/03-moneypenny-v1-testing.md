<!--
Imported verbatim from iQube-Protocol/moneypenny, path
`netlify-raindrop-demo/TESTING.md`. See 01-moneypenny-v1-setup.md's header
for full provenance context. Content below is UNMODIFIED from the source
repo.
-->

# MoneyPenny Trading Console - Testing Guide

Complete testing documentation for the MoneyPenny + Banking Profile system.

## Prerequisites

### Running Services

**MoneyPenny API Gateway** (Port 8787):
```bash
cd services/aa-api-gateway
npm run dev
```

**Banking Profile Service** (Port 8788):
```bash
cd services/banking-profile
python app.py
```

**Netlify Dev** (Port 8888):
```bash
# In project root
netlify dev
```

## Quick Test

Run the complete automated test suite:

```bash
cd services/aa-api-gateway
./test-scenarios.sh
```

This will test:
- Health checks
- Authentication
- Configuration endpoints
- Quotes with edge calculation
- Intent validation and submission
- Parameter setting
- Banking profile extraction
- HMAC webhooks
- Complete end-to-end flow

## Manual Testing Scenarios

### Scenario 1: Get Quotes & Calculate Edge

Test the improved quotes endpoint with edge opportunities.

```bash
# Small trade ($1000) - high gas impact
curl "http://localhost:8787/quotes?chain=ethereum&size_usd=1000" \
  -H "X-Api-Key: DEV_KEY_123" | jq

# Expected: floor_bps ~12+ due to gas costs

# Large trade ($10000) - lower gas impact
curl "http://localhost:8787/quotes?chain=ethereum&size_usd=10000" \
  -H "X-Api-Key: DEV_KEY_123" | jq

# Expected: floor_bps ~3-5, best_opportunity with edge_bps
```

**What to check:**
- ✓ Each quote has `total_cost_bps` and `floor_bps`
- ✓ `best_opportunity` shows arbitrage across venues
- ✓ Floor is higher for small sizes (gas dominates)

### Scenario 2: Submit Intent - Edge Too Low

Test the improved error messages showing cost breakdown.

```bash
curl -X POST "http://localhost:8787/propose_intent" \
  -H "X-Api-Key: DEV_KEY_123" \
  -H "Content-Type: application/json" \
  -d '{
    "intent_id":"'$(uuidgen)'",
    "tenant_id":"qripto-dev",
    "created_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "actor":{"type":"user","name":"MoneyPenny"},
    "kind":"PLACE_ORDER",
    "details":{
      "chain":"ethereum",
      "venue":"univ3",
      "symbol":"QCT/USDC",
      "side":"BUY",
      "size":{"notional":1000,"currency":"USDc"},
      "limits":{"max_slippage_bps":2,"min_edge_bps":1.0,"deadline_s":60},
      "reason":"Test: edge below floor"
    },
    "policy":{"risk_profile":"CANARY","requires_human_confirm":false},
    "meta":{"source":"MoneyPenny"}
  }' | jq
```

**Expected Response:**
```json
{
  "error": "edge_too_low",
  "floor_bps": 82.5,
  "fees_bps": 2.0,
  "gas_bps": 80.0
}
```

**What to check:**
- ✓ Clear breakdown of why intent failed
- ✓ floor_bps = fees_bps + gas_bps + 0.5
- ✓ User knows exactly what min_edge_bps to use

### Scenario 3: Submit Valid Intent

Fix the min_edge_bps and resubmit.

```bash
curl -X POST "http://localhost:8787/propose_intent" \
  -H "X-Api-Key: DEV_KEY_123" \
  -H "Content-Type: application/json" \
  -d '{
    "intent_id":"'$(uuidgen)'",
    "tenant_id":"qripto-dev",
    "created_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "actor":{"type":"user","name":"MoneyPenny"},
    "kind":"PLACE_ORDER",
    "details":{
      "chain":"arbitrum",
      "venue":"univ3",
      "symbol":"QCT/USDC",
      "side":"BUY",
      "size":{"notional":5000,"currency":"USDc"},
      "limits":{"max_slippage_bps":2,"min_edge_bps":15.0,"deadline_s":60},
      "reason":"Valid arbitrum order with sufficient edge"
    },
    "policy":{"risk_profile":"CANARY","requires_human_confirm":false},
    "meta":{"source":"MoneyPenny"}
  }' | jq
```

**Expected Response:**
```json
{
  "accepted": true,
  "requires_human_confirm": false,
  "policy_floor_bps": 2.65,
  "forwarded": false,
  "forward_status": null
}
```

### Scenario 4: Banking Profile Wizard

Test the complete profile flow.

**Step 1: Upload Statement**

```bash
# Create a test file
echo "Bank Statement Test Data" > test-statement.txt

# Upload and extract features
curl -F "tenant_id=qripto-dev" \
     -F "file=@test-statement.txt" \
     http://localhost:8788/bank/extract | jq
```

**Expected Response:**
```json
{
  "tenant_id": "qripto-dev",
  "raw_hash": "abc123...",
  "features": {
    "avg_daily_surplus": 125.50,
    "surplus_volatility": 45.20,
    "closing_balance": 5432.10,
    "cash_buffer_days": 43.2,
    "max_drawdown": 250.00
  },
  "proposed_overrides": {
    "max_notional_usd_day": 43.92,
    "daily_loss_limit_bps": 13.6,
    "inventory_band": 5.02,
    "min_edge_bps_baseline": 1.0
  },
  "consent": {...}
}
```

**Step 2: Apply Inventory Band**

```bash
# Extract the inventory_band value from previous response
INVENTORY_BAND=5.02

curl -X POST "http://localhost:8787/set_param" \
  -H "X-Api-Key: DEV_KEY_123" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "qripto-dev",
    "key": "inventory_band",
    "value": '$INVENTORY_BAND',
    "actor": "BankingProfileWizard"
  }' | jq
```

**Step 3: Verify Applied**

```bash
curl "http://localhost:8787/config" \
  -H "X-Api-Key: DEV_KEY_123" | jq
```

### Scenario 5: Complete End-to-End Flow

1. **Get market quotes**
2. **Upload bank statement** → get recommended limits
3. **Apply limits** to MoneyPenny
4. **Submit intent** with personalized limits
5. **Simulate webhook** from Aigent Z

```bash
# 1. Get quotes
QUOTES=$(curl -s -H "X-Api-Key: DEV_KEY_123" \
  "http://localhost:8787/quotes?chain=arbitrum&size_usd=3000")

echo "Quotes: $QUOTES" | jq .best_opportunity

# 2. Upload statement
echo "Mock Bank Data" > my-statement.txt
PROFILE=$(curl -s -F "tenant_id=qripto-dev" \
  -F "file=@my-statement.txt" \
  http://localhost:8788/bank/extract)

echo "Profile: $PROFILE" | jq .proposed_overrides

# 3. Apply inventory_band
BAND=$(echo $PROFILE | jq -r '.proposed_overrides.inventory_band')

curl -s -X POST -H "X-Api-Key: DEV_KEY_123" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\":\"qripto-dev\",
    \"key\":\"inventory_band\",
    \"value\":$BAND,
    \"actor\":\"E2ETest\"
  }" http://localhost:8787/set_param | jq

# 4. Submit intent
INTENT_ID=$(uuidgen)

curl -s -X POST -H "X-Api-Key: DEV_KEY_123" \
  -H "Content-Type: application/json" \
  -d "{
    \"intent_id\":\"$INTENT_ID\",
    \"tenant_id\":\"qripto-dev\",
    \"created_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"actor\":{\"type\":\"user\",\"name\":\"MoneyPenny\"},
    \"kind\":\"PLACE_ORDER\",
    \"details\":{
      \"chain\":\"arbitrum\",
      \"venue\":\"univ3\",
      \"symbol\":\"QCT/USDC\",
      \"side\":\"BUY\",
      \"size\":{\"notional\":3000,\"currency\":\"USDc\"},
      \"limits\":{\"max_slippage_bps\":2,\"min_edge_bps\":5.0,\"deadline_s\":60},
      \"reason\":\"E2E test order\"
    },
    \"policy\":{\"risk_profile\":\"CANARY\",\"requires_human_confirm\":false},
    \"meta\":{\"source\":\"MoneyPenny\"}
  }" http://localhost:8787/propose_intent | jq

# 5. Simulate webhook (HMAC-signed)
TS=$(date +%s)
BODY="{\"intent_id\":\"$INTENT_ID\",\"status\":\"ACCEPTED\"}"
SIG=$(echo -n "${TS}.${BODY}" | \
  openssl dgst -sha256 -hmac "CHANGE_ME_32B_SECRET" -binary | xxd -p -c 256)

curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" \
  http://localhost:8787/webhooks/aigentz | jq

# Cleanup
rm -f my-statement.txt
```

## UI Testing

### MoneyPenny Console

1. Open `http://localhost:8888/moneypenny`
2. API settings should be pre-filled:
   - Base URL: `http://localhost:8787`
   - API Key: `DEV_KEY_123`
3. Click **Get Quotes**
   - Should see DexScreener data with floor calculations
4. Submit an intent with `min_edge_bps` < floor
   - Should see detailed error with cost breakdown
5. Fix min_edge and resubmit
   - Should get 202 Accepted

### Banking Profile Wizard

1. Open `http://localhost:8888/wizard`
2. **Step 1**: Upload any text file, check consent
3. **Step 2**: Review extracted features (mock data)
   - avg_daily_surplus
   - surplus_volatility
   - cash_buffer_days
4. **Step 3**: Click "Apply Inventory Band"
   - Should call `/set_param` successfully

## Troubleshooting

### Common Issues

**MoneyPenny API returns 500:**
- Check `.env` has `RISK_POLICY_YAML` set
- Check database connection (or mock mode is working)

**Banking Profile returns connection error:**
- Ensure service is running on port 8788
- Check `USE_MOCK_ADE=true` in environment

**Wizard can't connect:**
- Check both services are running
- Check CORS is enabled
- Check browser console for errors

**HMAC webhook fails:**
- Ensure `WEBHOOK_HMAC_SECRET` matches
- Check timestamp tolerance (default 300s)
- Verify you're using raw body for signature

## Performance Testing

Test with various trade sizes to see gas impact:

```bash
for SIZE in 500 1000 5000 10000 50000; do
  echo "Testing size: \$${SIZE}"
  curl -s -H "X-Api-Key: DEV_KEY_123" \
    "http://localhost:8787/quotes?chain=ethereum&size_usd=$SIZE" | \
    jq -r ".quotes[0] | \"floor_bps: \(.floor_bps), gas_bps: \((.est_gas_usd / $SIZE) * 10000 | floor)\""
done
```

Expected: floor_bps decreases as size increases (gas is fixed cost).

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
test:
  steps:
    - name: Start services
      run: |
        npm run dev &
        python app.py &
        sleep 5

    - name: Run tests
      run: ./test-scenarios.sh
```

## Next Steps

- Add real PostgreSQL and test persistence
- Enable real ADE and test with actual PDFs
- Add RPC verification for near-floor edges
- Test with production API keys (Aigent Z)
- Add load testing with k6 or Apache Bench
