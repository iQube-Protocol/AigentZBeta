# Referral System - Deployment Required

## Issue
API endpoints return 404 on production (dev-beta.aigentz.me) because new code hasn't been deployed yet.

## What's Ready Locally
1. Database migration: `/supabase/migrations/20260102_referral_system.sql`
2. API routes in `/apps/aigent-z/app/api/`:
   - referrals/validate, set, link
   - rewards/distribute
   - social/track
   - engagement/track
3. Updated services and frontend components

## Next Steps
1. Run database migration on production Supabase
2. Deploy aigent-z app to production
3. Verify API endpoints work on dev-beta.aigentz.me
4. Run E2E tests

## Environment Config Fixed
✅ Updated `/apps/theqriptopian-web/.env.local`:
- VITE_AIGENT_API_URL=https://dev-beta.aigentz.me

## Test After Deployment
```bash
curl -X POST https://dev-beta.aigentz.me/api/referrals/validate \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@knyt"}'
```
Should return JSON, not 404.
