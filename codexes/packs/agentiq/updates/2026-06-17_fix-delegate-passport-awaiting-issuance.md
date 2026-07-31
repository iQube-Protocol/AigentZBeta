# Fix: approved-but-unclaimed delegate passports showing "Awaiting issuance"

**Date:** 2026-06-17
**Surface:** Polity Passport — Registry tab "My Citizen Passport & Sponsored Delegates"
**Branch:** `claude/optimistic-davinci-exiykx`

## Symptom

Sponsored delegate (participant) passports showed **"Awaiting issuance"** in the
registry even though the steward queue was empty (everything approved). The
approval wasn't reflected on the agent cards.

## Root cause

`agent_root_identity.bound_passport_id` — the link the sponsored-agents view
reads to surface a delegate's passport — is only set when the passport is
**claimed** (in the credential claim route). At **issuance** the passport record
is written with `application_id` but neither `agent_card_url` nor a back-link to
the agent. So an approved-but-unclaimed passport left `bound_passport_id` null,
and `/api/persona/sponsored-agents` returned `passport: null` → the UI rendered
"Awaiting issuance."

## Fix (read-side, no write-path/issuance change)

`/api/persona/sponsored-agents` now resolves the passport for agents with a null
`bound_passport_id` via the application linkage:

```
agent_card_url → polity_passport_applications → application_id
              → polity_passport_records (most-recent issued)
```

The issued passport now surfaces with its real status, so the registry shows
**"Claim Passport"** (claimable) instead of "Awaiting issuance." Claim still
binds `bound_passport_id` as before; this only changes what the sponsor sees
between issuance and claim. Retroactive — no backfill needed.

## Files

- `app/api/persona/sponsored-agents/route.ts` — application-linkage passport
  resolution for unbound agents.
