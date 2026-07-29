/**
 * VL-CT-001 reference derivation — the T0/T2 boundary for the venture substrate.
 *
 * Every `*Ref` and `*Commitment` field on every substrate type is derived here.
 * A raw `personaId` must NEVER reach a ledger row, a receipt payload, a budget
 * record or any chain-bound field (CLAUDE.md Identity & Access Spine + HMS
 * Identifier Isolation). This module is deliberately the ONLY place the
 * substrate is allowed to touch an identifier at all, so the canary that greps
 * for UUID shapes in emitted records has exactly one seam to guard.
 *
 * These are compositions of the canonical derivations in
 * `services/identity/personaReferences.ts` — NOT a second hashing scheme
 * (inv.engineering.036/037):
 *   - persona-class identifiers → `personaPublicRef` (the level-2 Polity Public
 *     Reference that already appears in every DVN receipt written to date;
 *     re-deriving it would break correlation with all of them);
 *   - everything else → `constitutionalRef(namespace, id)`, whose namespace
 *     prefix stops a delegation id and an opportunity id that happen to share a
 *     UUID from collapsing into one indistinguishable ref.
 */

import { constitutionalRef, personaPublicRef } from '@/services/identity/personaReferences';

/** Principal (the human on whose behalf the opportunity is evaluated). */
export function venturePrincipalRef(personaId: string): string {
  return personaPublicRef(personaId);
}

/** A participating agent — an agent persona is still a persona. */
export function ventureAgentRef(agentPersonaId: string): string {
  return personaPublicRef(agentPersonaId);
}

/** The operator-funded budget holder. */
export function ventureFunderRef(funderPersonaId: string): string {
  return personaPublicRef(funderPersonaId);
}

/** A bounded-delegation grant authorising an agent on this opportunity. */
export function ventureDelegationRef(grantId: string): string {
  return constitutionalRef('venture:delegation', grantId);
}

/** The opportunity's own reference, for receipt payloads. */
export function ventureOpportunityRef(opportunityId: string): string {
  return constitutionalRef('venture:opportunity', opportunityId);
}

/** Provenance commitment over where the opportunity came from. */
export function ventureSourceCommitment(source: string): string {
  return constitutionalRef('venture:source', source);
}

/** Obligation reference for receipts (the ledger row id stays server-internal). */
export function ventureObligationRef(obligationId: string): string {
  return constitutionalRef('venture:obligation', obligationId);
}

/**
 * Amount commitment for restricted-disclosure receipts (R-8): the receipt
 * carries a commitment plus a private ledger reference instead of the raw
 * amount. Deterministic — the same amount in the same denomination always
 * commits to the same value, so a later disclosure can be checked against it.
 */
export function ventureAmountCommitment(
  amountMinorUnits: string,
  denomination: string,
): string {
  return constitutionalRef('venture:amount', `${denomination}:${amountMinorUnits}`);
}

/** Private (server-internal) ledger reference paired with an amount commitment. */
export function venturePrivateLedgerRef(obligationId: string): string {
  return constitutionalRef('venture:ledger', obligationId);
}

/**
 * "This looks like a raw identifier" now lives with the reference derivations in
 * `services/identity/personaReferences.ts`, so the venture substrate, the
 * QriptoCENT settlement substrate and every leakage canary share ONE definition
 * rather than regexes that can drift apart. Re-exported from here because this
 * module is where the venture substrate's callers and canaries already look.
 */
export { RAW_UUID_PATTERN, containsRawIdentifier } from '@/services/identity/personaReferences';
