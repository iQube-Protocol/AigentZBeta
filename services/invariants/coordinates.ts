/**
 * coordinates — the Constitutional Coordinates Registry (CFS-038 / PRD-CCR-001,
 * RATIFIED 2026-07-17), Phase 0.
 *
 * The governed BASIS of constitutional space: the axes every invariant / intent
 * / iQube / agent is located against (CFS-037 §5). Three classes — structural
 * (describe the problem, actor-independent), constitutional (describe the
 * relationship, vary by actor/org/polity), operational (execution economics).
 *
 * STABLE OPERATIONAL BASIS vs EVOLVING RESEARCH BASIS (Aletheon): each vector
 * carries a `stability` —
 *   - 'operational' = ratified + computed every request (load-bearing);
 *   - 'research'    = declared, under IRL test (redundancy/emergence/domain
 *                     additions), computed in shadow, NOT load-bearing until a
 *                     ratification ceremony promotes it.
 * Phase 0 marks 'operational' ONLY the vectors the IRE actually derives today
 * from seeded axes — everything else is an honest 'research' candidate (never
 * faked). The IRL promotes vectors via ratification (Law XI applied to the basis).
 *
 * EXTENSION, NOT REPLACEMENT: this lifts `IQubeScoreBlock`'s calibrated-axis +
 * `_source`/`derivation_strategy` provenance pattern (types/registry-canonical.ts)
 * from the iQube level to the field's basis level. The four native iQube axes
 * (sensitivity/verifiability/accuracy→uncertainty/risk) appear here as structural
 * vectors — generalised, not reinvented.
 *
 * Pure + isomorphic — a data registry + lookups, no I/O.
 */

export type CoordinateClass = 'structural' | 'constitutional' | 'operational';
export type CoordinateStatus = 'candidate' | 'ratified' | 'deprecated';
export type CoordinateStability = 'operational' | 'research';

export interface CoordinateVector {
  key: string;
  class: CoordinateClass;
  /** The constitutional question the axis answers. */
  question: string;
  /** How a value is derived — provenance, never a bare number (the
   *  IQubeScoreBlock derivation_strategy pattern). */
  basis: string;
  status: CoordinateStatus;
  stability: CoordinateStability;
}

/**
 * The ratified coordinate basis (Phase 0). 'operational' stability marks the
 * vectors the IRE derives today (CFS-037 resolution.ts): per-invariant
 * verifiability + evidenceDensity + adoption, and field-level knowledgeCoverage
 * + reusePotential + timeToValue. All others are declared 'research' candidates
 * — named so the IRE can carry them null without faking (constitutional-class
 * vectors need actor context; several structural/operational vectors need
 * signals not yet computed).
 */
export const COORDINATE_BASIS: CoordinateVector[] = [
  // ── Structural (describe the problem; actor-independent) ────────────────────
  { key: 'verifiability', class: 'structural', question: 'Can claims be verified?', basis: 'derived:confidence', status: 'ratified', stability: 'operational' },
  { key: 'evidenceDensity', class: 'structural', question: 'How much validated evidence backs this?', basis: 'derived:standing', status: 'ratified', stability: 'operational' },
  { key: 'complexity', class: 'structural', question: 'How complex is the problem?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  { key: 'uncertainty', class: 'structural', question: 'How uncertain is the outcome?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  { key: 'sensitivity', class: 'structural', question: 'How sensitive is the information?', basis: 'research:iQubeScoreBlock.sensitivity', status: 'candidate', stability: 'research' },
  { key: 'risk', class: 'structural', question: 'What could go wrong?', basis: 'research:iQubeScoreBlock.risk', status: 'candidate', stability: 'research' },
  { key: 'scope', class: 'structural', question: 'How broad is the scope?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  // ── Constitutional (describe the relationship; need actor context) ──────────
  { key: 'authority', class: 'constitutional', question: 'Is the actor authorized?', basis: 'research:identity-spine', status: 'candidate', stability: 'research' },
  { key: 'standing', class: 'constitutional', question: 'Does standing affect or result from this?', basis: 'research:standing-spine', status: 'candidate', stability: 'research' },
  { key: 'delegability', class: 'constitutional', question: 'Can or should this be delegated?', basis: 'research:delegation-envelope', status: 'candidate', stability: 'research' },
  { key: 'consent', class: 'constitutional', question: 'Is consent required?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  { key: 'accountability', class: 'constitutional', question: 'Who owns the outcome?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  { key: 'sovereignty', class: 'constitutional', question: 'Is sovereignty preserved?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  { key: 'identityProtection', class: 'constitutional', question: 'Is identity appropriately protected/disclosed?', basis: 'research:identity-spine', status: 'candidate', stability: 'research' },
  { key: 'trust', class: 'constitutional', question: 'Can this be trusted?', basis: 'research:trust-scores', status: 'candidate', stability: 'research' },
  { key: 'personhoodImpact', class: 'constitutional', question: 'Does this preserve human continuity and agency?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  // ── Operational (execution economics) ──────────────────────────────────────
  { key: 'knowledgeCoverage', class: 'operational', question: 'How much of the intent does existing knowledge cover?', basis: 'derived:sliceSize/cap', status: 'ratified', stability: 'operational' },
  { key: 'reusePotential', class: 'operational', question: 'How strong is the existing canon in this region?', basis: 'derived:mean(standing)', status: 'ratified', stability: 'operational' },
  { key: 'timeToValue', class: 'operational', question: 'What collapses time to value?', basis: 'proxy:coverage×(0.5+standing/2)', status: 'ratified', stability: 'operational' },
  { key: 'adoption', class: 'operational', question: 'How adopted is this (Law XII reach)?', basis: 'derived:reach/(reach+5)', status: 'ratified', stability: 'operational' },
  { key: 'repairCost', class: 'operational', question: 'What minimizes future repair?', basis: 'research:pending', status: 'candidate', stability: 'research' },
  { key: 'automationPotential', class: 'operational', question: 'How automatable is this?', basis: 'research:pending', status: 'candidate', stability: 'research' },
];

const BY_KEY = new Map(COORDINATE_BASIS.map((v) => [v.key, v] as const));

/** Look up a vector by key. Pure. */
export function getVector(key: string): CoordinateVector | null {
  return BY_KEY.get(key) ?? null;
}

/** The vectors of a class. Pure. */
export function vectorsByClass(cls: CoordinateClass): CoordinateVector[] {
  return COORDINATE_BASIS.filter((v) => v.class === cls);
}

/** The load-bearing operational basis (ratified + computed). Pure. */
export function operationalBasis(): CoordinateVector[] {
  return COORDINATE_BASIS.filter((v) => v.stability === 'operational' && v.status === 'ratified');
}

/** The evolving research basis (declared, shadow, not load-bearing). Pure. */
export function researchBasis(): CoordinateVector[] {
  return COORDINATE_BASIS.filter((v) => v.stability === 'research');
}

/** The basis string for a computed coordinate — the single provenance source
 *  the IRE stamps onto each value (never an inline literal). Pure. */
export function basisFor(key: string): string {
  return getVector(key)?.basis ?? 'unregistered';
}
