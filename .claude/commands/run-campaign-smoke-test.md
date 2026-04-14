# run-campaign-smoke-test

Run the KNYT Wheel end-to-end campaign smoke test. Verifies Mailjet templates,
DB schema, investor data, dispatch API, and webhook endpoint — then prints a
pass/fail summary. Safe to run at any time; the dispatch test sends one real
email unless --skip-dispatch is passed.

## What this checks

1. **Mailjet templates** — all 4 sequences have templates with HTML content
2. **DB schema** — `nakamoto_knyt_personas` has `campaign_cohort`, `campaign_state`, `investment_amount_band`
3. **Investors** — at least one investor with a valid email exists
4. **Dispatch API** — `POST /api/marketa/sequence/dispatch` returns 200 for a test send
5. **Webhook endpoint** — `/api/crm/webhooks/mailjet` is reachable (not 404/502)

## Usage

```bash
# Full test (sends one real email to the first investor on record)
MAILJET_API_KEY=... MAILJET_SECRET_KEY=... \
  MAILJET_TEMPLATE_TOP_SHELF=... MAILJET_TEMPLATE_ZERO_KNYT=... \
  MAILJET_TEMPLATE_REACTIVATION=... MAILJET_TEMPLATE_GENERAL=... \
  MAILJET_FROM_EMAIL=... \
  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  python3 scripts/campaign_smoke_test.py

# Verify only — skip live dispatch
python3 scripts/campaign_smoke_test.py --skip-dispatch

# Test against a specific investor
python3 scripts/campaign_smoke_test.py --investor-id <nakamoto_id>

# Point at a different environment
python3 scripts/campaign_smoke_test.py --app-url https://dev-beta.aigentz.me
```

## Exit codes

- `0` — all checks passed (or only warnings)
- `1` — one or more checks failed

## Steps to execute

1. Confirm env vars are set (Mailjet keys + Supabase keys)
2. Run the script as shown above
3. Review the summary — fix any FAIL items before first campaign send
4. If dispatch test passes, check Mailjet dashboard to confirm the test email was queued

## Related files

- `scripts/campaign_smoke_test.py` — the script
- `scripts/skills/run-campaign-smoke-test.skill.json` — SkillQube manifest
- `services/campaign/adapters/mailjetAdapter.ts` — adapter under test
- `app/api/marketa/sequence/dispatch/route.ts` — dispatch route under test
- `app/api/crm/webhooks/mailjet/route.ts` — webhook under test
