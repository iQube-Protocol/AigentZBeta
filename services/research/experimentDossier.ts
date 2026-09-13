/**
 * experimentDossier — the single resolver behind BOTH the human Workspace
 * dossier UI and the machine `research.dossier.v1` JSON projection
 * (2026-09-11, IRL Workspace Experiment Dossier Completion Pass).
 *
 * COMPOSES, NEVER FORKS (inv.engineering.036/037). Every section below is
 * produced by an existing, already-authoritative source — this module adds
 * NO new persistence, no new experiment database, no parallel state:
 *
 *   - gate/role/lifecycle/review/activity  → resolveSelectedWorkspaceState
 *     (services/research/selectedWorkspaceState.ts) — the SAME canonical
 *     resolver Overview/Pipeline/Review/Working-Materials already read.
 *   - title/hypothesis/protocolRef          → researchExperiment (EXPERIMENT_REGISTRY,
 *                                              services/research/experimentIQubeSources.ts)
 *   - crystal detail (memberSnapshot,
 *     scientificDeviations, freezeRationale) → latestFrozenCrystalArtifact
 *                                              (services/research/artifacts.ts)
 *   - apparatus/arms/selector version        → REHEARSAL_ARM_LABELS
 *                                              (services/research/expP1Rehearsal.ts) +
 *                                              TASK_SCOPED_SELECTOR_VERSION
 *                                              (services/invariants/taskScopedSelection.ts)
 *   - readiness                              → buildReadinessDashboard
 *                                              (services/research/readinessDashboard.ts)
 *   - execution-run lineage                  → listExecutionRuns (artifacts.ts)
 *   - OCSGA exchange (parties/artifacts/
 *     attestations/receipts/comparison)      → getExchangeView
 *                                              (services/research/reciprocalExchange.ts),
 *                                              given the exchange id resolveSelectedWorkspaceState
 *                                              already derived (via its own listMyExchanges
 *                                              membership filter) — ALREADY per-artifact
 *                                              disclosure-gated and T0-stripped; never
 *                                              re-derived or re-filtered here.
 *   - experiment-scoped constitutional
 *     records                                → passport_locker_items, filtered by the
 *                                              caller's OWN holder_persona_id and the
 *                                              [EXP:<id>] bracket tag (the same convention
 *                                              LockerTab's itemScopeTag already reads).
 *
 * NO EXPERIMENT-SPECIFIC BRANCHING beyond data availability. `apparatus`/
 * `readiness` are looked up from small, honestly-partial maps/allowlists
 * (only EXP-P1 has arm definitions or a rehearsal harness today) — the
 * CODE path is identical for every experiment; an experiment with no
 * apparatus registered simply resolves an honest `UnmodeledField`, never a
 * fabricated one.
 *
 * FAIL CLOSED. The primary gate is `resolveSelectedWorkspaceState` itself —
 * a caller who cannot see the workspace never reaches any section below.
 * Per-artifact authorization is inherited from whatever already gated that
 * artifact (documents via resolveExperimentReviewGrant, exchange artifacts
 * via getExchangeView's own membership+disclosure checks) — this module
 * invents no new gate and weakens none.
 *
 * Server-only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveSelectedWorkspaceState,
  type SelectedWorkspaceState,
  type SelectedWorkspaceStateResult,
} from '@/services/research/selectedWorkspaceState';
import { researchExperiment } from '@/services/research/experimentIQubeSources';
import { latestFrozenCrystalArtifact, listExecutionRuns } from '@/services/research/artifacts';
import { buildReadinessDashboard, type ReadinessDashboard } from '@/services/research/readinessDashboard';
import { REHEARSAL_ARM_LABELS } from '@/services/research/expP1Rehearsal';
import { TASK_SCOPED_SELECTOR_VERSION } from '@/services/invariants/taskScopedSelection';
import { getExchangeView, type ExchangeView } from '@/services/research/reciprocalExchange';
import type { ExecutionRunArtifact, FrozenArtifact, RehearsalArmId } from '@/types/research';

export type DossierResult =
  | { ok: true; dossier: ExperimentDossier }
  | { ok: false; reason: 'not-found' | 'denied' };

export interface UnmodeledDossierField {
  available: false;
  reason: string;
}

function unmodeled(reason: string): UnmodeledDossierField {
  return { available: false, reason };
}

/** Per-experiment apparatus registry — honestly partial today (only EXP-P1
 *  has a registered rehearsal harness). Adding a new experiment's apparatus
 *  is a data addition here, never a new branch in the resolver below. */
const APPARATUS_BY_EXPERIMENT: Record<string, { arms: { id: RehearsalArmId; label: string }[]; selectorVersion: string }> = {
  'EXP-P1': {
    arms: (Object.keys(REHEARSAL_ARM_LABELS) as RehearsalArmId[]).map((id) => ({ id, label: REHEARSAL_ARM_LABELS[id] })),
    selectorVersion: TASK_SCOPED_SELECTOR_VERSION,
  },
};

export interface DossierExperimentMeta {
  title: string;
  hypothesis: string;
  protocolRef: string;
  governingInvariants: string[];
  seriesId: string;
  programmeFocus: string | null;
}

export interface DossierCrystal {
  artifactId: string;
  contentHash: string | null;
  commitmentHash: string | null;
  frozenAt: string | null;
  executionDesignation: FrozenArtifact['executionDesignation'] | null;
  scientificDeviations: FrozenArtifact['scientificDeviations'];
  freezeRationale: string | null;
  /** The actual invariant statements the commitment hash commits to — the
   *  crystal's own readable content, not prose (types/research.ts's own
   *  doc: "the EXACT hash pre-image commitmentHash commits to"). */
  memberSnapshot: FrozenArtifact['memberSnapshot'];
}

export interface DossierLockerRecord {
  itemId: string;
  displayName: string;
  contentType: string;
  createdAt: string;
}

export interface ExperimentDossier {
  schemaVersion: 'research.dossier.v1';
  workspaceId: string;
  experimentId: string | null;
  workspaceLabel: string;
  programmeId: string | null;
  viewer: { role: string | null; accessBasis: SelectedWorkspaceState['accessBasis'] };
  /** null for a non-experiment workspace (e.g. OCSGA) — honest absence, the
   *  same rule selectedWorkspaceState already follows for experimentLifecycle. */
  experiment: DossierExperimentMeta | null;
  lifecycle: SelectedWorkspaceState['experimentLifecycle'];
  currentStage: string | null;
  completedStages: string[];
  protocol: {
    ready: boolean;
    present: string[];
    missing: string[];
    documents: { path: string; url: string }[];
  } | null;
  crystal: DossierCrystal | null | UnmodeledDossierField;
  apparatus: { arms: { id: RehearsalArmId; label: string }[]; selectorVersion: string } | UnmodeledDossierField;
  readiness: ReadinessDashboard | UnmodeledDossierField;
  runs: ExecutionRunArtifact[] | UnmodeledDossierField;
  review: SelectedWorkspaceState['reviewState'];
  constitutionalRecords: DossierLockerRecord[] | UnmodeledDossierField;
  receipts: {
    activity: SelectedWorkspaceState['activity'];
    receiptCards: SelectedWorkspaceState['activityReceipts'];
  };
  /** OCSGA-shaped workspaces (a reciprocal-exchange workspace with no bound
   *  experimentId) resolve their own exchange dossier here — the SAME
   *  per-artifact disclosure-gated view Workspace's own Review/exchange
   *  surfaces already use, never re-derived. Null for an experiment-bound
   *  workspace with no exchange. */
  exchange: ExchangeView | null;
  blockers: { title: string; detail: string | null }[];
  nextMilestone: { title: string; dueDate: string | null } | null;
  /** The next governed action, in plain language — derived ONLY from
   *  pendingHumanDecisions (already computed by selectedWorkspaceState) plus
   *  the OCSGA exchange's own state, never invented beyond what those
   *  sources supply. */
  nextActions: string[];
}

export async function resolveExperimentDossier(
  admin: SupabaseClient,
  persona: { personaId: string; isAdmin: boolean },
  workspaceId: string,
  origin: string,
): Promise<DossierResult> {
  const base: SelectedWorkspaceStateResult = await resolveSelectedWorkspaceState(admin, persona, workspaceId, origin);
  if (!base.ok) return { ok: false, reason: base.reason };
  const state = base.state;
  const experimentId = state.experimentId;

  const experimentMeta: DossierExperimentMeta | null = experimentId
    ? (() => {
        const reg = researchExperiment(experimentId);
        if (!reg) return null;
        return {
          title: reg.family,
          hypothesis: reg.hypothesis,
          protocolRef: reg.protocolRef,
          governingInvariants: reg.governingInvariants,
          seriesId: reg.seriesId,
          programmeFocus: reg.programmeFocus ?? null,
        };
      })()
    : null;

  const protocol = state.experimentLifecycle
    ? {
        ready: state.experimentLifecycle.protocolReady,
        present: state.experimentLifecycle.protocolPresent,
        missing: state.experimentLifecycle.protocolMissing,
        documents: state.documents,
      }
    : null;

  let crystal: ExperimentDossier['crystal'] = experimentId
    ? unmodeled('No crystal-version artifact has ever been frozen for this experiment.')
    : unmodeled('No experiment is bound to this workspace.');
  if (experimentId) {
    const frozen = await latestFrozenCrystalArtifact(experimentId).catch(() => null);
    if (frozen) {
      crystal = {
        artifactId: frozen.id,
        contentHash: frozen.contentHash ?? null,
        commitmentHash: frozen.commitmentHash ?? null,
        frozenAt: frozen.frozenAt ?? null,
        executionDesignation: frozen.executionDesignation ?? null,
        scientificDeviations: frozen.scientificDeviations ?? [],
        freezeRationale: frozen.freezeRationale ?? null,
        memberSnapshot: frozen.memberSnapshot ?? null,
      };
    }
  }

  const apparatus: ExperimentDossier['apparatus'] = experimentId
    ? (APPARATUS_BY_EXPERIMENT[experimentId] ?? unmodeled(`No apparatus/arm specification is registered for ${experimentId}.`))
    : unmodeled('No experiment is bound to this workspace.');

  const readiness: ExperimentDossier['readiness'] = state.capabilities.readinessAvailable && experimentId
    ? await buildReadinessDashboard(experimentId)
    : unmodeled(
        experimentId
          ? `${experimentId} is not on the readiness-dashboard allowlist (PRD-EPI-001 §10 scope).`
          : 'No experiment is bound to this workspace.',
      );

  const runs: ExperimentDossier['runs'] = experimentId
    ? await listExecutionRuns(experimentId).catch(() => [])
    : unmodeled('No experiment is bound to this workspace.');

  // OCSGA / any reciprocal-exchange workspace — the workspace's OWN exchange
  // dossier, via the SAME per-artifact disclosure-gated view every other
  // exchange surface already uses. `exchangeIds` is already resolved and
  // access-checked by resolveSelectedWorkspaceState above.
  let exchange: ExchangeView | null = null;
  if (state.exchangeIds.length > 0) {
    const view = await getExchangeView(admin, { exchangeId: state.exchangeIds[0], personaId: persona.personaId });
    if (view.ok) exchange = view.view;
  }

  // Experiment-scoped constitutional records — the caller's OWN Locker
  // items only (holder_persona_id = caller), filtered by the SAME
  // [EXP:<id>] bracket-tag convention LockerTab's itemScopeTag already
  // reads (extends the existing tagging convention, never a parallel one).
  let constitutionalRecords: ExperimentDossier['constitutionalRecords'] = experimentId
    ? unmodeled('No constitutional records are tagged for this experiment yet.')
    : unmodeled('No experiment is bound to this workspace.');
  if (experimentId) {
    const { data, error } = await admin
      .from('passport_locker_items')
      .select('item_id, display_name, content_type, created_at')
      .eq('holder_persona_id', persona.personaId)
      .like('display_name', `[EXP:${experimentId}]%`)
      .order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      constitutionalRecords = data.map((r) => ({
        itemId: String((r as { item_id: string }).item_id),
        displayName: String((r as { display_name: string }).display_name),
        contentType: String((r as { content_type: string }).content_type),
        createdAt: String((r as { created_at: string }).created_at),
      }));
    }
  }

  const nextActions: string[] = [...state.pendingHumanDecisions];
  if (exchange && !exchange.receipt) {
    if (!exchange.yourArtifact) nextActions.push('Deposit your architecture artifact for this exchange.');
    else if (!exchange.yourArtifact.frozen) nextActions.push('Declare freeze on your deposited artifact.');
    else if (!exchange.yourArtifact.signed) nextActions.push('Sign the exchange instrument.');
    else nextActions.push('Awaiting the counterparty to freeze and sign.');
  }

  return {
    ok: true,
    dossier: {
      schemaVersion: 'research.dossier.v1',
      workspaceId: state.workspaceId,
      experimentId,
      workspaceLabel: state.workspaceLabel,
      programmeId: state.programmeId,
      viewer: { role: state.role, accessBasis: state.accessBasis },
      experiment: experimentMeta,
      lifecycle: state.experimentLifecycle,
      currentStage: state.currentStage,
      completedStages: state.completedStages,
      protocol,
      crystal,
      apparatus,
      readiness,
      runs,
      review: state.reviewState,
      constitutionalRecords,
      receipts: { activity: state.activity, receiptCards: state.activityReceipts },
      exchange,
      blockers: state.blockers,
      nextMilestone: state.nextMilestone,
      nextActions,
    },
  };
}
