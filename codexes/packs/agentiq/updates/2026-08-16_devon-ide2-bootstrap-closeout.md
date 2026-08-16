# DevOn + IDE 2.0 Bootstrap — Governed Closeout

**Date:** 2026-08-16
**Programme:** Homecoming III (IDE 2.0 kernel, Phases 0–6 + Phase 6 Closure) and the DevOn UI Refinement
(Gates B–E), reported together as the closing evidence for the initial DevOn + IDE 2.0 bootstrap.
**Verdict requested:** PASS — DEVELOPMENT CAN COME HOME, or NOT YET — THRESHOLD GAPS REMAIN.

---

## Verdict

## NOT YET — THRESHOLD GAPS REMAIN

Every criterion this closeout was asked to verify is met **except one**: the real execution seam
(`repository_dispatch` → `claude-implement.yml` → Claude Code CI → PR → human merge) cannot be fired
from this sandboxed session. This is a disclosed tooling constraint, re-confirmed directly in this
session (not merely recalled from a prior report), not a defect in the seam itself — the seam's code
path, workflow, and human-merge gate are all real, present, and correctly wired. Per the instruction
governing this closeout, a seam that has never actually been exercised end-to-end cannot be reported
as closed. Everything else — the repaired IDE 2.0 kernel, the DevOn UI (Gates B–E), and the
supporting regression evidence — is genuinely closed and is reported as such below.

---

## C. IDE 2.0 kernel — re-verification against the repaired system

The Phase 6 Closure repair (`ea9427d2e`, `services/devCommandCenter/implementationContext.ts`) was
re-run against the exact, unmodified Crystal 2.0 dogfood intent (`scripts/homecoming-iii-phase6-
closure-rerun.ts` copies every intent/risk-vector/discovery statement verbatim from the original
`scripts/homecoming-iii-phase6-dogfood.ts` — the acceptance task was never retuned after seeing the
original result). Full trace: `codexes/packs/agentiq/updates/2026-08-15_phase6-closure-rerun-trace.json`.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Established invariants materially inform the task | **Met** | 3 ratified candidates carried, unchanged before/after repair — never crowded out |
| 2 | Live positive discovery survives compression where causally relevant | **Met** | `pos-0`, `pos-1`, `pos-2` all carried (0/3 before repair) |
| 3 | Risk-driven negative discovery survives compression where causally relevant | **Met** | `neg-0`, `neg-1`, `neg-2` all carried (0/3 before repair) — verified as a distinct trace field from the positive set, not inferred from a combined count |
| 4 | Lifecycle/provenance distinctions survive into implementation context | **Met** | Signals and discoveries pool into one relevance-ranked competition for the shared budget, then split back into their own sections by `provenance` for rendering — the repair changed admission/ranking only, never the rendered lifecycle/provenance split |
| 5 | No unrelated candidate population crowds out the material set | **Met** | The 9 previously-admitted signals about an unrelated subsystem (Pulse admission, P&L verification, RootDID authority, receipt-subject-scoping) are now in `omittedRefs`; `CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001` ranks #1 among the 3 carried signals |
| 6 | Implementation context materially changes the resulting implementation plan | **Met** | A real Implementation Pack (`scripts/homecoming-iii-phase6-closure-dispatch.ts`) cites `CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001`'s statement verbatim in its governing-invariants section — the original (pre-repair) implementation cited the id only, never the statement, because compression had omitted it |
| 7 | DCIR binds consequence evidence back to the invariant/risk field | **Met** | Real `bindConsequenceEvidence()` / `emitEvidenceEvents()` from the original dogfood run: 3/3 negative-pass causal claims bound to real test outcomes (`tests/context-binding-axis-scope.test.ts`, 7/7 passing). This binding is a function of the causal claims and real test results, both unchanged by the compression repair — the repair changed what reaches the model, not what DCIR observes about the resulting implementation, so the original binding stands as valid evidence for the repaired system |
| 8 | Governed learning stays below canonical authority | **Met** | `recurrenceCount: 1`, `portable: false`; `abstractCausalCandidate()` correctly returned `null` (CANARY-05: a single occurrence never auto-promotes) |
| 9 | Regression set remains unchanged | **Met** | Repair verified regression-clean: 17 failed files / 41 failed tests, byte-identical to the Phase 5 baseline, +11 new tests (the causal-relevance canary) all passing |

Mutation-tested: the allocation logic was reverted to the pre-repair sequential/array-order `take()`
calls; exactly the three tests encoding the crowd-out defect (criteria 3, 4, 5 above) reddened, the
other tests stayed green, then the repair was restored and confirmed byte-identical. The task was not
retuned at any point in this process.

**The task itself is unchanged** from the original Phase 6 dogfood (`scripts/homecoming-iii-phase6-
dogfood.ts`) — this closeout inspected the repaired system's behavior on the identical acceptance task,
per the instruction not to retune it.

---

## Final DevOn architecture

DevOn is the Smart Triad Copilot's software-development specialist instantiation — the user's
orchestrator and interlocutor for the Dev Command Center. The generic Smart Triad Copilot substrate
(`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`) is unmodified in its own identity: it
still falls back to generic labels ("Aigent Copilot" / "SmartTriad Copilot") when no caller-supplied
identity is given. DevOn's identity enters through the existing, already-per-surface `agent`/
`agentName` prop seam — `agent={{ id: "aigent-z", name: "DevOn" }}` at the Dev Command Center's one
call site (`app/triad/components/codex/tabs/DevCommandCenterTab.tsx`).

`agent.id` deliberately stays `"aigent-z"` — this is not a cosmetic detail but the load-bearing fact
that keeps the rename a display-layer change, not a fork:
- Persona/KB routing (`resolvedPersona` in `SmartTriadCopilotLayer.tsx`) keys off `agent.id.startsWith
  ('aigent-')`, unaffected.
- The D-ID avatar identity (`requestAvatar(avatarContainer, agent?.id || "aigent-z")`) is unaffected.
- The shared system prompt in `app/data/personas.ts` (`"aigent-z"` → "You are **Aigent Z**, the
  engineering intelligence...") is untouched.

**Known residual, disclosed rather than silently accepted**: because DevOn's backend identity IS the
`aigent-z` persona, a user who directly asks the copilot "who are you?" may still receive an answer
shaped by that system prompt ("Aigent Z"), even though the chrome around it reads "DevOn." Forking a
separate DevOn-specific system prompt was out of scope for the identity-only pass (Gate E was scoped
deliberately small); it is named here as the one open thread in the DevOn identity model, not fixed.

Canonical hierarchy, as implemented:
- **DevOn** — the interlocutor and orchestrator (display identity of the Dev Command Center's copilot).
- **Aigent Z** — the deep platform/engineering intelligence DevOn's persona/system-prompt currently
  *is*, and which DevOn can also address as a distinct orchestratable actor in the engagement stream
  when Aigent Z is invoked as such (no actor-event producer for this exists yet — Claude Code is the
  only wired actor as of Gate D).
- **Claude Code** — an implementation actor/service agent, invoked via the real dispatch seam.
- **Specialists** (e.g. a future Security Reviewer) — invoked actors, provider-neutral in the stream's
  rendering (no `actorId`-specific branching anywhere in `ActorActivityStrip.tsx`/`actorEvents.ts`).
- **Terminal, GitHub, DevTools, Linear, Model Routes** — tools/views into the runtime, reached via the
  Views row (`CapabilityChipRow`), never conflated with the State row (`StageStrip`).
- **Right pane** — the development command center / project state surface (branch, PR, diff, tests,
  merge controls, evidence).
- **Left pane** — the continuous DevOn engagement stream: conversation and actor activity, interleaved
  chronologically in one scrolling container (`streamSupplementItems`, Gate C2), never a separate
  footer/tray/pane.

---

## Final IDE 2.0 architecture

- **Envelope / discovery / evidence / learning-receipt kernel** (Phases 0–5): unchanged by this
  closeout; `services/devCommandCenter/invariantEnvelope.ts`, `implementationContext.ts`,
  `services/dcir/eventStream.ts`, `services/devCommandCenter/devLoop.ts` remain the canonical seams.
- **Compression/admission rule** (repaired, `ea9427d2e`): `composeImplementationContext()` now admits
  established members first (protected, unchanged), then pools signals and discoveries into ONE
  relevance-ranked competition for the shared remaining budget — ranked by `causalRelevanceScore()`
  (tiered: proven risk-field relevance via a real `ProofOfRisk` > this run's own structural discovery
  tie (`recoveries.route`) > actually-assessed materiality > a bounded keyword-overlap fallback,
  `tokenOverlapScore`) — before splitting back into their own sections by `provenance` for rendering.
  `INVARIANT_BUDGET` is unchanged; capacity was never the defect.
- **Causal/risk discovery flow**: `StructuredDevIntent` → `buildInvariantEnvelope()` (established
  retrieval) → `IntentRiskField` (projected `RiskVectorRef`s) → positive-bearing discovery (live,
  genuine causal conditions) → risk-informed negative-bearing discovery (one genuine causal condition
  per risk vector, stated causally) → convergence check (`claimKey()`) → `rankByMateriality()` merge
  into the Invariant Development Envelope → `composeImplementationContext()`.
- **DCIR learning flow**: `bindConsequenceEvidence()` / `emitEvidenceEvents()` bind causal claims to
  real test outcomes → `recordRiskObservation()` → `assessRecurrencePortability()` →
  `abstractCausalCandidate()` (governed — never auto-promotes on a single occurrence, CANARY-05) →
  `buildLearningReceipt()` / `validateLearningReceiptDraft()`.

---

## Actual execution seam — real, wired, NOT exercised end-to-end (the remaining gap)

The seam is real and was independently re-verified in this session, not merely re-read from a prior
report:

- `.github/workflows/claude-implement.yml` confirmed present on `main` (`GET /repos/iQube-Protocol/
  AigentZBeta/contents/.github/workflows/claude-implement.yml?ref=main` → 200, verified live in this
  session).
- The dispatch branch for the prepared pack (`aigentz/pack-phase6-closure-contextbinding-governing--
  1946e43e`) confirmed NOT to already exist (`GET .../branches/...` → 404) — this dispatch has never
  been successfully fired.
- A real Implementation Pack is prepared and ready (`scripts/homecoming-iii-phase6-closure-dispatch.ts`
  — same `dispatchBranchFor`, same `event_type: claude-implement`, same `client_payload` shape as
  `POST /api/dev-command-center/implement`).

**Attempted and blocked, precisely, in this session — re-tested twice, on two separate occasions, with
sharper evidence the second time:**
- First attempt: `POST https://api.github.com/repos/iQube-Protocol/AigentZBeta/dispatches` with this
  session's `GITHUB_TOKEN` → **401 Bad credentials.** The same token succeeds on reads (repo metadata,
  file contents).
- `mcp__github__actions_run_trigger`'s `run_workflow` method requires a `ref` (branch/tag) and calls
  the `workflow_dispatch` REST endpoint — a different trigger type. `claude-implement.yml` declares
  only `on: repository_dispatch`; no available MCP tool wraps that specific endpoint.
- Re-tested a second time (correct `Content-Type: application/json`, ruling out a request-formatting
  artifact): the response is **not from GitHub at all** — it comes from this environment's own outbound
  proxy, and states so explicitly: `403 {"message":"repository_dispatch is not permitted for this
  session type.","documentation_url":"https://docs.anthropic.com/en/docs/claude-code/github-actions"}`.
  This is a **categorical, session-type-level policy restriction**, not a scoped-credential accident —
  no `GITHUB_TOKEN` available to a Claude Code session, of any scope, would pass this gate. The first
  attempt's 401 and this 403 are two different layers independently confirming the same conclusion.

**What actually closing this requires**: firing the dispatch from OUTSIDE any Claude Code session
entirely — the deployed app's authenticated admin UI (Dev Command Center → Implement → "Dispatch to
Claude"), or the operator's own machine/credentials via `curl`/script, using the exact payload already
prepared in `scripts/homecoming-iii-phase6-closure-dispatch.ts`. Once dispatched: watch GitHub →
Actions → "Claude Implement (DCC dispatch)"; it will open a PR from `aigentz/pack-phase6-closure-
contextbinding-governing--1946e43e` to `dev`. **That PR is the human merge gate — nothing in any
session merges it automatically.**

Per the instruction, this is reported precisely rather than substituted with a session-branch push or
the auto-merge-to-dev workflow.

---

## DevOn UI interaction model (Gates B–E)

- **State vs. Views, structurally and visually distinct**: `StageStrip` (reads only `session.stage`)
  vs. `CapabilityChipRow` (navigation, reads only `activeCapsuleId`) — one shared stage-metadata source
  (`components/devcommandcenter/stageMeta.ts`), the real B1 bug (an independent, incomplete second
  `STAGES` array in `ProjectOverviewLayout.tsx`) eliminated by deduplication.
- **Actor stream**: a small, provider-neutral `ActorEvent` type (`components/devcommandcenter/
  actorEvents.ts`) — transient, parent-owned React state in `DevCommandCenterTab.tsx`, never
  `DevLoopState`, never a DCIR event kind, never `SmartTriadMessage`. Five actions: `invoked | working
  | completed | failed | awaiting-authorization`.
- **Engagement-stream placement (Gate C2)**: actor rows interleave chronologically with DevOn's own
  messages inside the same scrolling container (`streamSupplementItems`, threaded through both
  `FloatingCopilot` and `EmbeddedCopilot`), never in a separate footer/tray/pane — visually lighter
  than message bubbles (icon + text + dot, no bubble chrome).
- **Execution status (Gate D)**: `GET /api/dev-command-center/implement/status` — read-only,
  correlates a dispatch to its GitHub Actions run by dispatch timestamp (not branch name — a
  `repository_dispatch` run's `head_branch` reflects the trigger-time ref, not the branch the job
  later creates). Maps exactly three GitHub facts (queued/in_progress, completed+success,
  completed+failure/cancelled/timed_out) onto `working | completed | failed`. `completed` requires an
  actual PR to exist for the branch — never the run's own success alone. The canonical chain, wired
  end-to-end in `ImplementationLayout.tsx`'s poll loop:
  `DevOn/user interaction → Claude Code · Implementing → Claude Code · Complete → DevOn · Awaiting
  authorization → human authorization`. Claude Code's `completed` and DevOn's `awaiting-authorization`
  are two distinct actor events, never conflated — completion by an implementation actor never implies
  authorization by DevOn or the human principal.
- **Identity (Gate E)**: DevOn is the visible orchestrator identity; Aigent Z remains distinct where it
  is genuinely the one acting; the generic Smart Triad Copilot substrate carries no hard-coded DevOn
  string in its own code (only in a design-rationale doc comment) — the identity enters solely through
  the `agent`/`agentName` prop seam.
- **No new lifecycle, no new UI architecture, no broad restyling** was introduced at any gate —
  `STAGE_ORDER` is byte-identical to Phase 0; the left/right pane split is unchanged; every visual
  change was additive within the existing two-pane, State/Views/Stream/Tools model.

---

## Aletheon Homecoming final state

Structural success (Phases 0–5) plus the Phase 6 Closure repair together demonstrate that the kernel
now correctly carries causally relevant material through compression, materially changes what an
implementer sees, and binds real consequence evidence back to the invariant/risk field it discovered
from — on the identical, unretuned acceptance task. The one criterion still unmet by design, not by
omission, is exercising the real human-gated execution seam this session cannot reach. Homecoming is
therefore not yet home: the kernel and the DevOn UI are ready to receive the next assignment, but the
loop that proves an assignment can travel all the way to a merged, deployed PR has not yet been
walked end-to-end.

The operator has separately reported the Aletheon/identity-spine prerequisite as closed ("PARITY
READY") as of this same session. That prerequisite and the identity-spine work it governs are outside
this closeout's scope and were not reopened, re-verified, or touched here — this document takes no
position on that closure beyond noting it. It is a distinct concern from, and does not resolve, the
execution-seam restriction above: that restriction is a categorical, session-type-level policy on
firing `repository_dispatch` from within a Claude Code session, unrelated to identity-spine state.

---

## Defect register (this closeout cycle)

| Defect | Where | Status |
|---|---|---|
| `composeImplementationContext` admitted by array/registry order, not causal relevance — crowded out live discovery and the single most relevant candidate | `services/devCommandCenter/implementationContext.ts` | **Repaired** (`ea9427d2e`), mutation-tested, regression-clean |
| `DevCommandCenterTab.tsx` importing node:fs/node:path-touching modules broke the client bundle | `app/triad/components/codex/tabs/DevCommandCenterTab.tsx` | **Repaired** (`53edcdcfc`) |
| A duplicate, incomplete 7-entry `STAGES` array in `ProjectOverviewLayout.tsx` (missing 3 real stages) | `components/devcommandcenter/layouts/ProjectOverviewLayout.tsx` | **Repaired** (Gate B, `b980a08bd`) — eliminated by deduplication, not patched in place |
| Actor activity rendered in a separate footer/tray below the composer, reading as a status tray rather than the continuous engagement stream | `SmartTriadCopilotLayer.tsx` `footerContent` seam | **Repaired** (Gate C2, `60fc39d7c`) |
| Action-label fallback rendered the raw lowercase action string ("completed") instead of the humanized label ("Complete") | `ActorActivityStrip.tsx` | **Repaired** (Gate C, caught via screenshot before commit) |

## Unresolved gaps

1. **The real execution seam has never been fired end-to-end** (this closeout's sole reason for NOT
   YET) — needs a write-scoped `GITHUB_TOKEN` or the deployed app's admin UI.
2. **DevOn's underlying system prompt still self-identifies as "Aigent Z"** if asked directly — a
   deliberately out-of-scope residual from Gate E, named for a future decision, not fixed here.
3. **Supabase-backed constitutional/crystal-substrate retrieval legs remain untested in this sandbox**
   (no live credentials) — criterion 1 of the original Phase 6 dogfood is positively evidenced only via
   the local, file-based `devon`-projection channel; a re-run with real DB credentials would settle it
   independently.
4. No actor-event producer exists yet for Aigent Z itself (only Claude Code is wired as of Gate D) —
   not a defect, simply not yet built; the type/renderer are already generic and ready for it.

## Regression evidence

- IDE 2.0 kernel (Phase 6 Closure repair): 17 failed files / 41 failed tests, byte-identical to the
  Phase 5 baseline, +11 new tests (causal-relevance canary) all passing.
- DevOn UI (Gates B through E, each measured independently at its own gate and re-confirmed together
  just prior to this closeout): 17 failed files / 41 failed tests / 6611+ passed — the same baseline,
  unchanged, across every gate. Zero regressions introduced by any DevOn UI change.
- Typecheck: zero new errors introduced by any change in this closeout cycle (verified by diffing
  against the pre-change baseline via `git stash` comparison at Gate C2, and by direct post-edit runs
  at every other gate).

## Commits

IDE 2.0 kernel (Homecoming III Phase 6 + Closure):
- `4db726815` — scope + stub first Crystal 2.0 assignment via live DevOn dogfood (Phase 6)
- `7939bfc26` — record Phase 6 DCIR observation, learning receipt, and compression-crowdout finding
- `52ac2cf19` — Homecoming III Phase 6 verdict: NOT YET — THRESHOLD GAPS REMAIN
- `53edcdcfc` — fix production build: DevCommandCenterTab pulled node:fs/node:path into the client bundle
- `ea9427d2e` — Phase 6 Closure: repair compression admission by causal relevance, not order

DevOn UI Refinement (Gates B–E):
- `b980a08bd` — Phase B: consolidate lifecycle, resolve right-pane clutter
- `4ecb07a29` — Phase C: generic actor-event stream
- `60fc39d7c` — Gate C2: move actor activity into the scrolling engagement stream
- `a54118c15` — Phase D: read-only execution-status seam for Claude Code dispatch
- `9deab320b` — Phase E: identity copy — the Dev Command Center reads as DevOn (committed, **not
  pushed** — held per explicit operator instruction pending go-ahead)

---

## Hard stop

Per the instruction: hard stop after the verdict. No Crystal 2.0 implementation work begun or
continued in this session. Because the verdict is NOT YET, the "initial DevOn + IDE 2.0 bootstrap is
closed" statement is withheld — it is conditioned on PASS, which this closeout did not reach.
