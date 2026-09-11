# Production Deployment Checklist

## ✅ Local Testing - PASSED

All agents can retrieve their keys successfully:
- ✅ aigent-z
- ✅ aigent-moneypenny  
- ✅ aigent-nakamoto
- ✅ aigent-kn0w1

## ⚠️ Production Issue: "Agent private key not found"

### Root Cause
One of two issues:

1. **Amplify hasn't deployed latest code** (most likely)
2. **Environment variables missing in Amplify**

---

## 🔍 Debugging Steps

### Step 1: Check Amplify Deployment Status

1. Go to **AWS Amplify Console**
2. Check if the latest commit is deployed: `ccc1273`
3. Look for build logs showing the deployment

**Latest commits that need to be deployed:**
- `ccc1273` - Debug logging added
- `ac05a67` - Missing agent keys added
- `7140113` - Fixed Supabase client
- `fa0b820` - Environment variable handling

### Step 2: Check Amplify Logs

Once deployed, check the **CloudWatch logs** or **Amplify logs** for:

```
[AgentKeyService] Initializing with env vars
[Transfer] Retrieving keys for agent: aigent-xxx
```

This will show you:
- ✅ If environment variables are set
- ✅ If keys are being retrieved
- ❌ Where exactly it's failing

### Step 3: Verify Environment Variables in Amplify

**Required variables:**
```
SUPABASE_URL = https://bsjhfvctmduxhohtllly.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
AGENT_KEY_ENCRYPTION_SECRET = <REDACTED-2026-07-30-treat-as-compromised-rotate-before-use>
```

**How to check:**
1. AWS Amplify Console → Your App
2. App settings → Environment variables
3. Verify all 3 variables are present

---

## 🎯 Expected Behavior After Fix

### Before (Current Error)
```
❌ Agent private key not found
```

### After (With Logging)
You should see in logs:
```
[AgentKeyService] Initializing with env vars: {
  SUPABASE_URL: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
  AGENT_KEY_ENCRYPTION_SECRET: true
}
[AgentKeyService] Initialized successfully
[Transfer] Retrieving keys for agent: aigent-z
[Transfer] Keys retrieved: { keysFound: true, hasEvmKey: true }
[Transfer] Using private key for address: 0x0e3a...
```

### After (Success)
```
✅ Transaction sent successfully! Hash: 0x1234...
```

---

## 📊 What We've Done

1. ✅ Added all agent keys to Supabase (encrypted)
2. ✅ Fixed environment variable handling
3. ✅ Added detailed debug logging
4. ✅ Tested locally - all agents work
5. ✅ Pushed to GitHub (dev branch)
6. ⏳ **Waiting for Amplify to deploy**

---

## 🚀 Next Steps

1. **Wait for Amplify deployment** to complete
2. **Check logs** for the debug output
3. **Try transfer again** - should work now
4. If still failing, **check environment variables** in Amplify console

---

## 📞 If Still Failing

Share the Amplify logs showing:
- `[AgentKeyService]` initialization
- `[Transfer]` key retrieval attempt
- Any error messages

This will tell us exactly what's wrong.
