# Critical Production Issues - December 26, 2025

## Issue 1: PayPal Authentication Fails in AWS Amplify (REVENUE BLOCKING)

**Error:** `401 invalid_client - Client Authentication failed`

**Environment:**
- Local dev: ✅ Works perfectly with same credentials
- AWS Amplify production: ❌ Fails with invalid_client

**Root Cause:** Environment variables not accessible to Next.js API routes at runtime in Amplify standalone mode

**Credentials:**
- Using LIVE PayPal credentials (not sandbox)
- `PAYPAL_MODE=live`
- Credentials verified working locally
- Set in Amplify Console environment variables

**What We've Tried (All Failed):**

1. Added PayPal env vars to `amplify.yml` build and runtime sections
2. Added explicit `env` config in `next.config.js` 
3. Created `.env.production` file during Amplify build
4. Copied `.env.production` to `.next/standalone/` directory
5. Added detailed error logging to diagnose the issue

**Current Status:** 
- Environment variables are set in Amplify Console
- `.env.production` is created during build with correct values
- API routes still cannot access these variables at runtime
- `process.env.PAYPAL_CLIENT_ID` returns undefined in Lambda

**Files Involved:**
- `/app/api/wallet/knyt/paypal/create-order/route.ts`
- `/services/wallet/knyt/paypalService.ts`
- `/amplify.yml`
- `/next.config.js`

---

## Issue 2: Base Q¢ Balance Not Showing in Wallet

**Error:** `CORS header 'Access-Control-Allow-Origin' missing`

**Environment:**
- Database: ✅ 50 Q¢ exists in `qc_balances` table
- API endpoint: ✅ Returns 200 with correct data
- Frontend: ❌ CORS error blocks the response

**Root Cause:** Missing CORS headers on `/api/wallet/base-qc/balance` endpoint

**What We've Tried:**

1. Created `qc_balances` table in Supabase
2. Granted retroactive 50 Q¢ signup bonus to existing personas
3. Created API endpoint `/api/wallet/base-qc/balance`
4. Added CORS headers to API endpoint
5. Updated wallet to fetch Base Q¢ balance

**Current Status:**
- Latest deployment includes CORS headers
- Waiting to verify if CORS fix resolved the issue
- If still failing, may be Amplify deployment issue

**Files Involved:**
- `/app/api/wallet/base-qc/balance/route.ts`
- `/apps/theqriptopian-web/src/components/navigation/drawers/WalletDrawer.tsx`
- `/scripts/migrations/create_qc_balances.sql`

---

## Issue 3: Ghostscript Not Installed (PDF Generation Failing)

**Error:** PDF thumbnail generation fails due to missing Ghostscript

**Impact:** Cannot generate thumbnails for PDF content

**Root Cause:** Ghostscript not installed in deployment environment

**What's Needed:**
- Install Ghostscript in AWS Amplify build environment
- Configure pdf-parse to use Ghostscript for rendering

**Files Involved:**
- `/app/api/content/pdf-page/[cid]/route.ts`

---

## Next Steps for External Help

**For PayPal Issue:**
1. How to make environment variables accessible to Next.js API routes in AWS Amplify standalone mode?
2. Alternative: Should we use AWS Secrets Manager instead of Amplify environment variables?
3. Is there a specific Amplify configuration for Next.js 14 standalone runtime env vars?

**For Base Q¢ Issue:**
1. Verify latest Amplify deployment includes CORS headers
2. Check if Amplify is stripping CORS headers from API responses

**For Ghostscript:**
1. How to install Ghostscript in AWS Amplify build environment?
2. Add to `amplify.yml` build commands?
