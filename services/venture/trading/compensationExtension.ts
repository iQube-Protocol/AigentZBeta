/**
 * R-8 — the versioned partner-service compensation extension to the DVN receipt
 * payload.
 *
 * A correct refusal must be representable on-chain as:
 *
 *     service completed constitutionally
 *     execution declined
 *     compensation earned
 *
 * and NEVER as a failed trade. An encoding that can only say "the trade did not
 * happen" cannot express the thing H3 is about (charter §8.8). Hence
 * `classification`, which is a first-class field with `refusal` as a SUCCESS
 * value, not an absence.
 *
 * ─── Scope discipline ───────────────────────────────────────────────────────
 *
 * This is a NAMED, VERSIONED extension carried inside the receipt's own payload
 * — not generic financial fields sprayed across every DVN receipt. Receipts
 * that carry no compensation carry no extension, and older receipts stay
 * readable because the version is explicit. The pipeline's payload construction,
 * state machine and `hashPersonaRef` are untouched: this module BUILDS an
 * object that a receipt carries, it does not modify
 * `services/dvn/activityReceiptDvnPipeline.ts`. The only change made there is
 * adding members to `ANCHORABLE_ACTION_TYPES`, which is the one unilateral
 * change CLAUDE.md permits.
 *
 * ─── Restricted disclosure ──────────────────────────────────────────────────
 *
 * Where disclosure is restricted, the extension carries an **amount commitment
 * plus a private ledger reference** instead of the raw amount. The commitment
 * is deterministic over (denomination, amount), so a later authorised
 * disclosure can be checked against what was anchored — which is the property
 * that makes withholding the figure an act of confidentiality rather than of
 * unverifiability.
 *
 * ─── T0/T2 ──────────────────────────────────────────────────────────────────
 *
 * Every identifier on the extension is a COMMITMENT. `funderRef`,
 * `beneficiaryRef`, `opportunityRef` and `obligationRef` are derived through
 * `./refs.ts`; a raw persona or opportunity UUID must never appear here.
 */

import {
  ventureAmountCommitment,
  ventureObligationRef,
  ventureOpportunityRef,
  venturePrivateLedgerRef,
} from './refs';
import type {
  ServiceObligation,
  ServiceObligationBasis,
  ServiceObligationState,
  VentureDenomination,
} from './types';

/** Bump ONLY on a breaking shape change; older receipts stay readable. */
export const COMPENSATION_EXTENSION_VERSION = 'partner-service-compensation/1';

export type CompensationClassification = 'completion' | 'refusal' | 'execution';

/** Which event brought the liability into existence. */
export type LiabilityCreationEvent = 'constitutional-completion' | 'execution';

/** The eleven supported fields of R-8, plus the extension's own identity. */
export interface PartnerServiceCompensationExtension {
  ext: 'partner-service-compensation';
  version: string;
  /** Commitment over the opportunity (never the raw id). */
  opportunityRef: string;
  obligationRef: string;
  liabilityCreationEvent: LiabilityCreationEvent;
  compensationBasis: ServiceObligationBasis;
  denomination: VentureDenomination;
  /** Present only under open disclosure. */
  amountMinorUnits?: string;
  /** Present only under restricted disclosure, alongside privateLedgerRef. */
  amountCommitment?: string;
  privateLedgerRef?: string;
  funderRef: string;
  beneficiaryRef: string;
  settlementState: ServiceObligationState;
  settlementRef?: string;
  classification: CompensationClassification;
  experimentalCellId: string;
}

export type CompensationDisclosure = 'open' | 'restricted';

/**
 * Classify the obligation for the receipt. `correct-refusal` maps to `refusal`
 * — a completed constitutional service with execution declined — and the
 * mapping is total, so there is no path by which a refusal is recorded as
 * anything else.
 */
export function classifyCompensation(basis: ServiceObligationBasis): CompensationClassification {
  if (basis === 'correct-refusal') return 'refusal';
  if (basis === 'execution-completed') return 'execution';
  return 'completion';
}

export function buildCompensationExtension(
  obligation: ServiceObligation,
  opts: { disclosure: CompensationDisclosure; liabilityCreationEvent: LiabilityCreationEvent; settlementRef?: string },
): PartnerServiceCompensationExtension {
  const base: PartnerServiceCompensationExtension = {
    ext: 'partner-service-compensation',
    version: COMPENSATION_EXTENSION_VERSION,
    opportunityRef: ventureOpportunityRef(obligation.opportunityId),
    obligationRef: ventureObligationRef(obligation.obligationId),
    liabilityCreationEvent: opts.liabilityCreationEvent,
    compensationBasis: obligation.basis,
    denomination: obligation.denomination,
    funderRef: obligation.funderRef,
    beneficiaryRef: obligation.beneficiaryAgentRef,
    settlementState: obligation.state,
    classification: classifyCompensation(obligation.basis),
    experimentalCellId: obligation.experimentalCellId,
    ...(opts.settlementRef ? { settlementRef: opts.settlementRef } : {}),
  };

  if (opts.disclosure === 'restricted') {
    // The raw amount is deliberately absent — not zeroed, not redacted to a
    // placeholder that a reader could mistake for a real figure.
    return {
      ...base,
      amountCommitment: ventureAmountCommitment(obligation.amountMinorUnits, obligation.denomination),
      privateLedgerRef: venturePrivateLedgerRef(obligation.obligationId),
    };
  }

  return { ...base, amountMinorUnits: obligation.amountMinorUnits };
}
