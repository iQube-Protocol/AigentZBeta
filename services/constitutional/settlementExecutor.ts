/**
 * settlementExecutor — binds a Constitutional Agreement's settlement terms onto
 * a settlement intent (CRP-003a; money-moving Domains 1/2). CRP-003 §6:
 * "settlement becomes a replaceable adapter; integrity is the primitive."
 *
 * MONEY IS PARAMOUNT. This layer does NOT sign or broadcast a transfer. It
 * builds + records a deterministic settlement INTENT bound to the agreement,
 * AFTER the P3 spend cap (spendWithinCap) has passed in the pipeline. Actual
 * on-chain execution stays the operator's supervised wallet path — the live
 * Base-USDC settlement (services/billing/planCheckout.ts UsdcPaymentIntent) or
 * the Q¢/x402 rail — never an autonomous transfer from the constitutional layer.
 * The intent is the constitutional binding; the transfer is a separate,
 * human-authorised step (the D1 discipline applied to money).
 *
 * Pure: node crypto only, no clock, no network. The rail is carried through as
 * a replaceable adapter id (CFS-018 primitive/provider separation).
 */

import { createHash } from 'crypto';
import type { SettlementTerms } from '@/services/constitutional/constitutionalAgreement';

export interface SettlementResult {
  status: 'intent_created' | 'refused';
  rail: string;
  amount: number;
  currency: string;
  /** Deterministic, T2-safe intent reference (one-way hash). */
  intentRef: string | null;
  note: string;
}

/** Build a deterministic settlement intent bound to the agreement. PURE.
 *  Never broadcasts — see file docs. */
export function buildSettlementIntent(terms: SettlementTerms, agreementRef: string): SettlementResult {
  if (!(terms.amount >= 0)) {
    return { status: 'refused', rail: terms.rail, amount: terms.amount, currency: terms.currency, intentRef: null, note: `invalid settlement amount ${terms.amount}` };
  }
  const intentRef = createHash('sha256')
    .update(`settlement:${agreementRef}:${terms.rail}:${terms.amount}:${terms.currency}`)
    .digest('hex')
    .slice(0, 24);
  return {
    status: 'intent_created',
    rail: terms.rail,
    amount: terms.amount,
    currency: terms.currency,
    intentRef,
    note: `settlement intent bound to the agreement — on-chain execution via the operator's ${terms.rail} wallet path (x402 / Base USDC) is a supervised step, not autonomous`,
  };
}
