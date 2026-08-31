# EXP-P1 Track 2 / Crystal v2 — Copilot decision-surface work — handoff

**Session date:** 2026-08-30 → 2026-08-31
**Branch:** `review/irl-scoped-restoration-2026-08-27` (all work pushed here first, then cherry-picked to `dev`)
**Scope:** Research Programme Orchestrator (Track 2) reliability + Copilot decision surfaces for EXP-P1 / Crystal v2. Scientific protocol, remediation profile, acquisition logic and readiness criteria were explicitly **not** touched at any point.

This doc is the single continuation point for the next agent. Read it before touching any of the files named below — several fixes here closed defects that had already been rediscovered once; re-reading this saves re-deriving the same root causes.

---

## 1. What shipped, in order, with dev commits

All five pieces below deployed to `dev` via the same workflow (fetch `origin dev` → temp branch off `origin/dev` → cherry-pick from the review branch → verify byte-identical diff → fold `.amplify-deploy` via `--amend` → push `HEAD:dev` → delete temp branch → return to review branch). Do not skip the byte-identical diff check; it's what catches a bad cherry-pick before it reaches Amplify.

| # | What | Dev commit |
|---|---|---|
| 1 | Empty-504 fix on `POST /api/research/programme/[experimentId]/advance` | `82f6308b4` |
| 2 | "Approve targeted acquisition" Copilot CTA (Discover Sources → real acquisition job) | `56b074876` |
| 3 | "Review & Promote" Copilot decision surface (real candidate cards, not prose) | `56b074876` (same push as #2's follow-on — check `git log` on `dev` if exact boundary matters) |
| 4 | `prepare-independent-review` generalized `actionable` fix | `aec0d2d6f` |
| 5 | Classify Provenance omission defect (`classDisposition` required) | `d1f2ba082`, env-loader follow-up `5e26748d7` |

Live repair of the one affected record (see §5) was applied directly by the operator using `scripts/repair-classify-provenance-record.ts` against production Supabase — not part of a deploy.

---

## 2. Empty-504 fix (`researchProgrammeOrchestrator.ts`)

**Root cause:** `loadTrack2ProgrammeState` (readiness + candidate/source/artifact reads + frozen-manifest verification + cohort reconciliation) had no time bound before the act-execution loop even began — a slow state composition could exceed the hosting timeout with nothing returned.

**Fix:** `PhaseTimer` class instruments every phase (auth, state derivation, readiness, measurement-layer resolution, each act, final re-read) into `ProgrammeRunResult.diagnostics`. A hard `Promise.race` backstop (`STATE_COMPOSITION_DEADLINE_MS = 15_000`) around the initial state load returns a structured `503` instead of an empty response if exceeded. `DEFAULT_TIME_BUDGET_MS` reduced 45s→20s to leave real margin under this repo's own documented "~30s real ceiling regardless of declared `maxDuration`" (see sibling routes `app/api/dev-command-center/validate|remediate/route.ts`).

Tests: `tests/research-programme-orchestrator.test.ts`, describe block `'the empty-504 repair'`.

---

## 3. "Approve targeted acquisition" (Discover Sources)

**Problem:** the Copilot's "Open Discover Sources" CTA just deep-linked to Corpus Scout — no way to act from the Copilot.

**Fix:**
- `services/research/crystalAcquisitionJob.ts` (new) — `approveAcquisitionJob`, `getActiveAcquisitionApproval`, `completeAcquisitionJob`, `runOneAcquisitionStep`. One bounded step per call (one ratified+verified institution's discovery), never the unbounded whole-domain sweep.
- `supabase/migrations/20260830213500_crystal_acquisition_approvals.sql` — the **one durable fact** ("has a steward authorized acquisition"), never a cached decision — the deficit and the plan are always re-derived live from `crystalReadiness.ts`/`crystalAcquisitionBrief.ts`.
- Two new routes: `POST .../acquisition/approve`, `POST .../acquisition/run-step`.
- `PendingGovernanceDecision.acquisitionBrief?: CrystalAcquisitionBrief` — attached when the `discover-sources` stop applies.
- Copilot UI (`IRLResearchCopilotTab.tsx`): primary CTA "Approve targeted acquisition" drives approve → bounded step loop → `runProgramme()` ("Run until you need me") continues automatically once the plan is satisfied or institutions are exhausted. "Open Discover Sources" survives as a demoted inspect-only link.

Tests: `tests/crystal-acquisition-job.test.ts`, `tests/crystal-acquisition-approve-route.test.ts`, `tests/crystal-acquisition-run-step-route.test.ts`, plus canaries in `tests/track2-copilot-deep-link.test.ts`.

**Never executed live** — this mechanism has not yet been exercised against real EXP-P1 acquisition. If the next agent is asked to run it, confirm with the operator first; it does real external HTTP against ratified institutions.

---

## 4. "Review & Promote" decision surface

**Problem:** the `review-and-promote` stop rendered only a capability string (`POST /api/invariants/discovery {action:'promote'}`) with no queue — an operator with N candidates awaiting review had nothing to click.

**Fix:** `PendingGovernanceDecision.reviewQueue?: ReviewPromoteCandidateEntry[]`, populated in `loadTrack2ProgrammeState` from the SAME `successorScopedCandidates` array Stage 3/4's own counts already derive from (no second query, no vP1/historical leakage). Each entry resolves evidence (`listEvidence`, joined by id), a pre-flight duplicate check (`findDuplicates` — the same instrument `promoteCandidate` itself runs), and a deterministic, **advisory-only** recommendation (confidence + convergence + duplicate signal — never binding).

Copilot renders one bounded card per candidate: statement, evidence excerpt, namespace, classification, confidence, duplicate warning, recommendation, **Promote / Reject / Exception-Inspect**. Promote and Reject call the existing canonical `POST /api/invariants/discovery {action:'promote'|'reject'}` directly — no new promotion/rejection implementation. After each disposition, a fresh Track2 read decides the count (server-derived, never client-decremented); once the queue empties, `runProgramme()` continues automatically.

Tests: new describe block in `tests/research-programme-orchestrator.test.ts` ("the review & promote queue"), UI canaries in `tests/track2-copilot-deep-link.test.ts`.

**Audit of the other 6 human-gated stages** (`review-and-admit`, `classify-provenance` [see §5 — separately reworked], `add-relationships`, `assign-to-crystal`, `freeze`, `prepare-independent-review`) found 5 already had real, wired action controls embedded at the Copilot's deep-link anchor in `Track2ProgrammePanel.tsx` — only `review-and-promote` and (differently) `prepare-independent-review` had the defect. `freeze` was confirmed to still have no automatic path (`researchProgrammeOrchestrator.ts` holds no call to `freezeArtifact`, canary-enforced).

---

## 5. `prepare-independent-review` generalized `actionable` fix

**Problem:** `firstPendingDecision` filtered out any `partially-complete` stage with empty `remedies` (meant to suppress Classify Provenance's "only historical exclusions remain, nothing to do" case) — but this ALSO suppressed `prepare-independent-review` at the one moment it's genuinely actionable (`independentReviewRequestOpen === true`, which sets `remedies: []` because the review itself is the act, not a repair).

**Fix — deliberately generic, not a stage-id special case:** `Track2Stage` gains an optional `actionable?: boolean` field, declared by each stage from its own state (same as `status`/`detail`/`remedies`). `firstPendingDecision`'s filter became `remedies.length > 0 || stage.actionable === true`. Only `prepare-independent-review` sets it (`true` iff `independentReviewRequestOpen`); every other stage is unaffected (field defaults falsy). `PendingGovernanceDecision.actionable: boolean` carries it through.

Tests: `tests/research-programme-orchestrator.test.ts`, describe block "the generic actionable rule" — includes a synthetic-stage proof that the mechanism isn't name-specific, plus a freeze-immunity canary.

---

## 6. Classify Provenance omission defect — **the most recent, most important item**

### What happened live

Steward classified 3 newly-promoted EXP-P1 invariants. For the first one, no evidence-provenance class was ever explicitly selected in the dropdown — the write still succeeded and Track 2 marked the stage complete.

### Root cause

`ClassificationQueue` (`components/research/Track2ProgrammePanel.tsx`) has three submission paths:
- **"Classify & next"** (manual dropdown) — correctly guarded, `disabled` until `to` is set.
- **"✓ Accept"** (per-record) and **"Accept All High-Confidence (>95%)"** (batch) — both submitted `to: classSuggestion.suggestedClass` **directly**, bypassing the dropdown state and its guard entirely.

Nothing server-side (`applyProvenanceReclassification`) distinguished "steward picked a value" from "machine's suggestion submitted verbatim via one click." Track 2's completion check was never lax — it correctly re-validates a real ratified class is present — it just had no way to know the class arrived unreviewed.

### The fix (deployed, `d1f2ba082` + `5e26748d7`)

- `services/research/experimentalPopulations.ts`: `ProvenanceReclassification` gains a **required** `classDisposition: 'operator-selected' | 'recommendation-accepted'` (no default). `applyProvenanceReclassification` refuses any event that omits it, or that declares `'recommendation-accepted'` without a structurally-consistent `acceptedRecommendation` (`suggestedClass` matching `to`, non-blank `reason`, 0–100 `confidence`) — **enforced server-side**, not merely a disabled button.
- **Grandfathered repair door**: the existing same-value dedup guard (`from === to` → refuse "already classified") now permits **one** re-affirmation when the record's latest log entry lacks a valid `classDisposition` (i.e. predates this fix). Once re-affirmed, the record is properly governed and a further same-value attempt is refused again — not a standing bypass.
- Deliberately did **not** touch `populationReconciliation.ts` / `track2Programme.ts` completion logic or readiness criteria — the invariant "Track 2 cannot mark provenance complete without a valid explicit classification" holds **by construction of the one write gate**; a redundant read-time re-check would either be a no-op for future records or wrongly retroactively re-flag already-correct ones.
- UI: `classifyAndNext` → `operator-selected`; `acceptSuggestion` and `acceptAllHighConfidence` (batch) → `recommendation-accepted` + the exact accepted-recommendation snapshot. The other classify surface, `components/composer/InvariantDiscoveryTab.tsx` (manual-only), always declares `operator-selected`.
- `app/api/invariants/discovery/route.ts`: thin pass-through for the two new fields — no new validation logic in the route itself (matches its existing "no logic here" design).

Tests: 10 server-side (`tests/evidence-provenance-populations.test.ts`, describe `'the constitutional act — classDisposition is declared, never inferred'`), 5 UI canaries (`tests/track2-steward-workflow.test.ts`, describe `'Classify Provenance — every submission declares WHICH explicit steward act produced the class'`).

### Live repair already completed

Root cause: all 3 records were classified **before** this fix existed, so all 3 originally had `classDisposition: null` in their log. The operator confirmed (via `AskUserQuestion`) that **only** the first-classified record (`invariant_id = 00a6d616-f1fb-4911-8c0a-e4b9f742258e`, "business continuity plans...", classified 2026-08-30T23:22:04Z — earliest of the 3 timestamps) lacked real steward review; the other two (`8e13b697-...`, `375393e8-...`) were genuinely reviewed and are to be left untouched.

**Repair executed** via `scripts/repair-classify-provenance-record.ts --confirm` (the operator ran it locally, using their own Supabase credentials — this session has no live DB access, see §7). Confirmed by SQL re-read: Record 1 now has `reclassification_count: 2`, `latest_class_disposition: "operator-selected"` — original ungoverned entry preserved (append-only), new governed entry appended. Records 2 and 3 unchanged (`reclassification_count: 1`, `latest_class_disposition: null` — **this is expected and correct**, not a residual bug: they were classified pre-fix too, but the operator attests they were genuinely reviewed, and the fix does not retroactively require re-governance of records nobody flagged as bad).

**`scripts/repair-classify-provenance-record.ts` usage note for future repairs of the same kind:** it needs BOTH the script file and `services/research/experimentalPopulations.ts` pulled from canonical `dev` — pulling only the script (as this session initially instructed) leaves the OLD pre-fix service file in place locally, which lacks the grandfather-door logic and refuses with "already classified" every time. The `.env.local` loader was also missing initially (added in `5e26748d7`) — a standalone `tsx` invocation doesn't get Next.js's automatic `.env.local` loading.

---

## 7. Environment gotchas the next agent will hit immediately

- **No live Supabase/DB access in this session type.** `ListConnectors` may show `Supabase: connected: true` at the account level while `enabledInChat: false` — `ToolSearch` for `mcp__Supabase__*` tools will find nothing. Re-toggling from the operator's client does not reliably reattach mid-session (per this repo's own CLAUDE.md "Session Start — Verify Connector/MCP Access" section). Don't burn time re-checking repeatedly; fall back to giving the operator exact SQL / scripts to run themselves, per that same CLAUDE.md section.
- **Two `AigentZBeta` repos exist.** Canonical (what Amplify builds, what every session must push to): `iQube-Protocol/AigentZBeta`. The operator's own laptop `origin` remote points at a stale fork, `Kn0w-1/AigentZBeta` — confirmed live this session (`scripts/repair-classify-provenance-record.ts` was missing on their machine after cloning from `origin` alone). The operator has (or should have) a second remote, `iqp`, pointing at canonical — always route the operator's local `git fetch`/`git checkout <path>` commands through `iqp`, never `origin`, never bare `dev` without specifying the remote.
- **Deploy workflow** (already used 5x this session, works reliably): see the table in §1's preamble. Never push directly from the review branch to `dev`; always go through the disposable temp branch + cherry-pick + byte-diff-verify pattern so a bad state on `dev` is never possible from this side.

---

## 8. What's NOT done / explicitly deferred

- **Validate All has not been run** against live EXP-P1. The operator asked to stop before this every time; do not run it without a fresh, explicit go-ahead in whatever conversation picks this up next.
- **The acquisition-approval mechanism (§3) has never been exercised live.** If asked to run it, confirm scope with the operator first — it performs real external HTTP against ratified institutions and writes real candidate sources.
- **`prepare-independent-review`'s underlying UI (`ReviewPackageControl`) was found to have a labeling quirk** (its `capability` field names a read-only eligibility check rather than the real mutating route) — noted in the original audit but not fixed; low priority, cosmetic only, and NOT related to the actionable-filter fix in §5 (which is fully closed).
- **Whether Track 2 currently reads Classify Provenance as fully complete for EXP-P1 (after the §6 repair) has not been re-confirmed via a fresh `GET /api/research/track2/EXP-P1` read in this session** — the operator's own SQL confirms the persisted data is correct, but nobody has re-loaded the Copilot/Track2 panel to confirm the STAGE STATUS reads complete post-repair. That's a 30-second sanity check worth doing first if picking this back up: load the Track 2 tab for EXP-P1 and confirm `classify-provenance` shows complete and the next pending decision (if any) is genuinely the next real thing to do.

---

## 9. Key files map (for fast re-orientation)

| Concern | File |
|---|---|
| Loop orchestration, all `PendingGovernanceDecision` enrichment | `services/research/researchProgrammeOrchestrator.ts` |
| Stage definitions, `Track2Stage.actionable`, deep-link contract | `services/research/track2Programme.ts` |
| Provenance classification core logic, `classDisposition` | `services/research/experimentalPopulations.ts` |
| Classify route (thin pass-through) | `app/api/invariants/discovery/route.ts` |
| Copilot UI — all three new decision cards live here | `components/composer/IRLResearchCopilotTab.tsx` (acquisition + review-and-promote), `components/research/Track2ProgrammePanel.tsx` (`ClassificationQueue`, and every other stage's embedded control) |
| Acquisition job service + migration | `services/research/crystalAcquisitionJob.ts`, `supabase/migrations/20260830213500_crystal_acquisition_approvals.sql` |
| Live-repair tooling | `scripts/repair-classify-provenance-record.ts` |
| Test homes | `tests/research-programme-orchestrator.test.ts` (orchestrator + Track2 logic), `tests/track2-copilot-deep-link.test.ts` (Copilot UI canaries), `tests/track2-steward-workflow.test.ts` (steward-workflow UI canaries incl. Classify Provenance), `tests/evidence-provenance-populations.test.ts` (provenance/population logic), `tests/crystal-acquisition-*.test.ts` (acquisition job + routes) |

Full suite baseline going into and coming out of this session: **17 failing files / 49 failing tests, unrelated to this work** (repo-weight budget, one stale resolution-record source-doc reference) — confirm this exact count is still what a fresh `npx vitest run` shows before attributing any new red to prior work.
