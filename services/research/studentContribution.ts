/**
 * studentContribution — student capstone contributions earning Standing
 * (operator ruling, 2026-07-29), routed through the ONE V-10 admission gate.
 *
 * ── THIS MODULE CONFIGURES A GATE; IT DOES NOT IMPLEMENT ONE ────────────────
 *
 * Every decision below is made by `evaluateStandingSignal` in
 * `services/venture/trading/standingAdmission.ts`. Nothing here re-partitions
 * bases, re-computes weight, or re-checks evidence. The operator's instruction
 * was explicit: "Generalise the gate if its naming is trading-specific — do NOT
 * fork it into a `researchStandingAdmission`. One admission gate, two domains,
 * or the invariant means nothing."
 *
 * What this module supplies is CONFIGURATION: which of the gate's permitted
 * bases a research contribution may claim, and the input shape that carries a
 * student's commitment rather than a venture agent's.
 *
 * ── THE UNIT IS THE VERIFIED CONTRIBUTION, NOT THE SUBMISSION ───────────────
 *
 *     executed-trade count earning Standing ≡ submission count earning Standing
 *
 * Submitting is activity, not contribution. If the ACT of submitting earned,
 * the incentive would be volume and a student who submits ten thin artefacts
 * would outrank one who submits a single rigorous one — the exact ordering V-10
 * exists to prevent. `submission-count` and its siblings are therefore named in
 * `PROHIBITED_STANDING_BASES` alongside `executed-trade-count`, in the SAME
 * closed list, because the list is not "trading metrics" but QUANTITY metrics.
 *
 * ── GRADING IS NOT STANDING ─────────────────────────────────────────────────
 *
 * A grade is an institutional judgement by the Faculty Lead; Standing is a
 * constitutional one. They may correlate; they must not collapse into one field
 * or one act. `RESEARCH_WORKSPACE_ROLE_AUTHORITY` gives `faculty-lead`
 * `mayAwardGrade: true` and the literal type `mayGrantStanding: false` — as it
 * does for every role — so no act of authority writes Standing. Standing is
 * reached only by a verified contribution passing this gate. Nothing in this
 * module accepts a grade, and nothing in the grading path may call it.
 *
 * ── ATTRIBUTION TRAVELS WITH THE STUDENT ────────────────────────────────────
 *
 * `contributorRef` is a `personaPublicRef()` COMMITMENT, never a raw
 * `personaId` — the gate refuses a raw UUID outright rather than sanitising it.
 * A student's Standing is theirs: it is not the institution's to hold or
 * revoke, and the capstone workspace's lifecycle ending does not invalidate
 * anything already accrued. Nothing here is scoped to the workspace's lifetime.
 *
 * ── ADMITTED IS NOT ACCRUED (the dependency, recorded rather than stubbed) ──
 *
 * V-10's signals do not yet flow into the Standing accrual service: Slice C is
 * the deferred work that defines how an admitted signal maps into Personal /
 * Delegated / Stewardship / Capability Standing. So this module produces an
 * ADMISSION DECISION and stops there. It writes nothing, accrues nothing, and
 * returns no score. An admitted-but-unaccrued signal is honest; a fake accrual
 * that appears to work is not, and would be the harder defect to find later.
 */

import {
  evaluateStandingSignal,
  PERMITTED_STANDING_BASES,
  type StandingSignalInput,
} from '@/services/venture/trading/standingAdmission';
import type { StandingContributionType, StandingLane, StandingSignalDecision } from '@/services/venture/trading/types';

/**
 * The bases a RESEARCH contribution may claim — a FILTERED SUBSET of the gate's
 * own permitted table, never a second list. Deriving it means a basis renamed
 * or removed upstream cannot leave a stale entry here quietly claiming
 * something the gate would refuse.
 *
 * The operator's family, mapped onto the gate's existing vocabulary. Five of
 * the seven already existed and are REUSED rather than renamed:
 *
 *   correctness                          → `correctness`
 *   veracity                             → `veracity`
 *   proof quality                        → `proof-quality`
 *   reproducibility                      → `reproducibility`
 *   reliability                          → `service-reliability`
 *   compliance with declared scope       → `authority-compliance`
 *                                          + `no-unauthorised-expansion`
 *   honest negative / null result        → `negative-result-reporting`  (new)
 *
 * `constitutional-completeness` is included because the completeness verdict is
 * the same constitutional property in both domains. `correct-refusal`,
 * `risk-detection` and `reconciliation-quality` are venture-shaped and are NOT
 * offered to a research claim — a narrower set is the fail-closed direction, and
 * an unlisted basis is refused by the gate as unrecognised.
 */
const RESEARCH_BASIS_IDS = [
  'correctness',
  'veracity',
  'proof-quality',
  'constitutional-completeness',
  'reproducibility',
  'service-reliability',
  'authority-compliance',
  'no-unauthorised-expansion',
  'negative-result-reporting',
] as const;

export const PERMITTED_RESEARCH_STANDING_BASES: StandingContributionType[] = (
  Object.keys(PERMITTED_STANDING_BASES) as StandingContributionType[]
).filter((b) => (RESEARCH_BASIS_IDS as readonly string[]).includes(b));

export interface StudentContributionInput {
  /** Server-internal contribution id — correlation only, never emitted. */
  contributionId: string;
  /** The student project workspace this contribution was made in. */
  workspaceId: string;
  /**
   * The STUDENT's commitment — `personaPublicRef(personaId)`. A raw persona id
   * is refused by the gate, not sanitised: sanitising would let the caller keep
   * the broken habit.
   */
  contributorRef: string;
  /** The bases the claim rests on. */
  proposedBases: string[];
  /** Evidence backing the claim. A claim with no evidence is inadmissible. */
  evidenceRefs: string[];
  /**
   * Whether the contribution was VERIFIED. Absent means not yet assessed, and
   * the gate then admits on bases + evidence alone; `{ complete: false }` is a
   * contribution that did not constitutionally complete and earns nothing.
   */
  verdict?: StandingSignalInput['verdict'];
  /**
   * Which lane the credit would land in. Defaults to `personal`: a student's
   * capstone work is their own, not delegated to them and not stewardship.
   */
  lane?: StandingLane;
}

/**
 * Decide whether a student contribution may enter Standing, and at what weight.
 *
 * DELEGATES ENTIRELY. There is no research-specific branch: the same partition,
 * the same evidence requirement, the same completeness clause, the same weight
 * expression with no count term in it.
 *
 * The returned decision is NOT an accrual (see the Slice C note in the header).
 */
export function evaluateStudentContribution(
  input: StudentContributionInput,
): StandingSignalDecision {
  return evaluateStandingSignal({
    subjectId: input.contributionId,
    domain: 'research-contribution',
    agentRef: input.contributorRef,
    proposedBases: input.proposedBases,
    lane: input.lane ?? 'personal',
    evidenceRefs: input.evidenceRefs,
    verdict: input.verdict,
  });
}

/**
 * Slice C is the named gate before any admitted decision becomes an accrual.
 * Exported as a VALUE so a caller that tries to accrue can be made to read it,
 * and so a canary can assert the dependency is recorded rather than forgotten.
 */
export const STANDING_ACCRUAL_DEPENDENCY =
  'Slice C — how an admitted signal maps into Personal / Delegated / Stewardship / Capability Standing. Until it lands, an admitted student contribution is an observation, not an accrual.';
