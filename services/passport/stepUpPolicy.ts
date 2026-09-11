/**
 * Holder-control step-up policy — the canonical risk→grade binding.
 *
 * PRD-PAG-001 Amendment A §A.6 level 3 (ratified 2026-07-27, operator:
 * "ratified - build"). The graded personhood ladder
 * (`services/passport/personhoodProof.ts`) and the Constitutional Agreement
 * gate (`requireAuthorizedAgreement`) both exist; what was unstated is WHICH
 * consequence requires WHICH grade. This module is that binding — the single
 * authoritative table. Nothing else may hand-roll a second one
 * (inv.engineering.036/037); `tests/passport-step-up-policy.test.ts` pins it.
 *
 * The charter's rule, verbatim:
 *
 * > additional passkey enrolment is optional for ordinary access;
 * > cryptographic holder-control proof is not optional; step-up is mandatory
 * > where consequence requires it.
 *
 * ── THE GRADE ORDER, derived from the existing ladder's semantics ──────────
 *
 * This is NOT a parallel ladder: it composes the existing
 * `PersonhoodProofType` union plus the passkey holder-control proof (§A.6
 * level 2), and ranks by what each proof actually establishes:
 *
 *   - `agent_declaration` / `captcha` — liveness / not-a-script. The weakest
 *     rung; either satisfies ordinary access ("passkey enrolment is optional
 *     for ordinary access").
 *   - `passkey` / `operator_attestation` — cryptographic holder-control of a
 *     specific credential, or a human steward vouching. Stronger than
 *     liveness, but neither establishes UNIQUENESS of the human.
 *   - `world_id` — the only proof in the ladder that carries a uniqueness
 *     nullifier. Uniquely top-ranked, which is exactly why the shipped
 *     money-moving gate (`hasVerifiedWorldIdPassport`, CLAUDE.md "Worldcoin
 *     keys" + CFS-043 §6) checks World ID SPECIFICALLY and nothing weaker —
 *     ranking any other proof at or above it would let that proof satisfy a
 *     money-moving requirement and silently widen the shipped gate.
 *
 * ── CONSEQUENCE CLASSES ────────────────────────────────────────────────────
 *
 *   read / write          → ordinary access; the weak rung suffices.
 *   delegation_grant      → granting an agent authority is consequential:
 *                           holder-control proof required (level 2). The
 *                           money-moving CAPABILITY inside a delegation is
 *                           gated separately at world_id by the shipped
 *                           `requireAuthorizedAgreement` + PROOF_REQUIREMENT
 *                           path — this class does not weaken that.
 *   money_moving          → world_id. Pinned by the existing gate; canaried.
 *   consolidation         → world_id. Passport consolidation (§A.5) is BY
 *                           DEFINITION keyed off the high-assurance
 *                           uniqueness proof — merging lineages on anything
 *                           weaker would let a non-unique proof join two
 *                           humans' passports. `passportLineage.ts` declares
 *                           itself under this class and checks this policy.
 *
 * This module describes; it never executes. Callers evaluate
 * `satisfies(proof, requiredGradeFor(class))` and refuse when false.
 */

import type { PersonhoodProofType } from './personhoodProof';

/**
 * A proof a holder can present. Composes the existing personhood ladder plus
 * the WebAuthn passkey holder-control proof (§A.6 level 2) — no parallel enum
 * of the personhood types themselves.
 */
export type HolderProofGrade = PersonhoodProofType | 'passkey';

export type ConsequenceClass =
  | 'read'
  | 'write'
  | 'money_moving'
  | 'delegation_grant'
  | 'consolidation';

/**
 * Rank by what the proof establishes (see the module header). Higher rank
 * satisfies every lower requirement — monotonicity is canaried.
 */
export const GRADE_RANK: Readonly<Record<HolderProofGrade, number>> = {
  agent_declaration: 1,
  captcha: 1,
  passkey: 2,
  operator_attestation: 2,
  world_id: 3,
};

/**
 * THE canonical risk→grade table. The single source of truth — tests pin it;
 * derive from it, never copy it.
 */
export const STEP_UP_POLICY: Readonly<Record<ConsequenceClass, HolderProofGrade>> = {
  read: 'captcha',
  write: 'captcha',
  delegation_grant: 'passkey',
  money_moving: 'world_id',
  consolidation: 'world_id',
};

/** The minimum proof grade a consequence class requires. */
export function requiredGradeFor(consequenceClass: ConsequenceClass): HolderProofGrade {
  return STEP_UP_POLICY[consequenceClass];
}

/**
 * Whether a presented proof satisfies a required grade. A higher grade always
 * satisfies a lower requirement; an equal grade satisfies itself.
 */
export function satisfies(proofType: HolderProofGrade, requiredGrade: HolderProofGrade): boolean {
  return GRADE_RANK[proofType] >= GRADE_RANK[requiredGrade];
}
