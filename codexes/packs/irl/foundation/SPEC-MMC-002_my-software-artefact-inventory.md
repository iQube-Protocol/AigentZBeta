# SPEC-MMC-002 — My Software: Developer-Strand Artefact Inventory

**metaMe IRL / iQube Protocol / AgentiQ · myCluster interaction-model specification · Status: RATIFIED (operator-directed, 2026-07-24) — Phase 1 shipped, Phase 2 shipped, Phase 3 shipped (Archive/Test/Deploy-propose/Delegate-propose; Run/Publish/Share honestly deferred, see §6.3.5)**
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

### 6.2a Amendment (2026-07-24, live operator feedback) — broaden the PRIMARY source to the Capability Registry

Live testing on dev surfaced a finding that changes what "Phase 2" primarily means: `dev_loop_sessions` and `artifact_records` are both narrow — most real capability work on this platform (the Constitutional Video/Audio pipeline being the concrete example the operator pointed at — a 4-segment video brief generator, an audio pipeline, a Coherent Bundle Generation skill, all shipped as direct feature development) never touches either table, because it never goes through the DCC dev-loop UI or the `produce-software`/softwarePilot route. Applying the migration in §6.2 alone does not make such work appear — there is no row to attribute, not a permissions problem.

The Capability Registry (CFS-032 §4, `services/constitutional/capabilityRegistry.ts`) is the closer fit: it's the same registry the CFS-049 Constitutional Capability Briefs already register into, it carries the full description/standing/lifecycle/brief-link detail SPEC-MMC-002 §3's item model wants, and — unlike `artifact_records` — a workable per-persona attribution path already exists: `capability_registry` rows carry no identity column (T2 discipline), but each row's `registered_receipt_id` points at an `activity_receipts` row that DOES carry `persona_id` server-side. Cross-referencing the caller's own `capability_registered` receipts against the registry (`GET /api/constitutional/capability-registry/mine`, no admin gate — persona-scoped, mirrors the `dev-command-center/sessions` reasoning) gives an honest "which of these capabilities did I register" answer without adding any new identity exposure.

Operator decision (2026-07-24, in response to an `AskUserQuestion` fork): **broaden mySoftware's primary content to the Capability Registry**, over three alternatives (manual attach-after-the-fact, a brand-new dedicated ledger, or pausing to revise this doc first). Implication accepted alongside the decision: registration is a real ceremony (Constitutional Acceptance, CFS-032 §4), not automatic on shipping — broadening the SOURCE doesn't retroactively populate it. The video/audio pipeline capability was added to `scripts/register-ccb-capabilities.ts` (now a 4-capability script, not just the 3 CCBs) so the operator can register it in the same pass.

`dev_loop_sessions` and `artifact_records` are NOT removed — they remain a secondary "in-progress builds" / "generated implementation packs" view beneath the primary registered-capabilities section, since they show real (if narrower) process state the registry doesn't carry (stage, receipt-class counts, pack provenance).

### 6.3 Phase 3 — mutating actions (SHIPPED 2026-07-24 — Archive, Test, Deploy-propose, Delegate-propose; Run/Publish/Share investigated and honestly deferred)

Test, Run, Deploy, Publish, Share, Delegate, Archive each required a dedicated ceremony design (authority boundary, receipt class, D1/D-series discipline where execution is involved) before any code was written. The operator's blanket 2026-07-24 authorisation cleared this SPEC's own gate on STARTING that work; it did not substitute for the per-action design — each of the four shipped actions below composes an ALREADY-EXISTING ceremony (Extend, Don't Duplicate), never a new execution/deployment/authority mechanism invented for this pass. D1 (CFS-016, "code execution stays human") and the DVN Pipeline Protection paramount rules in CLAUDE.md were not touched, weakened, or reinterpreted by any of this work.

#### 6.3.1 Archive — SHIPPED

A pure lifecycle status-flag flip + receipt. No execution, no deployment, no external side effect.

- **Route:** `POST /api/constitutional/capability-registry/mine` (extended — see §6.3.5), `{ action: 'archive', capabilityId }`.
- **Ownership:** the route re-derives the caller's own registered-capability set fresh on every call (the SAME cross-reference the GET already performs: the caller's own `capability_registered` receipts → registry rows) and refuses (403) before `deprecateCapability` is ever reached — never a client-supplied "is mine" flag.
- **Service function:** `deprecateCapability(personaId, { capabilityId })` (new, `services/constitutional/capabilityRegistry.ts`) — mirrors `recordOperationalValidation`'s shape (look up → mutate → receipt → persist). Idempotent: archiving an already-deprecated capability returns `alreadyDeprecated: true`, no duplicate receipt.
- **Receipt:** new action type `capability_deprecated` (added to `ActivityActionType` in `services/receipts/activityReceiptService.ts` and to `ANCHORABLE_ACTION_TYPES` in `services/dvn/activityReceiptDvnPipeline.ts` — the ONE unilateral change CLAUDE.md's DVN Pipeline Protection section permits without operator approval).
- **UI:** an "Archive" button on each registered-capability card in `MySoftwareTab.tsx`, gated behind the canonical `ConfirmDialog` primitive (`components/ui/ConfirmDialog.tsx` — Extend, Don't Duplicate, not a new confirm modal). Archived capabilities stay visible in the list (badge flips to `deprecated`) rather than disappearing — deleting the tab must never look like deleting the underlying information.

#### 6.3.2 Test (operational validation) — SHIPPED

Already existed as a service function and an admin-gated route action; this pass adds the persona-scoped equivalent so the capability's OWN registrant (not only an admin) can record it.

- **Route:** same `POST /api/constitutional/capability-registry/mine`, `{ action: 'test', capabilityId, evidence }`.
- **Ownership:** identical re-derivation + 403 refusal as Archive, before `recordOperationalValidation` (pre-existing, UNCHANGED) is called.
- **Evidence gate:** unchanged — `recordOperationalValidation` already refuses (400, "Standing accrues from verified contribution, not from a click") when `evidence.length < 10`. This pass does not weaken that gate.
- **Receipt:** the pre-existing `capability_operationally_validated` action type — no new receipt class.
- **UI:** a "Test" button expands an inline evidence textarea + "Submit test evidence" button. This never executes any code — it is a human typing what they observed working, exactly as the underlying function's own docstring describes.

#### 6.3.3 Deploy (propose-only) — SHIPPED

This tab's Deploy action is ENTIRELY a caller of the pre-existing D1-safe `POST /api/constitutional/deployment-proposal` ceremony — no new deployment logic was written.

- **Route called directly (admin-gated, unchanged):** `POST /api/constitutional/deployment-proposal` — `{ packId, commitRange, goal?, validationNotes?, touchesProtectedFiles? }`. Reading the route confirmed the exact required shape rather than guessing it (`packId` and `commitRange` are the two required fields).
- **UI:** a "Deploy" button — shown only when `isAdmin` (an optimistic client hint per CLAUDE.md's Inter-Cartridge Navigation rule; the route re-enforces the admin gate server-side regardless) — expands an inline form for the operator to supply the REAL `packId`/`commitRange`/validation notes/protected-files flag. Nothing is fabricated: there is no honest default `commitRange` for a capability card, so the operator types the actual range they intend to propose.
- **Result:** the route's own response (`deployment.ref`, `deployment.state`, `d1Semantics`) is displayed verbatim. `d1Semantics` already states the contract: "Proposal recorded... Execution stays human (D1): review the chain, then push manually exactly as today." This tab does not add, remove, or reinterpret that sentence.

#### 6.3.4 Delegate (propose-only: form + accept, human-only authorize) — SHIPPED

`constitutionalAgreement.ts`'s `formAgreement`/`acceptAgreement`/`authorizeAgreement` primitive (form → accept → **human authorizes** → active) is a clean fit for "scope a bounded-delegation agreement naming this capability and propose it" — `capabilityRef` accepts any stable capability-id string (the existing MoneyPenny Runtime integration already uses plain slugs like `cap-moneypenny-financial-services`, not a registry UUID), so a capability's own `capabilityId` composes directly with no forcing.

- **Routes called directly (pre-existing, unchanged):** `POST /api/constitutional/agreement` — `{ action: 'form', ... }` then `{ action: 'accept', acceptorType: 'agent', ... }` in one click ("Propose delegation"); `{ action: 'authorize', agreementId }` on a SEPARATE, distinctly-labelled "Authorize" button.
- **Principal–Delegate Separation (the line that must never move):** `handleProposeDelegation` in `MySoftwareTab.tsx` never calls the `authorize` action — that call site exists ONLY inside `handleAuthorizeDelegation`, fired exclusively by an explicit human click on the "Authorize (human step)" button. This mirrors `app/(shell)/moneypenny/components/RuntimePanel.tsx`'s own reviewed form/accept/authorize precedent (canary: `tests/moneypenny-runtime-authority-boundary.test.ts`) rather than inventing a new authorization UI pattern. `tests/companion-mysoftware.test.ts` now carries the matching canary for this tab: exactly one `action: 'authorize'` call site in the whole file, and it must live inside `handleAuthorizeDelegation`.
- **Delegate agent + authority defaults:** `selectedAgentRef: 'aigent-z'` (the system orchestrator already named in every capability receipt's `agentsInvoked`), a conservative `delegatedAuthority` (`forbiddenActions: ['transfer']`, `valueCeiling: null`, no settlement terms — this is not a money-moving delegation, so no `verificationRequirements` proof grade is imposed).
- **Agreement id:** deterministic per capability (`agr-cap-${capabilityId}-aigent-z`) — re-proposing is a no-op per `formAgreement`'s own idempotency contract.
- **UI persistence:** on load, the tab also reads `GET /api/constitutional/agreement` (best-effort) and folds any already-authorized/accepted status into the card, so revisiting the tab never loses a prior session's delegation state.

#### 6.3.5 What did NOT ship, and why (investigated, not silently narrowed)

- **Run** — no existing D1-safe "execute this capability" runtime was found anywhere in the codebase. Building one would mean inventing new execution machinery from scratch — exactly what this pass was told not to do. A real Run ceremony is future chartering work (Phase 4), not composed here.
- **Publish** — `registerCapability` already sets `lifecycle.state`/`version.status` to `'published'` immediately on registration; there is no draft workflow in use today. A distinct "Publish" action has no state transition left to perform for anything already in the registry. Documented honestly rather than inventing a fake draft stage to give Publish something to do.
- **Share** — investigated `services/passport/participationAccess.ts` and the x409/CAS invitation surfaces; both are cohort/participation-scoped grants, not a persona-to-persona "share this specific capability" primitive. No clean existing fit was found, so Share was not forced onto either mechanism.

#### 6.3.6 New backend surface (complete list)

| File | Change |
|---|---|
| `services/constitutional/capabilityRegistry.ts` | New `deprecateCapability(personaId, { capabilityId })` — Archive's service function |
| `app/api/constitutional/capability-registry/mine/route.ts` | New `POST` — `{ action: 'archive' \| 'test' }`, both ownership-gated via a shared `myRegisteredCapabilities()` re-derivation used by GET and POST alike |
| `services/receipts/activityReceiptService.ts` | New `ActivityActionType` literal: `capability_deprecated` |
| `services/dvn/activityReceiptDvnPipeline.ts` | `capability_deprecated` added to `ANCHORABLE_ACTION_TYPES` (the one permitted unilateral change) |
| `supabase/migrations/20260724120000_capability_deprecated_and_receipt_check_drift_fix.sql` | New — rebuilds `activity_receipts_action_type_check` wholesale (adds `capability_deprecated`; also see §6.3.7 — a pre-existing drift bug found and fixed in the same rebuild) |
| `app/triad/components/codex/tabs/MySoftwareTab.tsx` | Archive/Test/Deploy/Delegate UI, calling the routes above + the two pre-existing ceremonies directly |
| `tests/companion-mysoftware.test.ts` | Updated composition canary + new authority-boundary canary for the authorize call site |

No new database table was created. `Deploy` and `Delegate` call pre-existing routes directly with no new backend code at all.

#### 6.3.7 Bug found and fixed during this pass

While rebuilding the `activity_receipts_action_type_check` CHECK constraint for `capability_deprecated` (required wholesale per the 2026-07-15 constraint-drift-incident convention every prior migration in this chain follows), cross-referencing the live TypeScript `ActivityActionType` union and `ANCHORABLE_ACTION_TYPES` against the constraint's last rebuild (`20260719000000_constitutional_agreements.sql`) found four action types shipped in TypeScript with NO matching CHECK-constraint entry: `qubetalk_artifact_shared`, `qubetalk_artifact_opened`, `qubetalk_artifact_copied` (QubeTalk Peer Exchange, 2026-07-21) and `finance_authoritative_execution` (MoneyPenny Runtime P4-4). Any `createActivityReceipt` call with one of those four action types would have hit the CHECK constraint in production and thrown — silently losing the receipt AND its DVN anchor, with no soft-fail path catching it (it is neither a missing-table nor a missing-column error). Folded into the same wholesale rebuild this migration was already required to do — no separate migration, no DVN pipeline logic touched.

---

## 7. Ratification record

- [x] Operator has read and ratified this SPEC (§0–§6) as written, including the explicit phase gating. — 2026-07-24
- [x] Phase 1 (§6.1) implementation reviewed against this SPEC's §0.3 constraint (no `artifact_records` ownership claims) before merge. — verified 2026-07-24, commit `7a2a9890`
- [x] Phase 2 (§6.2) authorised to proceed. — operator, verbatim: "Ok. Will run the script etc shortly. Meantime phase 2/3 ratified/authorised." (2026-07-24). Per-change scoping (the `artifact_records` schema change specifically) still happens as that work is designed, not deferred as a separate approval gate.
- [x] Phase 3 (§6.3) authorised to proceed to design+build. — same operator ratification, 2026-07-24. Each of the seven actions was individually designed (authority boundary + receipt class) before its own code landed — this was an engineering sequencing requirement, not a pending approval.
- [x] Phase 3 (§6.3) shipped 2026-07-24. Archive, Test, Deploy (propose-only), Delegate (propose-only: form+accept, human-only authorize) built by composing pre-existing ceremonies (`recordOperationalValidation`, `/api/constitutional/deployment-proposal`, `constitutionalAgreement.ts`'s form/accept/authorize) — no new execution/deployment/authority mechanism invented. Run/Publish/Share investigated and honestly deferred (§6.3.5) — no clean existing seam found for any of the three. D1 (CFS-016) and DVN Pipeline Protection untouched; every mutating action re-derives ownership server-side; the `authorize` agreement action has exactly one call site in `MySoftwareTab.tsx`, fired only by an explicit human click (canary: `tests/companion-mysoftware.test.ts`).
