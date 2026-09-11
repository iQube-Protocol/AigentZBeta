# Mobility tracks rebalance + aigentMe 3-slot delegation

**Date:** 2026-06-17
**Surface:** Polity Passport Bureau cartridge — Human Mobility Services tab + Aigent Delegates tab
**Branch:** `claude/optimistic-davinci-exiykx`

## What changed

### 1. Human Mobility Services tab — balanced use cases (`PassportBeingTab.tsx`)

The "Being" mobility tab was previously anchored entirely on vulnerable persons
(refugee / stateless / asylum / shelter). It now presents **two balanced
mobility tracks** behind a toggle, each with its own use-case set and
demonstration scenario:

- **Executive & Global Mobility** — visa & work-permit orientation, relocation &
  housing setup, cross-border tax/residency orientation, fast-track credential
  verification, global-talent/investor mobility, travel-risk briefings. Scenario:
  *Executive Relocation*.
- **Vulnerable Persons & Protection** — the existing refugee/asylum/shelter/
  statelessness set, retained. Scenario: *Refugee / Stateless Citizen*.

Both tracks ride the identical identity spine (World ID → Citizen Passport →
Delegation Grant → Mobility Agent → Walrus vault → ProveKit ZK proof → counsel),
and share one privacy-guarantee panel. Still a Phase 1 vision surface — no live
service routing yet.

### 2. Aigent Delegates tab — 3 delegate slots, aigentMe primary (`BoundedDelegationTab.tsx`)

Replaced the single-agent carousel with a **three-slot delegate roster**:

- **Slot 1 = aigentMe (primary).** Defaults to the citizen's aigentMe agent. If
  none exists, a one-click **"Create my aigentMe"** runs genesis and the agent
  then appears in the wallet (AgentQubes) and here as delegate 1.
- **Slots 2 & 3** — assignable to any pre-existing sponsored (non-aigentMe) agent,
  or left empty for an agent yet to be developed.
- **System agents (Aigent Z, Aigent C-OS, Marketa, Kn0w1) are admin-only.** They
  are hidden from the assignable pool unless `cartridgeFlags.isAdmin` is true
  (resolved via `/api/wallet/active-persona`).
- **One active delegation at a time** (unchanged backend). Simultaneous
  multi-delegate activation is surfaced as a **Premium — coming soon** stub
  (option B; the existing delegation-persistence backlog item).

## aigentMe ↔ metaMe binding

The aigentMe is an ordinary `polity_bound` agent sponsored by the citizen's own
passport, flagged `is_aigent_me`. It is bound to the **same active persona** the
citizen applied with — no separate login. It consumes one of the citizen's base
sponsorship-capacity slots (base 3 = 1× aigentMe + 2× participants).

## Reuse, don't recreate

- Extracted the genesis core (`sponsorPolityAgent`) into a shared service so
  `/api/agents/genesis` and the new `/api/agents/aigentme` share one
  sponsor-ownership check, capacity enforcement, slug uniqueness, and insert.
- `/api/agents/aigentme` reuses that helper with `isAigentMe: true` and an
  auto-derived, T0-safe slug.
- `/api/persona/sponsored-agents` now returns `isAigentMe` and sorts the aigentMe
  first; pre-migration it falls back to the pre-aigentMe query so sponsored
  agents never vanish.

## Files

- `supabase/migrations/20260617000000_aigent_me_designation.sql` — adds
  `agent_root_identity.is_aigent_me` + partial unique index (one aigentMe per
  sponsor persona). **Must be applied in Supabase.**
- `services/agents/sponsorPolityAgent.ts` — shared genesis core (new).
- `app/api/agents/_lib/requestOrigin.ts` — shared origin resolver (new).
- `app/api/agents/genesis/route.ts` — refactored onto the shared helper.
- `app/api/agents/aigentme/route.ts` — GET/POST aigentMe (new).
- `app/api/persona/sponsored-agents/route.ts` — surfaces `isAigentMe`.
- `app/triad/components/codex/tabs/PassportBeingTab.tsx` — two mobility tracks.
- `app/triad/components/codex/tabs/BoundedDelegationTab.tsx` — 3-slot roster.

## Migration to run

```sql
-- supabase/migrations/20260617000000_aigent_me_designation.sql
ALTER TABLE public.agent_root_identity
  ADD COLUMN IF NOT EXISTS is_aigent_me boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_root_aigent_me_per_persona
  ON public.agent_root_identity (sponsor_persona_id)
  WHERE is_aigent_me;
```

All new server paths soft-fail when the migration is pending, so deploy order is
not load-bearing.
