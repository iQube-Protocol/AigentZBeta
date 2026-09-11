/**
 * selectedWorkspaceState — THE canonical (principal + selectedWorkspaceId)
 * resolver (2026-09-08, operator instruction: "Introduce or consolidate a
 * server-side resolver for principal + selectedWorkspaceId returning one
 * authoritative object"). Every Workspace surface — Overview, the new
 * Experiments tab, Pipeline, Review, Working Materials — consumes THIS
 * object; none of them independently infers state.
 *
 * COMPOSES, NEVER FORKS. Every field is produced by an existing, already-
 * authoritative source:
 *
 *   - membership/role/access basis    → services/passport/participationAccess.ts
 *   - phase/stage/protocol/observer   → services/research/experimentLifecycleState.ts
 *   - reviewer countersignature       → services/research/reviewerAgreement.ts
 *   - documents (Stage-0-excluded,
 *     review-grant gated)             → services/research/irlExperimentPathScope.ts +
 *                                        resolveExperimentReviewGrant (participationAccess.ts)
 *   - reciprocal artifact exchange    → services/research/reciprocalExchange.ts
 *   - milestones / blockers           → services/experiments/workspaceTracking.ts
 *   - scientific activity trail       → services/research/experimentLifecycleState.ts
 *
 * NO EXPERIMENT-SPECIFIC CODE. Every branch below keys off `ws.experimentId`
 * (present or absent) and `workspaceId`, never a literal 'EXP-P1' or
 * 'ocsga-boundary-research' — EXP-P1/Austin and OCSGA/Ian are two REAL
 * instances this same resolver produces correct output for, not two special
 * cases inside it (operator instruction, repeated verbatim across two
 * consolidation passes: "not hardcoded exceptions").
 *
 * FAIL CLOSED, HONEST ABSENCE. The primary gate is workspace membership
 * (`getParticipantResearchWorkspaceAccess`) — a caller who cannot see this
 * workspace gets a `denied` result before anything else is resolved. Fields
 * with no canonical source today (workspace-scoped Locker items, workspace-
 * scoped generic activity receipts) are returned as an explicit
 * `{ available: false, reason }` shape — never fabricated, never silently
 * omitted (CLAUDE.md "No Guessing").
 *
 * Server-only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getParticipantResearchWorkspaceAccess,
  resolveWorkspaceRole,
  resolveExperimentReviewGrant,
  type ParticipantWorkspaceAccessBasis,
} from '@/services/passport/participationAccess';
import {
  getResearchWorkspace,
  researchWorkspaceParent,
  researchWorkspaceLabel,
  type ResearchWorkspace,
} from '@/services/research/researchWorkspace';
import {
  resolveExperimentLifecycleState,
  resolveCallerObserverStatus,
  resolveExperimentActivity,
  deriveCompletedTemplateStages,
  type ExperimentLifecycleState,
  type CallerObserverStatus,
  type ExperimentActivityEntry,
} from '@/services/research/experimentLifecycleState';
import { listIrlPackDocumentsForExperiment } from '@/services/research/irlExperimentPathScope';
import { reviewerAgreementStatus, type ReviewerAgreementStatus } from '@/services/research/reviewerAgreement';
import { listWorkspaceItems } from '@/services/experiments/workspaceTracking';
import { listMyExchanges } from '@/services/research/reciprocalExchange';

/** Experiments the readiness dashboard (PRD-EPI-001 §10) is built for — same
 *  named allowlist `/api/participation/workspace-capabilities` uses; not
 *  every EXPERIMENT_REGISTRY entry has a "Crystal readiness" concept. */
const READINESS_AVAILABLE_EXPERIMENTS = new Set(['EXP-P1', 'EXP-P2', 'EXP-P3']);

export type SelectedWorkspaceStateResult =
  | { ok: true; state: SelectedWorkspaceState }
  | { ok: false; reason: 'not-found' | 'denied' };

export interface UnmodeledField {
  available: false;
  reason: string;
}

export interface SelectedWorkspaceState {
  workspaceId: string;
  programmeId: string | null;
  workspaceLabel: string;
  workspaceType: ResearchWorkspace['workspaceType'];
  experimentId: string | null;
  role: string | null;
  accessBasis: ParticipantWorkspaceAccessBasis;

  /** null when this workspace names no EXPERIMENT_REGISTRY member (e.g. a
   *  cohort/programme container like OCSGA) — there is no experiment-bound
   *  lifecycle to derive. */
  experimentLifecycle: ExperimentLifecycleState | null;
  currentPhase: string | null;
  currentStage: string | null;
  /** Template stage labels EVIDENCED complete (deriveCompletedTemplateStages)
   *  — never merely "earlier in phase order than the current stage". Empty
   *  for a non-experiment workspace (no phase machine exists to evidence). */
  completedStages: string[];
  /** Per-stage evidence for the Pipeline's expandable disclosure (message 3
   *  item 3) — the actual artifact/hash/receipt/round backing a completed or
   *  current stage, keyed by template stage label. Absent entries mean no
   *  stage-specific evidence beyond `experimentLifecycle` itself is modeled
   *  yet (honest, never fabricated). */
  stageEvidence: Record<string, {
    artifactId: string | null;
    contentHash: string | null;
    commitmentHash: string | null;
    frozenAt: string | null;
    observerRoundStatus: string | null;
    protocolPresent: string[];
    protocolMissing: string[];
  }>;

  nextMilestone: { title: string; dueDate: string | null } | null;
  blockers: { title: string; detail: string | null }[];
  pendingHumanDecisions: string[];

  capabilities: {
    readinessAvailable: boolean;
    reviewAgreementAvailable: boolean;
    exchangeAvailable: boolean;
    documentsAvailable: boolean;
  };
  documents: { path: string; url: string }[];
  reviewState: {
    agreement: ReviewerAgreementStatus;
    callerObserverStatus: CallerObserverStatus | null;
  } | null;
  exchangeIds: string[];

  /** The experiment's own scientific-lifecycle receipt trail (freeze,
   *  protocol-artifact freezes, execution runs) — real when experimentId is
   *  bound, honestly unmodeled otherwise (no such trail exists for a
   *  non-experiment workspace today). */
  activity: ExperimentActivityEntry[] | UnmodeledField;
  /** Workspace-scoped Locker items — genuinely unmodeled today (no T2-safe
   *  tagging convention exists for research materials; Locker items are
   *  holder-scoped only). See the round-3 update doc for the full account. */
  lockerScope: UnmodeledField;
}

function isUnmodeled(v: unknown[] | UnmodeledField): v is UnmodeledField {
  return !Array.isArray(v);
}

export { isUnmodeled };

export async function resolveSelectedWorkspaceState(
  admin: SupabaseClient,
  persona: { personaId: string; isAdmin: boolean },
  workspaceId: string,
  origin: string,
): Promise<SelectedWorkspaceStateResult> {
  const ws = getResearchWorkspace(workspaceId);
  if (!ws) return { ok: false, reason: 'not-found' };

  // PRIMARY GATE — canonical workspace membership, workspaceId-first.
  let accessBasis: ParticipantWorkspaceAccessBasis;
  if (persona.isAdmin) {
    accessBasis = 'admin';
  } else {
    const entries = await getParticipantResearchWorkspaceAccess(admin, persona.personaId, false);
    const entry = entries.find((e) => e.workspaceId === workspaceId);
    if (!entry) return { ok: false, reason: 'denied' };
    accessBasis = entry.accessBasis;
  }

  const experimentId = ws.experimentId ?? null;
  const programmeWorkspace = researchWorkspaceParent(ws);
  const roleGrant = await resolveWorkspaceRole(admin, persona.personaId, workspaceId, experimentId);
  const role = roleGrant?.role ?? (persona.isAdmin ? 'admin-preview' : null);

  // EXPERIMENT-BOUND state — only when this workspace names a registered
  // experiment. Workspace membership above is necessary but not sufficient
  // for the specific reviewer-facing capabilities below.
  let experimentLifecycle: ExperimentLifecycleState | null = null;
  let currentPhase: string | null = null;
  let currentStage: string | null = null;
  let documents: { path: string; url: string }[] = [];
  let readinessAvailable = false;
  let reviewState: SelectedWorkspaceState['reviewState'] = null;
  let pendingHumanDecisions: string[] = [];
  let completedStages: string[] = [];
  let stageEvidence: SelectedWorkspaceState['stageEvidence'] = {};
  let activity: ExperimentActivityEntry[] | UnmodeledField = {
    available: false,
    reason: 'No workspace-scoped activity trail exists for a workspace with no bound experiment.',
  };

  if (experimentId) {
    experimentLifecycle = await resolveExperimentLifecycleState(admin, experimentId);
    currentPhase = experimentLifecycle.phase;
    currentStage = experimentLifecycle.stageLabel;
    readinessAvailable = READINESS_AVAILABLE_EXPERIMENTS.has(experimentId);
    activity = await resolveExperimentActivity(experimentId);
    completedStages = deriveCompletedTemplateStages(experimentLifecycle);
    const evidenceEntry = {
      artifactId: experimentLifecycle.artifactId,
      contentHash: experimentLifecycle.contentHash,
      commitmentHash: experimentLifecycle.commitmentHash,
      frozenAt: experimentLifecycle.frozenAt,
      observerRoundStatus: experimentLifecycle.observerRoundStatus,
      protocolPresent: experimentLifecycle.protocolPresent,
      protocolMissing: experimentLifecycle.protocolMissing,
    };
    // Every stage this experiment has EVER touched (completed or current)
    // shares the same underlying evidence object — the Pipeline's disclosure
    // opens whichever stage the operator expands, keyed by the same label.
    for (const label of [...completedStages, currentStage]) {
      if (label) stageEvidence[label] = evidenceEntry;
    }

    // PER-ARTIFACT AUTHORIZATION PARITY (2026-09-11, message 3 item 7 /
    // Progressive Surface acceptance requirement): `documents` must be
    // populated ONLY for a caller who can ALSO retrieve every one of those
    // paths through their canonical route,
    // `GET /api/codex/packs/[packId]/file`. That route gates the `irl` pack
    // on admin OR `resolveExperimentReviewGrant` (REVIEW_VIEW_READABLE_ROLES
    // only) — a STRICTER check than this resolver's own primary gate
    // (`getParticipantResearchWorkspaceAccess`, role-AGNOSTIC — ANY active
    // research-lab grant scoped to the workspace/experiment). Without this
    // check, a workspace member holding a real grant in a role outside
    // REVIEW_VIEW_READABLE_ROLES (e.g. a non-reviewer participant role) would
    // see documents listed here and get a 403 opening every one of them —
    // exactly the defect this parity gate closes. Never widens the file
    // route; only narrows what this resolver claims is retrievable.
    const canReadDocuments = persona.isAdmin || Boolean(await resolveExperimentReviewGrant(admin, persona.personaId, experimentId));
    documents = canReadDocuments
      ? (await listIrlPackDocumentsForExperiment(experimentId)).map((path) => ({
          path,
          url: `${origin}/api/codex/packs/irl/file?path=${encodeURIComponent(path)}`,
        }))
      : [];

    const agreement = await reviewerAgreementStatus(admin, { personaId: persona.personaId, experimentId });
    const callerObserverStatus = await resolveCallerObserverStatus(admin, experimentId, persona.personaId);
    reviewState = { agreement, callerObserverStatus };

    if (experimentLifecycle.phase === 'pre-freeze-review') {
      pendingHumanDecisions = ['Comment, recommend a change, or contest a finding via QubeTalk/Locker'];
    } else if (experimentLifecycle.phase === 'awaiting-observer-assignment') {
      pendingHumanDecisions = [];
    } else if (experimentLifecycle.phase === 'post-freeze-observer-review') {
      pendingHumanDecisions =
        (callerObserverStatus?.callerDecisionStatus ?? 'not-decided') === 'not-decided'
          ? ['Submit one Observer Decision']
          : [];
    }
  }

  // WORKSPACE-BOUND — Reciprocal Artifact Exchange, keyed directly off
  // workspaceId, no experimentId required (the OCSGA case).
  let exchangeIds: string[] = [];
  const myExchanges = await listMyExchanges(admin, persona.personaId);
  if (myExchanges.ok) {
    exchangeIds = myExchanges.exchanges.filter((e) => e.parentExperimentId === workspaceId).map((e) => e.id);
  }

  // Milestones / blockers — real table, honestly empty where nothing was
  // ever seeded (services/experiments/workspaceTracking.ts).
  const [milestones, blockerItems] = await Promise.all([
    listWorkspaceItems(workspaceId, 'milestone'),
    listWorkspaceItems(workspaceId, 'blocker'),
  ]);
  const openMilestones = milestones.filter((m) => m.status !== 'done');
  const nextMilestone = openMilestones.length > 0 ? openMilestones[0] : null;
  const openBlockers = blockerItems.filter((b) => b.status !== 'cleared');

  return {
    ok: true,
    state: {
      workspaceId,
      programmeId: programmeWorkspace?.id ?? null,
      workspaceLabel: researchWorkspaceLabel(ws),
      workspaceType: ws.workspaceType,
      experimentId,
      role,
      accessBasis,
      experimentLifecycle,
      currentPhase,
      currentStage,
      completedStages,
      stageEvidence,
      nextMilestone: nextMilestone ? { title: nextMilestone.title, dueDate: nextMilestone.dueDate } : null,
      blockers: openBlockers.map((b) => ({ title: b.title, detail: b.detail })),
      pendingHumanDecisions,
      capabilities: {
        readinessAvailable,
        reviewAgreementAvailable: reviewState !== null,
        exchangeAvailable: exchangeIds.length > 0,
        documentsAvailable: documents.length > 0,
      },
      documents,
      reviewState,
      exchangeIds,
      activity,
      lockerScope: {
        available: false,
        reason:
          'No T2-safe tagging convention exists yet for scoping Locker items to a research workspace/experiment — ' +
          'Locker items are holder-scoped only (services/passport, LockerTab.tsx). Open the Locker view directly ' +
          'for the caller\'s full holder-scoped item set.',
      },
    },
  };
}
