/**
 * QriptoCENT settlement reference derivation — the T0/T2 boundary.
 *
 * Every `*Ref` on a settlement record, a receipt payload or a reconciliation
 * report is derived HERE. A raw `personaId` must NEVER reach a settlement row, a
 * DVN receipt payload, a settlement message or any chain-bound field (CLAUDE.md
 * Identity & Access Spine + HMS Identifier Isolation). This module is
 * deliberately the ONLY place the substrate touches an identifier, so the
 * leakage canary has exactly one seam to guard.
 *
 * These are COMPOSITIONS of the canonical derivations in
 * `services/identity/personaReferences.ts` — not a second hashing scheme
 * (inv.engineering.036/037), and the same pattern the venture substrate uses in
 * `services/venture/trading/refs.ts`:
 *   - persona-class identifiers → `personaPublicRef` (the level-2 Polity Public
 *     Reference that already appears in every DVN receipt written to date);
 *   - everything else → `constitutionalRef(namespace, id)`, whose namespace
 *     prefix stops a delegation id and a settlement id that happen to share a
 *     UUID from collapsing into one indistinguishable ref.
 *
 * A settlement message crosses a PUBLIC network boundary, so the tier rule bites
 * harder here than almost anywhere: an observer who could correlate two
 * settlement messages by a raw payer id could reconstruct a payment graph across
 * both ledgers.
 */

import { constitutionalRef, personaPublicRef } from '@/services/identity/personaReferences';

/** The paying principal. */
export function settlementPayerRef(personaId: string): string {
  return personaPublicRef(personaId);
}

/** The beneficiary principal. */
export function settlementBeneficiaryRef(personaId: string): string {
  return personaPublicRef(personaId);
}

/** The authority that authorised a liquidity advance — still a persona. */
export function settlementAuthorityRef(personaId: string): string {
  return personaPublicRef(personaId);
}

/** The bounded-delegation grant authorising this payment. */
export function settlementDelegationRef(grantId: string): string {
  return constitutionalRef('qriptocent:delegation', grantId);
}

/** The payment instruction's exactly-once identity. */
export function settlementInstructionRef(instructionId: string): string {
  return constitutionalRef('qriptocent:instruction', instructionId);
}

/** The source-ledger debit. */
export function settlementSourceDebitRef(debitId: string): string {
  return constitutionalRef('qriptocent:source-debit', debitId);
}

/** The DVN settlement message. */
export function settlementMessageRef(messageId: string): string {
  return constitutionalRef('qriptocent:dvn-message', messageId);
}

/** The destination-ledger credit. */
export function settlementCreditRef(creditId: string): string {
  return constitutionalRef('qriptocent:destination-credit', creditId);
}

/** An authorised liquidity advance. */
export function settlementAdvanceRef(advanceId: string): string {
  return constitutionalRef('qriptocent:liquidity-advance', advanceId);
}

// ─── The fee / market-fact split (operator ruling, 2026-07-29) ──────────────
//
// Each of these gets its OWN namespace rather than sharing one. A charging
// service and the venue it quotes against are different kinds of thing, and a
// disclosure that could not tell them apart would let a provider name itself as
// the venue whose movement supposedly justified its retained spread.

/** The service or liquidity provider that CHARGES an attributed fee. */
export function settlementProviderRef(providerId: string): string {
  return constitutionalRef('qriptocent:fee-provider', providerId);
}

/** The accelerated service or liquidity advance a timing fee pays for. */
export function settlementServiceRef(serviceId: string): string {
  return constitutionalRef('qriptocent:accelerated-service', serviceId);
}

/** The quote presented to the payer BEFORE authorisation. */
export function settlementQuoteRef(quoteId: string): string {
  return constitutionalRef('qriptocent:fee-quote', quoteId);
}

/** An external market venue — the subject of an observation, never a charger. */
export function settlementVenueRef(venueId: string): string {
  return constitutionalRef('qriptocent:market-venue', venueId);
}

/** The payer's recorded acceptance of an off-parity external execution path. */
export function settlementExecutionAuthorisationRef(authorisationId: string): string {
  return constitutionalRef('qriptocent:external-execution-authorisation', authorisationId);
}

/**
 * The replay nonce carried by a settlement message. Derived from the
 * instruction id AND the settlement id, so a nonce is meaningless outside the
 * one settlement it belongs to — a nonce lifted from another settlement's
 * message will not match and the message is refused.
 */
export function settlementNonce(instructionId: string, settlementId: string): string {
  return constitutionalRef('qriptocent:nonce', `${instructionId}:${settlementId}`);
}

/**
 * Re-exported from the identity module so this substrate's canaries and its
 * emitter share ONE definition of "this looks like a raw identifier" with the
 * venture substrate rather than three regexes that can drift apart.
 */
export { RAW_UUID_PATTERN, containsRawIdentifier } from '@/services/identity/personaReferences';
