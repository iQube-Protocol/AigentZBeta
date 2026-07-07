/**
 * Research object model — CFS-019 §4, Phase C contract.
 *
 * Contract-first (the Chrysalis discipline): these types + pinned registries
 * are the object model; DB tables arrive only when lifecycle automation
 * demands rows. Lifecycle ORDER is constitutional data (sequencing
 * corollary, inv.constitutional.078) — pinned by canary.
 */

// ─── Lifecycles (order is meaning — canary-pinned) ──────────────────────────

export const EXPERIMENT_LIFECYCLE = [
  'designed',
  'protocol-ratified',
  'running',
  'evaluated',
  'published',
  'replicated',
] as const;
export type ExperimentLifecycleState = (typeof EXPERIMENT_LIFECYCLE)[number];

export const PUBLICATION_LIFECYCLE = ['draft', 'internal', 'canonical', 'superseded'] as const;
export type PublicationLifecycleState = (typeof PUBLICATION_LIFECYCLE)[number];

/** Finding maturity: an observation becomes constitutional knowledge only
 * through replication and canonization (never by assertion). */
export const FINDING_LIFECYCLE = ['observed', 'replicated', 'canonized-as-invariant'] as const;
export type FindingLifecycleState = (typeof FINDING_LIFECYCLE)[number];

// ─── Objects ─────────────────────────────────────────────────────────────────

export type ConstitutionalLayer = 'I' | 'II' | 'III';

export interface ResearchExperiment {
  id: string; // EXP-NNN
  layer: ConstitutionalLayer;
  family: string;
  seriesId: string;
  hypothesis: string;
  /** Repo path of the protocol/design doc — provenance, not prose. */
  protocolRef: string;
  /** Seed ids of governing invariants (invariantsUsed rides receipts). */
  governingInvariants: string[];
}

export interface ResearchSeries {
  id: string;
  name: string;
  claim: string;
  members: string[]; // experiment ids
  charterRef: string;
}

export interface ResearchOverviewEntry {
  experiment: ResearchExperiment;
  /** Derived honestly from canonical publications — never asserted. */
  lifecycle: ExperimentLifecycleState;
  publishedRuns: number;
  distinctProviders: number;
  latestRunAt: string | null;
}

// ─── Pinned registries (the founding holdings — CFS-019 §3) ─────────────────

export const EXPERIMENT_REGISTRY: ResearchExperiment[] = [
  {
    id: 'EXP-001',
    layer: 'I',
    family: 'Semantic Fidelity',
    seriesId: 'FVS',
    hypothesis:
      'A living KnowledgeQube grounded in canonical invariants preserves semantic fidelity across independent renderings.',
    protocolRef: 'codexes/packs/ccrl/foundation/experiments/exp-001-living-knowledgeqube/README.md',
    governingInvariants: ['inv.constitutional.060', 'inv.reasoning.001'],
  },
  {
    id: 'EXP-002',
    layer: 'I',
    family: 'Temporal Fidelity',
    seriesId: 'FVS',
    hypothesis:
      'Invariant-carried video preserves identity and narrative coherence across segments; sequence is scored, not validated.',
    protocolRef: 'codexes/packs/ccrl/foundation/experiments/exp-002-invariant-video/README.md',
    governingInvariants: ['inv.constitutional.078', 'inv.reasoning.095', 'inv.reasoning.096'],
  },
  {
    id: 'EXP-003',
    layer: 'I',
    family: 'Computational Efficiency',
    seriesId: 'FVS',
    hypothesis:
      'Initialized (invariant-grounded) reasoning reduces rediscovery cost versus cold reasoning at equal or better groundedness.',
    protocolRef: 'codexes/packs/ccrl/foundation/experiments/exp-003-rediscovery-savings/README.md',
    governingInvariants: ['inv.constitutional.062'],
  },
  {
    id: 'EXP-004',
    layer: 'I',
    family: 'Constitutional Sovereignty',
    seriesId: 'PSE',
    hypothesis:
      'Constitutional operation survives on a non-frontier (open-weight) provider alone; quality may degrade, constitutional operation shall not.',
    protocolRef: 'services/experiments/exp004.ts',
    governingInvariants: ['inv.sovereignty.100', 'inv.sovereignty.102', 'inv.sovereignty.103'],
  },
];

export const SERIES_REGISTRY: ResearchSeries[] = [
  {
    id: 'FVS',
    name: 'Foundational Validation Series',
    claim: 'The invariant substrate is real: semantic, temporal, and efficiency properties are measurable.',
    members: ['EXP-001', 'EXP-002', 'EXP-003'],
    charterRef: 'codexes/packs/ccrl/foundation/CFS-015_operation-chrysalis-2-prd.md',
  },
  {
    id: 'PSE',
    name: 'Platform Sovereignty Experiment Series',
    claim: 'Platform sovereignty is a measurable bundle: model, provider choice, commercial independence, infrastructure.',
    members: ['EXP-004'],
    charterRef: 'codexes/packs/ccrl/foundation/CFS-018_platform-sovereignty.md',
  },
];

/**
 * Research Programmes — Aletheon nomenclature (CFS-019 institute-standing
 * amendment, 2026-07-06): Research Programmes → Validation Series →
 * Experiments. The A/B/C names are the validation-work presentation of the
 * foundational holdings; canary-pinned like the registries above. EXP-004
 * sits in the PSE series pending its programme letter.
 */
export const RESEARCH_PROGRAMMES = [
  { id: 'A', name: 'Invariant Knowledge', experiments: ['EXP-001'] },
  { id: 'B', name: 'Temporal Composition', experiments: ['EXP-002'] },
  { id: 'C', name: 'Reasoning Compression', experiments: ['EXP-003'] },
] as const;

// ─── Transition legality ─────────────────────────────────────────────────────

/**
 * A legal transition moves one step forward in the lifecycle, or re-enters
 * `running` from any post-protocol state (re-runs are first-class — the
 * flywheel). Everything else is rejected honestly.
 */
export function isLegalExperimentTransition(
  from: ExperimentLifecycleState,
  to: ExperimentLifecycleState,
): boolean {
  const fi = EXPERIMENT_LIFECYCLE.indexOf(from);
  const ti = EXPERIMENT_LIFECYCLE.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  if (ti === fi + 1) return true;
  if (to === 'running' && fi >= EXPERIMENT_LIFECYCLE.indexOf('protocol-ratified')) return true;
  return false;
}
