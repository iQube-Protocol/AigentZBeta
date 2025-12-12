# ICP Cycles Monitoring Setup

## ✅ Your Current Status

You are **already a controller** on both canisters! 🎉

**Your Principal**: `le4c3-erfdl-t3jek-qbayb-hawea-ezs4s-5jhzs-h4das-7q6hp-ep6ji-7ae`

### Canister Controllers

**DVN Canister** (`sp5ye-2qaaa-aaaao-qkqla-cai`):
- Controllers: `k4osr-uo74m...` AND `le4c3-erfdl...` (you!) ✅
- Current Cycles: **5.00T cycles** (5,006,597,943,131)

**RQH Canister** (`zdjf3-2qaaa-aaaas-qck4q-cai`):
- Controllers: `le4c3-erfdl...` (you!) AND `ps5yq-saaaa...` ✅
- Current Cycles: **5.98T cycles** (5,982,731,880,718)

---

## 🔧 To See Live Cycles in Dashboard

### Step 1: Add PEM to .env.local

Your identity PEM is at: `/Users/hal1/.config/dfx/identity/staging/identity.pem`

**Option A - Manually Copy/Paste**:

1. Open `.env.local` in your editor
2. Add this line (copy the ENTIRE PEM file content):

```bash
DFX_IDENTITY_PEM="-----BEGIN EC PRIVATE KEY-----
...entire content here...
-----END EC PRIVATE KEY-----"
```

**Option B - Auto-append (if not already there)**:

```bash
echo 'DFX_IDENTITY_PEM="'$(cat /Users/hal1/.config/dfx/identity/staging/identity.pem)'"' >> .env.local
```

⚠️ **Important**: The PEM must be in quotes and include the full `BEGIN` and `END` markers!

### Step 2: Restart Next.js Dev Server

```bash
# Stop current server (Ctrl+C in terminal)
npm run dev
```

**Why restart?** Next.js only reads `.env.local` at startup.

### Step 3: Test the API

```bash
curl -s "http://localhost:3000/api/admin/debug/check-canister-cycles?canisterId=sp5ye-2qaaa-aaaao-qkqla-cai" | jq .
```

**Expected Output** (after restart with PEM):
```json
{
  "ok": true,
  "canisterId": "sp5ye-2qaaa-aaaao-qkqla-cai",
  "name": "DVN",
  "cycles": "5.01T cycles",
  "cyclesRaw": 5006597943131,
  "status": "good",
  "canisterStatus": "running",
  "memorySize": 837000,
  "lastChecked": "2025-11-18T23:00:00.000Z"
}
```

---

## 🎯 What You'll See in Dashboard

### Before (Current)
```
DVN: Operational ✓
RQH: Operational ✓
```

### After (With PEM)
```
DVN: 5.01T cycles ✓
RQH: 5.98T cycles ✓
```

Plus you'll see:
- **Exact cycles count** instead of "Operational"
- **Memory usage** for each canister
- **Canister status** (running/stopped/stopping)
- **Real-time monitoring** with auto-refresh

---

## 🛠️ Verification Script

I created a helper script: `./scripts/check-icp-identity.sh`

Run it anytime to verify:
```bash
./scripts/check-icp-identity.sh
```

This shows:
- ✅ Current identity and principal
- ✅ Whether you're a controller on each canister
- ✅ Current cycles balance (via dfx)
- 📝 Command to add PEM to .env.local

---

## 🔒 Security Notes

### Your Identity Type: `staging` (plaintext)

⚠️ This is a **development identity** stored in plaintext.

**What this means**:
- ✅ Fine for testnet/development
- ❌ **DO NOT** use for mainnet production
- ❌ **DO NOT** commit `.env.local` to git (already in .gitignore)

**For production**, create a secure identity:
```bash
dfx identity new production --storage-mode=password-protected
dfx identity use production
```

### What the PEM Can Do

With your PEM in the environment, the API can:
- ✅ Query canister cycles balance
- ✅ Query canister memory usage
- ✅ Query canister status (running/stopped)

It **CANNOT**:
- ❌ Deploy code
- ❌ Change settings
- ❌ Transfer cycles (that requires explicit commands)

---

## 📊 Cycles Status Thresholds

The dashboard uses these thresholds:

| Status | Cycles | Color | Action |
|--------|--------|-------|--------|
| **Good** | ≥ 2T | 🟢 Green | Normal operation |
| **Low** | 0.5T - 2T | 🟡 Amber | Top-up recommended |
| **Critical** | < 0.5T | 🔴 Red | Top-up urgently! |

**Current Status**:
- DVN: 5.01T → 🟢 **Good**
- RQH: 5.98T → 🟢 **Good**

---

## 🔄 Manual Cycles Check (Alternative)

If you don't want to add PEM to .env.local, you can always check cycles via dfx:

```bash
# Check DVN
dfx canister status sp5ye-2qaaa-aaaao-qkqla-cai --network ic

# Check RQH
dfx canister status zdjf3-2qaaa-aaaas-qck4q-cai --network ic
```

---

## 🎁 Bonus: BTC Testnet Card Fixed

Also fixed in this session:

✅ **Latest TX field** now always visible (matches other testnet cards)
- Shows Bitcoin transaction hash when available
- Shows "—" when no transactions yet
- Includes copy button and Blockstream link

---

## Next Steps

1. ✅ **You're a controller** - No action needed!
2. 📝 **Add PEM to .env.local** (see Step 1 above)
3. 🔄 **Restart dev server** (`npm run dev`)
4. 🎉 **See live cycles in dashboard!**

Run `./scripts/check-icp-identity.sh` anytime to verify your setup.
