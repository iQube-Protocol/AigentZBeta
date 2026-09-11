/**
 * Action Authorisation — the terminal derivation the Authorisation Plane
 * performs (VELA-001 Slice 2F).
 *
 * Consequential Authority ∩ Acceptable Consequence Projection = Action
 * Authorised.
 *
 * This is a SEPARATE, downstream step from `invokeCapability()`'s Gate 2
 * check. Gate 2 passing (`decision: 'allow'`) is a GOVERNANCE-layer
 * permission to dispatch a capability invocation — it is necessary but never
 * sufficient for a financial-domain authorisation. This module is what
 * actually derives `ActionAuthorisation`, and it independently re-checks the
 * projection's disposition rather than trusting the gate's decision as a
 * substitute — the same "don't flatten provenance into one score" discipline
 * `unifiedConsequenceProjection.ts` applies to projections applies here to
 * authorisation.
 *
 * Owned by neither CFS-006a nor Vela, same as the composition seam it
 * consumes — shared substrate for Vela, Ian, Conditional Commerce and later
 * Qriptosentience.
 *
 * Server-side only.
 */

import { createHash } from 'crypto';
import type {
  ActionAuthorisation,
  ConsequenceProjection,
  ConstitutionalAuthority,
} from '@/types/constitutionalCommerce';
import type { InvocationDecision } from '@/types/capabilityInvocation';

function ref(namespace: string, value: string): string {
  return createHash('sha256').update(namespace).update(value).digest('hex').slice(0, 32);
}

export interface DeriveActionAuthorisationInput {
  authority: ConstitutionalAuthority;
  projection: ConsequenceProjection;
  /** The result of the SAME invokeCapability() call the projection was attached to. */
  invocationDecision: InvocationDecision;
  /** ISO timestamp; only ever supplied by the caller (never `new Date()` inside this pure function) so tests are deterministic. */
  now: string;
  /** How long an AUTHORISED action stays current, in seconds. Default 300 (5 minutes) — a short window, since Execution requires a CURRENT authorisation. */
  ttlSeconds?: number;
}

/**
 * Derive an `ActionAuthorisation` from constitutional authority, a unified
 * consequence projection, and the gate decision that governed the invocation
 * carrying that projection.
 *
 * Every branch is named so the reasoning is auditable:
 *
 *  - authority not ACTIVE            → REFUSED (no authority, independent of projection)
 *  - gate refused for any OTHER      → REFUSED (a governance refusal blocks the action)
 *    reason than CONSEQUENCE_PROJECTION_UNRESOLVED
 *  - gate refused specifically       → UNRESOLVED (nothing was established — not a
 *    CONSEQUENCE_PROJECTION_UNRESOLVED  refusal of the action, an inability to decide)
 *  - projection itself UNACCEPTABLE  → REFUSED (independent re-check — never trust
 *    (even if the gate somehow allowed) the gate blindly)
 *  - projection itself not COMPLETE  → UNRESOLVED (an incomplete picture may not
 *    or otherwise not ACCEPTABLE       become an authorisation)
 *  - gate decision 'shadow-only'     → REFUSED (shadow execution never authorises
 *                                       the real action)
 *  - gate decision 'allow-with-approval' → UNRESOLVED (pending human approval —
 *                                       not yet authorised, not refused either)
 *  - authority ACTIVE + projection ACCEPTABLE + gate 'allow' → AUTHORISED
 */
export function deriveActionAuthorisation(
  input: DeriveActionAuthorisationInput,
): ActionAuthorisation {
  const { authority, projection, invocationDecision, now, ttlSeconds = 300 } = input;

  const base = {
    authorisationRef: ref(
      'authorisation:',
      `${projection.projectionRef}|${authority.mandateRef}|${invocationDecision.decision}`,
    ),
    authorityRef: projection.authorityRef,
    mandateRef: projection.mandateRef,
    projectionRef: projection.projectionRef,
    actionRef: projection.actionRef,
  };

  if (authority.state !== 'ACTIVE') {
    return { ...base, status: 'REFUSED' };
  }

  if (invocationDecision.decision === 'refuse') {
    if (invocationDecision.code === 'CONSEQUENCE_PROJECTION_UNRESOLVED') {
      return { ...base, status: 'UNRESOLVED' };
    }
    // Any other refusal (identity/authority gate, depth guard,
    // CONSEQUENCE_PROJECTION_UNACCEPTABLE, MODE_NOT_PERMITTED, ...) is a
    // governance-established block — REFUSED, not UNRESOLVED.
    return { ...base, status: 'REFUSED' };
  }

  // Independent re-check: never derive AUTHORISED from "the gate said allow"
  // without separately confirming the projection itself is ACCEPTABLE and
  // COMPLETE. This is the same discipline as the composition module never
  // trusting a provider's disposition without its own protocol/attestation
  // checks.
  if (projection.disposition === 'UNACCEPTABLE') {
    return { ...base, status: 'REFUSED' };
  }
  if (projection.disposition !== 'ACCEPTABLE' || projection.completeness !== 'COMPLETE') {
    return { ...base, status: 'UNRESOLVED' };
  }

  if (invocationDecision.decision === 'shadow-only') {
    return { ...base, status: 'REFUSED' };
  }
  if (invocationDecision.decision === 'allow-with-approval') {
    return { ...base, status: 'UNRESOLVED' };
  }

  // decision === 'allow', authority ACTIVE, projection ACCEPTABLE + COMPLETE.
  const expiresAt = new Date(new Date(now).getTime() + ttlSeconds * 1000).toISOString();
  return { ...base, status: 'AUTHORISED', expiresAt };
}
