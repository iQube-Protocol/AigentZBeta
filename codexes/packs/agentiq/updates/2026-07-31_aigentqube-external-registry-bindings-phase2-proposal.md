# AigentQube External-Registry Bindings — Phase 2 Capability Proposal

**Status:** proposal, not yet built beyond the PRD-GJR-001 first slice already shipped for MoneyPenny
(see `2026-07-30_prd-gjr-001-guided-journey-runtime.md` §3.1.1).
**Supersedes:** an earlier draft of this idea (session chat only, never committed) that proposed a new
`Agent Card iQube` / `AgentQube` class. **The operator corrected this on 2026-07-31: there is no new
class. This is an extension of the existing `AigentQube` primitive.**

---

## The corrected architecture

```
AigentQube
= the canonical metaProof agent object (registry_assets, asset_class 'AigentQube')

A2A / ERC-8004 Agent Card
= an interoperable PROJECTION of the AigentQube — identity + capability declaration

External registry token id (Horizen, or any future registry)
= a BINDING recorded ON the AigentQube (external_registry_bindings[])

Polity Delegate Passport
= the bounded constitutional authority relationship — a separate concern entirely
```

Three things must never collapse into one: **identity ≠ governed representation ≠ authority.** An
Agent Card says what an agent is. An AigentQube proves how that agent is governed. A Polity Delegate
Passport proves what that agent may do, and for whom.

## Why this matters

Today (pre-2026-07-31), most runtime agents (`aigent-me`, `aigent-nakamoto`, the Community Concierge)
have no persisted AigentQube at all — they resolve through `services/registry/adapters/aigentQubeAdapter.ts`'s
code-only path (`RUNTIME_AGENT_IDS` + a hand-curated profile map), which the iQube Registry's resolver
(`services/registry/resolver.ts`) accepts with **zero existence check against any real record**. That
means an agent can appear "canonized" in the registry with nothing durable behind it — no evidence, no
external-registry binding, no wallet reference. This was confirmed via a dedicated audit (2026-07-31)
during PRD-GJR-001's Stage 1 redesign: MoneyPenny had exactly this gap before the migration below.

## What has already shipped (MoneyPenny only, PRD-GJR-001 first slice, 2026-07-31)

- `types/registry-canonical.ts` — two new, additive types:
  - `ExternalAgentRegistryBinding` — `{protocol, registry, network, identity_registry_contract,
    token_id, registry_alias, status, agent_card_url, agent_card_hash}`. Mirrors `ChainAnchor`'s shape
    but allows the pending state (`token_id: null`) `ChainAnchor` does not (`ChainAnchor` models a
    confirmed mint only).
  - `AigentControllerBinding` — `{wallet_address, proof_of_control_ref}`. The wallet address is never
    stored here directly — see below.
  - Both attached as new optional fields on `CanonicalAigentBlock`: `controller?` and
    `external_registry_bindings?`.
- `supabase/migrations/20260930000400_aigentqube_moneypenny_registry_asset.sql` — seeds
  `aigentqube-moneypenny` into `registry_assets` (mirroring the exact pattern already used for
  aigent-z, kn0w1, marketa, aigent-c), with `metadata.external_registry_bindings[0]` recording her
  Horizen ERC-8004 presence honestly as `pending-registration` (`token_id: null`). Also seeds the
  matching `iqube_id_map` row — the prior four agents were seeded without one, which this migration
  does not repeat.
- `services/registry/adapters/aigentQubeAdapter.ts` — the `registry_asset` hydrate path now surfaces
  `metadata.external_registry_bindings` onto the resolved `CanonicalAigentBlock`, and separately reads
  a controller wallet address from `agent_keys` (keyed by `registry_assets.slug`) at hydrate time —
  **never duplicated into `registry_assets.metadata`** as a second copy of the same fact
  (`inv.engineering.036/037`). Soft-fails when no `agent_keys` row exists (most AigentQubes have none).
- `app/api/agents/moneypenny/route.ts` — the live Agent Card route's `metadata.horizen` block is now a
  **projection** of the AigentQube record above, read at request time, rather than a hand-typed
  literal. Soft-fails to the same honest `pending_registration` defaults if the registry is
  unreachable (this is a live, external-facing A2A discovery endpoint and must never break on a
  registry read).

## What is deliberately NOT built yet

1. **The write-back path.** Once a real Horizen registration transaction succeeds and returns a real
   `tokenId`, something must update `aigentqube-moneypenny`'s `external_registry_bindings[0]` with it.
   `scripts/register-moneypenny-horizen.ts` already documents this as its own next, not-yet-run step
   ("persist a metaMe binding record... for this OUTBOUND registration"). Building the write function
   before there is a real transaction to write would be speculative, unexercised code — deferred until
   a real registration exists to drive it.
2. **Backfilling every other runtime agent.** `aigent-me`, `aigent-nakamoto` and the Community
   Concierge have the identical "code-only, no persisted AigentQube" gap MoneyPenny had. This proposal
   recommends closing it the same way (one `registry_assets` row + `iqube_id_map` row per agent,
   following the exact seed pattern above) as a **separate, deliberate migration** — not bundled into
   the pilot's scope, and not something any agent should do without an explicit operator go-ahead,
   since it touches the shared registry resolver every consumer of `resolveIQube()` depends on.
3. **A dedicated ingestion pipeline** (discover → validate → normalize → mint → enrich → govern) for
   *third-party* Agent Cards not already known to metaProof. Everything shipped so far is specific to
   MoneyPenny's own, already-known identity. A generalized ingestion path for arbitrary external
   ERC-8004/A2A cards is a materially larger scope than this proposal covers and should be scoped
   separately if/when a concrete need arises (e.g. onboarding a partner-operated agent metaProof does
   not already run).
4. **Versioned/historical AigentQube state.** Each `registry_assets` row is mutated in place today
   (`ON CONFLICT ... DO UPDATE`), matching the existing four-agent precedent. A history-bearing,
   append-only version chain (Agent Card v1 → registry activation → Pulse enrichment → delegation
   activation → Standing update → revocation) is a real, valuable idea but is a schema change to how
   *every* AigentQube is stored, not a MoneyPenny-specific addition — out of scope here.

## Recommended shape for future denomination/registry additions

Any future external registry (beyond Horizen) should add a new `ExternalAgentRegistryBinding` entry to
the same `external_registry_bindings` array — never a parallel field, and never require a new
`AigentQube`-adjacent class. The array already models "one AigentQube, many external presences"
(Horizen ERC-8004 token id, an A2A card URL, an MCP endpoint, a DID reference, etc.) without a schema
change.

## Fuller completeness picture (operator-directed follow-up audit, 2026-07-31)

The framing above, on its own, reads as "this pilot slice built the A2A/ERC-8004 integration from
scratch." **That is not accurate**, and the operator asked for a second audit pass specifically to
correct it. A substantial A2A/ERC-8004 Agent Card integration already existed in this codebase before
2026-07-31 — the gap this proposal's shipped slice closed was narrower and specific: **the connection
between that existing integration and the persisted, canonical `AigentQube` record.**

The system has four layers, and only the fourth had the gap:

| # | Layer | State before 2026-07-31 |
|---|---|---|
| 1 | AgentQube Card specification (identity/interfaces/capabilities/trust/policy/economics/context/receipts) | Already designed |
| 2 | A2A-style Agent Card publication (`GET /api/agents/{slug}/agent-card.json`, mirrored across MoneyPenny/Aletheon) | Already built |
| 3 | ERC-8004/Horizen ingestion, identity normalization, correlation, evidence, and binding stack | Already built — `services/horizen/agentCard.ts`, `identity.ts`, `correlate.ts`, `evidence.ts`, `evidenceChain.ts`, `agentBinding.ts` (+ `agent_identity_bindings` table); `scripts/register-moneypenny-horizen.ts` performs the real outbound sequence (fetch card → validate → connect to Horizen MCP → discover tool schemas → build + verify + sign + submit the registration tx → poll onboarding status) |
| 4 | Canonical AigentQube registry persistence (`registry_assets`, asset_class `AigentQube`) | Existed for 4 agents only; **not joined to layers 1–3** for MoneyPenny — her card was hand-authored, her registry presence synthesized through the code-only runtime fallback |

So: **the A2A/ERC-8004 integration is an existing platform capability, not new work from this pilot.**
What this pilot's shipped slice (above) did was join layer 4 to layers 1–3 for one agent (MoneyPenny),
by making her Agent Card's `metadata.horizen` block a real projection of her (newly persisted)
AigentQube's `external_registry_bindings`, instead of a disconnected literal.

### Current completeness by layer

| Capability | Status |
|---|---|
| AgentQube Card concept/spec | Built |
| A2A-style public card route | Built |
| ERC-8004 card parser (handles hostile JSON, optional/identity-only cards, `data:`/`https:`/`ipfs:`/unknown URI schemes, size caps, additive extensions, unresolved-vs-invalid) | Built |
| Network-qualified token identity normalization (`(network, tokenId)` as the identity key; `BigInt`, not unsafe number conversion; catalogue row ≠ on-chain identity) | Built |
| Horizen read/correlation/evidence/evidence-chain services | Built |
| External identity binding model (`agent_identity_bindings`) | Built |
| MoneyPenny outbound registration script | Built, **not executed** |
| MoneyPenny persisted AigentQube | Built (this slice) |
| MoneyPenny card reads Horizen binding from AigentQube | Built (this slice) |
| Entire MoneyPenny card projected from AigentQube (name/description/capabilities/skills/constitutional statements/registry-entry fields) | **Partial** — only the `metadata.horizen` subsection projects; the rest is still route literals |
| Live Horizen token id | Not yet issued |
| Token id write-back to AigentQube | Not yet built/executed (see "deliberately NOT built yet" #1 above) |
| Bidirectional AigentQube ↔ Horizen reread | Not yet complete |
| Generic canonical AigentQube creation factory | Still deficient (`createAigentQube()` is dead code — see the Stage-0 audit) |
| All production agents backed by persisted AigentQubes | Not yet true (see "deliberately NOT built yet" #2) |

### The remaining architectural gap, precisely

MoneyPenny's Agent Card route now projects its Horizen subsection from her persisted AigentQube, but
the rest of the card (name, description, capabilities, skills, constitutional statements,
registry-entry fields) is still authored directly in the route. The target end-state, once pursued:

```
persisted AigentQube
├── native identity
├── capabilities
├── policy/governance
├── controller reference
├── Agent Card profile
├── external registry bindings
├── constitutional authority references
└── evidence references
              ↓ projection (one service, not bespoke route literals)
A2A / ERC-8004 Agent Card
```

Recommended (not yet built): a reusable `projectAigentCard(aigentQubeId)` service that assembles the
full card from the canonical AigentQube record, joining fast-changing external fields (token
lifecycle, Pulse/P&L proofs) from their own authoritative sources (`services/horizen/*`,
`agent_identity_bindings`) rather than duplicating them into `registry_assets.metadata`. Migrating
Aletheon and other agents onto it should happen incrementally, agent by agent, never as a wholesale
replacement of the working `services/horizen/*` integration — that stack is preserved and reused, not
rebuilt.

## Cross-reference

Full first-slice detail: `2026-07-30_prd-gjr-001-guided-journey-runtime.md` §3.1.1, §7 (Register row),
§10, §22. Registered in `codexes/packs/agentiq/collections.json`'s `col_updates` collection.
