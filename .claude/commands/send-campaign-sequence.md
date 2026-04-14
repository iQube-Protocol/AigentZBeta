# send-campaign-sequence

Dispatch a KNYT Wheel campaign sequence to a cohort of investors via the
channel registry. This is the primary Marketa activation command.

## Usage

```
/send-campaign-sequence <sequenceId> <cohort> [channel]
```

| Argument | Required | Values |
|---|---|---|
| `sequenceId` | yes | `knyt_top_shelf_v1`, `knyt_zero_v1`, `knyt_reactivation_v1`, `knyt_general_v1` |
| `cohort` | yes | `top_shelf`, `zero_knyt`, `reactivation`, `general`, or `all` |
| `channel` | no | `email_mailjet` (default), `email_sendgrid`, `make_com` |

## What this does

1. Queries `nakamoto_knyt_personas` for all investors in the given cohort
   whose `campaign_state` is `unsent` or `sent` (not terminal: `backed`/`opted_out`)
2. Calls `POST /api/marketa/sequence/dispatch` with the recipient IDs
3. The dispatch route fetches full investor data, builds personalised payloads,
   and routes through the channel registry adapter
4. Returns count of dispatched + any errors

## Steps to execute

Run from the repo root:

```bash
python3 scripts/send_campaign_sequence.py \
  --sequence knyt_top_shelf_v1 \
  --cohort top_shelf \
  --channel email_mailjet \
  --app-url https://dev-beta.aigentz.me
```

Or dry-run to preview recipients without sending:
```bash
python3 scripts/send_campaign_sequence.py \
  --sequence knyt_top_shelf_v1 \
  --cohort top_shelf \
  --dry-run
```

## Marketa activation flow

Marketa invokes this skill as part of the campaign activation loop:
1. `reactivation-queue-build` → identify high-urgency investors
2. `send-campaign-sequence` → dispatch the appropriate sequence
3. `campaign-metrics-snapshot` → monitor results after 24h
4. Signal steering engine auto-advances `campaign_state` via webhooks

## Related files

- `scripts/send_campaign_sequence.py` — the script
- `scripts/skills/send-campaign-sequence.skill.json` — SkillQube manifest
- `app/api/marketa/sequence/dispatch/route.ts` — dispatch API
- `services/campaign/channelRegistry.ts` — channel routing
- `services/campaign/adapters/mailjetAdapter.ts` — email adapter
