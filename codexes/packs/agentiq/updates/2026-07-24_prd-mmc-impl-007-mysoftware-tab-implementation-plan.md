# PRD-MMC-IMPL-007 — mySoftware: the sixth myCluster tab (Phase 1 + Phase 2)

**Status:** Phase 1 shipped 2026-07-24 (read-only Developer-strand mirror). Phase 2 (SPEC-MMC-002 §6.2 — ownership gap, taxonomy, deep links) shipped same day by a second pass, per operator ratification ("Ok. Will run the script etc shortly. Meantime phase 2/3 ratified/authorised."). Phase 3 (mutating actions) remains out of scope — see §7 below.
**Author:** Claude Code, 2026-07-24
**Companion to:** SPEC-MMC-001 (Constitutional Flow) §5 pattern, PRD-MMC-IMPL-006 (myResearch — the tab this one mirrors), CFS-020 (Constitutional Development Environment / Dev Command Center), CFS-032 (Capability Registry / Constitutional Acceptance), `data/codex-configs.ts` (myCluster tab registry)
**Relationship to the fuller vision:** `codexes/packs/irl/foundation/SPEC-MMC-002_my-software-artefact-inventory.md` (charter, DESIGN status, awaiting explicit operator ratification) is the full "My Software" specification — every artefact type a citizen can build through the platform (applications, agents, capabilities, cartridges, tools, workflows, code projects; a full item model with status/version/deployment-state/permissions/available-actions; Phases 1–3). This document is **that SPEC's own §6.1 Phase 1 implementation plan**, in the same two-tier relationship SPEC-MMC-001 has to PRD-MMC-IMPL-006 (charter → implementation plan). It ships Phase 1 only — the first, genuinely-ownable data source (dev-loop sessions) wired end to end (tab, myLedger filter, Companion Search) — exactly as SPEC-MMC-002 §6.1 scopes it. Nothing here should be read as the complete mySoftware vision; Phases 2–3 (SPEC-MMC-002 §6.2–§6.3) are explicitly not authorised for build by either document.

---

## 0. Reconciliation (discover before draft)

### 0.1 What already exists

- **Dev-loop sessions** (`dev_loop_sessions` table, migration `20260707110000_dev_loop_sessions.sql`) — a genuine per-persona table (`persona_id` is a real, enforced ownership column). One row per Constitutional Development Environment (CDE) session: intent → context pack → gap analysis → consequence canvas → constitutional decision → implementation → validation → remediation → deployment authorization → complete (`services/devCommandCenter/devLoop.ts` `STAGE_ORDER`). `/api/dev-command-center/sessions` already reads/writes it, persona-owned-only, no admin gate.
- **Capability Registry** (`capability_registry` table, CFS-032) — a GLOBAL ledger (no identity columns at all) of capabilities that reached Constitutional Acceptance. `services/constitutional/capabilityRegistry.ts::listRegisteredCapabilities()` lists it; `/api/constitutional/capability-registry` (admin-gated) is the only route exposing it.
- **`artifact_records`** (migration `20260712000000_artifact_records.sql`, `services/artifact/artifactRecordStore.ts`, `services/artifact/pilots/softwarePilot.ts`, `POST /api/artifact/produce-software`) — an EXISTING durable store for generated software artifacts (CFS-015 Implementation Packs run through the Artifact Runtime). **This is the pre-existing "software artifact registry" and mySoftware must never duplicate it.**

### 0.2 Why `artifact_records` is NOT a data source for this tab (yet)

Reading `app/api/artifact/produce-software/route.ts` and `SaveArtifactRecordInput` (`services/artifact/artifactRecordStore.ts`) end to end: the route computes a T2-safe `actorCommitment = sha256('artifact:actor:' + personaId).slice(0,16)` but **never persists it** — `SaveArtifactRecordInput` has no `actorCommitment` field, and `produceSoftwareArtifact` defaults `delegate: args.delegate?.trim() || 'operator'` with the route never passing a per-persona value. Every row in `artifact_records` today is stamped `delegate: 'operator'` — a generic literal, not a citizen-specific commitment. **There is currently no honest way to attribute an `artifact_records` row to the citizen who produced it.**

Surfacing `artifact_records` rows as "mine" in this tab would be a fabricated ownership claim (CLAUDE.md "No Guessing or Hallucinating"). **Phase 1 therefore omits `artifact_records` entirely.** Persona-attributing that table (adding and back-filling an `actorCommitment`/owner column, then reading it here) is an explicit **Phase 2 prerequisite**, not attempted in this pass.

### 0.3 The scoping decision

**mySoftware Phase 1 is a compact, read-only, non-admin myCluster mirror of the persona's OWN `dev_loop_sessions`** — composing the existing `/api/dev-command-center/sessions` route (extended with a `?list=true` mode; still the same route, same ownership filter, same T0 discipline — no new backend surface), exactly as myResearch composes `/api/research/overview` (PRD-MMC-IMPL-006 §0.3). Best-effort enrichment from the Capability Registry (badge only, admin-gated route, silently skipped for non-admin viewers) links a session to its shipped capability's Standing band when a PR number or merge commit matches — a display-only correlation, never a hard join (no FK exists between the two tables).

### 0.4 What this explicitly does NOT do

- Does not read or surface `artifact_records` rows (§0.2).
- Does not implement the fuller item model (artefact type, version, deployment state, runtime/host, permissions) — only what `DevLoopState` already honestly carries (title from `intent.goal`, stage, timestamps, receipt counts by class).
- Does not implement any of the fuller vision's actions (Deploy, Publish, Share, Delegate, Test, Run, Archive) — those require wiring into the D1 constitutional deployment ceremony and other runtimes not in scope here.
- Does not add a new admin gate or change the Capability Registry's existing admin-only route.

---

## 1. What ships

**New file:** `app/triad/components/codex/tabs/MySoftwareTab.tsx` — mirrors `MyResearchTab.tsx`'s shape exactly: `{ personaId, isAdmin }` props, `personaFetch('/api/dev-command-center/sessions?list=true', { personaIdHint: personaId })`, renders one card per session (title, stage with position in `STAGE_ORDER`, started/updated timestamps, receipt counts by class using the `DevLoopReceipt.class` field already computed by `devReceiptClassFor`), best-effort Capability Registry standing-band badge, loading/error states matching the sibling tabs.

**Backend extension (no new route):** `app/api/dev-command-center/sessions/route.ts` GET gains a `?list=true` mode returning `{ sessions: DevLoopSessionSummary[] }` — all of the caller's sessions, newest-updated first, summarized (`sessionId, stage, title, startedAt, updatedAt, receipts`). Same `resolvePersonaOrTimeout` + `.eq('persona_id', ...)` ownership filter as the existing single-session GET; `persona_id` never leaves the server.

**Registration:** one new entry in `data/codex-configs.ts`'s `group: 'mycluster'` block (`order: 4`, `mycartridge` bumped `4 → 5` to stay last), same shape as its five siblings (`activationId: 'mycanvas'`, `type: 'static'`, `config: { component: 'MySoftwareTab', props: {} }`, `metadata: { icon: 'Code', description: 'Software, agents, and capabilities you have built through the Developer strand', color: 'violet' }`). No `adminOnly` flag — visible to every myCluster-activated persona, matching its siblings and matching the Command Center tab itself (`metame-agentz-command-center`, gated by the `'aigent-z'` activation, not admin).

**myLedger integration** (`app/triad/components/codex/tabs/MyLedgerTab.tsx`): a new `'mysoftware'` `FilterChip` + `CHIP_LABELS` entry + `SOFTWARE_ACTION_TYPES` set (`implementation_pack_generated`, `constitutional_validation_recorded`, `remediation_recorded`, `deployment_proposed`, `deployment_authorized`, `capability_registered`, `capability_operationally_validated` — the DCC's own receipted vocabulary, `services/devCommandCenter/devLoop.ts::devReceiptClassFor` + CFS-032's two Capability Registry receipts) + the matching branch in the `filtered` useMemo, mirroring the existing `myexperiments` chip exactly. These receipts carry no `intentId`, so they render as standalone `ActivityReceiptCard`s (no new capsule type).

**Companion Search integration** (`services/companion/searchFederation.ts`): a sixth source, `searchMySoftware(query, personaId)`, reading the caller's own `dev_loop_sessions` directly (same `getSupabaseServer()` + `.eq('persona_id', personaId)` pattern as the sessions route — no internal HTTP hop needed since this runs server-side already), wired into `federateSearch()`'s `Promise.all` + spread + source-count log exactly like the existing five sources. `target: { slug: 'metame', tab: 'mysoftware' }` (`METAME_CODEX`, the codex that hosts `group: 'mycluster'`). `types/companionSearch.ts::CompanionSearchSource` gains `'my-software'`; `components/companion/CompanionSearchPanel.tsx::SOURCE_LABEL` gains the matching display label (`"mySoftware"`).

---

## 2. Ratification checklist

- [x] Operator confirms mySoftware Phase 1 as a **read-only, non-admin, dev-loop-sessions-only** mirror — not the full item model, not `artifact_records`, not any of the fuller vision's actions.
- [x] Operator confirms the `artifact_records` persona-attribution gap (§0.2) as a named Phase 2 prerequisite, not silently deferred.
- [x] Operator confirms this document is SPEC-MMC-002 §6.1's implementation plan, not a competing scope statement — Phase 1 as filed here matches Phase 1 as chartered there.

---

## 3. Phase 2 — what actually shipped (SPEC-MMC-002 §6.2, 2026-07-24)

Phase 2 closes the ownership gap named in §0.2 above and wires the first three of SPEC-MMC-002 §6.2's five bullets fully, one partially, and finds no clean seam for the last (honestly reported, not forced).

### 3.1 Ownership gap closed — `artifact_records.actor_commitment`

New additive migration `supabase/migrations/20260819000000_artifact_records_actor_commitment.sql` adds four nullable columns to `artifact_records`: `actor_commitment` (indexed — the T2-safe `sha256('artifact:actor:' + personaId).slice(0,16)` commitment, the SAME formula `produce-software`'s route already computed but never persisted), `artefact_type`, `runtime_host`, `permissions` (jsonb). No backfill — rows written before this migration (or before a caller supplies the new fields) keep NULL, which is correct: they are genuinely unattributable, not a bug.

`services/artifact/artifactRecordStore.ts` gains: the four fields on `SaveArtifactRecordInput`/`ArtifactRecordRow` (soft-fail-forward, same "send only when supplied" pattern as `citedInvariantIds`); an exported `actorCommitmentFor(personaId)` helper (the single source of truth for this formula going forward — the four pre-existing produce-* routes still carry their own local copies, a follow-up dedup, not attempted here); and an `actorCommitment` filter option on `listArtifactRecords`.

`services/artifact/pilots/softwarePilot.ts` now threads `args.actorCommitment` (already computed by the route, previously discarded) into its `saveArtifactRecord` call. `delegate` is untouched — still defaults to `'operator'` — `actor_commitment` is the real per-persona ownership key going forward.

### 3.2 New route — `GET /api/artifact/records/mine`

Resolves the caller via `getActivePersona` (identity spine, no parallel resolver), computes `actorCommitmentFor(persona.personaId)`, and calls `listArtifactRecords({ actorCommitment, limit: 50 })`. Returns only display-safe fields (artifactId/profile/title/brief/artefactType/runtimeHost/permissions/contentHashPrefix/receiptId/createdAt) — `actorCommitment` and `personaId` never leave the function. Soft-fails to `{ records: [] }` (never a 500) when the migration hasn't been applied yet, exactly like every other soft-fail path on this table.

### 3.3 Taxonomy + Runtime/host + Permissions — schema landed, producers not yet populating

The `artefact_type`/`runtime_host`/`permissions` columns and store/route plumbing are live end to end. No current producer (softwarePilot) populates them yet — SPEC-MMC-002 §3 already named this as unmodeled ("No" rows), and this pass adds the FIELDS honestly rather than inferring values for them. A future producer pass can start setting these once a producer actually knows a value.

### 3.4 mySoftware tab — reads the new source, renders a second card section

`MySoftwareTab.tsx` fetches `/api/artifact/records/mine` (via `personaFetch`, best-effort — a failure never blocks the existing dev-loop-session cards) and renders matched rows as an additional "Produced software artifacts" section below the unchanged dev-loop-session cards. A persona with zero attributable rows (the common case immediately after the migration runs, until new productions land) sees exactly the Phase 1 experience — no error, no empty-state clutter for the new section.

### 3.5 Deep links (§6.2 bullet 5)

Every card (dev-loop session AND artifact record) now links "Continue in Command Center" via `buildCodexUrl('metame', { tab: 'dev-command-center', personaId, ... })`. Investigated whether `DevCommandCenterTab.tsx` supports resuming a SPECIFIC session via a prop/query param — it does not: it hydrates only the caller's most recent session on mount, with no `sessionId` resume affordance. The deep link is honestly general (lands on Command Center, not a specific past session) rather than inventing a resume capability that doesn't exist. Artifact-record cards with a `receiptId` also get an "Inspect receipt" link into `my-ledger` (an existing SPEC-MMC-002 §5 read-only action, "Inspect receipts").

### 3.6 Copilot ground-data awareness (§6.2 bullet 4) — investigated, explicitly punted

Two existing "ground-data folding" mechanisms were found and neither is a clean fit:

1. `services/devCommandCenter/stageGroundData.ts` — feeds the Dev Command Center's OWN internal copilot at two specific dev-loop stages (`context_assembly`, `gap_analysis`) with platform INVENTORIES (cartridge list, API route map, registry assets, `registeredCapabilityBlock()`) for gap-analysis classification purposes — not persona-scoped "recent activity" narration, and not the audience mySoftware serves.
2. `services/research/publicReads.ts::buildResearchOverview`'s `artifactProduction.recentRecords` block — the CLAUDE.md-cited "observed, never asserted" reference implementation — but it reads `artifact_records` GLOBALLY (`listArtifactRecords({ limit: 8 })`, no persona filter) for the IRL Research Copilot, an admin/steward-facing surface narrating the whole research programme, not a citizen's own work.

`MySoftwareTab.tsx` itself has no embedded copilot (unlike `DevCommandCenterTab.tsx` / `IRLResearchCopilotTab.tsx`, which both mount `SmartTriadCopilotLayer` directly) — it is a plain read-only mirror, so there is no "this tab's own copilot" to feed ground data into. No generic, persona-scoped "recent citizen activity" ground-data seam that a citizen-facing copilot already consumes was found anywhere in the codebase. Forcing an integration into either of the two mechanisms above would mean either feeding a citizen's private data into an admin-only global overview (a scope violation) or bolting a new consumer onto a stage-keyed mechanism that has nothing to do with mySoftware's audience. **This bullet is explicitly punted** to a follow-up that first decides where a generic persona-facing copilot ground-data seam should live (if myCluster tabs are meant to feed a shared aigentMe copilot context at all, that seam does not exist yet and would be new work, not an extension).

### 3.7 Test canary updated

`tests/companion-mysoftware.test.ts` encoded a Phase-1-only invariant ("never reaches into `artifact_records`"). Updated to match the Phase 2 contract: the fixed personaFetch target set now includes `/api/artifact/records/mine`, and the guard is narrowed to "never imports `artifactRecordStore`/the software pilot module directly" (still true — Phase 2 reaches `artifact_records` only through the mediating API route, same discipline as every other spine-guarded read in this tab).

## 4. Phase 2 SQL the operator must run

```sql
-- 20260819000000 — Actor commitment + taxonomy fields on artifact_records
-- (SPEC-MMC-002 §6.2, Phase 2)
ALTER TABLE public.artifact_records
  ADD COLUMN IF NOT EXISTS actor_commitment TEXT,
  ADD COLUMN IF NOT EXISTS artefact_type TEXT,
  ADD COLUMN IF NOT EXISTS runtime_host TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB;

CREATE INDEX IF NOT EXISTS idx_artifact_records_actor_commitment
  ON public.artifact_records (actor_commitment);

COMMENT ON COLUMN public.artifact_records.actor_commitment IS
  'T2-safe one-way commitment sha256(''artifact:actor:'' + personaId).slice(0,16) — the ONLY subject handle this table carries for per-persona attribution. NEVER the raw personaId; never serialised to the client. NULL on rows produced before this migration (genuinely unattributable — not backfilled, per CLAUDE.md No Guessing).';
COMMENT ON COLUMN public.artifact_records.artefact_type IS
  'SPEC-MMC-002 §3 taxonomy: application | agent | capability | cartridge | tool | workflow | code_project. Nullable — set only by a caller that actually knows the type, never inferred.';
COMMENT ON COLUMN public.artifact_records.runtime_host IS
  'Where the artifact runs, when known (SPEC-MMC-002 §3 "Runtime or host"). Nullable — not modeled by any producer yet.';
COMMENT ON COLUMN public.artifact_records.permissions IS
  'Per-artefact ACL/visibility model (SPEC-MMC-002 §3 "Permissions"), jsonb so the shape can evolve without a further migration. Nullable — today access is persona-level only (no per-artefact ACL exists).';
```

Full file: `supabase/migrations/20260819000000_artifact_records_actor_commitment.sql`.

## 5. Phase 2 files touched

| File | Change |
|---|---|
| `supabase/migrations/20260819000000_artifact_records_actor_commitment.sql` | New — the 4-column additive migration (§4) |
| `services/artifact/artifactRecordStore.ts` | New fields on input/row types, `actorCommitmentFor()` helper, `actorCommitment` filter on `listArtifactRecords` |
| `services/artifact/pilots/softwarePilot.ts` | Threads `args.actorCommitment` into the persisted record |
| `app/api/artifact/records/mine/route.ts` | New — persona-scoped, T1-safe read |
| `app/triad/components/codex/tabs/MySoftwareTab.tsx` | Fetches the new route, renders a second card section, adds Command Center + myLedger deep links |
| `tests/companion-mysoftware.test.ts` | Updated Phase-1-only canary to the Phase 2 contract |

## 6. What Phase 2 explicitly does NOT do

- Does not touch Phase 3 (Test/Run/Deploy/Publish/Share/Delegate/Archive) in any way.
- Does not backfill `actor_commitment` (or any new column) on rows written before this migration — those rows are genuinely unattributable and stay that way, honestly.
- Does not populate `artefact_type`/`runtime_host`/`permissions` from any producer yet (§3.3) — schema only.
- Does not force a copilot-awareness integration where none cleanly exists (§3.6) — punted with the reasoning on record.
- Does not touch the four other produce-* routes' local `actorCommitmentFor` copies (produce-research, composition/publish, homecoming/agent/produce) — pre-existing duplication, out of this pass's scope, named as a follow-up.

---

*Authored docs-first, 2026-07-24. Phase 1 reconciled against PRD-MMC-IMPL-006 (the component pattern mirrored), `services/devCommandCenter/devLoop.ts`, `types/devCommandCenter.ts`, `services/constitutional/capabilityRegistry.ts`, `app/api/artifact/produce-software/route.ts` + `services/artifact/artifactRecordStore.ts` (the `artifact_records` ownership-gap finding, §0.2), `data/codex-configs.ts`'s `mycluster` group, and `MyLedgerTab.tsx` / `services/companion/searchFederation.ts` as the integration points extended. Phase 2 reconciled against SPEC-MMC-002 §6.2 directly, `services/devCommandCenter/stageGroundData.ts`, `services/research/publicReads.ts`, and `components/composer/IRLResearchCopilotTab.tsx` (§3.6's copilot-awareness investigation). Builds nothing beyond each pass's stated scope.*
