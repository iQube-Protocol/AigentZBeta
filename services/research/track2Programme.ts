/**
 * The Track 2 programme — eleven stages, one guided surface (operator ruling,
 * 2026-08-02).
 *
 *   > "Surface the existing Corpus Scout, discovery, promotion, provenance
 *   >  classification, validation, crystal assignment, readiness, artifact
 *   >  provisioning and freeze functions as one guided Track 2 operator
 *   >  workflow. The operator must not need to run curl commands."
 *
 * ── What this module is, and is emphatically not ───────────────────────────
 *
 * It is a PROJECTION. Every stage names the capability that already implements
 * it, and every status is DERIVED from signals the platform already computes —
 * candidate-source rows, discovery candidates, the readiness report's own
 * checks, the crystal lifecycle ladder, the persisted artifact. Nothing here
 * stores progress, and nothing here re-implements a stage's work.
 *
 * A stored `currentStage` would be a second source of truth for a fact the
 * substrate already answers, and it would go stale the moment anyone acted
 * through one of the underlying surfaces directly (`inv.engineering.037`). The
 * eleven stages are a way of READING the substrate, not a workflow engine that
 * owns it.
 *
 * ── Honest unknowns ────────────────────────────────────────────────────────
 *
 * Some upstream signals may be unreadable (no substrate, no permission, a
 * corpus domain the caller did not name). Those stages report `unknown` — never
 * `complete`, and never `blocked`. Guessing "done" would advance an operator
 * past work that has not happened; guessing "blocked" would send them to fix
 * something that is not broken. Both errors have been made on this programme
 * already.
 *
 * Server-safe and pure: no I/O in this module. The route composes the signals.
 */

import type { CrystalLifecycle } from '@/services/research/crystalDomains';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';

export type Track2StageId =
  | 'discover-sources'
  | 'review-and-admit'
  | 'extract-candidates'
  | 'review-and-promote'
  | 'classify-provenance'
  | 'validate'
  | 'add-relationships'
  | 'assign-to-crystal'
  | 'run-readiness'
  | 'prepare-independent-review'
  | 'freeze';

/**
 * `unknown` is a first-class value, not a failure mode — see the header. It
 * means "this signal could not be read", which is different from both "not
 * started" and "blocked".
 */
export type Track2StageStatus = 'complete' | 'in-progress' | 'not-started' | 'blocked' | 'unknown';

export interface Track2Stage {
  id: Track2StageId;
  ordinal: number;
  label: string;
  /** What happens at this stage, in one sentence. */
  does: string;
  /**
   * The EXISTING capability this stage routes to. Never a new implementation —
   * if a stage ever needs one, that is a gap to report, not a thing to build
   * inside a workflow surface.
   */
  capability: string;
  /** Where the operator performs it. A repo path or a named panel, never a guessed URL. */
  surface: string;
  /** Scientific work or a governance act — the distinction the ladder made. */
  workKind: 'scientific' | 'governance';
  /** Who performs it. */
  actor: string;
  status: Track2StageStatus;
  /** One line stating the observed fact behind `status`. */
  detail: string;
  /**
   * What to do next AT THIS STAGE. Carries the readiness engine's own remedies
   * verbatim where they apply — never a second wording of them.
   */
  remedies: string[];
}

export interface Track2ProgrammeSignals {
  /** Corpus Scout candidate sources, by review workflow status. Null = unreadable. */
  candidateSources: { total: number; pendingReview: number; admitted: number } | null;
  /** Discovery candidates for the acquisition domain. Null = unreadable. */
  discoveryCandidates: { total: number; awaitingReview: number; promoted: number } | null;
  /** Promoted invariants with no recorded evidence provenance. Null = unreadable. */
  unclassifiedPromoted: number | null;
  /** The crystal readiness report over the DECLARED domain. */
  readiness: CrystalReadinessReport;
  /** The lifecycle ladder, already derived elsewhere. Consumed, not recomputed. */
  lifecycle: CrystalLifecycle;
  /** The persisted crystal-version artifact, or null when none exists. */
  artifact: { id: string; lifecycle: string } | null;
  /** Whether the independent pre-freeze review may open — from crystalReviewStageStatus. */
  independentReviewRequestOpen: boolean;
}

export interface Track2Programme {
  experimentId: string;
  crystalDomain: string;
  stages: Track2Stage[];
  /** The lowest-ordinal stage that is not complete. The programme's "you are here". */
  currentStageId: Track2StageId;
  /** Every remedy on the current stage, hoisted so a surface leads with it. */
  nextActions: string[];
  /** Stated on the payload: this is read, not stored. */
  derivationNote: string;
}

const DERIVATION_NOTE =
  'Every stage status is DERIVED from the substrate at request time — candidate-source rows, discovery ' +
  'candidates, the readiness report, the crystal lifecycle ladder and the persisted artifact. No progress is ' +
  'stored anywhere, so acting through any underlying surface directly is reflected here immediately, and this ' +
  'programme can never disagree with the reports it reads.';

/** Which readiness checks a stage is answerable for. Used to pull the engine's
 *  own remedies through, verbatim — never to restate them. */
const CHECKS_BY_STAGE: Partial<Record<Track2StageId, string[]>> = {
  'classify-provenance': ['provenance-eligibility'],
  validate: ['lifecycle-validation-integrity'],
  'add-relationships': ['relationship-density', 'graph-connectivity', 'orphan-detection'],
  'assign-to-crystal': ['selection-space'],
  'run-readiness': [
    'selection-space',
    'derivation-headroom',
    'structural-diversity',
    'duplicate-detection',
    'provenance-eligibility',
    'lifecycle-validation-integrity',
    'relationship-density',
    'graph-connectivity',
    'orphan-detection',
  ],
};

function remediesFor(stageId: Track2StageId, readiness: CrystalReadinessReport): string[] {
  const names = CHECKS_BY_STAGE[stageId];
  if (!names) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const check = readiness.checks.find((c) => c.name === name);
    if (!check || check.passed || !check.remedy) continue;
    if (seen.has(check.remedy)) continue; // several checks share the empty-domain remedy
    seen.add(check.remedy);
    out.push(`${check.name}: ${check.remedy}`);
  }
  return out;
}

export function buildTrack2Programme(input: {
  experimentId: string;
  crystalDomain: string;
  signals: Track2ProgrammeSignals;
}): Track2Programme {
  const { signals: s } = input;
  const populated = s.readiness.invariantCount > 0;
  const graphChecks = ['relationship-density', 'graph-connectivity', 'orphan-detection'];
  const graphOk = graphChecks.every((n) => s.readiness.checks.find((c) => c.name === n)?.passed);
  const provenanceOk = s.readiness.checks.find((c) => c.name === 'provenance-eligibility')?.passed ?? false;
  const validationOk = s.readiness.checks.find((c) => c.name === 'lifecycle-validation-integrity')?.passed ?? false;

  const stages: Track2Stage[] = [
    {
      id: 'discover-sources',
      ordinal: 1,
      label: 'Discover Sources',
      does: 'Run Corpus Scout across every ratified institution in the acquisition domain.',
      capability: 'POST /api/corpus-scout/institution-discovery/domain → runDiscoveryForDomain',
      surface: 'Corpus Scout tab',
      workKind: 'scientific',
      actor: 'Steward',
      status:
        s.candidateSources === null ? 'unknown' : s.candidateSources.total > 0 ? 'complete' : 'not-started',
      detail:
        s.candidateSources === null
          ? 'candidate-source substrate could not be read — status unknown, not assumed'
          : `${s.candidateSources.total} candidate source(s) discovered`,
      remedies:
        s.candidateSources?.total === 0
          ? ['Ratify the domain constitution pillars first, then run discovery for the domain.']
          : [],
    },
    {
      id: 'review-and-admit',
      ordinal: 2,
      label: 'Review & Admit',
      does: 'A human approves each source; approval hands it to the Ingestion Broker as evidence.',
      capability: 'POST /api/corpus-scout/candidates/[sourceId]/review → ingestApprovedSource',
      surface: 'Corpus Scout tab',
      workKind: 'scientific',
      actor: 'Steward — approval is never automatic (PRD-ICA-001 §6/§11)',
      status:
        s.candidateSources === null
          ? 'unknown'
          : s.candidateSources.admitted > 0
            ? s.candidateSources.pendingReview > 0
              ? 'in-progress'
              : 'complete'
            : s.candidateSources.total > 0
              ? 'not-started'
              : 'not-started',
      detail:
        s.candidateSources === null
          ? 'unreadable'
          : `${s.candidateSources.admitted} admitted · ${s.candidateSources.pendingReview} awaiting review`,
      remedies:
        s.candidateSources && s.candidateSources.pendingReview > 0
          ? [`${s.candidateSources.pendingReview} source(s) await a human decision. Approval is a human act.`]
          : [],
    },
    {
      id: 'extract-candidates',
      ordinal: 3,
      label: 'Extract Candidates',
      does: 'Run constitutional discovery over the admitted evidence to surface candidate invariants.',
      capability: "POST /api/invariants/discovery { action: 'extract' } → runConstitutionalDiscovery",
      surface: 'Invariant Discovery tab',
      workKind: 'scientific',
      actor: 'Steward',
      status:
        s.discoveryCandidates === null ? 'unknown' : s.discoveryCandidates.total > 0 ? 'complete' : 'not-started',
      detail:
        s.discoveryCandidates === null
          ? 'discovery substrate could not be read — status unknown, not assumed'
          : `${s.discoveryCandidates.total} candidate(s) extracted`,
      remedies: [],
    },
    {
      id: 'review-and-promote',
      ordinal: 4,
      label: 'Review & Promote',
      does: 'Promote each accepted candidate — it lands as `proposed`, never canonical.',
      capability: "POST /api/invariants/discovery { action: 'promote' } → promoteCandidate",
      surface: 'Invariant Discovery tab',
      workKind: 'scientific',
      actor: 'Steward',
      status:
        s.discoveryCandidates === null
          ? 'unknown'
          : s.discoveryCandidates.promoted > 0
            ? s.discoveryCandidates.awaitingReview > 0
              ? 'in-progress'
              : 'complete'
            : 'not-started',
      detail:
        s.discoveryCandidates === null
          ? 'unreadable'
          : `${s.discoveryCandidates.promoted} promoted · ${s.discoveryCandidates.awaitingReview} awaiting review`,
      remedies: [],
    },
    {
      id: 'classify-provenance',
      ordinal: 5,
      label: 'Classify Provenance',
      does: 'Record each invariant’s real evidence basis. Promotion deliberately leaves it unset.',
      capability: "POST /api/invariants/discovery { action: 'classify' } → applyProvenanceReclassification",
      surface: 'Invariant Discovery tab — classification queue',
      workKind: 'scientific',
      actor: 'Steward — a move into Population A citing only repo-internal sources is refused',
      status:
        s.unclassifiedPromoted === null
          ? populated
            ? provenanceOk
              ? 'complete'
              : 'in-progress'
            : 'unknown'
          : s.unclassifiedPromoted === 0
            ? 'complete'
            : 'in-progress',
      detail:
        s.unclassifiedPromoted === null
          ? provenanceOk && populated
            ? 'every crystal member is Population A'
            : 'classification queue could not be read'
          : `${s.unclassifiedPromoted} promoted invariant(s) carry no recorded evidence provenance`,
      remedies: remediesFor('classify-provenance', s.readiness),
    },
    {
      id: 'validate',
      ordinal: 6,
      label: 'Validate',
      does: 'Run the validation gate — consistency, groundedness, canonical form — and receipt it.',
      capability: "POST /api/invariants/[id]/advance { action: 'validate' } → validateInvariant",
      surface: 'Invariant Registry — invariant detail',
      workKind: 'scientific',
      actor: 'Steward',
      status: !populated ? 'not-started' : validationOk ? 'complete' : 'in-progress',
      detail: populated
        ? validationOk
          ? 'every crystal member carries a real validation count'
          : 'some members carry zero validations'
        : 'nothing assigned to the crystal domain yet',
      remedies: remediesFor('validate', s.readiness),
    },
    {
      id: 'add-relationships',
      ordinal: 7,
      label: 'Add Relationships',
      does: 'Record the relationships that hold between crystal members.',
      capability: 'POST /api/invariants/[id]/edges → addEdge (cycle guard + contradiction quarantine)',
      surface: 'Invariant Registry — invariant detail → Related invariants',
      workKind: 'scientific',
      actor: 'Steward',
      status: !populated ? 'not-started' : graphOk ? 'complete' : 'in-progress',
      detail: populated
        ? graphOk
          ? 'density, connectivity and orphan checks all pass'
          : `${s.readiness.graph.relationshipCount} intra-crystal edge(s); ${s.readiness.graph.orphanCount} orphan(s)`
        : 'nothing assigned to the crystal domain yet',
      remedies: remediesFor('add-relationships', s.readiness),
    },
    {
      id: 'assign-to-crystal',
      ordinal: 8,
      label: 'Assign to Crystal',
      does: 'Admit eligible validated invariants to the ratified crystal domain.',
      capability: 'POST /api/research/crystal/[experimentId]/assign → evaluateCrystalAssignment + upsertContext',
      surface: 'Track 2 programme — guided assignment',
      workKind: 'scientific',
      actor: 'Steward — dry run first; every admission is receipted',
      status: populated ? 'complete' : 'not-started',
      detail: populated
        ? `${s.readiness.invariantCount} invariant(s) in '${input.crystalDomain}'`
        : `'${input.crystalDomain}' is ratified and empty — nothing has been admitted yet`,
      remedies: remediesFor('assign-to-crystal', s.readiness),
    },
    {
      id: 'run-readiness',
      ordinal: 9,
      label: 'Run Readiness',
      does: 'Assess the constituted crystal against the nine intrinsic readiness checks.',
      capability: 'GET /api/research/crystal/[experimentId] → runCrystalReadinessReport',
      surface: 'Independent Review panel',
      workKind: 'scientific',
      actor: 'The originating team — it diagnoses its own checks',
      status: !populated ? 'not-started' : s.readiness.ok ? 'complete' : 'in-progress',
      detail: populated
        ? s.readiness.ok
          ? 'all nine checks pass'
          : `${s.readiness.checks.filter((c) => !c.passed).length}/${s.readiness.checks.length} checks failing`
        : 'nothing to assess yet',
      remedies: remediesFor('run-readiness', s.readiness),
    },
    {
      id: 'prepare-independent-review',
      ordinal: 10,
      label: 'Prepare Independent Review',
      does: 'Open the independent pre-freeze review — only over a populated crystal that has passed readiness.',
      capability: 'crystalReviewStageStatus → independentReviewRequestOpen',
      surface: 'Independent Review panel',
      workKind: 'governance',
      actor: 'An external reviewer',
      status: s.independentReviewRequestOpen ? 'in-progress' : populated ? 'blocked' : 'not-started',
      detail: s.independentReviewRequestOpen
        ? 'the independent pre-freeze review may open'
        : populated
          ? 'readiness has not passed — this is internal diagnostic work, not a reviewer’s to assess'
          : 'nothing to review yet',
      remedies: s.independentReviewRequestOpen
        ? []
        : populated
          ? ['Complete the failing readiness checks first. Sending a failing crystal to an external reviewer spends their independence diagnosing our checks.']
          : [],
    },
    {
      id: 'freeze',
      ordinal: 11,
      label: 'Freeze',
      does: 'Provision the crystal-version artifact, then perform the freeze as an explicit governed act.',
      capability: 'POST /api/research/crystal/[experimentId]/freeze → upsertArtifact / freezeArtifact',
      surface: 'Track 2 programme — freeze ceremony',
      workKind: 'governance',
      actor: 'The operator, by their own act',
      status:
        s.artifact?.lifecycle === 'frozen'
          ? 'complete'
          : s.lifecycle.stageId === 'READY_FOR_FREEZE'
            ? s.artifact
              ? 'in-progress'
              : 'blocked'
            : 'not-started',
      detail:
        s.artifact?.lifecycle === 'frozen'
          ? 'the crystal is frozen — its content is fixed and receipted'
          : s.artifact
            ? `crystal-version artifact is at '${s.artifact.lifecycle}'`
            : 'no crystal-version artifact has been provisioned',
      remedies:
        s.artifact?.lifecycle === 'frozen'
          ? []
          : s.lifecycle.stageId === 'READY_FOR_FREEZE' && !s.artifact
            ? ['Provision the crystal-version artifact before ratifying (action: "provision"). Nothing is frozen by provisioning.']
            : s.lifecycle.stageId !== 'READY_FOR_FREEZE'
              ? [`A freeze is not the next act at this stage — ${s.lifecycle.whatIsMissing ?? 'earlier stages are outstanding'}`]
              : [],
    },
  ];

  const current = stages.find((st) => st.status !== 'complete') ?? stages[stages.length - 1];
  return {
    experimentId: input.experimentId,
    crystalDomain: input.crystalDomain,
    stages,
    currentStageId: current.id,
    nextActions: current.remedies.length > 0 ? current.remedies : [current.detail],
    derivationNote: DERIVATION_NOTE,
  };
}
