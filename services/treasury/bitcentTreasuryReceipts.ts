/**
 * Bitcent (B¢) treasury receipt — records a real Bitcoin Runes etching
 * transaction, broadcast under the pilot treasury authority gate
 * (services/treasury/pilotTreasuryAuthority.js), as a DVN-anchorable
 * `activity_receipts` row (action type `bitcent_treasury_etch_executed`,
 * added to `ANCHORABLE_ACTION_TYPES` and to the CHECK constraint via
 * supabase/migrations/20260930000200_bitcent_treasury_receipt_type.sql).
 *
 * `buildBitcentEtchReceiptInput` is pure — no IO, no clock, no randomness —
 * so it is fully unit-testable. It shapes a `CreateActivityReceiptInput` from
 * known facts about the etch (mandate, transaction, tokenomics). The only
 * caller-supplied fact this module does not derive itself is `personaId`:
 * resolving "who is Aigent Z" to a live persona_id requires a Supabase query
 * (`select id from personas where fio_handle = 'aigentz@aigent'`), which this
 * module deliberately does not perform itself — see
 * scripts/record-bitcent-etch-receipt.ts, the operator-run script that
 * resolves the persona and calls `recordBitcentEtchReceipt`.
 *
 * Never carries the operator's passcode or the custodian's private key —
 * only the mandate commitment (an opaque hash), the signatory/observer
 * reasons, and the transaction hash.
 */

import {
  createActivityReceipt,
  type CreateActivityReceiptInput,
} from '@/services/receipts/activityReceiptService';

export interface BitcentEtchFacts {
  /** The broadcast Bitcoin transaction hash — the etch itself. */
  txHash: string;
  network: 'testnet' | 'mainnet';
  /** From `authorizeTreasuryAction`'s return value — an opaque commitment, never a secret. */
  mandateCommitment: string;
  requiredSignatory: string;
  requiredSignatoryReason: string;
  observer: string;
  observerReason: string;
  transactionClass: string;
  /** From the ratified issuance record + resolveTokenomics(). */
  runeName: string;
  symbol: string;
  maxSupply: number;
  premine: number;
  initiallyActiveIssuance: number;
  governedReserve: number;
  premineCustodianAddress: string;
  /** The address that funded/paid for the etch — never its private key. */
  deployerAddress: string;
}

/**
 * Pure builder — no IO. Shapes the receipt input deterministically from the
 * given facts. `personaId` is threaded through rather than resolved here, so
 * this function has no Supabase dependency and is directly unit-testable.
 */
export function buildBitcentEtchReceiptInput(
  facts: BitcentEtchFacts,
  personaId: string,
): CreateActivityReceiptInput {
  const summary =
    `Bitcent (${facts.symbol}) etched on Bitcoin ${facts.network}: ${facts.runeName}, ` +
    `premine ${facts.premine.toLocaleString()} (${facts.initiallyActiveIssuance.toLocaleString()} initially active, ` +
    `${facts.governedReserve.toLocaleString()} governed reserve), tx ${facts.txHash}.`;

  return {
    personaId,
    activeCartridge: 'agentiq-os',
    actionType: 'bitcent_treasury_etch_executed',
    summary: summary.slice(0, 1000),
    agentsInvoked: ['aigent-z', facts.requiredSignatory, facts.observer],
    approvalsGranted: [
      `${facts.requiredSignatory}: ${facts.requiredSignatoryReason}`,
      `${facts.observer}: ${facts.observerReason}`,
    ],
    actionInput: {
      network: facts.network,
      txHash: facts.txHash,
      mandateCommitment: facts.mandateCommitment,
      transactionClass: facts.transactionClass,
      runeName: facts.runeName,
      symbol: facts.symbol,
      maxSupply: facts.maxSupply,
      premine: facts.premine,
      initiallyActiveIssuance: facts.initiallyActiveIssuance,
      governedReserve: facts.governedReserve,
      premineCustodianAddress: facts.premineCustodianAddress,
      deployerAddress: facts.deployerAddress,
    },
  };
}

/** Persists the receipt (and, via createActivityReceipt's own fire-and-forget
 *  hook, enqueues its DVN anchor). Requires live Supabase — never callable
 *  from a network-restricted sandbox; run from scripts/record-bitcent-etch-receipt.ts. */
export async function recordBitcentEtchReceipt(facts: BitcentEtchFacts, personaId: string) {
  return createActivityReceipt(buildBitcentEtchReceiptInput(facts, personaId));
}
