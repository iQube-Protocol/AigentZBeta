/**
 * experimentLifecycleState — the ONE live derivation of "where is this
 * experiment right now", generalized (2026-09-08, canonical selected-
 * workspace resolver) from logic that used to live only inline inside
 * `app/api/journey/validation-programme/agent-package/route.ts`.
 *
 * WHY THIS EXISTS. `ResearchWorkspace.currentStage` (services/research/
 * researchWorkspace.ts) is a STATIC, hand-typed string on the registry —
 * `'Review'` for `autonomi-review-exp-p1`, absent for `irl-validation-
 * programme-vp1` — never computed from real state. The Pipeline surface
 * (`PartnerProgrammesTab.tsx`'s `PipelinePanel`) reads it verbatim, so a
 * caller who opens a container workspace that never declared one sees
 * "Stage not declared" even when the SAME experiment's real state is fully
 * knowable elsewhere. This module is the fix: a phase/stage genuinely
 * DERIVED from persisted state (frozen artifact lifecycle, protocol-freeze
 * artifact gate, observer review round, published-run floor lifecycle) —
 * the exact same primitives the agent-package route already computed inline,
 * extracted so both that route and the new canonical selected-workspace
 * resolver (`selectedWorkspaceState.ts`) read ONE derivation
 * (inv.engineering.036/037 — one authoritative location, not two that can
 * drift).
 *
 * NOT EXPERIMENT-SPECIFIC. Every function here takes `experimentId` as a
 * parameter; there is no EXP-P1 (or any other id) hardcoded anywhere in this
 * file. It happens to be exercised live by EXP-P1 today because EXP-P1 is
 * the only experiment with a frozen crystal, but the same derivation applies
 * to EXP-P2/P3/any future EXPERIMENT_REGISTRY member the moment it reaches
 * the same real state.
 *
 * THE PHASE MACHINE — six real phases, each backed by an actual persisted
 * signal, in priority order (first match wins):
 *
 *   1. `pre-freeze-review`          crystal not yet frozen
 *   2. `awaiting-observer-assignment`  frozen, no observer round exists yet
 *   3. `post-freeze-observer-review`   frozen, round exists, not yet accepted
 *   4. `protocol-preparation`          observer-accepted, protocol-freeze gate not ready
 *   5. `execution`                     protocol gate ready, floor lifecycle beyond 'designed'
 *   6. `ready-for-execution`           protocol gate ready, floor lifecycle still 'designed'
 *
 * (Phases 1–3 mirror `currentAssignment.state` in the agent-package route
 * byte-for-byte — PRE_FREEZE_REVIEW / AWAITING_OBSERVER_ASSIGNMENT /
 * POST_FREEZE_OBSERVER_REVIEW — kept as the SAME three names there via the
 * `PRE_FREEZE_REVIEW`/etc re-export below, so refactoring that route to call
 * this module changes no observable field.)
 *
 * STAGE LABEL — a DOCUMENTED, honest PROJECTION onto the generic 11-stage
 * `research-experiment` lifecycle template (services/experiments/
 * workspaceLifecycle.ts), never a claim that the two vocabularies are the
 * same thing. Both pre-freeze substrate review AND post-freeze observer
 * review map onto the template's own `'Review'` stage — the reviewer's real
 * job is reviewing in both cases, before or after the crystal freezes, and
 * the template has exactly one stage for that.
 *
 * Server-only.
 */

import { getArtifact, deriveProtocolRatified } from '@/services/research/artifacts';
import { deriveOverview } from '@/services/research/lifecycle';
import { observerRoundId, getObserverRound } from '@/services/research/observerReviewStore';
import {
  resolveObserverRound,
  deriveCallerObserverStatus,
  type ObserverReviewPackage,
} from '@/services/research/crystalObserverReview';
import { listResearchObjects } from '@/services/research/lifecycle';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExperimentLifecycleState as FloorLifecycle } from '@/types/research';

export type ExperimentPipelinePhase =
  | 'pre-freeze-review'
  | 'awaiting-observer-assignment'
  | 'post-freeze-observer-review'
  | 'protocol-preparation'
  | 'ready-for-execution'
  | 'execution';

/** Kept identical to the agent-package route's own three pre-execution
 *  state names, so that route's `currentAssignment.state` field never
 *  changes shape when it is refactored to call this module. */
export const PHASE_TO_LEGACY_ASSIGNMENT_STATE: Partial<
  Record<ExperimentPipelinePhase, 'PRE_FREEZE_REVIEW' | 'AWAITING_OBSERVER_ASSIGNMENT' | 'POST_FREEZE_OBSERVER_REVIEW'>
> = {
  'pre-freeze-review': 'PRE_FREEZE_REVIEW',
  'awaiting-observer-assignment': 'AWAITING_OBSERVER_ASSIGNMENT',
  'post-freeze-observer-review': 'POST_FREEZE_OBSERVER_REVIEW',
};

/** The ONE projection of a phase onto the generic 11-stage template label —
 *  documented above; extend here, never with a second switch elsewhere. */
export const PHASE_TO_TEMPLATE_STAGE_LABEL: Record<ExperimentPipelinePhase, string> = {
  'pre-freeze-review': 'Review',
  'awaiting-observer-assignment': 'Review',
  'post-freeze-observer-review': 'Review',
  'protocol-preparation': 'Preregistration',
  'ready-for-execution': 'Task Construction',
  execution: 'Run',
};

export interface ExperimentLifecycleState {
  experimentId: string;
  isFrozen: boolean;
  artifactId: string | null;
  contentHash: string | null;
  commitmentHash: string | null;
  frozenAt: string | null;
  protocolReady: boolean;
  protocolMissing: string[];
  protocolPresent: string[];
  /** The published-run floor lifecycle (services/research/lifecycle.ts
   *  `deriveOverview`) — 'designed' unless real published runs exist. */
  floorLifecycle: FloorLifecycle;
  observerRoundExists: boolean;
  observerRoundStatus: string | null;
  /** null pre-freeze or pre-assignment — there is no round to resolve yet. */
  observerAcceptance: 'not-applicable' | 'awaiting-assignment' | 'pending' | 'accepted' | 'changes_requested' | 'mixed';
  phase: ExperimentPipelinePhase;
  stageLabel: string;
}

/**
 * The pure, persona-INDEPENDENT experiment state — every field here is a
 * fact about the experiment itself, never about who is asking. Callers that
 * also need a CALLER-scoped decision status (has THIS persona already
 * submitted their Observer Decision) compose `resolveCallerObserverStatus`
 * separately, exactly as the agent-package route keeps `callerObserverStatus`
 * a second, explicitly persona-scoped derivation.
 */
export async function resolveExperimentLifecycleState(
  admin: SupabaseClient,
  experimentId: string,
): Promise<ExperimentLifecycleState> {
  const artifact = await getArtifact(experimentId, 'crystal-version').catch(() => null);
  const isFrozen = artifact?.lifecycle === 'frozen';

  const protocolGate = await deriveProtocolRatified(experimentId).catch(() => ({
    ready: false,
    missing: [] as string[],
    present: [] as string[],
  }));

  const overview = await deriveOverview().catch(() => []);
  const floorLifecycle: FloorLifecycle = overview.find((e) => e.experiment.id === experimentId)?.lifecycle ?? 'designed';

  let observerRoundExists = false;
  let observerRoundStatus: string | null = null;
  let observerRoundResolution: ReturnType<typeof resolveObserverRound> | null = null;
  if (isFrozen && artifact) {
    try {
      const round = await getObserverRound(admin, observerRoundId(experimentId, artifact.id));
      if (round) {
        observerRoundExists = true;
        observerRoundStatus = round.status;
        if (round.package) {
          observerRoundResolution = resolveObserverRound({ pkg: round.package, decisions: round.decisions });
        }
      }
    } catch {
      // Honest absence — stays false/null, never fabricated.
    }
  }

  const observerAcceptance: ExperimentLifecycleState['observerAcceptance'] = !isFrozen
    ? 'not-applicable'
    : !observerRoundExists
      ? 'awaiting-assignment'
      : (observerRoundResolution?.acceptance ?? 'pending');

  let phase: ExperimentPipelinePhase;
  if (!isFrozen) {
    phase = 'pre-freeze-review';
  } else if (!observerRoundExists) {
    phase = 'awaiting-observer-assignment';
  } else if (observerAcceptance !== 'accepted') {
    phase = 'post-freeze-observer-review';
  } else if (!protocolGate.ready) {
    phase = 'protocol-preparation';
  } else if (floorLifecycle === 'designed') {
    phase = 'ready-for-execution';
  } else {
    phase = 'execution';
  }

  return {
    experimentId,
    isFrozen,
    artifactId: artifact?.id ?? null,
    contentHash: isFrozen ? artifact?.contentHash ?? null : null,
    commitmentHash: isFrozen ? artifact?.commitmentHash ?? null : null,
    frozenAt: isFrozen ? artifact?.frozenAt ?? null : null,
    protocolReady: protocolGate.ready,
    protocolMissing: [...protocolGate.missing],
    protocolPresent: [...protocolGate.present],
    floorLifecycle,
    observerRoundExists,
    observerRoundStatus,
    observerAcceptance,
    phase,
    stageLabel: PHASE_TO_TEMPLATE_STAGE_LABEL[phase],
  };
}

/**
 * The template stage labels genuinely EVIDENCED complete, derived from the
 * same fields `resolveExperimentLifecycleState` already computed — never a
 * second, independent judgment. Because the phase machine is a strict,
 * priority-ordered ladder (a later phase can only be reached once every
 * earlier phase's own real signal fired), a stage is "complete" exactly when
 * its OWN gating signal is true, not merely because the current phase is
 * ordinally later (that would let an ordinal position stand in for evidence
 * — the Pipeline's own honesty requirement, message 3 item 3: "a stage may
 * show completed ONLY from canonical lifecycle/artifact/receipt evidence").
 *
 * Three phases share the 'Review' template label (pre-freeze substrate
 * review, awaiting-observer-assignment, post-freeze observer review) — the
 * label is complete only once the LAST of the three's own condition holds
 * (observer acceptance), never merely because the crystal froze.
 */
/** The full `research-experiment` template's ordering of `floorLifecycle`
 *  (types/research.ts's `EXPERIMENT_LIFECYCLE`) — used only to compare "has
 *  this floor state reached at least X" without a second copy of the list. */
const FLOOR_LIFECYCLE_ORDER: FloorLifecycle[] = ['designed', 'protocol-ratified', 'running', 'evaluated', 'published', 'replicated'];

function floorLifecycleAtLeast(floor: FloorLifecycle, threshold: FloorLifecycle): boolean {
  return FLOOR_LIFECYCLE_ORDER.indexOf(floor) >= FLOOR_LIFECYCLE_ORDER.indexOf(threshold);
}

export function deriveCompletedTemplateStages(state: ExperimentLifecycleState): string[] {
  const completed: string[] = [];
  // Concept and Protocol precede every DB-tracked signal this module derives
  // from (2026-09-12 fix — these two stages were never derivable at all
  // before this, so an experiment past its earliest phase still showed both
  // as merely "not evidence-backed"). A frozen crystal, or any persisted
  // protocol-freeze-artifact evidence, is real proof both already happened:
  // freezing requires a stated rationale over an already-conceived, already-
  // protocolled substrate (see the freeze route's own required fields), and
  // partial protocol-freeze-artifact presence is direct evidence protocol
  // authoring is under way. This is honest evidence, not an ordinal-position
  // stand-in — SPEC-IRL-WORKSPACE-001 §7 does not define a separate
  // DB-tracked "concept ratified" / "protocol registered" signal, so these
  // are the real, available proxies for the two stages it does not track.
  if (state.isFrozen || state.protocolPresent.length > 0) {
    completed.push('Concept', 'Protocol');
  }
  if (state.observerAcceptance === 'accepted') completed.push('Review');
  if (state.protocolReady) completed.push('Preregistration');
  // Freeze itself was never derived either — 'isFrozen' is exactly this
  // stage's own persisted signal (2026-09-12 fix).
  if (state.isFrozen) completed.push('Freeze');
  if (state.floorLifecycle !== 'designed') completed.push('Task Construction');
  // Run/Adjudication/Interpretation/Publication/Replication (2026-09-12 fix)
  // — the published-run floor lifecycle already carries exactly this
  // ordering (types/research.ts's EXPERIMENT_LIFECYCLE); it was read only up
  // to 'Task Construction' before, silently dropping every later stage's own
  // evidence once an experiment actually started running.
  if (floorLifecycleAtLeast(state.floorLifecycle, 'running')) completed.push('Run');
  if (floorLifecycleAtLeast(state.floorLifecycle, 'evaluated')) completed.push('Adjudication');
  if (floorLifecycleAtLeast(state.floorLifecycle, 'published')) completed.push('Interpretation', 'Publication');
  if (floorLifecycleAtLeast(state.floorLifecycle, 'replicated')) completed.push('Replication');
  return completed;
}

export interface CallerObserverStatus {
  callerAssigned: boolean;
  callerDecisionStatus: 'not-decided' | 'accepted' | 'changes_requested' | 'unable_to_assess';
}

/**
 * The CALLER-scoped half — "has THIS persona already decided" — kept
 * separate from `resolveExperimentLifecycleState` on purpose (SPEC point 8:
 * observer independence never leaks through a shared, unscoped derivation).
 * Returns null when there is no round to check the caller against yet.
 */
export async function resolveCallerObserverStatus(
  admin: SupabaseClient,
  experimentId: string,
  callerRef: string,
): Promise<CallerObserverStatus | null> {
  const artifact = await getArtifact(experimentId, 'crystal-version').catch(() => null);
  if (artifact?.lifecycle !== 'frozen') return null;
  try {
    const round = await getObserverRound(admin, observerRoundId(experimentId, artifact.id));
    if (!round?.package) return null;
    const status = deriveCallerObserverStatus({
      pkg: round.package,
      decisions: round.decisions,
      callerRef,
      mayViewOthersProgress: false,
    });
    return { callerAssigned: status.callerAssigned, callerDecisionStatus: status.callerDecisionStatus };
  } catch {
    return null;
  }
}

export interface ExperimentActivityEntry {
  objectId: string;
  objectKind: string;
  lifecycleState: string;
  receiptId: string | null;
  createdAt: string;
}

/**
 * The experiment's own scientific-lifecycle activity trail — every
 * `research_objects` row tagged with this `experimentId` in its payload
 * (freeze events, protocol-artifact freezes, execution runs), each carrying
 * the SAME `receiptId` the DVN-anchorable `research_lifecycle_transition`
 * receipt path writes (services/research/lifecycle.ts::writeLifecycleReceipt).
 * This is a REAL, canonical, already-persisted source — distinct from the
 * generic persona activity feed (services/receipts/activityReceiptService.ts),
 * which carries no experimentId/workspaceId tag at all and cannot be
 * filtered to one experiment today (see the round-3 update doc for the
 * honest account of that gap).
 */
export async function resolveExperimentActivity(experimentId: string): Promise<ExperimentActivityEntry[]> {
  const listed = await listResearchObjects();
  if (!listed.ok) return [];
  return listed.objects
    .filter((o) => (o.payload as { experimentId?: string }).experimentId === experimentId)
    .map((o) => ({
      objectId: o.objectId,
      objectKind: o.objectKind,
      lifecycleState: o.lifecycleState,
      receiptId: o.receiptId ?? null,
      createdAt: o.createdAt,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
