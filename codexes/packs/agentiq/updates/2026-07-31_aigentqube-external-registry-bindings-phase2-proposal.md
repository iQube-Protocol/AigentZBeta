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

## Cross-reference

Full first-slice detail: `2026-07-30_prd-gjr-001-guided-journey-runtime.md` §3.1.1, §7 (Register row),
§10, §22. Registered in `codexes/packs/agentiq/collections.json`'s `col_updates` collection.
