# Backlog: Cohort Escrow, Pseudonymous Tx Identity & Root DID Reputation

**Date:** 2026-04-27  
**Status:** Backlog — do not implement until end-to-end persona iQube mint flow is validated  
**Priority:** High (unlocks DVN pipeline, anonymous cohort txs, root DID reputation)

---

## Context

The four ICP canisters (Escrow, RQH, FBC, DBC) are already deployed and their IDLs exist in `services/ops/idl/`. The DiDQube schema migrations (20260427000000, 20260427000001) added `root_identity`, `did_persona`, `agent_root_identity`, `agent_environment`, and `agent_persona` tables. This backlog item bridges those two layers.

---

## The Flow (as designed)

```
Persona joins tx cohort
    ↓
Escrow canister: register_alias(hash(persona_uuid + cohort_id), mailbox, ttl)
    → pseudonymous alias registered; no on-chain link to persona or root DID
    ↓
Tx executes on-chain — only the alias is visible, not the persona UUID
    ↓
Escrow period active (configurable TTL)
    ├── No flag raised → purge_expired() deletes alias
    │                  → persona permanently anonymous on-chain ✓
    │
    └── Flag raised during escrow window
            → FBC.submit_cohort_flag(cohort_id, alias_commitment, flag_type)
            → FBC routes anonymously to RQH partition_id (root_identity UUID)
            → RQH updates root-level reputation bucket (NOT persona bucket)
            → root_identity.root_reputation_score / root_reputation_bucket updated
            → No reverse-lookup of alias → persona is still anonymous
```

**Key privacy invariant:** The alias commitment is a one-way hash. Flags flow to the root DID via RQH — but the path from flag → alias → persona UUID is destroyed when the alias is purged. The root DID receives a reputation consequence without the cohort ever knowing which persona (or even which person) was involved.

---

## Reputation Split

| Level | Scope | What goes here | Current state |
|-------|-------|---------------|---------------|
| Persona reputation | `reputation_events` table + RQH partition = persona UUID | Context-specific: trading history, KNYT participation, governance votes, contributions | Exists — wallet surfaces it |
| Root DID reputation | RQH partition = root_identity UUID | Cross-context serious events: fraud flags, escrow violations, dispute outcomes | Planned — fields not yet on `root_identity` |

Both can be read via RQH — it's the `partition_id` that determines which bucket gets updated.

---

## What Needs to Be Built

### 1. DB: `cohort_memberships` table

```sql
CREATE TABLE public.cohort_memberships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_identity_id  uuid REFERENCES public.root_identity(id) ON DELETE CASCADE,
  did_persona_id    uuid REFERENCES public.did_persona(id) ON DELETE CASCADE,
  cohort_id         text NOT NULL,          -- dynamic, tx/group scoped
  alias_commitment  text NOT NULL,          -- hash(persona_uuid + cohort_id + salt)
  alias_ttl_days    integer NOT NULL DEFAULT 30,
  escrow_expires_at timestamptz NOT NULL,
  status            text NOT NULL
    CHECK (status IN ('active','escrow','purged','flagged'))
    DEFAULT 'active',
  flag_type         text,                   -- populated if flagged before purge
  purged_at         timestamptz,
  created_at        timestamptz DEFAULT now()
);
```

### 2. DB: Root DID reputation fields

```sql
ALTER TABLE public.root_identity
  ADD COLUMN IF NOT EXISTS root_reputation_score   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS root_reputation_bucket  smallint DEFAULT 0
    CHECK (root_reputation_bucket BETWEEN 0 AND 5);
```

### 3. Service: Cohort alias lifecycle (`services/identity/cohortAliasService.ts`)

- `joinCohort(rootIdentityId, didPersonaId, cohortId, ttlDays)` → calls `escrow.register_alias(commitment, mailbox, ttl)`, writes `cohort_memberships` row
- `purgeCohort(cohortMembershipId)` → calls `escrow.purge_expired()`, updates status to `purged`, nulls alias_commitment
- Scheduled job (cron or Supabase Edge Function): runs `purgeCohort` on all rows where `escrow_expires_at < now()` and `status = 'escrow'`

### 4. Service: Flag routing bridge (`services/identity/cohortFlagRouter.ts`)

- Receives anonymous flag from FBC (via webhook or polling)
- Resolves `alias_commitment` → `root_identity_id` (only during active escrow window — not after purge)
- Calls RQH `add_reputation_evidence` with `partition_id = root_identity_id`
- Updates `root_identity.root_reputation_bucket` from RQH response
- Updates `cohort_memberships.status = 'flagged'`, records `flag_type`

### 5. API route: `POST /api/identity/cohort/join`

Accepts: `{ cohortId, personaType, ttlDays? }` — authenticated user  
Does: resolves root_identity + did_persona, registers alias on escrow canister, writes cohort_memberships row  
Returns: `{ cohortId, aliasCommitment, expiresAt }`

### 6. UI: Root DID reputation in IdentityIQubeDrawer DIDQube section

Add below the linked personas section:
- Root reputation bucket (0–5 scale, colour-coded matching persona rep display)
- Cohort membership count and escrow status
- Active flags (if any) — shown only to the user, anonymously sourced

---

## Agent Persona Considerations

`agent_persona.delegation_scopes` already has the right structure for bounding agent cohort participation:

```json
{
  "join_cohort": false,
  "read_cohort_reputation": true,
  "submit_evidence": false
}
```

Agents joining cohorts on behalf of users should require explicit `join_cohort: true` in delegation_scopes AND `max_identifiability >= semi_anonymous` (agents cannot join cohorts anonymously on behalf of a user without the user's persona-level identifiability floor being met).

---

## Files to Touch When Implementing

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_cohort_memberships.sql` | New migration |
| `services/ops/idl/escrow.ts` | Already exists — import and call |
| `services/ops/idl/fbc.ts` | Already exists — import and call |
| `services/ops/idl/rqh.ts` | Already exists — import and call |
| `services/identity/cohortAliasService.ts` | New service |
| `services/identity/cohortFlagRouter.ts` | New service |
| `app/api/identity/cohort/join/route.ts` | New route |
| `components/iqube/IdentityIQubeDrawer.tsx` | Add root reputation + cohort count |

---

## Dependencies / Prerequisites

- End-to-end persona iQube mint flow validated ✓ (in progress)
- `root_identity` table live with `auth_user_id` ✓ (migration 20260427000000)
- `did_persona` table live ✓ (migration 20260427000000)
- Escrow canister deployed ✓ (IDL in services/ops/idl/)
- RQH canister deployed and queryable ✓ (`zdjf3-2qaaa-aaaas-qck4q-cai`)
