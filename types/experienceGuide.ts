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
  alignmentState: AlignmentState;
  repairRisks: RepairRisk[];
  precedenceMode: PrecedenceMode;
  /** ISO timestamp of the most recent assessment. */
  lastAssessedAt: string;
  /** Optional free-text intent that frames the user's current focus. */
  focusIntent?: string;
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

export const ALIGNMENT_LABEL: Record<AlignmentState, string> = {
  aligned: 'Aligned',
  drifting: 'Drifting',
  at_risk: 'At risk',
  repair: 'Repair',
};
