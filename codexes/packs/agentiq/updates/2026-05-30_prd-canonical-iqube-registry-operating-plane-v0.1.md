# PRD: Canonical iQube Registry Operating Plane v0.1

**Status:** Draft for human review — do not implement until reviewed.
**Date:** 2026-05-30
**Author:** Claude Code (session: claude/dreamy-gates-mMqNv)
**Scope:** Phase 1 (consolidation + operationalization). Phase 2 (intent/risk/value/exchange) stubbed.

---

## 1. Executive Summary

The iQube Registry is the canonical orientation layer of the metaMe / AgentiQ ecosystem. Every primitive that is an iQube, references an iQube, mints an iQube, activates an iQube, gates an iQube, renders an iQube, audits an iQube, or allows an agent to discover an iQube must ultimately resolve through the Registry.

**Half of this work has already shipped.** Between 2026-05-13 and 2026-05-14, the ContentQube track landed a canonical resolver (`resolveContentQube`), a canonical manifest builder (`buildDisplayManifest`), a privacy-by-construction DVN receipt writer (`content_qube_dvn_receipts`, no `persona_id` column), a 1,860-edition pre-seed per qube with claim flow (`claimEditionForPurchase`), a Base ERC-1155 / ERC-721 mint service (`services/chain/baseTokenMint.ts`), and KNYT cartridge UI migration (KnytShelfTab, KnytTab, ScrollsTab, CharactersTab) onto the registry as the primary ownership decision input. The Qripto Spine — `getActivePersona → evaluateAccess → claimEditionForPurchase → content_qube_dvn_receipts` — is load-bearing and audited end-to-end for ContentQubes today. See §2.9 for the phase-by-phase ledger.

What remains is **generalising that pattern to every iQube primitive** (DataQube, ToolQube, ModelQube, AigentQube, ClusterQube, SkillQube, WorkflowQube, ConnectorQube, LiquidUITemplate, plus the triad MetaQube/BlakQube/TokenQube), **unifying the receipt index** across `orchestration_events` and `content_qube_dvn_receipts`, **replacing the mock stub at `app/api/registry/iqube/route.ts`**, **wiring minting (`/api/core/mint-tokenqube`) to emit canonical DVN receipts and persona ↔ TokenQube links**, **migrating the remaining non-KNYT-shelf cartridge surfaces** (KnytStoreEpisodesTab, KnytStoreCardsTab, bundle wizard, admin tools) off the deprecated `useOwnedEntitlements` / `/api/codex/owned` path, and **adding the missing agent-legibility layer** (`.well-known/iqube-cards`, Agent Cards, A2A descriptors).

Application-level renderings (cartridge tabs, codex panels, runtime cards) remain free to present iQubes however they want, provided they consume from the canonical resolver and never act as source of truth. Phase 2 work (intent capture, calibration, risk/value/price/exchange) is stubbed only — interfaces and architectural seams are reserved, no implementation in scope.

---

## 2. Current-State Inventory

All paths absolute from repo root `/home/user/AigentZBeta`.

### 2.1 Type contracts

| File | Lines | Role | Status |
|---|---|---|---|
| `types/registry.ts` | 42 | `IQubeTemplate`, `IQubeType` enum, `RegistryFilter`, `ApiResult` | Canonical for registry browse UI, **but** `IQubeType` is missing `AigentQube` and `ClusterQube` |
| `types/contentQube.ts` | 304 | ContentQube domain shape | Canonical for content registry |
| `types/aigentQube.ts` | 313 | AigentQube domain shape | Parallel — not unified with `IQubeTemplate` |
| `types/registryIngestion.ts` | 640 | Registry intake/source/asset/version/policy types | Canonical for ingestion factory |
| `types/smartWalletQube.ts` | — | Wallet-as-qube | Tangential |
| `types/access.ts` | — | Access spine: ActivePersonaContext, ContentAccessDescriptor, AccessAction, ReceiptMode, Identifiability | Canonical for access (Phase 1 closed per CLAUDE.md) — DO NOT MODIFY |

### 2.2 Services — registry and content

| Path | Role | Status |
|---|---|---|
| `server/services/iqRegistryService.ts` | **Canonical CRUD for the MetaQube / BlakQube / TokenQube triad** (`iq_meta_qubes`, `iq_blak_qubes`, `iq_token_qubes`). Functions: `createMetaQube`, `createBlakQube`, `createTokenQube`, `updateTokenQubeChainAnchor`, `getQubeTriad` | Canonical and live |
| `services/registry/intakeService.ts` | Inbound submission lifecycle (`registry_intakes`) | Canonical |
| `services/registry/fetcherService.ts` | Fetch + fingerprint external source artifacts | Canonical |
| `services/registry/classifierService.ts` | Classify intake as ToolQube/SkillQube/WorkflowQube/ConnectorQube | Canonical |
| `services/registry/packagerService.ts` | Package into `registry_assets` | Canonical |
| `services/registry/validatorService.ts` | Schema + safety validation | Canonical |
| `services/registry/trustScorerService.ts` | Trust score calculation | Canonical |
| `services/registry/publisherService.ts` | Publish to catalog | Canonical |
| `services/registry/persistence.ts` | DB layer for registry tables | Canonical |
| `services/registry/receiptEmitter.ts` | Emits registry receipts | Canonical — **parallel to** `services/orchestration/orchestrationEvents.ts` and `clawhack-group-agents/bridge-core/dvnReceiptService.ts` |
| `services/registry/invocationGateway.ts` | Invokes registered tools | Canonical |
| `services/registry/googleConnectorCatalog.ts` | Connector seed catalog | Canonical |
| `services/content/getContentDescriptor.ts` | Content state + gating classifier | Canonical (per CLAUDE.md — DO NOT MODIFY) |
| `services/content/encryption.ts`, `stateCDelivery.ts` | Encryption + state-C streaming | Canonical (DO NOT MODIFY) |

### 2.3 Services — identity, wallet, access

Per CLAUDE.md spine policy, these are **canonical and read-only**:

- `services/identity/getActivePersona.ts` — T0 persona resolver
- `services/identity/personaSessionToken.ts` — T1 session envelope
- `services/access/evaluateAccess.ts` — unified access gate
- `services/access/policyResolvers.ts` — per-action receipt mode + credential verifiers
- `services/wallet/personaRepo.ts` — persona ownership resolver
- `services/wallet/personaService.ts` — persona creation, key derivation, FIO handle binding
- `services/wallet/personaAddressResolver.ts` — EVM address resolution per chain
- `services/wallet/multiEmailIdentity.ts` — multi-email merge
- `services/rewards/assetOwnership.ts` — **canonical `userOwnsAsset(personaId, assetId)`** with SKU expansion

### 2.4 Services — DVN / receipts

| Path | Role | Status |
|---|---|---|
| `services/orchestration/orchestrationEvents.ts` | Writes `orchestration_events` table; T2-safe metadata only | Canonical for orchestration receipts |
| `services/registry/receiptEmitter.ts` | Writes registry-scoped receipts | **Parallel** — coordination with `orchestrationEvents` not visible |
| `clawhack-group-agents/bridge-core/dvnReceiptService.ts` | Buffers receipts, emits via QubeTalk or HTTP | **Parallel** — third receipt surface |
| Phase 3.4 (not landed) | Receipt batcher → Bitcoin ordinals via `inscription_id` column | Stubbed |

### 2.5 API routes

| Path | Method | Role | Status |
|---|---|---|---|
| `app/api/registry/iqube/route.ts` | POST | Create iQube | **STUB — returns mock response, real backend commented out** |
| `app/api/registry/templates/route.ts`, `[id]/`, `store.ts` | CRUD | Template management | Live |
| `app/api/registry/assets/` | CRUD | Asset listing | Live |
| `app/api/registry/library/` | GET | Owned library | Live |
| `app/api/registry/intake/route.ts`, `[intakeId]/`, `package-skill/` | POST | Ingestion intake | Live |
| `app/api/registry/publish/` | POST | Publish to catalog | Live |
| `app/api/registry/receipts/route.ts` | GET | Registry receipts | Live |
| `app/api/registry/analytics/` | GET | Registry analytics | Live |
| `app/api/registry/similarity/` | GET | Similar iQubes | Live |
| `app/api/registry/studio-artifacts/` | CRUD | Studio artifact handoff | Live |
| `app/api/registry/content-qube/[id]/`, `browse/`, `series/`, `series-rights/` | GET | ContentQube browse + resolve | Live |
| `app/api/iqube/persona/knyt/mint/route.ts` | POST | Persona iQube minting (KNYT) | Live; Autonomys upload TODO |
| `app/api/iqube/persona/qripto/mint/route.ts` | POST | Qripto persona mint | Live, likely unused |
| `app/api/iqube/identity/`, `memory/` | CRUD | Identity + memory iQubes | Live |
| `app/api/core/mint-tokenqube/route.ts` | POST | EVM mint handler (Base Sepolia) | Live — does NOT emit canonical DVN receipt, only proof-of-state |
| `app/api/core/activate-iqube/route.ts`, `view-iqube/route.ts` | — | Activation + view | Live |
| `app/api/content/registry/` | GET | Content registry (legacy bridge) | Live |
| `app/api/content/decrypt-supabase/`, `pdf/`, `pdf-page/`, `pdf-page-by-master/`, `pdf-pages/`, `pdf-meta/`, `cover/`, `video/`, `issue/`, `issues/`, `assets/`, `entitlements/`, `library/`, `section/`, `pricing/`, `smart/`, `home-hero/`, `demo/` | various | Content delivery + gating | Live; covered by access spine |
| `app/api/codex/registry/[codexId]/`, `_lib/`, `route.ts` | GET | Codex-registry bridge | Live |
| `app/api/codex/agentiq-os/registry-draft/`, `ecosystem-signup/` | — | AgentiQ OS surface | Live |
| `app/api/admin/codex/status/route.ts` | GET | Admin codex status (returns Supabase URLs — see Phase 2 PDF backlog in CLAUDE.md) | Live |

### 2.6 UI components

| Path | Role | Status |
|---|---|---|
| `components/registry/RegistryHome.tsx` | Main registry browse UI | Canonical |
| `components/registry/IQubeCard.tsx` | iQube card render | Canonical; the only `IQubeCard` file in the repo |
| `components/registry/IQubeDetailModal.tsx` | iQube detail modal | Canonical |
| `components/registry/AssetDetailPanel.tsx` | Asset detail panel | Canonical |
| `components/registry/AddIQuBeForm.tsx` | Create iQube form | Canonical |
| `components/registry/RegistryBrowserDrawer.tsx` | Browse drawer | Canonical |
| `components/registry/IngestionFactoryPanel.tsx` | Ingestion factory UI | Canonical |
| `components/registry/ComponentRegistryPanel.tsx` | Component registry tab | Canonical |
| `components/registry/TrustPanel.tsx`, `ValidationPanel.tsx` | Trust + validation surfaces | Canonical |
| `components/registry/FilterSection.tsx`, `IdentityFilterSection.tsx`, `Pagination.tsx`, `ViewModeToggle.tsx` | Filter + nav primitives | Canonical |
| `components/registry/scoreUtils.tsx` | Score helpers | Canonical |
| `components/composer/DVNReceiptsPanel.tsx` | DVN receipt panel in composer | Canonical — receipts surfaced in Composer, not in Registry |
| `app/triad/components/codex/tabs/RegistrySupplyTab.tsx` | Codex-side registry tab | Canonical |
| `app/triad/components/codex/tabs/AgentiQOSTab.tsx` | AgentiQ OS tab | Canonical |
| `app/triad/components/codex/tabs/FactoryIntakeTab.tsx` | Factory intake tab | Canonical |
| `app/data/personas.ts` | Persona seed (contains "iqube-card" string) | Tangential |

### 2.7 Smart contracts / canisters

- EVM iQube NFT contract — address in `IQUBE_NFT_CONTRACT_ADDRESS` env, ABI inline at `app/api/core/mint-tokenqube/route.ts`. Function `mintQube(to, uri)`, event `QubeAnchored`.
- ICP `PROOF_OF_STATE_CANISTER_ID` — fires proof-of-state receipt on mint (non-fatal if missing).
- No canonical iQube canister is the source of truth today; Supabase tables are.

### 2.8 Database — Supabase migrations

Registry / iQube relevant migrations (chronological):

- `20250101_codex_registry.sql` — codex registry seed
- `20260219143000_user_iqubes_dev_bootstrap.sql` — dev user iQubes
- `20260402010000_registry_ingestion_factory_v1.sql` — `registry_intakes`, `registry_sources`, `registry_assets`, plus version / policy tables
- `20260402020000_registry_rls.sql` — RLS for the above
- `20260407000002_agentiq_native_registry_assets.sql` — native asset seed
- `20260414000000_aigentqube_registry_assets.sql` — Aigent assets seed
- `20260415000002_agentiq_crm_skills_registry.sql`, `20260417000003_agentiq_crm_import_skill_registry.sql` — CRM skills
- `20260421000000_persona_iqube_fields.sql` — persona iQube fields
- `20260422000000_identity_iqube.sql`, `20260422000002_memory_iqubes.sql` — identity + memory iQubes
- `20260423000000_iq_token_qubes_chain_fields.sql` — TokenQube chain anchor fields
- `20260513010000_content_qubes_schema.sql` — **canonical ContentQube schema (8 new tables)**
- `20260513020000_content_qube_registry_view.sql` — registry VIEW bridge
- `20260513030000_content_qubes_knyt_pilot.sql` — KNYT pilot binding
- `20260513040000_content_qube_editions_seed.sql` — rarity-tiered editions seed
- `20260524000000_activation_tab_content_qubes.sql` — activation surface
- `20260524010000_content_qube_editions_released_at.sql` — releases column

Triad tables (per `server/services/iqRegistryService.ts`): `iq_meta_qubes`, `iq_blak_qubes`, `iq_token_qubes`.

ContentQube tables (per `20260513010000`): `content_qubes`, `content_qube_storage`, `content_qube_access_policies`, `content_qube_relationships`, `content_qube_cartridge_bindings`, `content_qube_editions`, `content_qube_versions`, `content_qube_dvn_receipts`.

Legacy content tables (still active, bridged): `master_content_qubes`, `codex_media_assets`.

### 2.9 Prior consolidation work — already landed (critical context)

The ContentQube + spine track has shipped substantial consolidation between **2026-05-13 → 2026-05-14**. This PRD extends, not redoes. Key prior commits:

| Phase | Commit | Landed surface |
|---|---|---|
| 2 | `bb67913b` | 8 net-new ContentQube tables (per `20260513010000`) |
| 3 | `eaa6f383` | `v_content_qube_registry` VIEW + `GET /api/registry/content-qube/[id]` |
| 4 | `bd19049a` | `resolveContentQube`, `resolveContentQubesBySeries`, `buildDisplayManifest` (server-side resolution + T1-safe manifest) |
| 5 | `70de5c8e` | `content_qube_dvn_receipts` writer — privacy-by-construction (no `persona_id` column; only `t2_alias_commitment`) |
| 6 | `897314a4` | KNYT pilot bridge: 13 episode masters + character cards into `content_qubes` via `master_qube_id` FK |
| 7 | `b5c863dd` | 1,860 canonical editions pre-seeded per qube (18 legendary / 186 epic / 1,654 rare / 2 secret_black_rare). Commons appended on streaming-access purchase. |
| 7B | `a2cc3d0c` | `services/chain/baseTokenMint.ts` — `mintCanonicalEdition` (ERC-1155, commons excluded), `mintMasterQube` (ERC-721, advances lifecycle_state to `chain_minted`). Deterministic SHA-256 token IDs. Graceful pre-deploy fallback. |
| 8 | `810dee8e` | `useContentQubeSeries` hook + `/api/registry/content-qube/series` list endpoint. ScrollsTab + CharactersTab off mocks, now persona-aware via `persona_owns`. |
| 9 | `82088b61` | `claimEditionForPurchase` — two atomic paths (canonical UPDATE-where-null + commons INSERT-at-max). `POST /api/registry/content-qube/[id]/claim` spine-gated. |
| 9.1 | `02a1d612` | T2 alias commitment piped via `cohortAliasService.computeAliasCommitment` — transfer receipt `t2_alias_commitment` no longer null. |
| 9.2 | `02a1d612` | `purchaseHandler.processPurchase` auto-fires `claimContentQubeEditions` post-grant. Fire-and-forget; entitlement grant remains source of truth. |
| A | `576dfaa6` | `OwnedIssue.contentTypes[]` field; `KnytTab.resolveVariant`, variant-aware `isEpisodeLocked` + `openEpisodeVideo`. |
| B | `d9ab98b5` | `/api/registry/content-qube/series-rights` endpoint (UNION of registry + synthesized SKU-rights placeholders); `useContentQubeSeriesRights` hook; KnytShelfTab + KnytTab + ScrollsTab + CharactersTab migrated. `is_placeholder?: boolean` on `ContentQubeDisplayManifest`. `useOwnedEntitlements` + `/api/codex/owned` marked `@deprecated`. |

Reference docs:
- `codexes/packs/agentiq/updates/2026-05-13_qripto-spine-contentqube-protocol-alignment.md`
- `codexes/packs/agentiq/updates/2026-05-14_contentqube-registry-as-sot-shelf-tab-canonicalization.md`
- `codexes/packs/agentiq/updates/2026-05-13_base-tokenqube-activation-backlog.md`

**Implications for this PRD:**

- The canonical resolver pattern is **already proven** for ContentQubes via `resolveContentQube` / `buildDisplayManifest`. The Phase 1 work in this PRD generalises that pattern to all primitives, not invents it.
- The DVN receipt privacy contract is **already enforced by construction** in `content_qube_dvn_receipts` (no `persona_id` column). The convergence proposed in §6 must preserve that property when extending to `orchestration_events` for non-content primitives.
- The chain-mint code path is **already wired** for ContentQube editions (Phase 7B). Extending to non-content primitives (ToolQube, ModelQube, AigentQube, etc.) is a known follow-up — not a fresh build.
- KNYT cartridge surfaces are **already on the registry** for `persona_owns` decisions. Other cartridges (KnytStoreEpisodesTab, KnytStoreCardsTab, bundle wizard, admin tools) remain on legacy paths per the explicit Phase B deprecation strategy.
- The four-parallel-paths problem identified in the `2026-05-14` doc has been **reduced to one**: registry-primary, Phase A variant-aware legacy fallback. The remaining duplicated readers exist in non-KNYT-shelf surfaces (admin, store, bundle wizard).

This PRD's contribution is therefore **not** "consolidate ContentQube" — that's done. It is **"generalise the canonical-resolver / canonical-receipt-stream / canonical-manifest pattern from ContentQube to every iQube primitive, and add the missing agent-legibility layer."**

### 2.10 What does NOT exist

Verified by direct search:

- No `.well-known/` directory at repo root, `app/`, or `public/` — **no canonical agent-legibility descriptor surface exists.**
- No public `/iqube-catalog` JSON endpoint.
- No public iQube Card endpoint resolving from canonical registry record.
- No Agent Card / A2A Card endpoint registry — `packages/agentiq-sdk/src/A2AClient.ts` is a client only.
- No single resolver `resolveIQube(id) → CanonicalIQubeRecord`. `getQubeTriad(metaId, blakId, tokenId)` requires three IDs.
- No registry-side DVN receipt index — receipts persist in `orchestration_events` + `content_qube_dvn_receipts` separately.
- No persona ↔ TokenQube link in Supabase post-mint (ownership is implicit in on-chain `to` address).
- No canonical DIDQube table; identity is FIO-handle-centric.

---

## 3. Fragmentation / Gap Analysis

> **Read first:** §2.9 names what is already consolidated. The fragmentation claims below are scoped to surfaces NOT covered by the 2026-05-13/14 ContentQube + spine consolidation. Where prior work has reduced a duplicated path to one, this section says so explicitly.

### 3.1 Type fragmentation

- `IQubeType` in `types/registry.ts` enumerates `'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube' | 'LiquidUITemplateArchetypeQube'` but **omits `ClusterQube`** and does not include the `asset_class` enum used by the ingestion factory (`ToolQube | SkillQube | WorkflowQube | ConnectorQube`). Ingestion writes assets with a class that does not appear in `IQubeType`.
- `AigentQube` has its own 313-line type file (`types/aigentQube.ts`) that does not extend `IQubeTemplate`.
- `ContentQube` has its own 304-line type file that does not extend `IQubeTemplate`.
- There is no `CanonicalIQubeRecord` interface that unifies primitive + meta/blak/token triad + content + ingestion + provenance + receipts.

### 3.2 Registry surface fragmentation

Three parallel registries currently live in the codebase:

| Surface | Tables | Owner |
|---|---|---|
| **Triad CRUD** | `iq_meta_qubes`, `iq_blak_qubes`, `iq_token_qubes` | `server/services/iqRegistryService.ts` |
| **Ingestion Factory** | `registry_intakes`, `registry_sources`, `registry_assets` | `services/registry/*` |
| **ContentQube** | `content_qubes` + 7 related tables | new (Phase 3 VIEW pending) |

These three do not share a canonical iQube ID. An ingested asset (`registry_assets.asset_id`) and a triad MetaQube (`iq_meta_qubes.id`) and a ContentQube (`content_qubes.id`) are not unified.

### 3.3 Stubbed canonical endpoint

`app/api/registry/iqube/route.ts` is a **mock-response stub**. The code path that should be the canonical "register an iQube" endpoint returns a fake response with a TODO to proxy to a real registry service. This is the single biggest fragmentation symptom — there is no canonical "create iQube" entrypoint that any caller should hit.

### 3.4 Receipt fragmentation — **mixed status**

Four receipt-emitting surfaces, with deliberate separations:

- `services/orchestration/orchestrationEvents.ts` → `orchestration_events` — T2-safe, identity-spine compliant, **platform-wide** access decisions.
- `content_qube_dvn_receipts` (writer landed Phase 5, `70de5c8e`) — **per-qube indexed**, privacy-by-construction (no `persona_id` column, only `t2_alias_commitment`). Complements orchestration_events; not duplicative. Receipt kinds include `access`, `mint`, `transfer`, `creation`.
- `services/registry/receiptEmitter.ts` → registry-asset-scoped. Used by ingestion factory.
- `clawhack-group-agents/bridge-core/dvnReceiptService.ts` → QubeTalk/HTTP relay buffer.

The deliberate separation between `orchestration_events` and `content_qube_dvn_receipts` is per Phase 5 design — the per-qube table is the audit/anchor surface and `orchestration_events` is the platform-wide decision feed. The PRD's §6 convergence proposal must respect this: extend `orchestration_events` with an `iqube_id` column for cross-primitive queries, not collapse the per-qube tables.

Remaining real gaps:
- `app/api/core/mint-tokenqube/route.ts` (EVM mint for non-content iQubes) emits ICP Proof-of-State only — does **not** emit a canonical DVN receipt.
- `services/registry/receiptEmitter.ts` (ingestion) is not unified with `orchestration_events` and is not indexable by iqube_id.
- `bridge-core/dvnReceiptService.ts` is a relay buffer; its write target audit is unclear.
- No cross-surface query API: receipts cannot today be queried by iQube ID across orchestration + content + ingestion surfaces in one call.

### 3.5 Content registry duplication — **partially resolved**

Legacy `master_content_qubes` and `codex_media_assets` are bridged with FK columns (`master_qube_id`, `media_asset_id`) on `content_qubes`. Phase 3 (`v_content_qube_registry` VIEW + `GET /api/registry/content-qube/[id]`) **has landed** (commit `eaa6f383`). Phase 6 (KNYT pilot bridge) **has landed** (commit `897314a4`). The Phase B work (commit `d9ab98b5`) added `useContentQubeSeriesRights` and the union endpoint and migrated KnytShelfTab / KnytTab / ScrollsTab / CharactersTab off legacy. Legacy `useOwnedEntitlements` and `/api/codex/owned` are marked `@deprecated`. Remaining migrators (non-KNYT-shelf): `KnytStoreEpisodesTab`, `KnytStoreCardsTab`, the bundle wizard, several admin tools. Decommissioning the legacy tables themselves is a later phase per `2026-05-14` doc.

### 3.6 Minting → Registry link gap

EVM mint at `app/api/core/mint-tokenqube/route.ts` writes the chain anchor back via `updateTokenQubeChainAnchor` but does **not**:
- Link the minted TokenQube to a persona row in Supabase (ownership is implicit in on-chain `to`)
- Emit a canonical DVN receipt in `orchestration_events`
- Upload BlakQube ciphertext to Autonomys (TODO)
- Create an agent-readable iQube Card

### 3.7 No agent-legibility layer

No `.well-known` descriptors. No public iQube Card / Agent Card / A2A Card endpoints derived from registry records. The Composer surfaces a `DVNReceiptsPanel` but the registry itself has no DVN tab.

### 3.8 No registry-resolved cartridge access

Cartridge tabs (e.g. `RegistrySupplyTab`, `AgentiQOSTab`, `KnytTab`) consume their own data shapes and do not call a shared `resolveIQube(id)` resolver. Identity propagation works (per CLAUDE.md `buildCodexUrl()`), but content/iQube resolution is duplicated per tab.

---

## 4. Canonical Registry Model

The canonical record `CanonicalIQubeRecord` should consolidate triad + ingestion + content + provenance + receipts into one resolvable shape. Proposed minimal schema:

```ts
interface CanonicalIQubeRecord {
  // Identity
  iqube_id: string;                   // canonical UUID, stable across triad/ingestion/content
  primitive_type: IQubeType;          // DataQube | ContentQube | ToolQube | ModelQube | AigentQube | ClusterQube | SkillQube | WorkflowQube | ConnectorQube | LiquidUITemplateArchetypeQube
  instance_type: 'template' | 'instance';
  template_lineage?: { parent_id: string; version: string }[];

  // Triad
  meta_qube_id: string;               // → iq_meta_qubes.id (always public-safe metadata)
  blak_qube_id?: string;              // → iq_blak_qubes.id (reference only; payload NEVER exposed via descriptor)
  token_qube_id?: string;             // → iq_token_qubes.id (entitlement; chain anchor)

  // Provenance
  creator_persona_id?: string;        // T0 — server-internal only
  creator_identity_state: Identifiability;
  creator_alias_commitment?: string;  // T2 — public-network safe
  steward_persona_id?: string;        // T0
  origin: 'ingested' | 'native' | 'minted' | 'forked' | 'imported';
  ingestion_intake_id?: string;       // → registry_intakes.intake_id

  // State
  status: 'draft' | 'wip' | 'review_pending' | 'published' | 'canonized' | 'deprecated' | 'revoked';
  canonicalization_status: 'wip' | 'finalized' | 'canonized';
  wip_supabase_only: boolean;         // true while still in Supabase WIP; false once registry-canonical
  visibility: 'private' | 'semi_public' | 'public' | 'token_gated';

  // Access
  access_policy_id?: string;          // → content_qube_access_policies.id or equivalent
  gating: 'free' | 'credential' | 'payment' | 'token' | 'identity';
  required_credentials?: string[];    // cohort:* | token:* | role:*

  // Minting / chain
  mint_status: 'unminted' | 'minting' | 'minted' | 'transfer_pending' | 'transferred' | 'revoked';
  chain_anchor?: { chain_id: number; contract: string; token_id: string; tx_hash: string };

  // Content (only for ContentQube)
  content_qube_id?: string;           // → content_qubes.id

  // Agent legibility
  agent_card_descriptor_url?: string; // e.g. /.well-known/iqube-cards/<iqube_id>.json
  cartridge_bindings: string[];       // codex slugs / cartridge IDs that render this iQube

  // Receipts
  dvn_receipt_index: {
    last_receipt_id?: string;
    receipt_count: number;
  };

  // Versions
  version: string;
  version_history_id?: string;        // → content_qube_versions or equivalent

  created_at: string;
  updated_at: string;
}
```

This record is built by a canonical resolver — see §11. It is the only shape any cartridge, UI, agent endpoint, or external integration should consume for "what is this iQube?"

---

## 5. Supabase vs Registry / Ledger Relationship

Proposed model — validated against existing code:

| Tier | Backing store | Role |
|---|---|---|
| **WIP / draft** | Supabase (existing tables) | Draft iQubes, ingestion intakes, pre-mint state. Mutable. RLS-controlled. |
| **Canonical Registry** | Supabase (canonical tables) + canonical resolver | Source of truth for the `CanonicalIQubeRecord`. Append-only for canonized records (version bumps, never destructive updates). |
| **Chain Anchor** | EVM (Base), ICP, future DVN ordinal inscription | On-chain proof of mint, transfer, ownership. Authoritative for entitlement, not for metadata. |
| **DVN Receipts** | `orchestration_events` table (+ future ordinal inscription via `inscription_id`) | Authoritative receipt trail. Indexed by `iqube_id`, `block`, `actor_alias_commitment`. |

Rules:

- WIP iQubes live in Supabase. They may be private (creator only), semi-public (cartridge-scoped), public (discoverable), or invisible (system-only).
- A WIP record becomes **canonical** when it is published, minted, or canonized. The transition is auditable (receipt emitted).
- metaQube metadata is **publicly resolvable** for canonical records where visibility allows.
- BlakQube payloads are **never exposed** through registry resolver responses or agent descriptors. The registry surfaces a **reference** (provider + locator + content-hash); access goes through `evaluateAccess()` + `streamStateCPlaintext()`.
- tokenQube mediates entitlement. Registry surfaces entitlement status (owned / required / gated), not the unwrap key.
- Chain anchor is consulted as additional proof of ownership when `evaluateAccess()` runs against a token-gated descriptor (Phase 4 wiring).

---

## 6. DVN Receipt Registry Surface

The registry must offer block-level and object-level receipt analysis without duplicating receipt authority.

### 6.1 Indexing

- All canonical receipts continue to be written by `services/orchestration/orchestrationEvents.ts` to `orchestration_events`.
- Add a composite index on `(asset_id, created_at DESC)` and `(actor_alias_commitment, created_at DESC)`.
- Add (or expose) a `block_height` / `block_anchor` column populated when receipts are ordinal-inscribed (Phase 3.4).
- `services/registry/receiptEmitter.ts` and `bridge-core/dvnReceiptService.ts` and `content_qube_dvn_receipts` should converge on `orchestration_events` as the single write target, then add per-domain views if needed. No new write surfaces.

### 6.2 Query API (new)

- `GET /api/registry/receipts?iqube_id=...` — receipts for an iQube
- `GET /api/registry/receipts?cartridge=...` — receipts in a cartridge scope
- `GET /api/registry/receipts?tx_hash=...` — receipts for a transaction
- `GET /api/registry/receipts?primitive_type=...` — receipts by primitive type
- `GET /api/registry/receipts?block=...` — receipts in a block (post-Phase 3.4)
- `GET /api/registry/receipts/chain?iqube_id=...&action=...` — CRUD receipt chain for a single iQube + action

Filters: `persona`, `wallet`, `aigent`, `cartridge`, `primitive_type`, `status`, `risk_level`, `date_range`. **All persona filters operate via `actor_alias_commitment` (T2-safe)** — never expose raw `personaId` in receipt queries.

### 6.3 UI

New tab inside `RegistryHome` (and inside the AgentiQ OS / Registry cartridge tab):
- `RegistryDVNTab` — by iQube, by block, by transaction, by primitive type, by cartridge
- Receipt chain visualization for a single iQube
- Filter chips matching the query API above
- Re-uses `components/composer/DVNReceiptsPanel.tsx` rendering primitive — do not duplicate the panel

### 6.4 Agent-readable

- `GET /api/registry/receipts/feed?iqube_id=...&format=agent` — agent-readable JSON feed of receipts for an iQube, T2-safe only.

---

## 7. Minting and Tokenization Integration

Minting must update or create canonical registry records and emit a canonical DVN receipt. The current `app/api/core/mint-tokenqube/route.ts` does neither.

### 7.1 Flow

```
1. Draft iQube created in Supabase (WIP) → CanonicalIQubeRecord{ status: 'draft', mint_status: 'unminted' }
2. metaQube generated via createMetaQube()
3. BlakQube payload encrypted + uploaded to Autonomys/IPFS → createBlakQube()  [Autonomys TODO]
4. tokenQube entitlement created via createTokenQube()
5. Wallet signs mint tx (recipient = persona address)
6. EVM contract mints; QubeAnchored event observed
7. updateTokenQubeChainAnchor() writes chain state
8. NEW: Persona ↔ TokenQube link row written in Supabase (canonical ownership)
9. NEW: DVN receipt emitted via orchestrationEvents.emitDecisionReceipt({ action: 'mint', ... })
10. NEW: CanonicalIQubeRecord status → 'minted'
11. NEW: Agent-readable card published to /.well-known/iqube-cards/<iqube_id>.json
12. ICP Proof-of-State receipt fires (existing — secondary signal)
```

Steps 8–11 are net new. Step 12 stays as a secondary, non-authoritative signal.

### 7.2 Transfers, versions, revocation

- Transfer: chain event observed → update chain anchor → emit transfer receipt → update persona ↔ TokenQube link.
- Version bump: append to `content_qube_versions` or registry version table → emit `mint`/`canonize` receipt with `parent_version`.
- Revocation: set `status: 'revoked'`, emit `policy-escalation` receipt. Chain anchor stays as history.

---

## 8. Agent-Legibility Layer

The registry remains canonical. Agent-readable cards are **descriptor surfaces derived from registry records** — never primary state.

### 8.1 Surface map

| Path | Role | Source |
|---|---|---|
| `/.well-known/iqube-registry.json` | Catalog descriptor + endpoint list | derived from registry config |
| `/.well-known/iqube-cards/<iqube_id>.json` | Per-iQube card | derived from `CanonicalIQubeRecord` |
| `/.well-known/agent-cards/<aigent_id>.json` | Per-Aigent card | derived from AigentQube records |
| `/.well-known/a2a/<aigent_id>.json` | A2A handshake descriptor | derived from AigentQube records |
| `GET /api/registry/catalog?format=agent` | Agent-readable browse | derived from registry resolver |
| `GET /api/registry/iqube/<id>/card?format=agent` | Programmatic card fetch | derived from `CanonicalIQubeRecord` |

### 8.2 Exposure rules

- Public metaQube fields only. Never BlakQube payload. Never any T0 identifier (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, or another persona's `fioHandle`).
- Only T2 identifiers (`cohort_alias_commitment`, `cohort_id`) and T1-safe fields (`display_label`, `own_fio_handle`).
- Token-gated iQubes publish a card with policy hints (`gating`, `required_credentials`) but no unwrap key.
- Private / WIP iQubes are not published as cards.

### 8.3 Policy / action descriptors

Card includes:
- `actions`: allowed actions (`read`, `watch`, `invoke`, `mint`, `transfer`, ...) per `AccessAction` enum in `types/access.ts`
- `policy.gating` + `policy.required_credentials`
- `policy.receipt_mode` per action (from `policyResolvers.resolveReceiptMode`)

---

## 9. Cartridge Access and Registry Cartridge

### 9.1 Surfaces

The Registry should be exposed in three places, all consuming the same canonical resolver:

1. **Registry Cartridge** (proposed slug: `iqube-registry`) — operator/human interface. Houses `RegistryHome`, ingestion factory, DVN receipts, agent-legibility settings.
2. **AgentiQ OS cartridge → Registry tab** (`RegistrySupplyTab.tsx` already exists) — operator-facing within AgentiQ OS.
3. **Registry as a service** — every cartridge that renders an iQube imports the canonical resolver `resolveIQube(id)` from `services/registry/resolver.ts` (new). Cartridge-local rendering allowed; canonical data must resolve through the resolver.

### 9.2 Cartridge resolver contract

```ts
// services/registry/resolver.ts (new)
export async function resolveIQube(
  iqube_id: string,
  opts: { persona?: ActivePersonaContext; expand?: ('meta'|'blak_ref'|'token'|'content'|'receipts'|'card')[] }
): Promise<CanonicalIQubeRecord>;

export async function resolveIQubeByChainAnchor(
  chain_id: number, contract: string, token_id: string
): Promise<CanonicalIQubeRecord | null>;

export async function listIQubes(filter: RegistryFilter, opts: PaginationOpts): Promise<CanonicalIQubeRecord[]>;
```

Cartridges currently consuming their own shapes (`KnytTab.tsx`, `KnytStoreAdminTab.tsx`, `QriptoScrollsTab.tsx`, etc.) migrate progressively. The resolver should accept legacy IDs (master_content_qube, codex_media_asset, registry_asset) and return the unified `CanonicalIQubeRecord` until the underlying tables converge.

---

## 10. UI / UX Requirements

`RegistryHome` extends to support:

- Browse all iQubes — filter by primitive type, cartridge, status, access type, canonization state, creator identity state, mint status.
- Detail view (`IQubeDetailModal`) — metaQube panel, tokenQube/entitlement status panel, BlakQube access request panel (CTA to `evaluateAccess`), DVN receipts panel, provenance/lineage panel, agent-card preview panel, "launch in cartridge" CTA.
- New: Receipts tab (per §6.3).
- New: Ingestion tab — surfaces ingestion intake state (already present via `IngestionFactoryPanel.tsx`); make it consume the resolver.
- New: Admin tools — consolidation, reconciliation, dedupe duplicate iQubes, migrate WIP → canonical, deprecate, version bump.

Application-level iQube renderings (KnytTab, etc.) remain free but must consume `resolveIQube()` data, not query their own tables for canonical fields.

---

## 11. API / Service Requirements

### 11.1 Replace the stub

`app/api/registry/iqube/route.ts` — replace mock with real implementation calling `services/registry/resolver.ts` write path. POST creates a draft `CanonicalIQubeRecord`.

### 11.2 New endpoints

| Path | Method | Role |
|---|---|---|
| `GET /api/registry/iqube/[id]` | GET | Resolve canonical record |
| `POST /api/registry/iqube` | POST | Create draft (replaces stub) |
| `PATCH /api/registry/iqube/[id]` | PATCH | Update draft metadata |
| `POST /api/registry/iqube/[id]/mint` | POST | Trigger mint (orchestrates §7.1) |
| `POST /api/registry/iqube/[id]/canonize` | POST | Promote WIP → canonical |
| `POST /api/registry/iqube/[id]/deprecate` | POST | Mark deprecated |
| `POST /api/registry/iqube/[id]/version` | POST | New version |
| `GET /api/registry/iqube/[id]/card` | GET | Agent-readable card |
| `GET /api/registry/iqube/[id]/receipts` | GET | DVN receipts for iQube |
| `GET /api/registry/iqube/[id]/access` | GET | Access policy + caller's allow/deny |
| `POST /api/registry/iqube/[id]/access/blakqube` | POST | Request BlakQube access (gated by `evaluateAccess`) |
| `GET /api/registry/catalog` | GET | Browse / agent-readable catalog |
| `GET /api/registry/receipts?...` | GET | Multi-filter receipt query (§6.2) |
| `GET /.well-known/iqube-registry.json` | GET | Public catalog descriptor |
| `GET /.well-known/iqube-cards/[id].json` | GET | Public iQube card |
| `GET /.well-known/agent-cards/[id].json` | GET | Public Agent Card |
| `GET /.well-known/a2a/[id].json` | GET | A2A descriptor |

### 11.3 Existing endpoints preserved

All endpoints in §2.5 keep their current behavior. Internally they should consume the canonical resolver where they currently query tables directly.

---

## 12. Data Migration / Consolidation Plan

### 12.1 Canonical ID strategy

- One `iqube_id` (UUID v4) per logical iQube.
- Mapping table `iqube_id_map(iqube_id, source, source_id)` where `source ∈ {triad_meta, registry_asset, content_qube, master_content_qube, codex_media_asset, identity_iqube, memory_iqube, aigentqube_asset}`.
- Backfill: for each existing record across the eight source surfaces, generate or assign an `iqube_id` and write the map row.

### 12.2 Per-domain migration

| Domain | Action |
|---|---|
| Triad CRUD (`iq_meta_qubes`/`iq_blak_qubes`/`iq_token_qubes`) | Backfill `iqube_id` column on `iq_meta_qubes`; map row written; resolver reads triad via meta_qube_id lookup |
| Ingestion (`registry_intakes`/`registry_sources`/`registry_assets`) | Backfill `iqube_id` on `registry_assets`; align `asset_class` enum with `IQubeType` (add SkillQube/WorkflowQube/ConnectorQube to canonical enum) |
| ContentQube (`content_qubes`) | Backfill `iqube_id`; align with `content_qube_id` lookup |
| Legacy content (`master_content_qubes`, `codex_media_assets`) | Bridge rows already have FK on `content_qubes`; migrate via the bridge then drop legacy tables in a later phase |
| Identity / Memory iQubes | Backfill `iqube_id`; expose via resolver |
| AigentQube assets | Backfill `iqube_id`; expose via resolver; unify with `types/aigentQube.ts` |
| DVN receipts | Add `iqube_id` column on `orchestration_events`; backfill from `metadata.asset_id` where present; converge `content_qube_dvn_receipts` writes onto `orchestration_events` |
| Persona ↔ TokenQube link | New table `persona_token_qube_ownership(persona_id, token_qube_id, chain_anchor, acquired_at, source)`; backfill from existing wallet records where possible |

### 12.3 Duplicate detection

- Before assigning canonical IDs, run a dedupe pass: same `content_hash`, same `chain_anchor`, or same `slug` within a `series` → flag for human review; do not auto-merge.

### 12.4 Rollback

- All migrations behind feature flag `REGISTRY_CANONICAL_PLANE_V0_1`. Resolver continues to work without flag by falling back to direct table reads.
- Backfill scripts idempotent and re-runnable.

---

## 13. Acceptance Criteria (Phase 1)

- [ ] `CanonicalIQubeRecord` type defined and exported from `types/registry.ts` (extended) — includes all primitive types: `DataQube | ContentQube | ToolQube | ModelQube | AigentQube | ClusterQube | SkillQube | WorkflowQube | ConnectorQube | LiquidUITemplateArchetypeQube`.
- [ ] `services/registry/resolver.ts` exists and exposes `resolveIQube`, `resolveIQubeByChainAnchor`, `listIQubes`.
- [ ] `app/api/registry/iqube/route.ts` no longer returns a mock — it calls the resolver write path.
- [ ] All endpoints in §11.2 implemented and covered by integration tests.
- [ ] ContentQube records resolvable through the canonical resolver via `content_qube_id`.
- [ ] metaQube / BlakQube / tokenQube relationships represented consistently on the canonical record.
- [ ] Minting (`/api/core/mint-tokenqube`) emits a canonical DVN receipt via `orchestrationEvents.emitDecisionReceipt()` with `action: 'mint'` and updates `CanonicalIQubeRecord.mint_status`.
- [ ] DVN receipts queryable by `iqube_id`, by `actor_alias_commitment`, by `tx_hash`, by `primitive_type`, by cartridge.
- [ ] `RegistryDVNTab` available inside `RegistryHome` and inside the Registry cartridge / AgentiQ OS tab.
- [ ] WIP iQubes in Supabase have a documented promotion path to canonical via `POST /api/registry/iqube/[id]/canonize`.
- [ ] At least one cartridge (proposed: `KnytTab`) demonstrates consuming the resolver instead of querying its own tables for canonical fields.
- [ ] At least one agent-readable iQube card resolvable at `/.well-known/iqube-cards/<iqube_id>.json` for a published canonical record.
- [ ] No private BlakQube payload appears in any agent-readable descriptor (verified by extending `tests/persona-broadcast-handshake.test.ts` canary pattern with iQube descriptor checks).
- [ ] No T0 identifier (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, cross-persona `fioHandle`) appears in any registry-bound JSON.
- [ ] `evaluateAccess()` is the only gate consulted for BlakQube access requests via the registry — no parallel auth resolver introduced.
- [ ] Wallet + persona spine integration: `userOwnsAsset()` is the only ownership check consulted by registry access flows.
- [ ] Migration backfill scripts written and idempotent; rollback path documented.
- [ ] CLAUDE.md updated to name the canonical resolver as the required entry point for iQube resolution.

---

## 14. Implementation Plan

### Stage 0: Codebase Audit (1–2 days)

Complete a final pre-implementation audit beyond §2: confirm every existing read surface that should migrate to the canonical resolver. Output a per-cartridge table (KnytTab, KnytStoreAdminTab, QriptopianEditTab, RegistrySupplyTab, etc.) of current shape vs. resolver shape.

### Stage 1: Canonical Schema (2–3 days)

- Extend `types/registry.ts` with `CanonicalIQubeRecord`, expanded `IQubeType` enum.
- Migration: `iqube_id` columns + `iqube_id_map` table.
- No behavior change yet; new columns nullable.

### Stage 2: Canonical Resolver (3–5 days)

- Implement `services/registry/resolver.ts` with read path covering all eight source surfaces via the map table.
- Implement `app/api/registry/iqube/[id]/route.ts` GET.
- Replace the mock in `app/api/registry/iqube/route.ts` with a real POST.
- Integration tests for the resolver across all source surfaces.

### Stage 3: ContentQube Consolidation Completion (2–3 days)

**Note:** ContentQube core consolidation already landed (Phases 2–9.2 + A/B). This stage finishes the migration in the remaining surfaces.

- Migrate the remaining non-KNYT-shelf consumers off `useOwnedEntitlements` / `/api/codex/owned`: `KnytStoreEpisodesTab`, `KnytStoreCardsTab`, bundle wizard, admin tools (per `2026-05-14` doc backlog).
- Generalise `useContentQubeSeriesRights` pattern into the canonical resolver as the read path for ContentQube records inside `resolveIQube`.
- Then schedule legacy table decommission (`master_content_qubes`, `codex_media_assets`, `useOwnedEntitlements`, `/api/codex/owned`) — separate ticket post-observation window.
- **Phase C (per-rarity persona ownership)** from `2026-05-14` doc is an explicit dependency for full ScrollsTab rarity-aware locking — surface in Open Questions §17.

### Stage 4: Minting Integration (3–4 days)

**Note:** ContentQube edition minting is already wired via `services/chain/baseTokenMint.ts` (Phase 7B, commit `a2cc3d0c`) — `mintCanonicalEdition` for ERC-1155, `mintMasterQube` for ERC-721, deterministic SHA-256 token IDs, graceful pre-deploy fallback, mint receipts to `content_qube_dvn_receipts`. Phase 9.2 auto-fires `claimContentQubeEditions` post-grant.

This stage extends that pattern to non-content primitives (triad TokenQube via `app/api/core/mint-tokenqube/route.ts`).

- Add Persona ↔ TokenQube link table for triad-minted iQubes (new join table — ContentQube editions already have `persona_id` columns).
- Wire `app/api/core/mint-tokenqube/route.ts` to emit canonical DVN receipt via `orchestrationEvents.emitDecisionReceipt({ action: 'mint', ... })` and additionally record an `iqube_id`-tagged row.
- Update `CanonicalIQubeRecord.mint_status` post-mint.
- Add Autonomys upload to mint flow (currently TODO in `/app/api/iqube/persona/knyt/mint/route.ts`).
- Confirm `baseTokenMint.ts` `isCanonicalRarity` guard handles the new primitive types correctly (or extend if needed for non-content primitives).

### Stage 5: DVN Receipt Index (3–4 days)

**Note:** `content_qube_dvn_receipts` (per-qube, T2-only, no `persona_id`) is the audit/anchor surface and `orchestration_events` is the platform-wide decision feed. Do not collapse them; bridge them.

- Add composite indexes + `iqube_id` column to `orchestration_events`.
- Backfill `orchestration_events.iqube_id` from `metadata.asset_id` where present.
- Implement `GET /api/registry/receipts` query API per §6.2 — query joins `orchestration_events` (by `iqube_id`) UNION `content_qube_dvn_receipts` (by `content_qube_id` via canonical iqube_id map) when the iQube primitive is ContentQube.
- Build `RegistryDVNTab` UI (re-use `components/composer/DVNReceiptsPanel.tsx`).
- Converge `services/registry/receiptEmitter.ts` (ingestion-asset receipts) and `clawhack-group-agents/bridge-core/dvnReceiptService.ts` (QubeTalk relay) onto `orchestrationEvents` as canonical writer for non-ContentQube receipts. Per-qube ContentQube receipts continue to land in `content_qube_dvn_receipts`.

### Stage 6: Cartridge Registry Surface (2–3 days)

- Wire `RegistrySupplyTab` and AgentiQ OS Registry tab to use the resolver.
- Decide registry cartridge scope (standalone vs. AgentiQ OS tab) — see Open Question §17.
- Document the resolver-as-shared-service pattern in CLAUDE.md.

### Stage 7: Agent-Legibility Layer (3–4 days)

- Implement `/.well-known/iqube-registry.json` and `/.well-known/iqube-cards/[id].json` Next.js route handlers.
- Generate cards from `CanonicalIQubeRecord` via a single derivation function.
- Add canary test mirroring `tests/persona-broadcast-handshake.test.ts` for descriptor exposure rules (verify no T0 fields, no BlakQube payload).
- Implement Agent Card + A2A descriptor handlers for AigentQubes.

### Stage 8: Migration + Cleanup (3–5 days)

- Backfill scripts for all source surfaces.
- Dedupe pass with human review queue.
- Decommission stub code paths.
- Decommission duplicate receipt writers (after observation window).

### Stage 9: Phase 2 Hooks (1–2 days)

- Stub interfaces only:
  - `services/registry/phase2/intent.ts` — `IntentCaptureInput`, `IntentToIQubeRequest`
  - `services/registry/phase2/calibration.ts` — `CalibrationProfile`, `calibrate(iqube_id, ...)`
  - `services/registry/phase2/risk.ts` — `RiskAssessment`, `assessRisk(iqube_id, ...)`
  - `services/registry/phase2/value.ts` — `ValueAssessment`, `assessValue(iqube_id, ...)`
  - `services/registry/phase2/pricing.ts` — `PricingProposal`, `proposePricing(iqube_id, ...)`
  - `services/registry/phase2/exchange.ts` — `ExchangeUtility`, marketplace seams
- No runtime implementation. Just types + commented stubs marking integration points.

**Total Stage 0–9 estimate:** ~23–33 working days for a single engineer, less if parallelized across cartridge surfaces.

---

## 15. Risks and Dependencies

### 15.1 Risks

- **Resolver becomes a bottleneck.** Mitigation: keep it stateless, cache by `iqube_id`, fan out via parallel reads to triad/content/ingestion tables.
- **Receipt write convergence loses data.** Mitigation: dual-write during a feature-flagged observation window; verify counts match before decommissioning old writers.
- **Cartridge migration drift.** Multiple sessions may touch the same cartridge tab. Mitigation: per CLAUDE.md multi-agent coordination, declare cartridge file scope in QubeTalk before editing.
- **BlakQube payload exposure during refactor.** Highest-severity risk. Mitigation: canary tests for every descriptor surface added; never expose `blak_qube_id` storage path in JSON responses.
- **Identity-spine bypass.** Mitigation: registry resolver must never resolve gating decisions itself — always delegate to `evaluateAccess()`. Code review gate.
- **Stub endpoint discovery.** The `iqube/route.ts` mock is one example; there may be others. Stage 0 audit must enumerate.
- **Phase 3.4 ordinal inscription dependency.** Block-level receipt analysis only meaningful once inscriptions land. Mitigation: ship block analysis behind a feature flag.

### 15.2 Dependencies

- CLAUDE.md identity-spine policy (in force; do not modify).
- ContentQube Phase 3 VIEW migration (`20260513020000`) needs activation.
- Autonomys storage adapter completion (currently TODO in mint route).
- ICP Proof-of-State canister remains as secondary signal — no change.
- Supabase RLS: extend `20260402020000_registry_rls.sql` to cover the new tables (map table, persona-tokenqube link).

---

## 16. Phase 2 Stub Scope (not in scope for v0.1 implementation)

These belong to a future PRD but interfaces are reserved:

- **Intent-based iQube creation** — capture user/agent intent, propose iQube structure, draft canonical record.
- **iQube curation** — review queues, partner-curated bundles.
- **iQube calibration** — adjust metaQube parameters, ground truth alignment.
- **iQube risk analysis** — quantified risk score against canonical risk model.
- **iQube value analysis** — Proof of Work Potential / Proof of Time Saved valuation loops.
- **iQube price / exchange analysis** — pricing proposals, marketplace integration, QriptoCENT / Q¢ payment-gated access (note: Q¢ pricing canonical rules in CLAUDE.md — `$1 = 100 Q¢`, store as integer cents).

Stage 9 above reserves the file paths and types; no logic.

---

## 17. Open Questions (for human review)

1. **Which existing registry schema is closest to canonical?** This PRD proposes the triad CRUD (`iq_meta_qubes` + companions) as the spine, extended with an `iqube_id` UUID and a map table. Operator approval needed.

2. **Should the Registry cartridge be standalone, or remain an AgentiQ OS tab?** Both surfaces work. Standalone gives it operating-system-layer weight; tab keeps it close to AgentiQ OS adjacents. Recommend: standalone `iqube-registry` cartridge AND retain the AgentiQ OS tab as a deep-link.

3. **Should `LiquidUITemplateArchetypeQube` remain in the primitive enum?** It's present in `types/registry.ts` but doesn't appear elsewhere. Likely vestigial.

4. **Which ContentQube records already have canonical IDs?** Verify `20260513030000_content_qubes_knyt_pilot.sql` assignment before backfill design.

5. **DVN receipt ordinal inscription cadence?** Phase 3.4 spec needs operator decision on batch size, inscription frequency, and which actions inscribe vs. stay async-batched.

6. **Persona ↔ TokenQube link table — own table or extend `personas`?** Recommend new join table for clean ownership history.

7. **Should `services/registry/receiptEmitter.ts` and `clawhack-group-agents/bridge-core/dvnReceiptService.ts` survive?** Recommend deprecating in favor of `orchestrationEvents.emitDecisionReceipt()` after observation window.

8. **Identity propagation in `/.well-known/` cards.** Cards are public — should they include any T1 fields, or remain strictly T2 + public metaQube only? Recommend T2 + public only; no T1 surface.

9. **Which app-level iQube templates should remain purely presentational?** Recommend: all cartridge tabs become presentation-only on the resolver. Composer renders authoring surface, Registry renders canonical view. Cartridge-local iQube cards are read-only views of the canonical record.

10. **Cluster of which canonized open-gated ContentQubes differ from private WIP ContentQubes** — verified by `visibility` + `gating` + `wip_supabase_only`. Operator should confirm taxonomy completeness before backfill.

11. **Registry operations requiring human approval.** Recommend: canonization, mint, transfer, revocation, deprecation, version bump for canonized records. Approval queue surfaced in the registry cartridge admin tab.

12. **Naming of the canonical resolver.** Recommend `services/registry/resolver.ts` exporting `resolveIQube()`. Confirm no naming conflict with existing `resolveContentQube` (already shipped Phase 4, `bd19049a`) — the proposed pattern is `resolveIQube()` calls `resolveContentQube()` internally for ContentQube records and adds resolution paths for other primitives.

13. **Phase C (per-rarity persona ownership)** — `2026-05-14` doc names this as a known follow-up for ScrollsTab. The PRD should either schedule it in Stage 3 or explicitly defer with a named ticket. Recommend: defer to a separate PRD because it requires extending `ContentQubeDisplayManifest` with a T1-safe `persona_owned_rarities: ContentQubeRarity[]` rollup and a per-edition lookup against `content_qube_editions` — orthogonal to general registry consolidation.

14. **Phase 9.3 chain-mint activation** — `2026-05-13_base-tokenqube-activation-backlog.md` covers Base ERC-1155 / ERC-721 contract deployment. This PRD's Stage 4 assumes that backlog item completes independently — it does not redo it.

---

## Appendix A — Files NOT to modify (per CLAUDE.md)

- `services/identity/getActivePersona.ts`
- `services/identity/personaSessionToken.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `services/content/getContentDescriptor.ts`
- `services/content/encryption.ts`
- `services/content/stateCDelivery.ts`
- `types/access.ts`

Registry resolver composes over these. No fork, no replacement.

## Appendix B — Required reading before implementation

1. `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
2. `types/access.ts`
3. `services/identity/getActivePersona.ts`
4. `services/access/evaluateAccess.ts`
5. `services/content/getContentDescriptor.ts`
6. `codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md`
7. `codexes/packs/agentiq/updates/2026-05-08_phase-1-iam-spine-closure.md`
8. `codexes/packs/agentiq/updates/2026-05-09_phase-2-encryption-decisions.md`
9. `supabase/migrations/20260513010000_content_qubes_schema.sql` (header has the Phase 3–8 roadmap)
10. `supabase/migrations/20260402010000_registry_ingestion_factory_v1.sql`

---

**End of PRD v0.1. Do not begin implementation until reviewed.**
