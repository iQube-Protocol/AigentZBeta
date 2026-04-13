# create-mailjet-templates

Create all four KNYT Wheel email templates in the operator's Mailjet account via the REST API, then print the template IDs ready to paste into Amplify env vars.

## What this does

Runs `scripts/mailjet_create_templates.py` which:
1. Reads `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` from `.env.local`
2. Creates four templates (Top Shelf, Zero KNYT, Reactivation, General) with full responsive HTML and plain-text parts, populated with the campaign copy from `KNYT_CAMPAIGN_COPY_PACK.md`
3. Prints the Amplify env var names and template ID values to add

The script is idempotent — it skips creation of any template whose name already exists and reuses the existing ID.

## Usage

```
/create-mailjet-templates
```

No arguments needed. Run from the repo root.

## Steps to execute

1. Confirm `.env.local` has `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` set
2. Run the script:
   ```bash
   python3 scripts/mailjet_create_templates.py
   ```
3. Copy the printed env var values into Amplify → Environment variables:
   - `MAILJET_TEMPLATE_TOP_SHELF`
   - `MAILJET_TEMPLATE_ZERO_KNYT`
   - `MAILJET_TEMPLATE_REACTIVATION`
   - `MAILJET_TEMPLATE_GENERAL`
4. Trigger an Amplify redeploy (update `.amplify-deploy` and push)

## Template variables wired in each template

| Variable | Description |
|---|---|
| `{{var:first_name:"there"}}` | Recipient first name (fallback: "there") |
| `{{var:full_name}}` | Full name |
| `{{var:ks_url}}` | Personalised KS tracking URL |
| `{{var:cohort}}` | Campaign cohort (top_shelf / zero_knyt / etc.) |
| `{{var:investment_band}}` | Investment band (<500 / 500-1999 / etc.) |
| `{{var:sequence_id}}` | Sequence identifier |

## Related files

- `scripts/mailjet_create_templates.py` — the script
- `services/campaign/adapters/mailjetAdapter.ts` — the send adapter
- `app/api/crm/webhooks/mailjet/route.ts` — the event webhook
- `services/campaign/channelRegistry.ts` — registry entry: `email_mailjet`
- `codexes/packs/knyt/items/KNYT_CAMPAIGN_COPY_PACK.md` — source copy

## SkillQube manifest

`scripts/skills/create-mailjet-templates.skill.json`
