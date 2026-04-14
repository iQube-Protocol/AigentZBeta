# setup-mailjet-webhooks

Register all required Mailjet event webhooks via the REST API — no manual
Mailjet dashboard configuration needed.

## What this does

Calls `POST /v3/REST/eventcallbackurl` (or `PUT` to update existing entries)
for each of the 6 event types: open, click, bounce, spam, unsub, blocked.

All events are routed to:
```
https://dev-beta.aigentz.me/api/crm/webhooks/mailjet?secret=<MAILJET_WEBHOOK_SECRET>
```

Idempotent — updates existing webhooks if already registered.

## Usage

```bash
MAILJET_API_KEY=... MAILJET_SECRET_KEY=... \
MAILJET_WEBHOOK_SECRET=... \
python3 scripts/mailjet_setup_webhooks.py
```

## Steps to execute

1. Confirm `MAILJET_WEBHOOK_SECRET` is set (must match what's in Amplify)
2. Run the script
3. All 6 event types will be registered/updated
4. Open a test email — within seconds Mailjet will POST open/click events
   to the webhook, advancing `campaign_state` in the DB

## Related files

- `scripts/mailjet_setup_webhooks.py` — the script
- `scripts/skills/setup-mailjet-webhooks.skill.json` — SkillQube manifest
- `app/api/crm/webhooks/mailjet/route.ts` — the receiving webhook handler
- `services/campaign/signalSteering.ts` — signal engine triggered by events
