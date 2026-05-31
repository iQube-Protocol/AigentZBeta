# Stage 0 Audit Report — Canonical iQube Registry Operating Plane

**Status:** Pre-implementation audit. Required by PRD v1.1 §F before Stage 1 schema work begins.
**Date:** 2026-05-30
**Branch:** `claude/dreamy-gates-mMqNv`
**Reads with:** v1.0 (consolidated PRD) + v1.1 (guardrails).
**Sign-off required:** operator. On sign-off, Stage 1 schema migrations begin.

This audit answers the 7 deliverables listed in PRD v1.1 §F. Every finding is code-grounded — file paths and line numbers verified against `origin/dev` and the working tree.

---

## Deliverable 1 — Per-surface backfill readiness matrix

The canonical `iqube_id` UUID is a new identifier. Every existing source surface needs a backfill into `iqube_id_map(iqube_id, source, source_id)` before its read paths flip to `resolveIQube()`. This matrix names the source-of-record table, the natural join key, the dedupe signal, and the readiness gate.

| Source | Table(s) | Natural join key | Row-count signal | Dedupe signal | Backfill complexity | Gate status |
|---|---|---|---|---|---|---|
| **Triad MetaQube** | `iq_meta_qubes` | `id` (already UUID) | `SELECT count(*) FROM iq_meta_qubes` | `slug` UNIQUE within tenant; `content_hash` if present | Trivial — `iqube_id = id` straight copy | Ready Stage 1 |
| **Triad BlakQube** | `iq_blak_qubes` | `id` + FK to meta | `SELECT count(*) FROM iq_blak_qubes` | Locator hash; provider+path uniqueness | Trivial — keyed off meta_id resolution | Ready Stage 1 |
| **Triad TokenQube** | `iq_token_qubes` | `id` + chain_anchor | `SELECT count(*) FROM iq_token_qubes` | `chain_id + contract + token_id` UNIQUE | Trivial | Ready Stage 1 |
| **Registry Assets (ingestion)** | `registry_assets` | `asset_id` | `SELECT count(*) FROM registry_assets` | `(tenant_id, slug)` UNIQUE; `content_hash` from source | Medium — `asset_class` → `(primitive_type, tool_subtype)` migration (per v0.2 §A.1) | Needs `asset_class` migration first |
| **ContentQube** | `content_qubes` | `id` (already UUID) | `SELECT count(*) FROM content_qubes` | `(series, content_kind, display_number)` for episodic; `(series, content_kind)` for non-episodic | Trivial — `iqube_id = id` straight copy | Ready Stage 1 |
| **Legacy bridge — master_content_qubes** | `master_content_qubes` | `id` | n/a — bridged via `content_qubes.master_qube_id` | Already deduplicated via Phase 6 pilot | Indirect — surfaces through `content_qubes` | No direct backfill; legacy decommission post-Stage 4 |
| **Legacy bridge — codex_media_assets** | `codex_media_assets` | `id` | n/a — bridged via `content_qubes.media_asset_id` | Same as above | Indirect | Same |
| **Identity iQubes** | `personas` + identity migrations | `persona_id` | `SELECT count(*) FROM personas WHERE identity_iqube_id IS NOT NULL` | One identity iQube per persona; persona uniqueness enforced upstream | Low — direct map | Ready Stage 1 |
| **Memory iQubes** | (memory_iqubes migration) | `memory_iqube_id` | `SELECT count(*) FROM memory_iqubes` | persona+memory_class composite | Low | Ready Stage 1 |
| **AigentQube (hand-seeded)** | `RUNTIME_AGENT_IDS` (code, not DB) | runtime id string | 5 hand-seeded (`aigent-me`, `aigent-marketa`, `aigent-kn0w1`, `aigent-moneypenny`, `aigent-nakamoto`) | None — runtime constants | No backfill needed Stage 1; deferred to legibility fast-follow #3 (DB promotion) | Code-only; flag for promotion |
| **ToolQube (openclawCore)** | `openclawCore` (code) | `tool_id` string | runtime-registered (see toolQubeSource.ts) | None — runtime registry | Same as AigentQube — code only Stage 1 | Code-only; flag for promotion |
| **LiquidUITemplateArchetypeQube seeds** | `app/api/registry/templates/store.ts` | template id string | 20 hardcoded seeds | seed-list uniqueness in source | Migration is reclassification, not row-by-row backfill | See Deliverable 2 |

**Per-surface verification queries** (operator runs in Stage 1 to confirm backfill completeness):

```sql
-- Triad backfill verification
SELECT COUNT(*) FROM iq_meta_qubes
EXCEPT
SELECT COUNT(*) FROM iqube_id_map WHERE source = 'triad_meta';

-- ContentQube backfill verification
SELECT COUNT(*) FROM content_qubes
EXCEPT
SELECT COUNT(*) FROM iqube_id_map WHERE source = 'content_qube';

-- Registry assets backfill verification (after asset_class migration)
SELECT COUNT(*) FROM registry_assets
EXCEPT
SELECT COUNT(*) FROM iqube_id_map WHERE source = 'registry_asset';

-- Each must return zero — anything non-zero is a backfill gap.
```

**Row-count snapshot (operator-confirmed, 2026-05-30, dev Supabase):**

| Source | Live rows | Notes |
|---|---:|---|
| `iq_meta_qubes` | **87** | One orphan meta (no matching blak/token) — see finding F below |
| `iq_blak_qubes` | **86** | |
| `iq_token_qubes` | **86** | |
| `registry_assets` | **28** | Tiny; ToolQube-subtype migration affects 23 rows (see Block 3) |
| `registry_intakes` | **3** | Ingestion factory barely used |
| `content_qubes` | **49** | One row per qube; access policy 1:1 |
| `content_qube_access_policies` | **49** | Perfect 1:1 with content_qubes |
| `content_qube_editions` | **78,150** | 49 qubes × ~1595 avg (canonical pre-seed target = 1,860; gap suggests some qubes incomplete) |
| `content_qube_dvn_receipts` | **12,554** | Substantial receipt history; index design important Stage 6 |
| `master_content_qubes` (legacy) | **16** | Bridged via FK |
| `codex_media_assets` (legacy) | **120** | Bridged via FK |
| `personas` | **7,393** | Most personas don't own an iQube — expected |
| `orchestration_events` | **12,352** | Platform-wide receipts; `iqube_id` column backfill Stage 6 |

**ContentQube lifecycle stratification (49 rows):**

| `lifecycle_state` | Count | Series breakdown |
|---|---:|---|
| `canonized` | 48 | metaKnyts: 41 (15 ep + 13 char + 13 powers); activation_tab: 6 (avl 1, knyt 1, marketa 1, metame 2, qriptopian 1); — |
| `chain_minted` | 1 | metame activation_tab (1) |
| `semi_minted` | 1 | metaKnyts gn (1) |
| `draft` / `review_ready` / `canon_pending` / `superseded` / `archived` | **0** | No live rows in these substates today |

**Stage 3 substate-mapping impact:** Only **1 live row** falls into the universal `review_pending` collapse bucket (`semi_minted` metaKnyts gn). Mapping is structurally important for forward compatibility but not migration-blocking — there is no legacy backlog to reshape.

**Registry asset class stratification (28 rows):**

| `asset_class` | Count | Stage 1 `(primitive_type, tool_subtype)` migration |
|---|---:|---|
| `SkillQube` | 19 | → `ToolQube`, `skill` |
| `AigentQube` | 4 | → `AigentQube`, `null` (unchanged) |
| `WorkflowQube` | 3 | → `ToolQube`, `workflow` |
| `ConnectorQube` | 1 | → `ToolQube`, `connector` |
| `DataQube` | 1 | → `DataQube`, `null` (unchanged) |
| `ToolQube` (generic) | 0 | n/a — no generic ToolQube records today |

**Stage 1 ToolQube-subtype migration size:** 23 rows (19 SkillQube + 3 WorkflowQube + 1 ConnectorQube). Trivial scope.

**Finding F — orphan triad metas (operator-confirmed, 2026-05-30):**

`iq_meta_qubes`=87 vs `iq_blak_qubes`=86. The owning-row query (`LEFT JOIN master_content_qubes + codex_media_assets`) returned **4 metas** with no owner:

| `id` | `slug` | `qube_type` | `created_at` |
|---|---|---|---|
| `a0000000-...-000001` | `metaknyts-codex` | `cluster` | 2025-12-09 |
| `fa3cbf8f-...` | `mk-ep01-motion` | `master_content` | 2025-12-12 |
| `075aa8d6-...` | `mk-ep03-motion` | `master_content` | 2025-12-12 |
| `03539a11-...` | `mk-bronze-knyt-1-` | `media_asset` | 2026-05-01 |

**Critical finding:** Two of the orphans (`mk-ep01-motion`, `mk-ep03-motion`) are **the exact records named in the known "missing motion tiles for episodes 1 and 3" operator complaint** documented in `codexes/packs/agentiq/updates/2026-05-14_contentqube-registry-as-sot-shelf-tab-canonicalization.md`. The 2026-05-14 work added variant-aware filtering (Phase A) and registry-side rights synthesis (Phase B) to mitigate the symptom, but the **root cause is now confirmed in the data: these meta records exist but were never linked to a `master_content_qubes` row.** The fix landed in Phase A/B works around this; the canonical resolution is to either backfill the missing master_content_qubes rows or hard-delete the unbound metas.

**Other two orphans:**
- `metaknyts-codex` (qube_type=`cluster`) — likely the cluster qube intended to hold the entire metaKnyts codex. Per v1.0 §5.1 ClusterQube schema this is a legitimate-but-unbound cluster record; should be linked to a `master_content_qubes`-equivalent ClusterQube owning surface (or registered directly via `iqube_id_map` as a ClusterQube primitive in Stage 1).
- `mk-bronze-knyt-1-` (qube_type=`media_asset`, trailing dash suggests empty index) — likely a malformed character card slug; operator review recommended.

**Action for Stage 5 mint-saga design:**
- Mint saga MUST handle "meta exists without paired master_content/codex_media owner" as a recoverable state, not an error.
- Stage 1 `iqube_id_map` backfill writes a row for each orphan meta with `source='triad_meta'` but flags via `notes` column that no owning record exists.
- Pre-Stage 5: operator decides per-orphan disposition (backfill missing master row, delete, or register as standalone iQube).

**Finding G — under-seeded edition qubes (operator-confirmed, 2026-05-30):**

7 of 49 content_qubes have fewer than 1,860 editions:

| `content_qube_id` | `series` | `content_kind` | `title` | `editions` | `top_edition` |
|---|---|---|---|---:|---:|
| `00000000-...-ac1001` | metame | activation_tab | myCanvas | 8 | 8 |
| `00000000-...-ac1002` | knyt | activation_tab | Order of Metayé | 6 | 6 |
| `00000000-...-ac1004` | qriptopian | activation_tab | Qriptopian | 5 | 5 |
| `00000000-...-ac1005` | avl | activation_tab | Venture Lab | 3 | 3 |
| `00000000-...-ac1006` | marketa | activation_tab | Marketa | 3 | 3 |
| `00000000-...-ac1003` | metame | activation_tab | AgentiQ OS | 3 | 3 |
| `00000000-...-ac1007` | metame | activation_tab | metaMe Studio | 2 | 2 |

**Resolution: NOT an under-seeding problem.** Every under-seeded qube has `content_kind='activation_tab'`. These are activation/navigation surfaces, not canonical art/content qubes — they follow a different seeding pattern (one edition per activation event per persona, append-only). The 1,860 canonical pre-seed target applies to `content_kind ∈ {episode, character, powers_sheet, gn, lore_scroll, bundle}`, not to `activation_tab`.

The 41 metaKnyts qubes (15 episode + 13 character + 13 powers_sheet) have `78,150 − 30 = 78,120` editions across them = **~1,905 avg per qube**, slightly OVER 1,860 (consistent with Phase 7 design where commons are open-supply appended past 1860). All canonical-class qubes are healthy.

**Action for Stage 5 mint-saga:** the saga's edition-claim path must short-circuit for `content_kind='activation_tab'` — these don't use `claimEditionForPurchase`. The existing Phase 9.2 `purchaseHandler.processPurchase` only fires `claimContentQubeEditions` for matched master_qube_id / media_asset_id, so activation_tab qubes are naturally excluded. Stage 5 saga must preserve this distinction.

**Dedupe-collision matrix (operator-reviewed in Stage 1):**

| Likely collision signal | Action |
|---|---|
| Same `content_hash` across two `registry_assets` rows | Flag for human review; never auto-merge — different ingestion sources may legitimately produce identical content but warrant distinct iQubes |
| Same `chain_anchor` across two records | Critical — must be resolved before backfill commits; same chain anchor must map to one iqube_id |
| Same `slug` within a `series` on `content_qubes` | Flag; resolve via human merge decision |
| `content_qubes.master_qube_id` shared across rows | Already legal (Phase 6 bridging); maintain as 1-to-N |

---

## Deliverable 2 — `LiquidUITemplateArchetypeQube` reclassification

**Search result (12 source files):**

| File | Usage | Reclassification action |
|---|---|---|
| `types/registry.ts:1` | In `IQubeType` enum | **Remove from enum** (per v1.1 §A.2) |
| `app/types/knyt.ts:59,87,93,98` | `KnytLiquidUITemplate`, `KnytLiquidUITemplatePack` interfaces | **Unaffected** — these are KNYT-specific UI runtime types, not the archetype iQube. Keep. |
| `app/types/knytLiquidUI.ts:275` | `KnytLiquidUITemplatePack` interface | **Unaffected** — same as above |
| `app/services/knyt/knytLiquidUIService.ts:19,30,38` | Uses KNYT-specific types | **Unaffected** |
| `app/(shell)/content/demo/page.tsx:156,161` | Fetches `/api/registry/templates?type=LiquidUITemplateArchetypeQube` | **Migrate** — query param becomes `?type=DataQube&category=ui_template_archetype` (new filter field), or alternative discriminator |
| `app/api/registry/templates/store.ts` | **20 hardcoded seed records** with `iQubeType: 'LiquidUITemplateArchetypeQube'` | **Migrate** — all 20 records' `iQubeType` becomes `'DataQube'` + `metaExtras` gains a `{ k: 'category', v: 'ui_template_archetype' }` entry |

**Reclassification rule (operator-confirmed per v1.1 §A.2):**

> "LiquidUITemplateArchetypeQube" records describe template / schema / archetype definitions for UI surfaces. They don't carry content payloads. Reclassify all 20 as `DataQube` (since they're schema/template definitions, not renderable content surfaces in the ContentQube sense).

**Single-source-of-truth records to reclassify (20, all in `app/api/registry/templates/store.ts`):**

Detected at lines: 51, 69, 87, 105, 123, 141, 158, 175, 192, 209, 226, 243, 260, 277, 294, 311, 328, 345, 362, 379. Operator should review the seed list (template names, intended use cases) before Stage 1 commits the reclassification — though since these are dev seed data with no chain anchor, the migration is reversible.

**Migration plan (Stage 1):**

1. Add `category: string | null` field to template schema (additive).
2. Replace `iQubeType: 'LiquidUITemplateArchetypeQube'` with `iQubeType: 'DataQube'` AND add `{ k: 'category', v: 'ui_template_archetype' }` to each seed's `metaExtras` array across all 20 seeds (uses the existing `metaExtras` k/v pattern; no new schema field needed).
3. Update `/api/registry/templates` filter logic to recognize both query patterns during transition.
4. Update `app/(shell)/content/demo/page.tsx` to query `?type=DataQube&category=ui_template_archetype`.
5. Remove `'LiquidUITemplateArchetypeQube'` from `types/registry.ts::IQubeType`.
6. Add `legacy_primitive_type: 'LiquidUITemplateArchetypeQube'` column to the seed rows in `iqube_id_map` for one-rev downgrade safety (per v1.1 §A.2).

**Rollback:** Restore `iQubeType` field via `legacy_primitive_type` lookup; revert filter logic. One-rev safe per v1.1.

**Risk:** Low. No on-chain records, no DVN receipts reference these. The `app/(shell)/content/demo` consumer is a dev demo page.

---

## Deliverable 3 — Per-cartridge surface → resolver shape map

The canonical resolver (`services/registry/resolver.ts`) becomes the read path for cartridge-internal iQube rendering. This table names every cartridge tab that today reads iQube-shaped data, its current source, and what resolver shape it consumes after Stage 8.

### 3.1 Already on registry (Phase 8 + Phase B shipped)

| Tab | Current hook | Source | Status |
|---|---|---|---|
| `KnytShelfTab.tsx` | `useContentQubeSeriesRights('metaKnyts')` | `/api/registry/content-qube/series-rights` | ✅ On registry |
| `KnytTab.tsx` (locked check) | `useContentQubeSeriesRights('metaKnyts')` + Phase A variant-aware fallback | Same | ✅ On registry (registry-primary, legacy fallback) |
| `ScrollsTab.tsx` | `useContentQubeSeriesRights('metaKnyts')` | Same | ✅ On registry |
| `CharactersTab.tsx` | `useContentQubeSeriesRights('metaKnyts')` | Same | ✅ On registry |

### 3.2 Still on legacy `useOwnedEntitlements` / `/api/codex/owned` (PRD v1.0 Stage 4 work)

| Tab / Component | Current hook | Migration target |
|---|---|---|
| `KnytStoreEpisodesTab.tsx:29,648` | `useOwnedEntitlements(personaId)` | `useContentQubeSeriesRights('metaKnyts', { personaId })` for ownership; episode store data stays on existing store endpoint |
| `KnytStoreCardsTab.tsx:16,294` | `useOwnedEntitlements(personaId)` | `useContentQubeSeriesRights('metaKnyts')` filtered to character variants |
| `KnytCardsGrid.tsx:23,132` (in `app/triad/components/content/`) | `useOwnedEntitlements(personaId)` | Same |
| `SmartWalletDrawer.tsx:13,329` | `useOwnedEntitlements(effectivePersonaId)` | Migrate to `services/registry/resolver.ts::listIQubes({ owned_by: personaId })` — needs the resolver to land Stage 2 first |
| `SmartWalletPanel.tsx:6,44` | `useOwnedEntitlements(personaId)` | Same as SmartWalletDrawer |

**Stage 4 work:** ~5 surfaces to migrate. KnytStoreEpisodesTab and KnytStoreCardsTab are the high-priority migrations (operator-facing store flows). SmartWalletDrawer + SmartWalletPanel migrate after Stage 2 resolver lands.

### 3.3 Cartridge tabs that render iQubes but don't yet have an ownership-aware surface

These tabs render iQube metadata but don't gate on ownership today. They become resolver consumers in Stage 8.

| Tab | What it renders | Resolver consumer pattern (Stage 8) |
|---|---|---|
| `RegistrySupplyTab.tsx` (agentiq-os cartridge) | Currently the iQube registry browse UI | `listIQubes({ project: 'admin' })` — full canonical view for operator |
| `KnytStoreInvestorTab.tsx` | Investor bundle SKUs | Read via resolver for canonical SKU iQube metadata |
| `KnytStoreBundlesTab.tsx` | Retail bundle SKUs | Same |
| `KnytStoreAdminTab.tsx` | Admin store management | `listIQubes({ project: 'admin' })` |
| `KnytTreasuryTab.tsx`, `KnytTreasuryAdminTab.tsx` | Treasury holdings (iQube-backed) | Resolver for canonical iQube metadata |
| `KnytQuestsTab.tsx`, `KnytTasksRewardsAdminTab.tsx` | Quest definitions + rewards | Quest content as ContentQube; resolver for canonical metadata |
| `KnytAlphaTab.tsx`, `KnytWheelTab.tsx`, `KnytRuntimeTab.tsx` | KNYT cartridge surfaces | Resolver where ownership matters; otherwise read-only |
| `KnytCommunityContentTab.tsx`, `KnytCommunityContentAdminTab.tsx` | Community-submitted ContentQubes | Resolver — must respect access spine |
| `KnytCodexAdminTab.tsx`, `KnytInvestmentsAdminTab.tsx`, `KnytInvestorDashboardTab.tsx` | Admin views | `project: 'admin'` projection |
| `QriptopianEditTab.tsx`, `QriptoScrollsTab.tsx`, `QriptopiaTab.tsx`, `QriptoLiquidCodexTab.tsx`, `QriptopianAdminTab.tsx` | Qripto cartridge tabs | Resolver where applicable |
| `DevRegistryTab.tsx`, `DevMissionBoardTab.tsx` | Dev / mission board surfaces | Resolver — DevRegistryTab is a parallel registry browse |
| `AigentMeWelcomeTab.tsx`, `AigentMeWelcomeSplitTab.tsx`, `AigentMissionsBoardTab.tsx`, `AigentCOSTab.tsx`, `RefAigentTab.tsx` | AigentQube cartridge tabs | Resolver for AigentQube canonical record |
| `MarketaPartnersAdminTab.tsx` (`app/(shell)/marketa/...`) | Marketa partner data (AigentQube cluster) | Resolver |
| `MoneyPennyTab.tsx`, `InvestorDirectoryTab.tsx`, `NanOSBridgeTab.tsx` | Cross-cartridge surfaces | Resolver for any iQube references |
| `BoundedDelegationTab.tsx`, `RelationshipBuilderTab.tsx`, `MetaMeAnalysisTab.tsx`, `MetaMeStatusTab.tsx` | metaMe identity / delegation views | Resolver for iQube descriptors; identity already goes through spine |
| `MyCanvasTab.tsx` | User-created canvas content | Resolver — myCanvas entries are personal content iQubes |
| `ExperienceAlignmentTab.tsx`, `ExperiencePackTab.tsx`, `PersonalExperienceMatrixTab.tsx`, `VentureLabGrowthMatrixTab.tsx` | Experience Qubes | Resolver — Experience Qubes flow through `evaluateAccess` |
| `OrderTab.tsx`, `FeaturesTab.tsx`, `DigiTerraTab.tsx`, `LoreTab.tsx`, `AlphaDocsTab.tsx`, `PlaceholderTab.tsx` | Static / decorative tabs | No iQube reads; safely unchanged |

**Total tabs surveyed:** ~50 in `app/triad/components/codex/tabs/`. ~30 will become resolver consumers in Stage 8. Apps under `apps/theqriptopian-web/src/` are out of scope (separate Next.js app, future migration).

### 3.4 Non-tab surfaces

| Surface | File | Migration |
|---|---|---|
| Registry browse UI | `components/registry/RegistryHome.tsx` + sibling components | Hooks become resolver consumers; UI shape stable |
| Composer DVN receipt panel | `components/composer/DVNReceiptsPanel.tsx` | Read receipts via §8.1 query API after Stage 6 |
| Composer studio | `components/composer/ComposerStudio.tsx` | Reads template iQubes via resolver |
| Ingestion factory panel | `components/registry/IngestionFactoryPanel.tsx` | Existing — feeds canonical resolver via registry_assets backfill |

---

## Deliverable 4 — Action-vocabulary mapping completeness in `cardBuilder.ts`

**File audited:** `services/iqube/legibility/cardBuilder.ts` (460 lines, on `origin/dev` at commit `d5b2194a`).

### 4.1 IQubeAgentAction surface verbs — coverage

All 14 verbs from `types/iqube/legibility.ts::IQubeAgentAction` are referenced in `cardBuilder.ts`:

| Verb | `defaultPermissions` | `buildActionMenu` (method + href) |
|---|---|---|
| `discover` | ✅ Base for every iQube | ✅ GET on card route |
| `read_meta` | ✅ Public + public_meta_private_payload | ✅ GET on card route |
| `read_summary` | ✅ Public only | ✅ GET on card route |
| `request_access` | ✅ Public + public_meta_private_payload | ✅ POST `/request-access` |
| `read_payload` | ✅ Conditional; `disallowed` for public_meta_private_payload | ✅ POST `/read-payload` (currently a descriptive entry; handler not wired) |
| `derive_summary` | ✅ Public only | ✅ POST `/derive-summary` |
| `transform` | ✅ Public | ✅ POST `/transform` |
| `cite` | ✅ Public | ✅ GET (treated as passive) |
| `propose_update` | ✅ ContentQube/DataQube, public, non-canonized | ✅ POST `/propose-update` |
| `mint_derivative` | ✅ ContentQube/DataQube, public; disallowed on canonized | ✅ POST `/mint-derivative` |
| `fork` | ✅ Public; requires policy check on canonized | ✅ POST `/fork` |
| `record_receipt` | ✅ Always present in `requires_dvn_receipt` | ✅ POST `/record-receipt` |
| `revoke_access` | ✅ Implicitly mutating; `isMutating(verb)` returns true | ✅ POST `/revoke-access` |
| `audit_state` | ✅ ToolQube / AigentQube / ModelQube | ✅ GET (treated as passive) |

**Coverage:** 14/14 ✅.

### 4.2 AccessAction internal verbs — surface mapping

`types/access.ts:378::AccessAction` enumerates:

```
'read' | 'watch' | 'listen' | 'invoke' | 'connect' | 'remix' | 'mint'
| 'transfer' | 'payment-settle' | 'policy-escalation' | 'disclosure'
```

**Finding:** `cardBuilder.ts` does NOT import `AccessAction` from `types/access.ts`. There is no internal-to-surface mapping table in code today. The v1.0 §4.3 mapping is documented in the PRD but not codified.

**Impact:** This is a Stage 1 gap. The §4.3 mapping table must land in code before Stage 2 ships, otherwise the resolver and the legibility cards will use disjoint vocabularies with no enforcement that callers in spine-level code (`evaluateAccess`, `policyResolvers`) and callers in card code (`cardBuilder`, action handlers) agree on what verb means.

**Action (Stage 1 ticket):**

Add `services/iqube/legibility/actionMap.ts`:

```ts
import type { AccessAction } from '@/types/access';
import type { IQubeAgentAction } from '@/types/iqube/legibility';

// Maps internal AccessAction to surface IQubeAgentAction.
// Surface verbs without internal equivalents are passive (no mutation).
// 'internal_only' marks AccessAction values that don't surface.
export const ACTION_SURFACE_MAP: Record<AccessAction, IQubeAgentAction | 'internal_only'> = {
  'read':              'read_payload',
  'watch':             'read_payload',
  'listen':            'read_payload',
  'invoke':            'transform',        // primary mapping; ContentQube callers may map to 'derive_summary' contextually
  'connect':           'request_access',
  'remix':             'mint_derivative',
  'mint':              'mint_derivative',
  'transfer':          'internal_only',
  'payment-settle':    'internal_only',
  'policy-escalation': 'revoke_access',
  'disclosure':        'audit_state',
};

// Reverse map for action-handler dispatch.
export const SURFACE_INTERNAL_MAP: Partial<Record<IQubeAgentAction, AccessAction>> = {
  'read_payload':      'read',
  'transform':         'invoke',
  'request_access':    'connect',
  'mint_derivative':   'mint',
  'revoke_access':     'policy-escalation',
  'audit_state':       'disclosure',
  // Passive verbs (no internal equivalent):
  // 'discover', 'read_meta', 'read_summary', 'cite',
  // 'derive_summary' (context-dependent — handler decides 'invoke' vs none),
  // 'propose_update' (routes to suggestion queue, not access-action),
  // 'fork' (routes to ingestion factory; 'mint' on the new fork is its own event),
  // 'record_receipt' (passive — receipt already emitted)
};
```

CI tests assert:

- Every `AccessAction` value is keyed in `ACTION_SURFACE_MAP`.
- Every `IQubeAgentAction` value is either a value in `ACTION_SURFACE_MAP` OR explicitly listed in the passive-verbs comment block (codified via a `PASSIVE_SURFACE_VERBS: Set<IQubeAgentAction>` export).
- `SURFACE_INTERNAL_MAP` is a strict inverse of `ACTION_SURFACE_MAP` for non-`'internal_only'` entries.

### 4.3 Other findings in `cardBuilder.ts`

- **Lifecycle internal→surface mapping** lives at `cardBuilder.ts:151-164`, using the internal ContentQube `lifecycle_state` enum (`draft / semi_minted / review_ready / canon_pending / canonized / chain_minted / superseded / archived`). This is the **ContentQube-internal** lifecycle, not the PRD v1.0 §6 universal internal lifecycle (`draft / wip / review_pending / published / canonized / deprecated / revoked / new_version_pending / abandoned`). **Action (Stage 3 ticket):** extend `cardBuilder.ts:151-164` to handle the new PRD-canonical states too. Both must collapse to the same 5-state surface enum.
- **Visibility derivation** at `cardBuilder.ts:154` correctly treats canonized + non-free as `public_meta_private_payload`.
- `isMutating(verb)` at line 432 hardcodes the mutating-verb set. Move into the action map module above as `MUTATING_SURFACE_VERBS: Set<IQubeAgentAction>`.

---

## Deliverable 5 — `iqube-registry` cartridge slug reservation

**Search results:**

- `data/codex-configs.ts` — every top-level cartridge has an `id` and `slug` field.
- Top-level cartridge slugs (extracted from `data/codex-configs.ts`):

```
knyt-codex          (id: 'knyt-codex',          slug: 'knyt-codex')
qripto-codex        (id: 'qripto-codex',        slug: 'qripto')
agentiq-codex       (id: 'agentiq-codex',       slug: 'agentiq')
metame-codex        (id: 'metame-codex',        slug: 'metame')
agentiq-os-cartridge (id: 'agentiq-os-cartridge', slug: 'agentiq-os')
```

(Plus per-tab sub-slugs inside each, none of which collide with `iqube-registry`.)

**Existing related slugs (no collision with `iqube-registry`):**

- `registry-supply` — a tab inside `agentiq-os-cartridge` (line 1290 in `data/codex-configs.ts`) — the existing registry tab. Stays.
- `agentiq-knyt` (Venture Lab α) — a tab inside `agentiq-codex`. Unrelated.

**Confirmation:** `iqube-registry` slug is FREE. No collision. Reserve in Stage 1 by adding the new cartridge stub to `data/codex-configs.ts` (configuration only; full UI build is Stage 8).

**Stage 1 cartridge stub (proposed addition to `data/codex-configs.ts`):**

```ts
{
  id: 'iqube-registry',
  slug: 'iqube-registry',
  label: 'iQube Registry',
  icon: 'Database',         // or similar
  description: 'Canonical orientation layer for every iQube',
  groups: [
    { id: 'browse',  label: 'Browse',  icon: 'Search',   order: 0 },
    { id: 'admin',   label: 'Admin',   icon: 'Settings', order: 1, adminOnly: true },
    { id: 'docs',    label: 'Docs',    icon: 'FileText', order: 2 },
  ],
  tabs: [
    // Concrete tabs land in Stage 8. Stub the structure now so the slug
    // is reserved and inter-cartridge buildCodexUrl() works in dev.
    { id: 'browse',       slug: 'browse',       label: 'Browse iQubes',         group: 'browse', order: 0 },
    { id: 'receipts',     slug: 'receipts',     label: 'DVN Receipts',          group: 'browse', order: 1 },
    { id: 'mints',        slug: 'mints',        label: 'Mints + Sagas',         group: 'admin',  order: 0, adminOnly: true },
    { id: 'canonization', slug: 'canonization', label: 'Canonization Queue',    group: 'admin',  order: 1, adminOnly: true },
    { id: 'vocabulary',   slug: 'vocabulary',   label: 'Action Vocabulary',     group: 'admin',  order: 2, adminOnly: true },
    { id: 'health',       slug: 'health',       label: 'Registry Health',       group: 'admin',  order: 3, adminOnly: true },
  ],
}
```

Operator decides icon + final tab list before Stage 8 build.

---

## Deliverable 6 — Stub-route inventory beyond `app/api/registry/iqube/route.ts`

The known mock is `app/api/registry/iqube/route.ts` (v1.0 §3.3). This audit searched all `app/api/registry/**` and adjacent routes for similar `mock` / `simulate` / `stub` / `fake` patterns.

| Route | Stub nature | Status / risk |
|---|---|---|
| `app/api/registry/iqube/route.ts:33-49` | **Mock POST response** — returns hardcoded `mockResponse` after `setTimeout(1000)` | **Already named in PRD v1.0 §3.3** as the canonical "replace with real write path" target |
| `app/api/registry/analytics/route.ts:25-107` | **Mock analytics data** — returns hardcoded `mockAnalyticsData` object based on a time-range query | Low priority — analytics is a presentation surface, not authority. Phase 1 lower-tier cleanup. Recommend: tag as `@deprecated` in Stage 6 when receipt-index API lands, since real analytics derives from `orchestration_events` queries. |
| `app/api/registry/publish/route.ts:6-8` | Comment: *"registry entry and returns a DVN receipt stub. Product decision: manual Publish flow, stub for DVN mint."* | Medium priority — publish route ties into Stage 3 (lifecycle) + Stage 6 (receipts). On lifecycle wiring, this route emits a canonical receipt via `orchestrationEvents`. |
| `app/api/registry/content-qube/series/route.ts:7` | Comment: *"static/mock content."* | **Outdated comment** — Phase 8 shipped `useContentQubeSeriesRights` which now drives this surface. Verify in Stage 0 follow-up; likely the comment is stale and the route is live. |

**Findings beyond the registry namespace:**

Searching `app/api/iqube/`, `app/api/content/`, `app/api/codex/` for the same patterns:

- `app/api/codex/agentiq-os/registry-draft/route.ts` — verify content (not inspected in this pass; flag for follow-up).
- `app/api/iqube/persona/qripto/mint/route.ts` — v1.0 §2.5 calls this *"parallel path, likely unused."* Verify in Stage 0 follow-up whether this should be removed or kept.

**Recommendation:** Stage 2 (resolver implementation) cleans up `iqube/route.ts`. Stage 6 (DVN receipt index) cleans up `analytics/route.ts` + `publish/route.ts` receipt-stub language. Stage 0 sign-off includes operator decision on `iqube/persona/qripto/mint` removal.

---

## Deliverable 7 — Receipt-writer call-site catalog (30-day dual-write window)

### 7.1 `services/registry/receiptEmitter.ts` callers — internal to registry

11 distinct call sites across 8 files. All in the ingestion-factory pipeline. Dual-write coverage required.

| File | Line(s) | Event type |
|---|---|---|
| `services/registry/classifierService.ts` | 9, 52 | classification receipt |
| `services/registry/packagerService.ts` | 14, 140 | packaging receipt |
| `services/registry/fetcherService.ts` | 14, 76 | fetch receipt |
| `services/registry/validatorService.ts` | 24, 71, 112 | validation receipt (twice — pass/fail) |
| `services/registry/intakeService.ts` | 10, 57 | intake receipt |
| `services/registry/publisherService.ts` | 20, 88, 125 | publish receipt (twice — propose/commit) |
| `services/registry/trustScorerService.ts` | 24, 100 | trust-score receipt |
| `services/registry/invocationGateway.ts` | 19 (import) | invocation receipt |

### 7.2 `services/registry/receiptEmitter.ts` callers — external to registry

1 external caller:

| File | Line(s) | Event |
|---|---|---|
| `services/rewards/rewardService.ts` | 14 (import), 372 (`emitReceiptSilent`) | reward grant receipt |

### 7.3 `bridge-core/dvnReceiptService.ts` callers

**Scope:** entirely within `clawhack-group-agents/` subsystem. Not used by the platform proper.

| File | Usage |
|---|---|
| `clawhack-group-agents/openclaw-wrapper/run.ts:6` | `createDVNReceiptService` |
| `clawhack-group-agents/openclaw-wrapper/openclawWorker.ts:97, 306, 518, 679, 722` | 4 receipt emissions + the `emitReceipt` method definition |
| `clawhack-group-agents/scripts/test-e2e.ts:12` | Test harness |
| `clawhack-group-agents/scripts/run-group-runtime.ts:5` | Runtime entry |
| `clawhack-group-agents/scripts/test-discord-simple.ts:9` | Test harness |
| `clawhack-group-agents/adapters/discord/run.ts:5` | Discord adapter entry |
| `clawhack-group-agents/adapters/xmtp/run.ts:5` | XMTP adapter entry |
| `clawhack-group-agents/adapters/discord/discordAdapter.ts:109, 194` | 2 receipt emissions |
| `clawhack-group-agents/adapters/xmtp/xmtpAdapter.ts:171, 435` | 2 receipt emissions |
| `clawhack-group-agents/bridge-core/adapter.ts:88` | `emitReceipt` base method |

**Finding:** `bridge-core/dvnReceiptService.ts` is a clawhack-group-agents internal concern. Stage 6 convergence question per v1.1 §A.4 ("services/registry/receiptEmitter.ts + bridge-core/dvnReceiptService.ts → observe-then-deprecate") needs nuance:

- **`services/registry/receiptEmitter.ts`** — converge onto `orchestrationEvents.emitDecisionReceipt()` for all non-content primitives. Dual-write during the 30-day window. Deprecate the file after window.
- **`bridge-core/dvnReceiptService.ts`** — **subsystem-internal**. Recommendation to operator: do NOT deprecate the file; instead, ensure that the QubeTalk/HTTP writes it produces ALSO land in `orchestration_events` (via the `services/registry/receiptEmitter.ts` path or via a new bridge-to-orchestration adapter). The clawhack subsystem retains its receipt infrastructure for ops/runtime continuity; the platform sees those receipts via `orchestration_events`.

**Stage 6 dual-write plan (refined):**

1. Add `orchestrationEvents.emitDecisionReceipt()` call alongside every `emitReceipt(...)` in the 8 internal registry-service callers.
2. Add the same alongside the 1 external caller (`rewardService.ts`).
3. Add a single `orchestrationEvents.emitDecisionReceipt()` call inside `clawhack-group-agents/bridge-core/dvnReceiptService.ts` (or one of its emitter paths) so that every clawhack-side receipt also lands in `orchestration_events` for platform-wide query.
4. Nightly reconciliation report counts emissions across the three surfaces; flags discrepancies.
5. Day 30: deprecate `services/registry/receiptEmitter.ts`. **Do not** deprecate `bridge-core/dvnReceiptService.ts` — it stays as the clawhack-internal mechanism, now mirrored into `orchestration_events`.

---

## Stage 0 cross-cutting findings

### A. Action-vocabulary mapping is a Stage 1 gap

The §4.3 mapping table does not yet exist in code. The legibility cards reference 14 surface verbs; the access spine has 11 internal verbs; no module imports both. **Stage 1 must add `services/iqube/legibility/actionMap.ts`** (per Deliverable 4 spec) before Stage 2 ships.

### B. Lifecycle mapping has two scopes today

`cardBuilder.ts:151-164` maps the **ContentQube-internal** lifecycle (`draft / semi_minted / review_ready / canon_pending / canonized / chain_minted / superseded / archived`) to the surface 5-state enum. The PRD v1.0 §6 introduces a **universal internal** lifecycle (`draft / wip / review_pending / published / canonized / deprecated / revoked / new_version_pending / abandoned`). Both must collapse to the same 5-state surface enum but the two internal vocabularies are different. **Stage 3 must reconcile** — likely the universal internal becomes the canonical, ContentQube's richer states map IN to it as substates (e.g. `semi_minted / review_ready / canon_pending` all collapse to internal `review_pending`).

### C. AigentQube + ToolQube DB promotion blocked

Legibility v0.1 reads AigentQubes from `RUNTIME_AGENT_IDS` (code constant, 5 entries) and ToolQubes from `openclawCore` registry (runtime, in-process). These have no DB-backed `iqube_id`. The canonical resolver cannot return a stable `iqube_id` for them without DB promotion (legibility fast-follow #3). **Stage 0 finding:** until promotion lands, the resolver must accept either UUID lookups OR string-id lookups for these primitives, and the `iqube_id_map` join table needs to support code-source entries with synthetic UUIDs (deterministic SHA-256 of the runtime id, perhaps).

**Recommendation:** Stage 1 schema includes `iqube_id_map.source = 'code:aigentQubeSource' | 'code:toolQubeSource'` with `source_id` being the runtime string id. Synthetic UUID derived deterministically:

```ts
function syntheticIQubeId(source: string, runtime_id: string): string {
  // deterministic; same input always produces same UUID; idempotent for legibility callers
  const hash = sha256(`${source}:${runtime_id}`);
  // Format as UUID v4-ish (variant bits set per RFC 4122)
  return formatAsUuid(hash);
}
```

This unblocks the resolver to serve AigentQube + ToolQube records via `iqube_id` until DB promotion happens.

### D. Backfill ordering — dependency chain

The backfill order matters because some sources depend on others:

```
Stage 1 backfill order:
  1. iq_meta_qubes        (no dependencies)
  2. iq_blak_qubes        (depends on iq_meta_qubes via meta_qube_id resolution)
  3. iq_token_qubes       (depends on iq_meta_qubes)
  4. content_qubes        (independent; UUID already)
  5. registry_assets      (after asset_class → tool_subtype migration; otherwise independent)
  6. identity_iqubes      (independent)
  7. memory_iqubes        (independent)
  8. AigentQube synthetic (independent; derives UUIDs from code constants)
  9. ToolQube synthetic   (independent; same)
  10. legacy_primitive_type backfill for the 20 LiquidUITemplateArchetypeQube seeds
```

Steps 1-3 must complete before any triad-reading caller flips to the resolver. Steps 4-10 are parallelizable.

### E. RLS readiness

New tables (per v1.1 §B.4 acceptance): `iqube_id_map`, `persona_token_qube_ownership`, `mint_sagas`, `dvn_receipt_blocks`, `dvn_receipt_block_items`, `iqube_canonization_requests`, `registry_config`. **Stage 1 must land RLS migrations alongside the table migrations** — not in a separate ticket. Pattern: follow `supabase/migrations/20260402020000_registry_rls.sql` as a reference for service-role-only access on internal-projection columns.

---

## Stage 0 sign-off checklist

Before Stage 1 begins, operator should confirm:

- [x] Per-surface row counts (Deliverable 1) — operator-confirmed 2026-05-30; baseline rows table + ContentQube lifecycle stratification + registry asset class stratification folded into Deliverable 1. Two follow-up SQL queries (Finding F orphan triad meta; Finding G under-seeded editions) outstanding before Stage 5.
- [x] The 20 LiquidUITemplateArchetypeQube seeds will reclassify as DataQube + `metaExtras: [{ k: 'category', v: 'ui_template_archetype' }, ...]` (Deliverable 2). Stage 1 commits the change.
- [ ] The ~30 cartridge tabs identified for Stage 8 resolver migration (Deliverable 3) — operator confirms priority order (Stage 4 vs Stage 8).
- [ ] Action-vocabulary mapping module `services/iqube/legibility/actionMap.ts` is a Stage 1 deliverable (Deliverable 4 finding).
- [ ] `iqube-registry` cartridge slug reserved in Stage 1 by adding the stub to `data/codex-configs.ts` (Deliverable 5).
- [ ] Stub routes (Deliverable 6) — confirm `app/api/iqube/persona/qripto/mint/route.ts` disposition (remove vs retain).
- [ ] Receipt-writer dual-write plan (Deliverable 7) — confirm `bridge-core/dvnReceiptService.ts` retention with mirror-to-orchestration_events, vs. deprecation.
- [ ] Synthetic UUID strategy for AigentQube / ToolQube `iqube_id_map` entries (Cross-cutting finding C).
- [ ] ContentQube-internal lifecycle (`semi_minted` / `review_ready` / `canon_pending`) maps to universal internal lifecycle as substates of `review_pending` (Cross-cutting finding B). Confirm or refine.

---

## What Stage 0 did not cover

- **Live row counts** — sandbox cannot query Supabase. Operator runs the queries in Deliverable 1 §verification queries and commits results.
- **Test coverage gap analysis for Stages 2/3/5/6** — deferred to Stage 1 audit follow-up. The v1.1 §C plan calls for tests in those stages; the Stage 0 audit confirms the test files don't exist yet (`tests/registry-authority.test.ts`, `tests/registry-projections.test.ts`, `tests/registry-lifecycle.test.ts`, `tests/registry-lifecycle-clarity.test.ts`, `tests/iqube-legibility-compat.test.ts` — none present).
- **`app/api/codex/agentiq-os/registry-draft/route.ts`** — flagged but not inspected in this pass.
- **Apps under `apps/theqriptopian-web/`** — out of scope (separate Next.js app).

---

## Files referenced in this audit

| Path | Role | Section |
|---|---|---|
| `types/registry.ts` | `IQubeType` enum | D2, D4 |
| `types/registryIngestion.ts` | `RegistryAssetClass` enum | D1 |
| `types/access.ts` | `AccessAction` enum (line 378) | D4 |
| `types/iqube/legibility.ts` | Surface enums | D4 |
| `services/iqube/legibility/cardBuilder.ts` | Mapper module (460 lines) | D4 |
| `services/iqube/legibility/sources/contentQubeSource.ts` | ContentQube source | D1 |
| `services/registry/receiptEmitter.ts` | Internal registry receipt writer | D7 |
| `services/registry/{classifier,packager,fetcher,validator,intake,publisher,trustScorer,invocationGateway}Service.ts` | Receipt callers | D7 |
| `services/rewards/rewardService.ts` | External receipt caller | D7 |
| `clawhack-group-agents/bridge-core/dvnReceiptService.ts` | Clawhack subsystem receipt writer | D7 |
| `data/codex-configs.ts` | Cartridge slug + tab config (2428 lines) | D5 |
| `app/api/registry/iqube/route.ts` | Mock POST (PRD v1.0 §3.3) | D6 |
| `app/api/registry/analytics/route.ts` | Mock analytics data | D6 |
| `app/api/registry/publish/route.ts` | Receipt stub | D6 |
| `app/api/registry/content-qube/series/route.ts` | Possibly-stale "mock" comment | D6 |
| `app/api/registry/templates/store.ts` | 20 LiquidUI seeds | D2 |
| `app/(shell)/content/demo/page.tsx` | Demo consumer of LiquidUI | D2 |
| `app/triad/components/codex/tabs/` (~50 files) | Cartridge tabs surveyed | D3 |
| `supabase/migrations/20260513010000_content_qubes_schema.sql` | ContentQube schema (lifecycle CHECK) | D1, B |

---

**End of Stage 0 audit. Stage 1 schema work proceeds on operator sign-off of the checklist above.**
