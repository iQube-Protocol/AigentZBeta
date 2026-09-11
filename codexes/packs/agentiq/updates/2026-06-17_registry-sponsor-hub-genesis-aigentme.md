# Registry sponsor hub + genesis-time aigentMe designation

**Date:** 2026-06-17
**Surface:** Polity Passport — Registry tab + Apply (agent setup) tab
**Branch:** `claude/optimistic-davinci-exiykx`

## What changed

Builds on the `is_aigent_me` designation (`20260617000000_aigent_me_designation.sql`).

### 1. Registry tab — citizen passport shown with sponsored delegates (`PassportRegistryTab.tsx`)

The "My Sponsored Agents" section is now **"My Citizen Passport & Sponsored
Delegates"**:

- The citizen's **own Citizen Passport** renders as a header card (grade, claim
  state, passport id) — the sponsoring credential, shown together with the
  delegates it sponsored. Surfaces whenever the user has a citizen passport or
  any sponsored delegate.
- **Sponsorship capacity** is shown inline (`used of total`, remaining /
  exhausted) from the sponsored-agents response.
- The aigentMe delegate carries an amber **★ aigentMe** badge.
- On any non-aigentMe delegate, when the user has **no aigentMe yet**, an
  **"Assign as my aigentMe"** button promotes that delegate (and its bound
  passport) into the aigentMe role via `PATCH /api/agents/aigentme`.

### 2. Apply tab — designate the generated agent as aigentMe (`PassportBureauApplyTab.tsx`)

In the agent setup step, the generate paths (quick + genesis) now show a
**"This is my aigentMe"** checkbox. When checked, the generated agent card — and
the participant passport it earns — become the citizen's aigentMe, mapped to
their persona, citizen passport, and wallet via the `is_aigent_me` flag. The
checkbox disables with a note when an aigentMe already exists (one per persona).

## Why no new mapping plumbing

Agent ↔ persona ↔ citizen passport ↔ participant passport ↔ wallet are already
wired through `agent_root_identity.sponsor_persona_id` and `bound_passport_id`.
Designating an agent as aigentMe is just setting `is_aigent_me` — every other
relationship already exists. "Assign delegate passport to aigentMe" = promote
that sponsored delegate (and its bound passport) to the aigentMe role.

## Reuse, don't recreate

- `/api/agents/genesis` gained an `isAigentMe?` flag, passed straight to the
  existing `sponsorPolityAgent` helper (already supported it).
- `PATCH /api/agents/aigentme` reuses the one-aigentMe-per-persona invariant
  (partial unique index) — promotion returns `aigent_me_exists` if one already
  exists.
- Registry/Apply read existing endpoints (`/api/polity-passport/wallet`,
  `/api/persona/sponsored-agents`, `/api/agents/aigentme`); no new data sources.

## Files

- `app/api/agents/genesis/route.ts` — accept + forward `isAigentMe`.
- `app/api/agents/aigentme/route.ts` — new `PATCH` to promote an existing
  sponsored delegate to aigentMe.
- `app/triad/components/codex/tabs/PassportRegistryTab.tsx` — citizen header,
  capacity readout, aigentMe badge, assign-to-aigentMe action.
- `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx` — "This is my
  aigentMe" checkbox on the generate paths.

No new migration — relies on `20260617000000_aigent_me_designation.sql`
(already pending/applied). All paths soft-fail when that migration is pending.
