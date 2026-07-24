# PRD-MMC-IMPL-007 — mySoftware: the sixth myCluster tab (Phase 1)

**Status:** Phase 1 shipped this pass — read-only Developer-strand mirror only
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

- [ ] Operator confirms mySoftware Phase 1 as a **read-only, non-admin, dev-loop-sessions-only** mirror — not the full item model, not `artifact_records`, not any of the fuller vision's actions.
- [ ] Operator confirms the `artifact_records` persona-attribution gap (§0.2) as a named Phase 2 prerequisite, not silently deferred.
- [ ] Operator confirms this document is SPEC-MMC-002 §6.1's implementation plan, not a competing scope statement — Phase 1 as filed here matches Phase 1 as chartered there.

---

*Authored docs-first, 2026-07-24. Reconciled against PRD-MMC-IMPL-006 (the component pattern mirrored), `services/devCommandCenter/devLoop.ts`, `types/devCommandCenter.ts`, `services/constitutional/capabilityRegistry.ts`, `app/api/artifact/produce-software/route.ts` + `services/artifact/artifactRecordStore.ts` (the `artifact_records` ownership-gap finding, §0.2), `data/codex-configs.ts`'s `mycluster` group, and `MyLedgerTab.tsx` / `services/companion/searchFederation.ts` as the integration points extended. Builds nothing beyond this pass's stated scope.*
