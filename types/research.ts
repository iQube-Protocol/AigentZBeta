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

/** Publication kinds (CFS-019 §4) — the `publishResult` discipline generalized. */
export const PUBLICATION_KINDS = ['working', 'technical', 'white', 'note', 'conference'] as const;
export type PublicationKind = (typeof PUBLICATION_KINDS)[number];

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

/**
 * Finding (CFS-019 §4): claim + evidence refs + maturity status. A finding
 * enters at `observed` and only earns `replicated` / `canonized-as-invariant`
 * through the lifecycle — never by assertion. `evidenceRefs` carry hash
 * commitments / canonical-result ids (provenance), never raw T0 identifiers.
 */
export interface ResearchFinding {
  id: string; // FIND-<slug> — session-local, T2-safe
  /** Governing experiment (EXP-NNN) the observation came from. */
  experimentId: string;
  claim: string;
  /** Hash commitments / canonical result ids — provenance, never prose, never T0 ids. */
  evidenceRefs: string[];
  lifecycle: FindingLifecycleState;
  /** Seed ids of governing invariants (ride receipts as invariantsUsed). */
  governingInvariants: string[];
}

/**
 * Publication (CFS-019 §4): the `publishResult` discipline generalized —
 * kind, source artifacts (experiment ids / result hashes / finding ids),
 * abstract, lineage via lifecycle. Enters at `draft`.
 */
export interface ResearchPublication {
  id: string; // PUB-<slug> — session-local, T2-safe
  kind: PublicationKind;
  title: string;
  /** Experiment ids, canonical result hashes, or finding ids — provenance. */
  sourceArtifacts: string[];
  abstract: string;
  lifecycle: PublicationLifecycleState;
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
  {
    id: 'EXP-005',
    layer: 'I',
    family: 'Provider Choice',
    seriesId: 'PSE',
    hypothesis:
      'Provider choice is a real, measured sovereignty-bundle component: the same constitutional battery hands across providers mid-run (cross-provider judged) and constitutional operation survives the switch. Demonstrates S2 (substitutable) exercised, not merely available.',
    protocolRef: 'services/experiments/exp005.ts',
    governingInvariants: ['inv.sovereignty.102'],
  },
  // ─── Invariant Intelligence Validation Series (CRP-002 · metaMe IRL) ────────
  {
    id: 'IRL-EXP-001',
    layer: 'I',
    family: 'Intent → Invariant Projection Fidelity',
    seriesId: 'IIVS',
    hypothesis:
      'Intent projects onto a minimal invariant set predictable against the CIRS (Stage A: overlap/precision/recall), and that set produces superior downstream reasoning (Stage B). Every predicted-vs-CIRS disagreement is a classified Invariant Delta — first-class data for the emergent WP0 (Option 1A).',
    protocolRef: 'services/experiments/irlExp001.ts',
    governingInvariants: ['inv.epistemology.119', 'inv.epistemology.120'],
  },
  {
    id: 'IRL-EXP-002',
    layer: 'I',
    family: 'Reasoning Entropy Reduction',
    seriesId: 'IIVS',
    hypothesis:
      'Invariant-initialised reasoning reduces reasoning entropy vs retrieval across a four-arm ladder (large-context → naive-rag → existing-kb → invariant-runtime). Beating naïve RAG is easy; the honest bar is beating our own production KB retrieval.',
    protocolRef: 'codexes/packs/ccrl/foundation/CRP-002_invariant-intelligence-intent-driven-compression.md',
    governingInvariants: ['inv.epistemology.119', 'inv.constitutional.062'],
  },
  {
    id: 'IRL-EXP-003',
    layer: 'I',
    family: 'Cross-Modal Invariant Reuse (Propagation Fidelity)',
    seriesId: 'IIVS',
    hypothesis:
      'A single invariant set propagates across modalities (article/story/image/ux/prd) with high fidelity: blind reviewers can reconstruct the original invariant set from the artifacts. Propagation Fidelity is the benchmark.',
    protocolRef: 'codexes/packs/ccrl/foundation/CRP-002_invariant-intelligence-intent-driven-compression.md',
    governingInvariants: ['inv.epistemology.119'],
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
    members: ['EXP-004', 'EXP-005'],
    charterRef: 'codexes/packs/ccrl/foundation/CFS-018_platform-sovereignty.md',
  },
  {
    id: 'IIVS',
    name: 'Invariant Intelligence Validation Series',
    claim: 'Intent projects onto minimal invariant sets; those sets reason more faithfully at lower entropy and propagate across modalities — and the disagreements teach us what an invariant is.',
    members: ['IRL-EXP-001', 'IRL-EXP-002', 'IRL-EXP-003'],
    charterRef: 'codexes/packs/ccrl/foundation/CRP-002_invariant-intelligence-intent-driven-compression.md',
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
  { id: 'A', name: 'Invariant Knowledge', experiments: ['EXP-001'], exploratory: false },
  { id: 'B', name: 'Temporal Composition', experiments: ['EXP-002'], exploratory: false },
  { id: 'C', name: 'Reasoning Compression', experiments: ['EXP-003'], exploratory: false },
  // Research Roadmap Expansion (CFS-019 amendment, 2026-07-07). A long-term,
  // EXPLORATORY programme — no experiments yet. Its purpose is to identify the
  // invariant structures stable across reasoning systems and the properties
  // unique to particular forms of reasoning, framed as hypotheses, never
  // assuming answers where evidence does not yet exist.
  { id: 'D', name: 'Reasoning Systems', experiments: [], exploratory: true },
  // CRP-002 (metaMe IRL) — the first programme formally chartered under CRP-001.
  // Intent Science is the entry point; Knowledge Compression is one mechanism.
  { id: 'E', name: 'Invariant Intelligence', experiments: ['IRL-EXP-001', 'IRL-EXP-002', 'IRL-EXP-003'], exploratory: false },
] as const;

// ─── Research Roadmap Expansion (CFS-019 amendment, 2026-07-07) ──────────────
// The applied-research agenda the CCRL Copilot plans against. Incorporated into
// the EXISTING roadmap/registry — not a parallel framework. Canary-pinned.

/**
 * Applied Constitutional Research (CFS-019 guiding principle). Research aims not
 * at theory alone but at constitutional capabilities that can be implemented,
 * experimentally validated, and integrated. Implementation is PART of research,
 * not a downstream activity. The preferred outcome of every programme is this
 * chain — experimental evidence, measured consequence, and constitutional
 * standing together form the empirical validation process.
 */
export const APPLIED_RESEARCH_CHAIN = [
  'Discovery',
  'Compression',
  'Implementation',
  'Validation',
  'Standing',
  'Canonical Knowledge',
] as const;

/**
 * Roadmap prioritization — prefer research satisfying ALL THREE. Preserves the
 * applied emphasis while letting exploratory programmes mature over time.
 */
export const ROADMAP_PRIORITIZATION_CRITERIA = [
  'Advances foundational constitutional understanding',
  'Can be experimentally validated using the current platform',
  'Has a plausible pathway to improving constitutional capability',
] as const;

/** What every research item should seek to produce (research governance). */
export const RESEARCH_OUTPUT_KINDS = [
  'validated invariants',
  'constitutional refinements',
  'engineering capabilities',
  'experimental evidence',
  'implementation guidance',
] as const;

/**
 * Initial research themes of the Reasoning Systems programme. `exploratory`
 * items remain explicitly marked until sufficient evidence exists to produce
 * implementation outcomes (research governance).
 */
export interface ResearchTheme {
  id: string;
  title: string;
  investigate: string[];
  hypothesis?: string;
  exploratory: boolean;
}

export const RESEARCH_THEMES: ResearchTheme[] = [
  {
    id: 'reasoning-systems',
    title: 'Reasoning Systems',
    investigate: [
      'biological reasoning', 'machine reasoning', 'collective reasoning', 'institutional reasoning',
      'shared invariant structures', 'unique properties', 'constitutional implications',
    ],
    exploratory: true,
  },
  {
    id: 'representational-artifacts',
    title: 'Representational Artifacts',
    investigate: ['the role of representational artifacts in reasoning'],
    hypothesis:
      'Reasoning performed through shared representational artifacts provides the common substrate through which biological and machine reasoning contribute to constitutional invariant discovery. The objective is not to prove this but to experimentally refine or falsify it.',
    exploratory: true,
  },
  {
    id: 'invariant-discovery',
    title: 'Invariant Discovery',
    investigate: [
      'how invariants emerge', 'how invariants evolve', 'reasoning compression',
      'invariant stability', 'invariant provenance', 'invariant supersession',
    ],
    exploratory: true,
  },
  {
    id: 'constitutional-invariant-evolution',
    title: 'Constitutional Invariant Evolution',
    investigate: [
      'natural invariants', 'constitutional invariants',
      'relationships between discovered and ratified invariants',
      'constitutional standing of invariants', 'mechanisms for constitutional evolution',
    ],
    exploratory: true,
  },
] as const as ResearchTheme[];

/**
 * Open Constitutional Questions — maintained as EXPLICIT research questions,
 * NOT conclusions. Hypothesis-driven until supported by experimental evidence.
 */
export const OPEN_CONSTITUTIONAL_QUESTIONS = [
  'What differentiates biological and machine reasoning once representational artifacts are held constant?',
  'What role does embodiment play in reasoning?',
  'What role does perception play?',
  'What role does sentience play?',
  'What role does intentionality play?',
  'What role does consciousness play?',
  'Which of these properties are constitutionally relevant?',
  'Which are implementation-specific rather than constitutional?',
  'How should constitutional systems evolve as additional classes of reasoning systems emerge?',
] as const;

/**
 * The laboratory's emerging research METHOD (operator note, 2026-07-07):
 * progress comes not from grand theories but from discovering the correct
 * constitutional DISTINCTIONS, then validating them experimentally. Recorded as
 * method, NOT as a ratified law — it informs how research questions are
 * structured. Each pair is a distinction the work has already surfaced.
 */
export const CONSTITUTIONAL_DISTINCTIONS = [
  'Information ≠ Knowledge',
  'Knowledge ≠ Invariants',
  'Standing ≠ Truth',
  'Standing ≠ Reach',
  'Human reasoning ≠ Machine reasoning',
  'Artificial ≠ Machine',
  'Natural invariants ≠ Constitutional invariants',
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
