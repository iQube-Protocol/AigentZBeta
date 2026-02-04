# ⚠️ SERVER RESTART REQUIRED

## Current Status

Your environment check shows:
```json
{
  "hasDfxIdentityPem": false,        ← Not loaded!
  "rpcSepolia": "https://rpc2.sepolia.org"  ← Old RPC (causing 522 errors)
}
```

**The server is running with OLD configuration!**

All the fixes we made are in the code, but **Next.js only reads .env.local at startup**.

---

## 🔧 Fix Both Issues - Restart Server

### Quick Method (Recommended)

```bash
# Stop and restart in one command
./scripts/restart-dev-server.sh
```

This will:
1. Kill any existing process on port 3000
2. Start fresh with new environment variables
3. Load DFX_IDENTITY_PEM from .env.local
4. Use new RPC fallback logic

---

### Manual Method

**In your terminal running the dev server:**

1. Press `Ctrl+C` to stop the server
2. Wait for it to fully stop
3. Run: `npm run dev`
4. Wait for "Ready" message

---

## ✅ Verify After Restart

Run the verification script:
```bash
./scripts/verify-ops-apis.sh
```

This checks:
- ✅ DFX_IDENTITY_PEM loaded
- ✅ ICP Cycles showing real numbers
- ✅ ETH Balance working with fallback RPCs
- ✅ BTC Testnet operational

---

## 📋 What You'll See After Restart

### In Terminal Verification Script:
```
✅ DFX_IDENTITY_PEM loaded (227 characters)
✅ DVN Cycles: 5.01T cycles
✅ ETH Balance: 0.0234
✅ BTC Testnet: Block 4782785
```

### In Dashboard (http://localhost:3000/ops):

**Ops Gas Status Card:**
```
DVN 0    5.01T cycles ✓
RQH 0    5.98T cycles ✓

ETH 0    0.0234 ✓
```

**Instead of:**
```
DVN 0    Operational ✓
RQH 0    Operational ✓

ETH 0    N/A ⚠️
```

---

## 🔍 Troubleshooting

### If DFX_IDENTITY_PEM Still Not Loading

Check your `.env.local` format:

**✅ Correct:**
```bash
DFX_IDENTITY_PEM="-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIJP...entire key here...
-----END EC PRIVATE KEY-----"
```

**❌ Wrong:**
```bash
DFX_IDENTITY_PEM=-----BEGIN EC PRIVATE KEY-----  # Missing quotes
DFX_IDENTITY_PEM="path/to/file"  # Not the actual content
```

**Get the PEM:**
```bash
cat /Users/hal1/.config/dfx/identity/staging/identity.pem
```

**Auto-add to .env.local:**
```bash
# Only run if not already there!
echo 'DFX_IDENTITY_PEM="'$(cat /Users/hal1/.config/dfx/identity/staging/identity.pem)'"' >> .env.local
```

### If ETH Still Shows N/A

1. Check terminal logs for RPC errors
2. Verify fallback is being used:
   ```bash
   curl -s http://localhost:3000/api/admin/debug/check-env | grep rpc
   ```
3. Should see multiple RPC endpoints configured

### If Issues Persist

1. **Hard restart:**
   ```bash
   # Kill all Node processes (nuclear option)
   killall node
   npm run dev
   ```

2. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

---

## 🎯 Expected Timeline

1. **Stop server**: 2 seconds
2. **Start server**: 10-15 seconds
3. **First load**: May be slow, then fast
4. **Dashboard refresh**: Should show new values immediately

---

## 📞 Still Not Working?

Run diagnostic:
```bash
# Check environment
curl -s http://localhost:3000/api/admin/debug/check-env | jq .

# Check ICP cycles
curl -s http://localhost:3000/api/admin/debug/check-canister-cycles?canisterId=sp5ye-2qaaa-aaaao-qkqla-cai | jq .

# Check ETH balance  
curl -s http://localhost:3000/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=11155111 | jq .
```

Share the output if issues persist.

---

## 🚀 After Restart Checklist

- [ ] Server restarted successfully
- [ ] Ran `./scripts/verify-ops-apis.sh` - all green
- [ ] Dashboard shows actual cycles (5.01T, 5.98T)
- [ ] ETH shows balance (not N/A)
- [ ] BTC Testnet Latest TX field visible
- [ ] No more 522 errors in terminal

---

**Ready?** → `./scripts/restart-dev-server.sh` 🚀
