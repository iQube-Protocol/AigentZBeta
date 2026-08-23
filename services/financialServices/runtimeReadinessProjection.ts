/**
 * RuntimeReadinessProjection — a DERIVED, read-only UI projection for a
 * Runtime-class Financial Service (2026-08-23 operator directive).
 *
 * Pre-Vela, a Confidential Runtime request resolves `UNRESOLVED` (no live
 * `NITRO_ATTESTED` deployment exists yet — Stage 3.3,
 * `docs/vela/VELA_EARLY_ACCESS_HANDOFF.md` §9). The operator's instruction:
 * "The desired pre-Vela UI is not generic UNRESOLVED. It should make the
 * layered readiness visible: Eligibility: ready, Standing: ready, Authority:
 * ready/pending, Confidential execution: Vela Live attestation pending."
 *
 * This module composes exactly that — FOUR independent facts, decomposed
 * from state ALREADY resolved elsewhere (`FinancialServiceAgentContext`,
 * `FinancialServiceAuthorityPrerequisite`) — it performs NO reads of its own
 * and computes NO new authority/eligibility/authorisation decision. It is
 * explicitly NOT a new frozen constitutional state (operator: "do not invent
 * a new frozen constitutional state") — a caller that ignores this
 * projection and reads `eligibility.eligible`/`authority.state` directly
 * gets the exact same underlying facts, unchanged.
 */

import type { FinancialServiceAgentContext } from './agentEligibilityContext';
import type { FinancialServiceAuthorityPrerequisite } from './discovery';
import type { FinancialServiceDefinition } from '@/types/financialServices';

export type ReadinessState = 'ready' | 'not-ready' | 'pending' | 'unresolved' | 'not-required';

export interface RuntimeReadinessProjection {
  eligibility: ReadinessState;
  standing: ReadinessState;
  authority: ReadinessState;
  confidentialExecution: ReadinessState;
}

/**
 * Only meaningful for a service whose `executionPolicy.executionReachable`
 * is `true` (i.e. a Runtime-class definition) — the caller decides whether
 * to compute/attach this; Advisor/Architect/Constitutional-Runtime never
 * reach real VELA authorisation, so this projection is not offered for them.
 */
export function deriveRuntimeReadinessProjection(
  context: FinancialServiceAgentContext,
  definition: FinancialServiceDefinition,
  authority: FinancialServiceAuthorityPrerequisite | null,
): RuntimeReadinessProjection {
  // ── Eligibility: admission + structural assignment only — Standing is its
  //    own row below, never folded in here, so a reader can tell "not yet
  //    admitted" apart from "admitted, but Standing too low". ──────────────
  let eligibility: ReadinessState;
  if (context.admission === undefined || context.structurallyAssigned === undefined) {
    eligibility = 'unresolved';
  } else if (context.admission.registryActivated === true && context.structurallyAssigned === true) {
    eligibility = 'ready';
  } else {
    eligibility = 'not-ready';
  }

  // ── Standing: only meaningful when this service declares a floor. ───────
  let standing: ReadinessState;
  if (definition.eligibilityPolicy.minimumStandingScore === null) {
    standing = 'not-required';
  } else if (!context.standingPersonaId || !context.standing) {
    standing = 'unresolved';
  } else {
    standing = context.standing.score >= definition.eligibilityPolicy.minimumStandingScore ? 'ready' : 'not-ready';
  }

  // ── Authority: reuses the ALREADY-computed prerequisite verbatim. ────────
  let authorityState: ReadinessState;
  if (!authority) {
    authorityState = 'unresolved';
  } else if (authority.state === 'ACTIVE') {
    authorityState = 'ready';
  } else {
    authorityState = 'pending';
  }

  // ── Confidential execution: honest and static until Stage 3.3 ships a
  //    real NITRO_ATTESTED deployment — never fabricated as 'ready'. A
  //    service that does not require attestation at all reports
  //    'not-required' (e.g. Constitutional Runtime), never a confusing
  //    'pending' for a gate it was never subject to. ────────────────────────
  const confidentialExecution: ReadinessState =
    definition.attestationRequirement === 'REQUIRED' ? 'pending' : 'not-required';

  return { eligibility, standing, authority: authorityState, confidentialExecution };
}
