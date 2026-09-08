# IRL OS Workspace — Live State Round 3: Canonical Resolver, Experiments Tab, Real Pipeline/Review/Working Materials

**Date:** 2026-09-08
**Follows:** `2026-09-08_irl-os-workspace-generalization-round-2.md` (Round 2 — OCSGA capability
generalization, Stage-0 exclusion, navigation-model confirmation).

Operator instruction (verbatim, abridged): *"The Workspace consolidation is incomplete. The
screenshot from an invited EXP-P1 persona proves that entitlement visibility works, but the command
centre is still rendering stale/generic programme UI instead of canonical live experiment state. Fix
this end-to-end."* Ten numbered requirements — a real `Experiments` tab, one canonical
(principal + selectedWorkspaceId) resolver, live Pipeline/Overview/Review/Working Materials, no
independent inference per surface, parity between the left rail and the Experiments tab, and the
same generalization proven for Ian/OCSGA. **No grants, scientific state, Crystal, protocol or
rehearsal artifacts were altered** — every change here is read-only projection of existing state.

## 1. Superseded ruling — `Experiments` is now a real Workspace view

Round 2's §6A closed with "no redundant Experiments submenu — the left rail already is the
navigator." The operator explicitly overrode that same-day ruling: the left rail is a compact
*selector*; `Experiments` is the *full-page* rendering of the same entitled estate, and both are the
same job at two different scales, not two navigators. SPEC-IRL-WORKSPACE-001 §6A now records the
superseded ruling and the correction rather than silently deleting it (epistemic honesty discipline).

`services/research/researchWorkspaceViews.ts`'s `RESEARCH_WORKSPACE_VIEWS` gains a ninth entry,
`experiments` (`roles: allRolesExcept()` — every role reaches it, same as Overview/Pipeline).
`PartnerProgrammesTab.tsx`'s new `surface === "experiments"` block renders `RESEARCH_NAV_SECTIONS`
grouped over the **exact same `workspaces` array** the left rail's `ResearchProgrammeNav` already
consumes — not a second, independently-derived list. Selecting a row calls the identical
`setActiveId` the left rail uses, so both surfaces' highlight and the main workspace context update
together. This is why the parity invariant ("if visible in the left rail, visible in Experiments, and
vice versa") holds **by construction**, proven in
`tests/experiments-tab-left-rail-parity-2026-09-08.test.ts`.

## 2. The canonical (principal + selectedWorkspaceId) resolver

**New:** `services/research/selectedWorkspaceState.ts` — `resolveSelectedWorkspaceState(admin,
persona, workspaceId, origin)`, served at `GET /api/participation/workspace-state`. One authoritative
object per (principal, workspace): `workspaceId`, `programmeId`, `experimentId`, `role`,
`accessBasis`, `currentPhase`/`currentStage`, `nextMilestone`, `blockers`, `pendingHumanDecisions`,
`documents` (Stage-0-excluded), `capabilities` (readiness/agreement/exchange/documents flags),
`reviewState` (agreement + caller observer status), `exchangeIds`, `activity`, and an honest
`lockerScope` stub. Composed entirely from existing services — no parallel derivation:

- Membership/role/access basis → `getParticipantResearchWorkspaceAccess` / new
  `resolveWorkspaceRole` (generalized beyond `resolveExperimentReviewGrant`'s reviewer-role
  restriction — works for OCSGA's `research-participant` role too).
- Phase/stage/protocol/observer state → **new** `services/research/experimentLifecycleState.ts`.
- Reviewer countersignature → `reviewerAgreementStatus` (unchanged, already live).
- Documents (Stage-0-excluded) → `listIrlPackDocumentsForExperiment` (Round 2, unchanged).
- Reciprocal Artifact Exchange → `listMyExchanges` (Round 2, unchanged).
- Milestones/blockers → `listWorkspaceItems` (unchanged).
- Scientific activity trail → **new**, `resolveExperimentActivity` in the same module (see §6).

**No experiment or workspace id is hardcoded anywhere in this composition** — every branch keys off
`ws.experimentId` (present or absent). `tests/experiments-tab-left-rail-parity-2026-09-08.test.ts`
canary-enforces this (only the pre-existing, documented `READINESS_AVAILABLE_EXPERIMENTS` allowlist
is permitted to name `EXP-P1`/`P2`/`P3`, and only inside its own declaration).

Every Workspace surface — Overview, Experiments, Pipeline, Review, Working Materials — reads THIS
one fetch (`useSelectedWorkspaceLiveState` state in `PartnerProgrammesTab.tsx`). None of them
independently infers the same fact a sibling surface already resolved.

## 3. The genuinely new derivation: `experimentLifecycleState.ts`

`ResearchWorkspace.currentStage` (the registry field) was **100% a static, hand-typed string**, never
computed — confirmed by direct investigation before writing any code (`'Review'` hardcoded for
`autonomi-review-exp-p1`, absent entirely for `irl-validation-programme-vp1`, the container workspace
the operator's screenshot had selected — which is why it showed a placeholder: that container
workspace genuinely has no stage concept of its own, distinct from the EXP-P1 experiment workspace
nested beneath it in the same section).

`services/research/experimentLifecycleState.ts` extracts the SAME primitives the Validation
Programme's `agent-package` route already computed inline (`getArtifact`, `deriveProtocolRatified`,
`deriveOverview`, `getObserverRound`/`resolveObserverRound`) into one shared, persona-independent
derivation, keyed purely by `experimentId`. A six-phase state machine, each backed by a real
persisted signal (first match wins): `pre-freeze-review` → `awaiting-observer-assignment` →
`post-freeze-observer-review` → `protocol-preparation` → `ready-for-execution` → `execution`. Each
phase projects onto the generic 11-stage `research-experiment` lifecycle template's own `'Review'` /
`'Preregistration'` / `'Task Construction'` / `'Run'` labels — documented as a projection, not a
claim the two vocabularies are identical.

**Live EXP-P1 state, queried directly from production before writing the mapping** (not guessed):
crystal `EXP-P1/crystal-vP2` is **frozen** (2026-09-06, `internal-pilot` designation), **no observer
round has been assigned yet**, and none of the six protocol-freeze artifact kinds (arm-config,
task-set, answer-key, judge-config, analysis-config, interpretation-table) are frozen. This resolves
to phase `awaiting-observer-assignment`, stage label **`Review`** — real, current, honest, and it
happens to match the operator's own hypothesis, but for the actual reason (frozen substrate awaiting
observer assignment is fundamentally a review-phase state), not because the string was hardcoded.

## 4. Pipeline — live, not a static template marker

`PipelinePanel` now takes an optional `liveState` prop. For an experiment-bound workspace, its stage
marker uses `liveState.state.currentStage` (live) instead of `ws.currentStage` (static); it shows a
"Live phase: …" line naming the resolved phase and any pending human decision. A workspace with no
bound experiment (a programme container) still falls back to the static registry field — there is
genuinely nothing for the resolver to derive there, and the fallback is stated as such, not hidden.

## 5. Overview — Current Phase now live for experiment-bound workspaces

The "Current Phase" metric card prefers `liveState.state.currentPhase` (with a "live —
services/research/experimentLifecycleState.ts" detail line) for any research workspace naming an
experiment; a non-experiment workspace keeps the existing static-registry fallback. Health/Owner/Last
Sync remain honestly `NotYetWired` — no health-scoring model exists anywhere in this codebase, and
inventing one was out of scope for this pass (named explicitly in §8 below, per the operator's own
rule: report what is genuinely unmodeled rather than fabricate it).

## 6. Review and Working Materials — real content, not placeholder prose

**Review** now renders, for any experiment-bound workspace: the Reviewer Kit & Protocol document
list (Stage-0-excluded, reused `DocumentRow` component — exported from `WorkspaceCapabilitiesPanel.tsx`
rather than forked), the caller's role and current phase, any pending human decision (e.g. "Submit
one Observer Decision"), and the `ReviewerAgreementPanel` (unchanged, already live) when an agreement
exists for the experiment.

**Working Materials** now renders the SAME document list, framed as "authorized materials" rather
than reviewer documentation — the honest disclosure that a dedicated drafts/notebooks/branches store
does not exist for research workspaces was kept (true), but the surface no longer says nothing real
exists when authorized materials genuinely do.

**Activity** (new, `resolveExperimentActivity` in `experimentLifecycleState.ts`): a REAL, canonical
data source distinct from the generic persona activity-receipt feed (which carries no
experimentId/workspaceId tag at all, confirmed by investigation) — the experiment's own
`research_objects` rows (freeze events, protocol-artifact freezes, execution runs), each carrying the
same `receiptId` the DVN-anchorable `research_lifecycle_transition` receipt path writes. Exposed on
`SelectedWorkspaceState.activity` for a future UI mount (see §8 — not yet wired into the `evidence`
surface's JSX this round; the venture-only `EvidenceChainPanel` there is untouched).

## 7. Ian/OCSGA — the same resolver, no experiment-specific code

`resolveSelectedWorkspaceState` returns an honest `experimentLifecycle: null`, `currentPhase: null`,
`currentStage: null` for OCSGA (no bound experiment) — never a fabricated stage. Its workspace-bound
Reciprocal Artifact Exchange capability (Round 2) is unchanged and still resolves correctly alongside
the new fields. `tests/selected-workspace-state-2026-09-08.test.ts` proves this directly, and the
structural canary in `tests/experiments-tab-left-rail-parity-2026-09-08.test.ts` proves no
`'ocsga-boundary-research'`/`'autonomi-review-exp-p1'` literal exists anywhere in the resolution
logic.

## 8. What remains genuinely unmodeled — reported, not hidden

- **Locker scoping.** No T2-safe tagging convention exists for binding a Locker item to a research
  workspace/experiment. `SelectedWorkspaceState.lockerScope` returns `{ available: false, reason }`
  honestly; the Locker view itself is unchanged (holder-scoped, canonical, unfiltered — as it always
  disclosed). Building real scoping requires a tagging convention decision and is out of this pass's
  scope.
- **Activity surface UI.** `resolveExperimentActivity` is real and exposed on the resolver's output,
  but is not yet mounted into the Workspace `evidence` surface's JSX this round — the venture-only
  `EvidenceChainPanel` there renders empty for research workspaces exactly as before. The data exists;
  the UI mount is a follow-up.
- **Health / Last Sync metric cards.** No health-scoring or sync-tracking model exists anywhere in
  the codebase for research workspaces. Left as `NotYetWired`, honestly, rather than invented.
- **`agent-package/route.ts` was NOT refactored** to call the new shared
  `experimentLifecycleState.ts` — its own inline computation (isFrozen/protocolGate/observerReview)
  is functionally identical but textually separate. Low-risk to consolidate later
  (inv.engineering.036/037), deferred this round to avoid regressing its 32-test suite under time
  pressure; flagged here rather than silently left as a duplicate.

## Verification

- `tests/selected-workspace-state-2026-09-08.test.ts` — 12/12 (anonymous/missing/unknown/wrong-scope/
  revoked denial; live EXP-P1 frozen/awaiting-observer-assignment/Review-stage resolution for both
  admin and scoped reviewer; pre-freeze honest fallback; OCSGA null-lifecycle honesty; OCSGA exchange
  generalization with cross-workspace non-leak; milestone/blocker projection).
- `tests/experiments-tab-left-rail-parity-2026-09-08.test.ts` — 7/7 (single `workspaces` derivation;
  shared `setActiveId`; unrestricted view roles; shared server-side access gate; fail-closed-before-
  experiment-bound-state ordering; no hardcoded experiment/workspace literal outside the named
  readiness allowlist).
- `tests/research-lab-workspace.test.ts` — 48/48 (updated for the ninth view: every role's exact
  reachable-set table, `EVERY_TAB`/`EVERY_VIEW` counts, subTab counts on both cartridges).
- `tests/research-workspace-spec.test.ts` — 53/53 (updated: "nine views" spec-parity, `WORKSPACE_SURFACE_AUTHORITY`
  entry for `experiments`, "eight of nine views plus Tier 0" shipped-subset assertion).
- Full suite: 659 passed / 64 pre-existing failures across 17 files, unchanged from before this
  round's changes (confirmed via `git stash` A/B comparison) — none touch any file this round modified.
- `npx tsc --noEmit`: zero new errors (one pre-existing, unrelated error in
  `ValidationProgrammeJourneyTab.tsx` confirmed present with this round's changes stashed out too).

Live re-verification against the exact screenshot state (the real EXP-P1 reviewer/admin session) and
the final capability map follow in a subsequent report per the operator's stated stop condition.
