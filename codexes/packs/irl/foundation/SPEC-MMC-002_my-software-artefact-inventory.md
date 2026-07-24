# SPEC-MMC-002 — My Software: Developer-Strand Artefact Inventory

**metaMe IRL / iQube Protocol / AgentiQ · myCluster interaction-model specification · Status: RATIFIED (operator-directed, 2026-07-24) — Phase 1 shipped, Phases 2–3 authorised for build**
**Title:** *My Software — a citizen-facing inventory of everything built through the Developer strand*
**Companion to:** SPEC-MMC-001 §5 (myCluster as the Operational Spine) · PRD-MMC-001 (metaMe Companion) · CFS-032 (Constitutional Development Router) · CFS-049 (Constitutional Capability Brief)
**Extension of:** myCluster (`data/codex-configs.ts`, `group: 'mycluster'`) — this adds a sixth tab, `mySoftware`, alongside `myCanvas`, `myWorkspace`, `myLedger`, `myResearch`, `myCartridge`. Not a new architectural primitive: the same "read-only mirror of an existing, already-governed data source" pattern `myResearch` established for the research programme (SPEC-MMC-001 §5, PRD-MMC-IMPL-006).
**Owner:** AgentiQ Runtime stewards + Identity & Access Spine stewards, same ownership as SPEC-MMC-001. **Origin:** operator request 2026-07-24 ("we need an equivalent for software development… the missing piece in the cluster area"), expanded same day by the operator's own follow-up (quoting a collaborator persona, "Aletheon") into a fuller item model, status vocabulary, and action set. Reconciled by Claude Code against the shipped runtime the same day, in parallel with the first implementation slice.

> **Governance note (binding, this SPEC):** Docs-first, same regime as SPEC-MMC-001 and PRD-MMC-001. Phase 1 (§6.1) was implemented concurrently with this filing, per the operator's explicit "spin up a parallel agent to implement that" instruction — the same "build it and close the loop" precedent CFS-032 §4/§5 used. **Phases 2–3 (§6.2–6.3) were explicitly ratified/authorised by the operator on 2026-07-24** ("Ok. Will run the script etc shortly. Meantime phase 2/3 ratified/authorised.") — blanket authorisation to proceed past the SPEC's own gating language in §5/§6.3. This authorises *design and build to proceed*; it does not waive the substantive requirement that each Phase 3 mutating action (Test/Run/Deploy/Publish/Share/Delegate/Archive) still needs its own authority-boundary/receipt-class ceremony design before its code is written — D1 (CFS-016) and the DVN-pipeline-protection paramount rules are not superseded by this ratification, only unblocked to be worked through. Phase 3 is also sequenced after Phase 2 on engineering grounds independent of authorisation timing: Phase 3's actions (e.g. "Deploy") have nothing real to act on until Phase 2 gives the item model actual `deployment_state`/`runtime` fields.

---

## 0. Read this first — reconciliation against what's already built

### 0.1 The gap is real, and it sits exactly where myResearch's gap sat

`data/codex-configs.ts` (`group: 'mycluster'`) confirms five live tabs as of this session: `myCanvas`, `myWorkspace`, `myLedger`, `myResearch` (built this session per SPEC-MMC-001 §5), `myCartridge`. None of them surface a citizen's own output from the Developer strand — the Dev Command Center / Constitutional Development Environment (CFS-020, CFS-032). A citizen who has run dev-loop sessions, had capabilities accepted into the Capability Registry, or (in principle) produced software artifacts has no myCluster surface showing any of it back to them. This confirms the operator's own diagnosis.

### 0.2 There is ALREADY a durable software-artifact registry — do not duplicate it

`services/artifact/pilots/softwarePilot.ts` (composing `services/constitutional/implementationPack.ts` + `services/artifact/runArtifact.ts`) + `services/artifact/artifactRecordStore.ts` + the `artifact_records` table (migration `20260712000000_artifact_records.sql`, `profile: 'software'`) already persist software productions — title, brief, body (the CFS-015 Implementation Pack, rendered), `content_hash`, `sovereignty` (packId/composedBy/implementationMechanism/canonVersion), and an optional `receipt_id`. `listArtifactRecords({ delegate?, limit? })` already lists them. `POST /api/artifact/produce-software` is the live production route (admin-gated, D1-safe — it produces the pack artifact only, never executes/pushes/deploys).

**This is the pre-existing "software registry" the operator's constraint ("does not create a separate or duplicate software registry where one already exists") refers to.** Any "My Software" surface MUST read from `artifact_records` (profile `software`) as one of its sources, not invent a parallel table or a parallel notion of "what counts as a software artifact."

### 0.3 The catch: `artifact_records` has no per-citizen ownership today — this bounds what Phase 1 can honestly show

Reading `app/api/artifact/produce-software/route.ts` closely: it computes a T2-safe `actorCommitment = sha256('artifact:actor:' + personaId).slice(0,16)` and passes it into `produceSoftwareArtifact` — but `SaveArtifactRecordInput` (`artifactRecordStore.ts`) has **no `actorCommitment` column at all**, and the route never supplies a per-persona `delegate` either, so `produceSoftwareArtifact` falls back to its default: `delegate: args.delegate?.trim() || 'operator'`. **Every row in `artifact_records` today is stamped with the literal string `'operator'`, not a citizen-specific commitment.** There is currently no way to attribute an existing `artifact_records` software row to the individual citizen who produced it.

This is a real, load-bearing finding, not a detail to gloss over: it means a "My Software" tab **cannot honestly claim ownership of `artifact_records` rows today**. Per CLAUDE.md's "No Guessing or Hallucinating" doctrine, Phase 1 (§6.1) does not attempt to. It surfaces the two data sources that genuinely ARE persona-scoped already:

- **`dev_loop_sessions`** (migration `20260707110000`) — real `persona_id` column, ownership-filtered reads already exist (`app/api/dev-command-center/sessions/route.ts`).
- **`capability_registry`** (CFS-032, migration `20260716000000`) — a global constitutional ledger (no identity columns, T2 discipline by design), but each capability's *acceptance* is receipted via `createActivityReceipt({ personaId, actionType: 'capability_registered', ... })` — so a citizen's OWN receipts (already flowing through `myLedger`) name which capabilities THEY were the acting party for admitting, even though the registry row itself carries no identity.

Closing the `artifact_records` ownership gap (adding a T2-safe per-persona commitment column, and threading it through `produce-software` and any future self-serve software-production route) is named explicitly as a **Phase 2 prerequisite** (§6.2), not attempted here.

### 0.4 Existing integration seams to extend, not duplicate

- **myLedger** (`app/triad/components/codex/tabs/MyLedgerTab.tsx`) already has a proven per-artefact-class filter-chip mechanism: `FilterChip` union type, `CHIP_LABELS`, and a dedicated action-type `Set` per class (see `EXPERIMENT_ACTION_TYPES` / the `myexperiments` chip, shipped this session as myResearch's own ledger integration). My Software's ledger integration is the SAME mechanism, one more chip and one more Set — not a new grouping model.
- **Companion Search** (`services/companion/searchFederation.ts`, behind `GET /api/companion/search`) already fans out across 5 sources (research, registry-iqube, registry-asset, registry-library, capability-graph), each independently `guard()`-wrapped so one source's failure never fails the whole search. My Software's Companion integration is a 6th source in the same fan-out — not a new search surface.
- **Copilot awareness** follows the existing "observed, never asserted" pattern (CLAUDE.md "Artifact Production — AR/CPS + Observer Awareness"): a copilot narrating a citizen's workspace should fold recent My Software state into its ground/observation context the same way `/api/research/overview` + `IRLResearchCopilotTab` already do for research state — this SPEC does not invent a new copilot-awareness doctrine, it names the existing one as the mechanism to apply once Phase 1's data source stabilises.

---

## 1. Principle

**My Software is a projection, not a source of truth.** It has no data of its own — it reads, ranks, and displays what the Developer strand and the constitutional registries already produced. Deleting the `mySoftware` tab must never lose information; it only removes a window onto information that lives (and is governed) elsewhere. This mirrors `myResearch`'s own principle (SPEC-MMC-001 §5) exactly.

## 2. The pipeline (operator-specified)

```
Developer strand
      ↓
Build or generate software
      ↓
Register resulting artefact
      ↓
My Software
      ↓
My Ledger receipt and provenance
      ↓
Copilot access and actions
      ↓
Edge Companion availability
```

Each arrow above is an EXISTING seam (§0.4) being extended, not a new one being built, with the single named exception of "Register resulting artefact → My Software," which is the net-new read this SPEC charters.

## 3. Minimum item model (target — see §6 for what's achievable per phase)

| Field | Meaning | Available today? |
|---|---|---|
| Name | Human-readable title | Yes — `dev_loop_sessions.state.intent` / `capability_registry.display_label` / `artifact_records.title` |
| Artefact type | application / agent / capability / cartridge / tool / workflow / code project | Partial — `capability_registry` and `dev_loop_sessions` don't carry a type taxonomy field today; would need to be inferred or added |
| Status | see §4 | Partial — DCC's `DevLoopStage` and capability `lifecycle_state` map onto a subset; full status vocabulary (Paused, Archived) has no backing field yet |
| Originating project | The intent / venture / context this was built for | Yes for `dev_loop_sessions` (`state.intent`/`state.contextPack`); not modelled for `capability_registry` |
| Created by | The citizen (T2-safe reference) | Yes for `dev_loop_sessions` (`persona_id`, server-side only); **NO for `artifact_records`** (§0.3) |
| Owned by | Same as Created by today (no re-assignment/transfer model exists) | Same caveat as above |
| Delegated agents | Which agent(s) acted on the citizen's behalf | Partial — `dev_loop_sessions.state` records `agentsInvoked` on receipts, not on the session itself as a first-class field |
| Version | Build/pack version | Partial — `implementationPack` carries `canonVersion`; no semantic version field for the artefact itself |
| Last modified | Timestamp | Yes — `updated_at` on both `dev_loop_sessions` and `capability_registry` |
| Deployment state | Whether it's live | Partial — DCC's `deployment_authorized` / `deployment_proposed` receipt types signal this; no durable "is it currently deployed" field |
| Runtime or host | Where it runs | **No** — not modelled anywhere today |
| Permissions | Who else can see/act on it | **No** — inherits persona-level access only; no per-artefact ACL exists |
| Ledger receipt | Link to the DVN receipt(s) | Yes — `dev_loop_sessions.state.receipts[]`, `capability_registry.registered_receipt_id` |
| Available actions | See §4 | Partial — read-only actions (Open, Inspect receipts, View source) are buildable now; mutating actions require their own ceremonies |

This table is the honest gap map. Phase 1 (§6.1) surfaces every "Yes" and best-effort "Partial" row; it does not fabricate the "No" rows.

## 4. Suggested statuses (target vocabulary)

Draft · Building · Ready · Published · Deployed · Paused · Archived · Failed

`DevLoopStage`'s ten stages (`intent_capture` → `complete`) and `capability_registry.lifecycle_state` (`draft`/`published`/`canonized`/`deprecated`) are the two existing state machines; a full mapping onto this eight-value vocabulary — including which stages/states this vocabulary has NO existing counterpart for (`Paused`, `Archived`) — is Phase 2 work (§6.2), not invented ad hoc in Phase 1.

## 5. Core actions (target — phase-gated, see §6)

Open · Continue building · Test · Run · Deploy · Publish · Share · Delegate · Inspect receipts · View source · Archive

Every action in this list that only READS existing state (Open, Inspect receipts, View source, and a deep link into the Dev Command Center to "Continue building" an in-progress session) is Phase 1/2 work. Every action that MUTATES state (Test, Run, Deploy, Publish, Share, Delegate, Archive) requires its own constitutional ceremony — D1's "code execution stays human" discipline (CFS-016) already governs Deploy/Run explicitly; Publish/Share/Delegate would need their own authority-boundary design (mirroring `constitutionalAgreement.ts`'s form/accept/authorize idiom). None of these are chartered for build by this document; they are Phase 3 (§6.3), each requiring its own explicit operator go-ahead before implementation, consistent with the "Security — Access Gates" and DVN-pipeline-protection paramount rules in CLAUDE.md.

## 6. Phased implementation

### 6.1 Phase 1 — read-only inventory (THIS SESSION, in flight)

A `mySoftware` myCluster tab, mirroring `myResearch`'s exact architecture (`personaFetch`, loading/error/refresh, dark-slate card list), backed by:
- The citizen's own `dev_loop_sessions` (a new persona-scoped list endpoint, extending `/api/dev-command-center/sessions`), and
- `capability_registry` entries best-effort linked via the citizen's own receipts (`capability_registered` / `capability_operationally_validated`).

Wired into:
- `MyLedgerTab.tsx`'s existing filter-chip mechanism (new `mysoftware` chip + `SOFTWARE_ACTION_TYPES` set covering the DCC's real receipted action types: `implementation_pack_generated`, `constitutional_validation_recorded`, `remediation_recorded`, `deployment_proposed`, `deployment_authorized`, plus `capability_registered`/`capability_operationally_validated`).
- `searchFederation.ts`'s existing 5-source fan-out (a 6th source reading the citizen's own dev-loop sessions), surfacing My Software results through Companion Search — the Edge Companion integration the operator required.

Explicitly OUT of Phase 1: `artifact_records` is NOT read as a persona-owned source (§0.3); no mutating actions; no artefact-type taxonomy beyond "a DCC build" / "an accepted capability."

### 6.2 Phase 2 — close the ownership + taxonomy gaps (RATIFIED, operator-authorised 2026-07-24)

- Add a T2-safe per-persona commitment column to `artifact_records` (or an equivalent join table), and thread it through `produce-software` and any future self-serve production route, so software-pilot productions become attributable to the citizen who produced them — closing §0.3's gap.
- Introduce an artefact-type taxonomy (application/agent/capability/cartridge/tool/workflow/code project) as a real field, not an inferred label.
- Extend the item model to include Runtime/host and a real Permissions model (today: persona-level access only).
- Wire copilot ground-data awareness (§0.4's "observed, never asserted" pattern) once the data source is stable.
- Deep links from each My Software card into the artefact's originating Builder/Studio/runtime surface (`buildCodexUrl()`, per CLAUDE.md's Inter-Cartridge Navigation rule).

### 6.3 Phase 3 — mutating actions (RATIFIED for design+build, operator-authorised 2026-07-24; each action's ceremony is still designed individually before its code lands)

Test, Run, Deploy, Publish, Share, Delegate, Archive — each requires a dedicated constitutional ceremony design (authority boundary, receipt class, D1/D-series discipline where money or execution is involved) before any code is written. The operator's blanket authorisation clears this SPEC's own gate on STARTING that work; it does not substitute for the per-action design itself. Sequenced after Phase 2 lands (an artefact needs real `deployment_state`/`runtime` fields before a "Deploy" ceremony has anything to act on).

---

## 7. Ratification record

- [x] Operator has read and ratified this SPEC (§0–§6) as written, including the explicit phase gating. — 2026-07-24
- [x] Phase 1 (§6.1) implementation reviewed against this SPEC's §0.3 constraint (no `artifact_records` ownership claims) before merge. — verified 2026-07-24, commit `7a2a9890`
- [x] Phase 2 (§6.2) authorised to proceed. — operator, verbatim: "Ok. Will run the script etc shortly. Meantime phase 2/3 ratified/authorised." (2026-07-24). Per-change scoping (the `artifact_records` schema change specifically) still happens as that work is designed, not deferred as a separate approval gate.
- [x] Phase 3 (§6.3) authorised to proceed to design+build. — same operator ratification, 2026-07-24. Each of the seven actions is still individually designed (authority boundary + receipt class) before its own code lands — this is an engineering sequencing requirement, not a pending approval.
