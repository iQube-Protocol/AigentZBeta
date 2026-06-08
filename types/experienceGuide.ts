/**
 * Personal ExperienceGuide — type contract.
 *
 * Per metaMe Cartridge PRD (Personal ExperienceGuide layer).
 *
 * The ExperienceGuide is the human-centred layer over the existing
 * ExperienceQube / ExperienceModel. Where the ExperienceModel captures
 * the user's venture / programme intent, the ExperienceGuide captures the
 * user's *lived* state across two axes:
 *
 *   Sphere of Agency (Y) — what arena of agency is the position about
 *     Energy → Body → Mind → Emotion → Relationship → Community → Legacy
 *
 *   Experience Maturity (X) — how settled is their practice in that arena
 *     Noticing → Exploring → Experimenting → Practicing → Integrating →
 *     Sustaining → Stewarding
 *
 * A 7×7 lattice. Each Sphere dimension carries one MaturityLevel — the
 * user's self-assessed position. The lattice plus the AlignmentState,
 * RepairRisk list, and PrecedenceMode are persisted as the `personalGuide`
 * key inside the ExperienceQube BlakQube payload. No new table.
 */

export const SPHERE_AXES = [
  'energy',
  'body',
  'mind',
  'emotion',
  'relationship',
  'community',
  'legacy',
] as const;
export type SphereAxis = (typeof SPHERE_AXES)[number];

export const MATURITY_LEVELS = [
  'noticing',
  'exploring',
  'experimenting',
  'practicing',
  'integrating',
  'sustaining',
  'stewarding',
] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];

/** 1..7 ordinal mapping for grid placement and comparisons. */
export const MATURITY_ORDINAL: Record<MaturityLevel, number> = {
  noticing: 1,
  exploring: 2,
  experimenting: 3,
  practicing: 4,
  integrating: 5,
  sustaining: 6,
  stewarding: 7,
};

export const SPHERE_ORDINAL: Record<SphereAxis, number> = {
  energy: 1,
  body: 2,
  mind: 3,
  emotion: 4,
  relationship: 5,
  community: 6,
  legacy: 7,
};

export type AlignmentState = 'aligned' | 'drifting' | 'at_risk' | 'repair';

/** 1..4 ordinal — higher = more concerning. Used to derive the overall. */
export const ALIGNMENT_ORDINAL: Record<AlignmentState, number> = {
  aligned: 1,
  drifting: 2,
  at_risk: 3,
  repair: 4,
};

/** Per-sphere repair signal — what's pulling the user out of alignment. */
export interface RepairRisk {
  sphere: SphereAxis;
  signal: string;
  /** Optional remediation suggestion shown in the alignment helper. */
  suggestion?: string;
}

/**
 * Which sphere takes precedence when the guide must choose between
 * competing nudges. 'auto' means the helper picks based on the lowest
 * maturity / highest repair risk.
 */
export type PrecedenceMode =
  | 'auto'
  | 'energy'
  | 'body'
  | 'mind'
  | 'emotion'
  | 'relationship'
  | 'community'
  | 'legacy';

/**
 * Canonical persisted shape. Stored as `blak.personalGuide` on the
 * ExperienceQube row. Never sent to the browser without an explicit T1
 * shape; routes carry their own response surface.
 */
export interface PersonalGuideData {
  /** Per-sphere maturity self-assessment. */
  sphereMaturity: Record<SphereAxis, MaturityLevel>;
  /** Per-sphere alignment self-assessment. Added 2026-06-08. */
  sphereAlignment: Record<SphereAxis, AlignmentState>;
  /**
   * Overall alignment — derived from `sphereAlignment` by taking the worst
   * (highest-ordinal) state across spheres. Persisted for fast read on the
   * surfaces that still want a single roll-up (welcome chip, brief card).
   */
  alignmentState: AlignmentState;
  repairRisks: RepairRisk[];
  precedenceMode: PrecedenceMode;
  /** ISO timestamp of the most recent assessment. */
  lastAssessedAt: string;
  /** Optional free-text intent that frames the user's current focus. */
  focusIntent?: string;
  /**
   * Stub — pattern that maps the user's stated goals to which sphere
   * alignment posture matters most for them. Worked out down the road; the
   * field is reserved so we can write it without a migration.
   */
  goalAlignmentPattern?: GoalAlignmentPattern;
}

/**
 * Stub for the goal → alignment-pattern mapping. Different goal classes
 * weight spheres differently — e.g. an athletic-performance goal weights
 * body + energy more heavily, a creative-output goal weights mind + emotion.
 * Filled in when we work out the canonical pattern catalogue.
 */
export interface GoalAlignmentPattern {
  /** Free-form pattern id once we name the canonical patterns. */
  patternId?: string;
  /** Optional per-sphere weight 0..1 — interpretation TBD. */
  weights?: Partial<Record<SphereAxis, number>>;
  /** Optional notes captured during inference. */
  notes?: string;
}

/** Default sphere positions for a freshly-onboarded user — all noticing. */
export function defaultSphereMaturity(): Record<SphereAxis, MaturityLevel> {
  return {
    energy: 'noticing',
    body: 'noticing',
    mind: 'noticing',
    emotion: 'noticing',
    relationship: 'noticing',
    community: 'noticing',
    legacy: 'noticing',
  };
}

/** Default per-sphere alignment for a freshly-onboarded user — drifting. */
export function defaultSphereAlignment(): Record<SphereAxis, AlignmentState> {
  return {
    energy: 'drifting',
    body: 'drifting',
    mind: 'drifting',
    emotion: 'drifting',
    relationship: 'drifting',
    community: 'drifting',
    legacy: 'drifting',
  };
}

/**
 * Roll-up rule: the overall alignment is the worst (highest-ordinal) state
 * across any sphere. One sphere in repair forces the overall to repair —
 * the nudge engine should react to the weakest link, not the average.
 */
export function deriveOverallAlignment(
  sphereAlignment: Record<SphereAxis, AlignmentState>,
): AlignmentState {
  let worst: AlignmentState = 'aligned';
  for (const sphere of SPHERE_AXES) {
    const v = sphereAlignment[sphere];
    if (v && ALIGNMENT_ORDINAL[v] > ALIGNMENT_ORDINAL[worst]) worst = v;
  }
  return worst;
}

/**
 * Backfill `sphereAlignment` from a legacy guide payload that only carries
 * the global `alignmentState`. Fans the single value out to every sphere
 * so the user's previous snapshot is mirrored seven times — they can then
 * adjust per sphere on their next assessment.
 */
export function backfillSphereAlignment(
  overall: AlignmentState | undefined,
): Record<SphereAxis, AlignmentState> {
  const seed: AlignmentState = overall ?? 'drifting';
  return {
    energy: seed,
    body: seed,
    mind: seed,
    emotion: seed,
    relationship: seed,
    community: seed,
    legacy: seed,
  };
}

/** T1-safe display labels for UI rendering. */
export const SPHERE_LABEL: Record<SphereAxis, string> = {
  energy: 'Energy',
  body: 'Body',
  mind: 'Mind',
  emotion: 'Emotion',
  relationship: 'Relationship',
  community: 'Community',
  legacy: 'Legacy',
};

export const MATURITY_LABEL: Record<MaturityLevel, string> = {
  noticing: 'Noticing',
  exploring: 'Exploring',
  experimenting: 'Experimenting',
  practicing: 'Practicing',
  integrating: 'Integrating',
  sustaining: 'Sustaining',
  stewarding: 'Stewarding',
};

/**
 * Plain-language descriptions of each maturity level. Surfaced as
 * tooltips on the wizard buttons so a new operator can self-assess
 * without guessing what each label means.
 */
export const MATURITY_DESCRIPTION: Record<MaturityLevel, string> = {
  noticing:
    'Just becoming aware that this sphere matters — no consistent practice yet.',
  exploring:
    'Trying things out, gathering information, no committed routines.',
  experimenting:
    'Running small bets to learn what works for you — willing to fail.',
  practicing:
    'A routine exists but still requires conscious effort to maintain.',
  integrating:
    'Now part of how you operate day-to-day; rarely skipped.',
  sustaining:
    'Self-correcting — bounces back quickly when life disrupts it.',
  stewarding:
    'You can guide others through this; the practice runs you, not the other way around.',
};

export const SPHERE_DESCRIPTION: Record<SphereAxis, string> = {
  energy:
    'How you generate, conserve, and spend the underlying drive that powers everything else. Assess your stamina and pace — do you have the fuel for what you have committed to, and does it recover between pushes?',
  body:
    'Physical health, sleep, nutrition, movement — the substrate of all other agency. Assess your physical practice and the condition of the vessel you carry every commitment in.',
  mind:
    'Thinking, focus, learning, decision quality — the cognitive layer. Assess how clear and sharp your reasoning feels, and how often distraction or rumination is winning.',
  emotion:
    'Feeling vocabulary, regulation, self-honesty about emotional state. Assess how cleanly emotion moves through you — are feelings acknowledged and processed, or stuck and acted out?',
  relationship:
    'One-to-one ties — partner, family, close friends, business co-founders. Assess the health and honesty of the small number of relationships that matter most to your life.',
  community:
    'The wider circles you belong to and contribute to — local, professional, identity-based. Assess your sense of belonging, contribution, and reciprocity with the groups you are part of.',
  legacy:
    'The long horizon — what you build to outlast you, the imprint you leave. Assess whether your daily work is compounding into something that matches the contribution you mean to make.',
};

export const ALIGNMENT_LABEL: Record<AlignmentState, string> = {
  aligned: 'Aligned',
  drifting: 'Drifting',
  at_risk: 'At risk',
  repair: 'Repair',
};

/**
 * Plain-language descriptions of each alignment state. Surfaced as tooltips
 * on the wizard buttons so a new operator can self-assess each sphere
 * without guessing.
 */
export const ALIGNMENT_DESCRIPTION: Record<AlignmentState, string> = {
  aligned:
    'This sphere feels coherent — your attention, energy, and commitments here are in step. Nothing pulling.',
  drifting:
    'Quietly slipping. No crisis, but you can feel that this sphere is not getting what it needs.',
  at_risk:
    'Real friction is building here. If you do not intervene soon, something is going to break.',
  repair:
    'Active rupture in this sphere. You need to repair before you can move forward — keep pushing and the cost compounds.',
};
