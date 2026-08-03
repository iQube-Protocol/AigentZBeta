/**
 * The nominal Standing awarded for a completed iQube Registry registration.
 *
 * ── THE OPERATOR'S CORRECTION (2026-08-03) ───────────────────────────────
 *
 * I had removed `standing_accrued` from the ingestion stage entirely, on the
 * grounds that "Ingested into Factory ≠ Standing accrued". That was too
 * absolute, and the operator corrected it:
 *
 *   > "Factory ingestion can earn a nominal initial Standing award because
 *   >  registration is itself a consequential, receipted action — not merely
 *   >  passive eligibility. … The important safeguard is not 'no Standing on
 *   >  ingestion.' It is: Admission Standing must be distinguishable from
 *   >  earned performance Standing."
 *
 * The voter-registration analogy is theirs and is exact: registering is not
 * civic contribution equivalent to voting or public service, but it is a
 * constitutionally meaningful act that establishes participation and may
 * justify a modest initial grant.
 *
 * So the sequence is:
 *
 *   Registered in iQube Registry -> Standing ELIGIBLE
 *                                -> NOMINAL onboarding Standing accrued
 *   Subsequent validated contribution -> ADDITIONAL Standing accrued
 *
 * ── WHY THE SEED IS 1, AND NOT A ROUND NUMBER SOMEONE LIKED ──────────────
 *
 * Derived from the accrual service's own live constants
 * (`services/crm/standingAccrualService.ts`), not invented:
 *
 *   BUCKET_STEP        = 25   — one Standing bucket
 *   STANDING_THRESHOLD = 50   — bucket 2, "earned Standing"
 *   STANDING_CVS_FACTOR = 1   — contribution accrues 1:1 with CVS
 *
 * A seed of 1 is 2% of the earned threshold and 4% of a single bucket. The
 * property that matters is structural rather than cosmetic: because
 * `bucketFor(overall) = floor(overall / 25)`, a seed of 1 CANNOT move an
 * agent off bucket 0 on its own. Registration therefore cannot confer a
 * Standing tier, cross the earned-Standing threshold, or unlock anything
 * gated on a bucket. It is visible, real, and inert with respect to
 * authority — which is precisely what "nominal" has to mean to be safe.
 *
 * If BUCKET_STEP or STANDING_THRESHOLD ever change, the canary in
 * `tests/journey-admission-spine.test.ts` re-checks that property rather than
 * trusting this comment.
 */

/**
 * The one-time award for a constitutionally valid registration act.
 * Nominal by construction: strictly less than one bucket step.
 */
export const REGISTRATION_SEED_STANDING = 1;

/**
 * The basis code that keeps admission Standing distinguishable from earned
 * performance Standing FOREVER — the operator's actual safeguard. Any surface
 * reporting Standing must be able to separate these, so the basis is recorded
 * on the accrual rather than inferred later from timing or amount.
 */
export const REGISTRATION_SEED_BASIS = 'iqube_registry_registration' as const;

/** `initial` is admission; everything earned by validated work is `contribution`. */
export type StandingTier = 'initial' | 'contribution';

export interface RegistrationStandingSeed {
  amount: number;
  basis: typeof REGISTRATION_SEED_BASIS;
  tier: StandingTier;
  /** Always false — the award is one-time, agent-bound, and idempotent. */
  repeatable: false;
  /**
   * What this award does NOT assert. Carried on the record because a bare
   * number invites exactly the reading the operator is guarding against.
   */
  impliesPerformance: false;
}

export const REGISTRATION_STANDING_SEED: RegistrationStandingSeed = {
  amount: REGISTRATION_SEED_STANDING,
  basis: REGISTRATION_SEED_BASIS,
  tier: 'initial',
  repeatable: false,
  impliesPerformance: false,
};

/**
 * ── IDEMPOTENCY IS STRUCTURAL, NOT A CALLER'S RESPONSIBILITY ─────────────
 *
 * "Registration cannot be repeatedly farmed for Standing; the award must be
 * one-time, personhood/agent-bound, and idempotent." A caller that simply
 * remembers not to call twice is not idempotent — a refresh, a retry, a
 * second observer or a re-read would each re-award.
 *
 * So the award is gated on a SETTLED FACT (`services/journey/settledFacts.ts`
 * predicate `registry_standing_seeded`). `settleFact` returns
 * `alreadySettled: true` for a second settlement and does not overwrite, so
 * the seed can be attempted any number of times and lands exactly once. This
 * reuses the layer built for "is_registered" rather than inventing a second
 * dedup mechanism (inv.engineering.036/037).
 *
 * The caller's contract:
 *
 *   1. The registry act must be RECEIPTED first (`capability_registered`).
 *      Standing is never awarded before the act it rewards is recorded.
 *   2. Then settle `registry_standing_seeded`.
 *   3. Award ONLY when `alreadySettled === false`.
 *
 * A failed or incomplete ingestion never reaches step 2, so it never accrues.
 */
export function shouldAwardRegistrationSeed(settlement: { ok: boolean; alreadySettled?: boolean }): boolean {
  return settlement.ok === true && settlement.alreadySettled === false;
}
