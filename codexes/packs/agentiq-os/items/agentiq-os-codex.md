# AgentiQ OS Codex

The AgentiQ OS Codex is the canonical asset registry and ledger model for the AgentiQ OS layer. It is distinct from a cartridge (which delivers a user experience) and distinct from the Registry (which is the on-chain asset ledger).

## Codex vs Cartridge vs Registry

| Concept | What It Is | Who Uses It |
|---------|-----------|-------------|
| **Cartridge** | A self-contained experience module | End users, developers |
| **Codex** | A structured KB + asset type ledger | Operators, builders |
| **Registry** | On-chain/off-chain asset publication ledger | Protocol-level, ecosystem |

The Codex sits between the cartridge (experience layer) and the Registry (trust layer). It records what asset types exist, their canonical models, and the lifecycle from working → published → canonical.

## Canonical Asset Types

The AgentiQ OS layer defines six canonical asset types:

| Asset Type | Interface | Registry Entry | Trust Band Floor |
|-----------|-----------|---------------|-----------------|
| `AigentQube` | Agent registration with capabilities + policy bindings | Required | L1 |
| `SkillQube` | Discrete deployable capability unit | Required | L1 |
| `ExperienceQube` | Packaged user journey (depth ladder) | Optional | L1 |
| `PersonaQube` | Bounded identity surface | Internal (not published) | — |
| `DataQube` | Encrypted data container | Internal (not published) | — |
| `ContentQube` | Media / document asset with access policy | Optional | L1 |

## Asset Lifecycle

```
Working      → Local development, not registered
Draft        → Committed to pack, awaiting review
Submitted    → Submitted to Registry as L1_EXPERIMENTAL
Reviewed     → Community review completed → L2_VERIFIED_COMMUNITY
Approved     → Formal review passed → L3+ trust band
Canonical    → Protocol-level, immutable → L5_CORE_SOVEREIGN
Archived     → Superseded, no longer active
```

Every lifecycle transition emits an `artifact_synced` or `stage_assigned` OrchestrationEvent (receipt_eligible: true) that anchors to the asset publisher's Root DiD.

## Post-Production Asset Ledger

Phase 1 (current): The codex model is documented in markdown. The lifecycle is tracked manually by operators.

Phase 3 (planned): A `codex_canonical_assets` table in Supabase will provide full lifecycle management:
- Asset registration on submit
- Reviewer assignment on review request
- Trust band update on approval
- DVN receipt generation on canonical promotion
- Archival with rollback SHA preserved

This table will be linked to the `orchestration_events` table for audit continuity.

## Publishing Flow (Current)

```
1. Developer creates pack in codexes/packs/<pack-id>/
2. Developer commits and pushes to dev
3. Pack appears in codex viewer (auto-discovered by packRegistry.ts)
4. Developer submits AigentQube/SkillQube via Registry tab
5. Community review promoted to L2
6. Registry entry updated, DVN receipt emitted
```

## Codex Document Standards

All codex documents must:
- Be written in plain markdown (no embedded code requiring execution)
- Reference only documented protocol contracts (no speculation)
- Carry a `disclosure_class` header if the content is above `public`
- Use canonical naming conventions (see [Developer Standards](dev-standards.md))
- Be registered in `collections.json` before they appear in the UI

## Why "Codex"?

A codex is a handwritten or early printed manuscript — the root of the word "code." In AgentiQ OS, the codex is the *authoritative written record* of the platform's asset types, lifecycle rules, and canonical models. It is the single source of truth for what exists and how it behaves — the contract between the protocol layer and the builders who use it.
