# aigentMe wallet-persona self-heal + registry delegation awareness

**Date:** 2026-06-17
**Branch:** `claude/optimistic-davinci-exiykx`

## 1. aigentMe persona not appearing in the wallet switcher

The aigentMe wallet `personas` row is provisioned at designation time (create /
promote / genesis), but agents designated **before** that code shipped — or where
the provision soft-failed once — had no wallet persona, so they never showed in
the persona switcher even after the passport was claimed.

Fix — **self-healing reconciliation** (idempotent, best-effort):
- `GET /api/agents/aigentme` now ensures the wallet persona exists when the
  aigentMe is read, and returns it as `walletPersona`.
- `GET /api/persona/sponsored-agents` ensures it too — the high-traffic wallet /
  registry path — so opening the wallet self-heals the persona on its own fetch.
- `provisionAigentMePersona` now logs failures (`console.error`) instead of
  swallowing them, so any genuine insert failure is diagnosable in CloudWatch.

Result: an existing designated aigentMe now surfaces in the wallet switcher
(renameable, engage/act-as per B/B+) without re-designation.

## 2. Registry showed "Set up Delegation" for an already-delegated agent

`PassportRegistryTab` didn't read delegation state, so an agent that already held
the active delegation still showed "Set up Delegation". It now fetches the active
delegation (`GET /api/codex/chat/agentiq-os/delegation?persona_id=…`) and, when an
agent's `didUri`/`agentRootId` matches `agent_root_did`, renders an emerald
**"Delegation active"** affordance (linking to the Delegation tab to manage /
revoke) instead of "Set up Delegation".

## Files

- `app/api/agents/aigentme/route.ts` (GET reconcile + `walletPersona` in response)
- `app/api/persona/sponsored-agents/route.ts` (reconcile aigentMe persona)
- `services/agents/provisionAigentMePersona.ts` (log failures)
- `app/triad/components/codex/tabs/PassportRegistryTab.tsx` (delegation-aware row)
