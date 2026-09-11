# AIGENTQUBE-MIGRATION-001 — Canonicalize All Persistent Platform Aigents

**Status: BACKLOG — operator-directed, explicitly NOT started.** ("This is for the backlog. Not now.",
2026-07-31.) No implementation work has begun. This document records the ruling and scope so the
migration can be picked up as its own governed effort, not folded into the Horizen/MoneyPenny/Nakamoto
work that exposed the need for it.

**Priority:** P0 platform integrity
**Class:** Registry migration + constitutional invariant
**Scope:** All system, specialist, runtime and persistent user-facing Aigents across metaMe, AgentiQ,
Venture Lab α, IRL and associated cartridges
**Excludes:** transient helpers, ephemeral inference sessions, and agents explicitly classified as
non-persistent

---

## Why this exists

The Horizen x MoneyPenny Guided Journey work (2026-07-30/31) required promoting MoneyPenny from a
code-literal, wallet-only agent representation into a real, persisted `registry_assets` AigentQube
record — because Horizen's `external_registry_bindings` metadata needed a persistent carrier her prior
representation could not hold. Extending the same registration flow to Aigent Nakamoto (the dry-run
agent for that flow) surfaced the general problem directly: Nakamoto already has a real, deployed
Agent Card, a real wallet (`agent_keys`, confirmed via 5 independent files), a persona, and a content
cartridge — but no persisted AigentQube record backs any of it. A deep audit (2026-07-31) confirmed she
is not alone in this shape: of the 5 `RUNTIME_AGENT_IDS` code-literal profiles
(`services/iqube/legibility/sources/aigentQubeSource.ts`), only aigent-z, kn0w1, marketa, aigent-c and
moneypenny have ever been promoted to real `registry_assets` rows (per
`services/registry/adapters/aigentQubeAdapter.ts:151`'s own comment) — and that promotion happened
piecemeal, per-agent, via hand-authored migrations, never as a governed, repeatable process.

This is a registry-integrity problem, not a Nakamoto-specific repair. The right response is to
constitutionalize the fix so it cannot recur.

## Governing ruling

> Every persistent platform Aigent must be represented by one canonical, persisted AigentQube in the
> iQube Registry. Agent Cards, wallets, personas, runtime profiles and external registry identities are
> **projections or bindings** of that AigentQube — not competing sources of truth.

## Canonical object model

```
AigentQube
├── canonical Aigent identity
├── persona/profile binding
├── Agent Card projection
├── controller wallet binding
├── capabilities and service endpoints
├── constitutional governance
├── Polity Delegate Passport
├── sponsorship and bounded delegation
├── runtime jurisdiction
├── Standing
├── external registry bindings
├── evidence and receipts
├── lifecycle and revocation
└── version history
```

Dependent objects and what they mean relative to the AigentQube:

| Object | Relationship to AigentQube |
|---|---|
| Agent Card | interoperable projection |
| wallet | control instrument |
| persona | experiential/runtime presentation |
| external token ID | registry binding |
| Polity Delegate Passport | bounded constitutional authority |
| Standing | evidence-backed constitutional state |

## New platform invariant — Persisted AigentQube Requirement

> No persistent platform Aigent may be issued, published, activated or represented as canonical unless
> a persisted AigentQube exists for it in the iQube Registry.

This applies **at creation time**, not merely through a later cleanup. A persistent Aigent creation path
must atomically establish, or fail before publishing:

- AigentQube
- Agent Card
- persona binding
- controller binding
- registry mapping
- initial receipt

### Supporting invariants

- **Single Source of Truth** — the AigentQube is the sole canonical platform record for a persistent
  Aigent.
- **Projection Integrity** — Agent Cards and runtime profiles must project from AigentQube state or
  resolve explicitly back to it.
- **No Synthetic Canonization** — a resolver may preserve discoverability of a legacy Aigent, but may
  not represent an unbacked synthetic record as canonical.
- **No Duplicate Issuance** — discovery of an existing Agent Card, wallet or persona must trigger
  convergence with the existing Aigent, not creation of a replacement.
- **External Binding Subordination** — ERC-8004, A2A, MCP, DID and partner registry identities enrich
  the AigentQube; they do not supersede it.
- **Continuity Across Rotation** — wallet, endpoint, Agent Card and external registry rotation must
  preserve the continuity of the same AigentQube.
- **Persistent-Agent Creation Gate** — a persistent Aigent is not fully issued until its AigentQube can
  be deterministically reread from the Registry.

## Audit population (minimum)

- Aigent Z
- Aigent C
- Aigent Kn0w1
- Marketa
- MoneyPenny
- Aigent Nakamoto
- aigentMe
- Community Concierge
- all metaMe specialist agents
- all cartridge-specific persistent specialists
- all configured runtime agents
- all published Agent Card routes
- all wallet-backed agent personas
- all external A2A/ERC-8004 agent identities

The specialist population is especially important — many already have an Agent Card, a persona/profile,
capabilities, and a wallet or runtime identity, but lack a persisted AigentQube, an `iqube_id_map`
entry, or a canonical external-binding record.

## Required audit output

One inventory row per discovered agent:

| Field | Required finding |
|---|---|
| Canonical name | Current public name |
| Aliases | Slugs, persona IDs and legacy names |
| Persistent status | Persistent / transient / uncertain |
| Agent Card | Route, file, factory or URL |
| Persona | Runtime/persona source |
| Wallet | Safe reference and custody source |
| AigentQube | Persisted / synthetic / absent |
| Registry mapping | `registry_assets` and `iqube_id_map` |
| External bindings | ERC-8004, A2A, MCP, DID |
| Passport/delegation | Current constitutional state |
| Standing | Current state/source |
| Conflict | Duplicate or contradictory records |
| Migration decision | Bind / expand / merge / quarantine / exempt |
| Evidence | Exact source paths and record IDs |

Classify every discovered Aigent as one of:

`CANONICAL` · `PERSISTED_BUT_INCOMPLETE` · `EXISTING_ARTIFACTS_BINDING_REQUIRED` · `SYNTHETIC_LEGACY` ·
`DUPLICATE_CONFLICT` · `TRANSIENT_EXEMPT` · `QUARANTINED`

**Do not infer absence merely because a current `registry_assets` row is missing.** Existing cards,
wallets and personas must be located and converged before any new artifact is created — this is the
exact lesson of the Nakamoto audit (2026-07-31): a narrow grep concluded "does not exist" when the real
finding was "exists, but as a different artifact class than assumed."

## Migration order

**Phase 1 — Discovery and freeze on new gaps.** Before broad migration: add a canary preventing new
persistent agents without AigentQubes; identify every publishing/creation path; prevent further
static-card-only or persona-only issuance; do not delete or rewrite existing artifacts.

**Phase 2 — Core system Aigents.** Migrate and verify: Aigent Z, Aigent C, Aigent Kn0w1, Marketa,
MoneyPenny, Aigent Nakamoto, aigentMe, Community Concierge.

**Phase 3 — metaMe specialists.** Audit every specialist exposed through Agent Card routes, specialist
selectors, Companion menus, cartridge manifests, runtime configuration, persona records, and wallet/key
records. Create or bind canonical AigentQubes without duplicating existing cards or wallets.

**Phase 4 — Remaining persistent agents.** Venture Lab, IRL, Founder Office, Registry, FS Runtime and
future product-specific populations.

**Phase 5 — Resolver enforcement.** After migration: persistent Aigent lookup → persisted AigentQube
required → projections assembled → missing record fails honestly. Remove synthetic "canonized" fallback
behavior. Legacy entries may remain visible only as migration-required.

## Creation-service requirement

The current hand-authored SQL-migration-per-agent pattern (the exact pattern this session used for
MoneyPenny and Nakamoto) must not remain the permanent issuance mechanism. Create or repair a canonical
service such as:

```ts
createPersistentAigent({
  identity,
  persona,
  agentCard,
  controller,
  capabilities,
  governance,
  externalBindings,
})
```

It should produce, atomically: `registry_assets` AigentQube row, `iqube_id_map` entry, persona binding,
Agent Card projection metadata, controller binding, and a creation receipt. The operation must be
idempotent and reject duplicates.

### Addendum — user-created agents must issue an AigentQube too (operator ruling, 2026-07-31)

> Issuing an AigentQube must become part of the process of creating an agent going forward — including
> when a user creates one through their own wallet.

This means `createPersistentAigent()` (or its equivalent) is not only the system/specialist-agent
migration path — it is the same path a citizen-sponsored genesis agent (`services/agents/
sponsorPolityAgent`, `/api/agents/genesis`) or any future user-facing "create your own agent" flow must
route through. A user-created agent is not exempt from the Persisted AigentQube Requirement merely
because it originates from a wallet rather than a platform migration.

## Required canaries

- a persistent Agent Card cannot be published without an AigentQube
- a persistent persona cannot be marked active without an AigentQube reference
- an external registry binding must resolve to exactly one AigentQube
- duplicate Agent Cards cannot create duplicate AigentQubes
- wallet rotation preserves AigentQube continuity
- synthetic fallback entries are never labeled canonical
- Agent Card projection cannot drift silently from AigentQube state
- a deleted or revoked external binding does not delete the AigentQube
- transient agents are explicitly exempt rather than accidentally omitted
- every system Aigent in the audit inventory has a governed disposition

## Intended final relationship

```
AigentQube               = canonical Aigent
Agent Card                = projection
persona                   = presentation
wallet                     = control
external registry identity = binding
Polity Delegate Passport  = authority
Standing                  = evidence-backed state
```

## Relationship to this session's work

- `supabase/migrations/20260930000400_aigentqube_moneypenny_registry_asset.sql` and
  `supabase/migrations/20260930000700_aigentqube_nakamoto_registry_asset.sql` are the two hand-authored
  promotions that motivated this backlog item. They are **not** retroactively wrong — they follow the
  only mechanism that existed at the time — but they are exactly the pattern the creation-service
  requirement above must replace so a third, fourth, and fifth agent don't each need their own bespoke
  migration.
- `services/horizen/registrableAgents.ts` (this session's agent-selectable Register-stage config table)
  is a narrow, Horizen-specific config, not a substitute for the general `listRegisterableAgents
  (principalContext)` resolver or the `JourneyAgentSubject` parameterization the operator separately
  ruled on the same day — those remain queued, in-scope, active work for the Guided Journey Runtime;
  AIGENTQUBE-MIGRATION-001 is the broader, platform-wide registry-integrity effort underneath them.

## Next step when this is picked up

Begin with an **audit-only pass** per the ruling above — populate the inventory table for at least the
Phase 2 core system Aigents, with every finding sourced to an exact file path or record ID, before any
Aigent's records are bound, expanded, merged, quarantined, or exempted. Do not delete legacy records,
rotate wallets, replace Agent Cards, or mint duplicate AigentQubes during the audit.
