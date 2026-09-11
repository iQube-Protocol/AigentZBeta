/**
 * COHORT AUTHORIZATION — partial progress must produce a DURABLE, AUDITABLE
 * receipt (operator ruling, 2026-08-03 §4).
 *
 *   > "The system should not merely hide exceptions and continue visually."
 *   > "That makes progressive completion scientifically auditable rather than
 *   >  a convenience bypass."
 *
 * ── Why the per-record receipt is not enough ────────────────────────────────
 *
 * Every admitted source already gets its own receipt. That records what
 * happened to each record; it does NOT record that a SUBSET was chosen, which
 * records were left out, why, or who authorised proceeding without them.
 *
 * The executable subset is itself an authorized act. If exception isolation is
 * to be "scientifically auditable rather than a convenience bypass", the
 * subset needs a record that can be checked afterwards — including a
 * **cohort hash**, so a later reader can prove which exact set of records was
 * authorised and detect any substitution.
 *
 * ── The population guardrail rides here too (ruling §5) ────────────────────
 *
 * The receipt carries the FULL population, not just what advanced. Isolating
 * exceptions must never let the corpus be quietly reduced until readiness
 * passes; a receipt that recorded only the 29 admitted sources and not the 47
 * discovered would be exactly that quiet reduction, notarised.
 *
 * Server-side: uses `node:crypto` for the cohort commitment, which is why this
 * is a separate module from the isomorphic `exceptionIsolation.ts`.
 */

import { createHash } from 'crypto';
import { personaPublicRef } from '@/services/identity/personaReferences';
import type {
  IsolationCounts,
  IsolationException,
  PopulationDisclosure,
} from '@/services/research/exceptionIsolation';
import { renderPopulationDisclosure } from '@/services/research/exceptionIsolation';

/**
 * A deterministic commitment to the exact set of records an act authorised.
 *
 * Order-independent (the ids are sorted first) so the same cohort selected in
 * a different order hashes the same — the identity being committed to is the
 * SET, not the click order. Namespaced like every other commitment in this
 * codebase so it can never collide with a locker ref or a persona ref.
 *
 * Deliberately NOT a T0-bearing value: record ids here are source ids,
 * candidate ids and invariant ids — never a personaId.
 */
export function computeCohortHash(recordIds: readonly string[]): string {
  const canonical = [...recordIds].map((id) => id.trim()).filter(Boolean).sort().join('\n');
  return createHash('sha256').update(`research:cohort:${canonical}`).digest('hex').slice(0, 32);
}

export interface CohortAuthorizationInput {
  stage: string;
  /** The domain/corpus the act writes to — recorded so a later reader can see
   *  the act did not target a different corpus than the one displayed. */
  target: string;
  /** The records that ADVANCED. */
  executableRecordIds: readonly string[];
  counts: IsolationCounts;
  /** Every exception, with its own reason — "why each was excluded". */
  exceptions: readonly IsolationException[];
  /** The warnings a steward ACCEPTED by admitting the ready-with-warning
   *  cohort. Recorded because accepting a warning is a decision, and a
   *  decision that leaves no trace is indistinguishable from not having
   *  noticed. */
  acceptedWarnings: readonly { recordId: string; warnings: readonly string[] }[];
  /** The full population — never only what advanced (ruling §5). */
  population: PopulationDisclosure;
  /** The authorizing steward. Converted to a `personaPublicRef` commitment
   *  before it reaches the receipt — a raw personaId is T0 and must never be
   *  serialised (CLAUDE.md identity spine). */
  personaId: string;
  /** The steward's stated reason for proceeding with the subset. */
  rationale: string;
}

export interface CohortAuthorizationRecord {
  stage: string;
  target: string;
  cohortHash: string;
  authorizedBy: string;
  counts: IsolationCounts;
  advancedRecordIds: string[];
  exclusions: { recordId: string; disposition: string; cause: string; causeGroup: string }[];
  acceptedWarnings: { recordId: string; warnings: string[] }[];
  population: PopulationDisclosure;
  rationale: string;
  /** The human-readable form written onto the receipt summary. */
  summary: string;
}

/**
 * Build the authorization record for ONE partial-progress act. Pure apart from
 * the hash — it writes nothing; the caller passes `summary` to the existing
 * `writeLifecycleReceipt`, so no second receipt mechanism is introduced
 * (inv.engineering.036/037).
 */
export function buildCohortAuthorization(input: CohortAuthorizationInput): CohortAuthorizationRecord {
  const cohortHash = computeCohortHash(input.executableRecordIds);
  const authorizedBy = personaPublicRef(input.personaId);
  const exclusions = input.exceptions.map((e) => ({
    recordId: e.recordId,
    disposition: e.disposition,
    cause: e.cause,
    causeGroup: e.causeGroup,
  }));
  const acceptedWarnings = input.acceptedWarnings
    .filter((w) => w.warnings.length > 0)
    .map((w) => ({ recordId: w.recordId, warnings: [...w.warnings] }));

  const summary =
    `${input.stage} — partial-progress cohort authorized over '${input.target}'. ` +
    `Cohort ${cohortHash} (${input.counts.executable} record(s): ` +
    `${input.counts.ready} ready, ${input.counts.readyWithWarning} ready-with-warning) ` +
    `authorized by ${authorizedBy}. ` +
    `Advanced: ${input.executableRecordIds.join(', ') || '(none)'}. ` +
    (exclusions.length > 0
      ? `Excluded — ${exclusions.map((x) => `${x.recordId} (${x.disposition}, ${x.causeGroup}): ${x.cause}`).join('; ')}. `
      : 'Excluded: none. ') +
    (acceptedWarnings.length > 0
      ? `Warnings accepted — ${acceptedWarnings.map((w) => `${w.recordId}: ${w.warnings.join(' | ')}`).join('; ')}. `
      : 'Warnings accepted: none. ') +
    // The FULL population rides on every partial-progress receipt, so a
    // technically-passing but materially narrow crystal can never look
    // complete to whoever reads this later (ruling §5).
    `Population — ${renderPopulationDisclosure(input.population)}. ` +
    `Rationale: ${input.rationale}`;

  return {
    stage: input.stage,
    target: input.target,
    cohortHash,
    authorizedBy,
    counts: input.counts,
    advancedRecordIds: [...input.executableRecordIds],
    exclusions,
    acceptedWarnings,
    population: input.population,
    rationale: input.rationale,
    summary,
  };
}
