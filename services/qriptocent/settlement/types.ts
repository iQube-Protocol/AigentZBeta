/**
 * QriptoCENT cross-denomination settlement — the shared primitives.
 *
 * Constitution: `codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md`,
 * §"Interoperability is inter-ledger settlement, not token bridging".
 *
 * ─── THIS IS NOT A BRIDGE ───────────────────────────────────────────────────
 *
 * Base Q¢ and B¢ each keep their OWN native ledger, balances, issuance and
 * settlement on their own network. A cross-network payment is not a lock-and-mint:
 *
 *   payer debited on the SOURCE ledger
 *     → DVN-verified settlement message
 *     → destination credited from NATIVE settlement liquidity on the DESTINATION ledger
 *
 * The token does not move. What moves is an authenticated instruction. No wrapped
 * asset is created, no lock pool backs anything 1:1, and **settlement never
 * mints**: `issuedMinorUnits` on either ledger is untouched by every function in
 * this substrate. New issuance is a separate governed act.
 *
 * ─── THE ACCOUNTING INVARIANT ───────────────────────────────────────────────
 *
 * Because no source tokens are locked to represent destination tokens, the ONLY
 * thing standing between an inter-ledger payment and DUPLICATE SPENDABLE VALUE
 * is this rule:
 *
 *   > A destination credit may exist only against a finalised source debit OR an
 *   > explicitly authorised liquidity advance, and each settlement instruction
 *   > may be consumed EXACTLY ONCE.
 *
 * The schema below is shaped to make that rule checkable rather than asserted:
 * the actual ledger movements are recorded (`sourceDebitedMinorUnits`,
 * `destinationCreditedMinorUnits`) alongside the intent (`amountMinorUnits`,
 * `feeBreakdown`), so reconciliation compares two independently-recorded facts
 * instead of comparing a figure with itself.
 *
 * ─── PARITY ─────────────────────────────────────────────────────────────────
 *
 * `1 B¢ = 1 Base Q¢ = one cent of reference value`. `protocolRate` is the literal
 * type `'1:1'` — not a number, not a configurable field — so there is no rate
 * arithmetic anywhere in this substrate that could introduce drift, and no place
 * for a fee to hide inside a rate. Fees live in `feeBreakdown` and nowhere else.
 *
 * Amounts are minor-unit DECIMAL STRINGS throughout, converted to `BigInt` for
 * arithmetic and back. Never a float.
 *
 * T0/T2 (CLAUDE.md Identity & Access Spine): every `*Ref` here is a COMMITMENT.
 * A raw `personaId` must never reach a settlement record, a receipt payload or
 * any chain-bound field. Derive refs with `./refs.ts`.
 *
 * Phase 1 is SIMULATION ONLY: no LayerZero call, no Bitcoin transaction, no Base
 * transaction, no wallet. Every state transition below is a state transition.
 */

/** The two canonical QriptoCENT denominations with native ledgers today. */
export type QriptoDenomination = 'BCENT' | 'BASE_QC';

/** The settlement networks those denominations natively issue and settle on. */
export type SettlementNetwork = 'bitcoin' | 'base';

/**
 * The denomination↔network binding is a CONSTITUTIONAL fact, not a parameter: a
 * denomination has exactly one canonical issuance network. Instructions that
 * disagree with this table are refused rather than normalised — a settlement
 * that silently "corrects" its own network is a settlement whose provenance
 * cannot be reconstructed from its record.
 */
export const DENOMINATION_HOME_NETWORK: Record<QriptoDenomination, SettlementNetwork> = {
  BCENT: 'bitcoin',
  BASE_QC: 'base',
};

/** The protocol settlement rate. A literal type, so it cannot be arithmetic. */
export const PROTOCOL_SETTLEMENT_RATE = '1:1' as const;
export type ProtocolSettlementRate = typeof PROTOCOL_SETTLEMENT_RATE;

/**
 * ─── THE STATE MACHINE ──────────────────────────────────────────────────────
 *
 * True cross-chain atomicity between Bitcoin and Base is impossible, so
 * atomicity is CONSTITUTIONAL rather than technical: it is expressed as states,
 * and the rule that a partial state may never be presented as final settlement.
 *
 *   initiated
 *     → source-debit-pending → source-debit-final
 *     → message-verified
 *     → destination-credit-pending → settled
 *
 * Failure and exception states:
 *
 *   expired               — timed out with NO ledger effect
 *   source-failed         — the source debit never became final; no value left the payer
 *   destination-failed    — the destination credit failed; see below
 *   reconciliation-required — value LEFT the payer and did NOT reach the beneficiary
 *   reversed              — a compensating reversal returned the value to the payer
 *   failed                — refused before any ledger effect, for a reason that is
 *                           none of the above (kept so no exception is stateless)
 *
 * `destination-failed` and `reconciliation-required` are DIFFERENT and must never
 * be conflated: the first says the credit attempt failed, the second says the
 * system now OWES someone. A destination failure after a FINAL source debit is
 * always escalated to `reconciliation-required` — it is an obligation, never a
 * silent loss.
 */
export type SettlementState =
  | 'initiated'
  | 'source-debit-pending'
  | 'source-debit-final'
  | 'message-verified'
  | 'destination-credit-pending'
  | 'settled'
  | 'reconciliation-required'
  | 'reversed'
  | 'failed'
  | 'expired'
  | 'source-failed'
  | 'destination-failed';

/**
 * States from which nothing further will happen. `reconciliation-required` is
 * DELIBERATELY ABSENT — an outstanding obligation is not a resting place, and
 * treating it as terminal is how an obligation becomes a write-off.
 */
export const TERMINAL_SETTLEMENT_STATES: readonly SettlementState[] = [
  'settled',
  'reversed',
  'expired',
  'source-failed',
  'destination-failed',
  'failed',
];

/**
 * The ONE state that means the payment completed. Everything else — including
 * every in-flight state and every exception — is not settlement.
 */
export function isFinalSettlement(state: SettlementState): boolean {
  return state === 'settled';
}

/** States in which value has left the payer's ledger. */
export const VALUE_COMMITTED_STATES: readonly SettlementState[] = [
  'source-debit-final',
  'message-verified',
  'destination-credit-pending',
  'settled',
  'reconciliation-required',
  'destination-failed',
];

/**
 * ─── THE FEE / MARKET-FACT SPLIT (operator ruling, 2026-07-29) ──────────────
 *
 * The two classes the earlier build FLAGGED rather than mapped — `timing/finality
 * premium` and `market deviation outside the protocol rate` — are now ruled on,
 * and the ruling is NOT "add two more fee fields". It is a three-way distinction:
 *
 *   > Parity governs the protocol principal. Fees pay for services and risk.
 *   > Market deviations describe external conditions.
 *
 * Three different KINDS of thing, and collapsing any two is the defect:
 *
 *   1. PRINCIPAL   — `amountMinorUnits`, converted at the literal `'1:1'`.
 *                    Never reduced by an undisclosed rate or retained margin.
 *   2. FEE         — a charge, with a payer, a charging service, a quote given
 *                    BEFORE authorisation, a basis, and a receipt. Lives here.
 *   3. MARKET FACT — an OBSERVATION of an external venue. Not a charge, nobody
 *                    receives it, and it lives in `marketObservations` — a
 *                    structure the fee breakdown cannot reach. Putting it here
 *                    would reimport an exchange-rate concept into a layer that
 *                    is deliberately cent-for-cent.
 */

/** The four ordinary categories. Charged alongside the principal, as before. */
export type OrdinaryFeeClass =
  | 'network-fee'
  | 'service-fee'
  | 'liquidity-fee'
  | 'reconciliation-fee';

/**
 * The timing/finality premium, RULED to be a fee — but only under a condition,
 * and the condition is the whole content of the ruling:
 *
 *   > It is a fee when a participant, liquidity provider or service undertakes
 *   > ADDITIONAL RISK or ADVANCES DESTINATION LIQUIDITY before ordinary source
 *   > finality.
 *
 * So it is never a standing line item. A timing fee must name the accelerated
 * service it pays for, and it must be ABSENT when no accelerated service or
 * liquidity advance was used — a fee that always appears is not a fee for a
 * service, it is a spread wearing a fee's name.
 */
export type TimingFeeClass =
  | 'finality-fee'
  | 'liquidity-advance-fee'
  | 'expedited-settlement-fee';

/**
 * ─── THE SHARP LINE ─────────────────────────────────────────────────────────
 *
 * The CONSTITUTIONAL TRADING TRANSPARENCY PRINCIPLE (ratified 2026-07-29):
 *
 *   > A financial transaction must distinguish observable market movement from
 *   > provider compensation. Market movement is recorded as a market fact. Any
 *   > spread, markup, premium, or differential deliberately retained by a
 *   > provider is compensation and must be disclosed as a fee. No provider may
 *   > attribute retained compensation to market conditions without separately
 *   > proving the underlying market movement.
 *
 * So: where a market maker or service intentionally quotes worse than the
 * observed market or the protocol reference and RETAINS the difference, that
 * retained amount is compensation — even when presented through an exchange
 * rate. It is disclosed HERE, as a fee, never in the market-observation record.
 *
 * The principle's last clause is the one with teeth, and it has a mechanism:
 * `classification.ts` refuses a retained spread whose underlying market
 * movement is not SEPARATELY PROVEN by an observation record naming the same
 * venue. Without that, a provider could assert "the market moved" and retain
 * against an assertion nobody has to evidence — which is the same laundering
 * one step further back.
 *
 *   > Market conditions may explain a price difference, but they must never be
 *   > used to conceal compensation.
 */
export type ProviderRetainedSpreadFeeClass = 'provider-retained-spread-fee';

/** Fee classes that carry full attribution: who charged, quoted when, for what. */
export type AttributedFeeClass = TimingFeeClass | ProviderRetainedSpreadFeeClass;

export type SettlementFeeClass = OrdinaryFeeClass | AttributedFeeClass;

export const ORDINARY_FEE_CLASSES: readonly OrdinaryFeeClass[] = [
  'network-fee',
  'service-fee',
  'liquidity-fee',
  'reconciliation-fee',
];

export const TIMING_FEE_CLASSES: readonly TimingFeeClass[] = [
  'finality-fee',
  'liquidity-advance-fee',
  'expedited-settlement-fee',
];

export const ATTRIBUTED_FEE_CLASSES: readonly AttributedFeeClass[] = [
  ...TIMING_FEE_CLASSES,
  'provider-retained-spread-fee',
];

export const SETTLEMENT_FEE_CLASSES: readonly SettlementFeeClass[] = [
  ...ORDINARY_FEE_CLASSES,
  ...ATTRIBUTED_FEE_CLASSES,
];

/**
 * ─── THE TWO PRESENTATION FORMS ─────────────────────────────────────────────
 *
 *   Fee deducted from principal        Fee borne separately (PREFERRED)
 *   Principal:           100 B¢        Principal delivered:  100 Base Q¢
 *   Protocol conversion: 100 Base Q¢   Fee paid separately:    1 Base Q¢
 *   Finality fee:          1 Base Q¢   Total payer cost:     101 B¢ equiv
 *   Recipient receives:   99 Base Q¢
 *
 * Both are modelled, because both occur. `borne-separately` is PREFERRED and is
 * the default, for one reason: THE RECIPIENT RECEIVES THE FULL AUTHORISED
 * PRINCIPAL. Note that the protocol conversion is cent-for-cent in BOTH forms —
 * what the deducted form reduces is the DELIVERED figure, and it may only be
 * reduced by a fee that is itemised, attributed and quoted. A reduction with no
 * such fee behind it is the undisclosed spread this whole layer exists to
 * prevent.
 */
export type FeeBearing = 'borne-separately' | 'deducted-from-principal';

/** The default, and the preferred form. Absent `bearing` means this. */
export const PREFERRED_FEE_BEARING: FeeBearing = 'borne-separately';

/**
 * A fee with full attribution. Every field is a requirement of the ruling:
 * quoted before authorisation (`quotedAt`, `quoteRef`), separately itemised
 * from the principal (it is its own row, never folded into the amount),
 * attributed to the charging service (`chargedByRef`), and bound to the service
 * it pays for (`serviceRef`) so it cannot exist when nothing was accelerated.
 */
export interface AttributedFee {
  feeClass: AttributedFeeClass;
  amountMinorUnits: string;
  /** Commitment of the service that charges it. Never a raw id, never empty. */
  chargedByRef: string;
  /** The quote presented to the payer. */
  quoteRef: string;
  /** When the quote was presented. MUST precede the instruction's acceptance. */
  quotedAt: string;
  /**
   * The accelerated service, liquidity advance, or — for a retained margin —
   * the quote the provider deliberately placed away from the reference. A fee
   * of these classes with nothing to point at is a fee for nothing.
   */
  serviceRef: string;
  /** Absent means `PREFERRED_FEE_BEARING` — the recipient keeps the principal. */
  bearing?: FeeBearing;
  /** Why this amount. A charge with no stated basis is unreviewable. */
  basis: string;
}

export interface SettlementFeeBreakdown {
  networkFee?: string;
  serviceFee?: string;
  liquidityFee?: string;
  /** Reconciliation / exception handling. */
  reconciliationFee?: string;
  /**
   * Timing/finality and retained-margin fees, itemised and attributed.
   *
   * NOTHING resembling a market observation may appear in this structure or on
   * these rows — see `MarketObservation`. `classification.ts` refuses an
   * instruction whose fee breakdown carries a market-observation class, and
   * `reconcileBook` checks the same property after the fact.
   */
  attributedFees?: AttributedFee[];
}

/**
 * ─── MARKET FACTS — OBSERVATIONS, NOT CHARGES ───────────────────────────────
 *
 * B¢ at a premium on an exchange; Base Q¢ temporarily below reference; a quoted
 * bid/ask in an external venue. These describe EXTERNAL CONDITIONS. Nobody is
 * charged, nobody receives them, and no ledger moves because of them.
 *
 * They are therefore structurally incapable of being amounts: an observation
 * carries a DEVIATION IN BASIS POINTS and a venue, and it has no
 * `amountMinorUnits`, no `chargedByRef` and no `bearing`. That absence is the
 * type-level half of the separation; the refusal in `classification.ts` and the
 * reconciliation identity are the runtime halves.
 */
export type MarketObservationClass =
  | 'market-price-deviation'
  | 'observed-spread'
  | 'market-impact'
  | 'external-execution-rate';

export const MARKET_OBSERVATION_CLASSES: readonly MarketObservationClass[] = [
  'market-price-deviation',
  'observed-spread',
  'market-impact',
  'external-execution-rate',
];

export interface MarketObservation {
  observationClass: MarketObservationClass;
  /** Commitment of the venue observed. Never a raw id. */
  venueRef: string;
  /** Signed basis points away from the protocol reference. NOT an amount. */
  deviationBps: string;
  observedAt: string;
  /** What was observed, in words. */
  note: string;
}

/**
 * The payer's recorded acceptance of an external market-execution path.
 *
 * The classification table's last row — *external venue execution away from
 * parity* — is a market execution RESULT, and it is legitimate only when the
 * payer accepted that path. An execution away from parity with no recorded
 * authorisation is refused, because the alternative is a settlement silently
 * routed off-parity and reported as if the payer had chosen it.
 */
export interface ExternalExecutionAuthorisation {
  authorisationRef: string;
  /** Commitment of the party that accepted the path — the payer. */
  acceptedByRef: string;
  at: string;
}

export interface ExternalVenueExecution {
  /** Commitment of the venue. */
  venueRef: string;
  /** How far from the protocol reference the venue executed, in basis points. */
  executionDeviationBps: string;
  /** REQUIRED in practice; optional in the type so its absence is refusable. */
  authorisation?: ExternalExecutionAuthorisation;
  /**
   * Value the provider deliberately RETAINED out of the deviation.
   *
   * Positive here obliges TWO things, and both are refused at acceptance and
   * caught again at reconciliation:
   *
   *   1. a matching `provider-retained-spread-fee` in the fee breakdown, same
   *      amount — recording it ONLY here, as a market fact, is the laundering
   *      the sharp line forbids;
   *   2. a `MarketObservation` naming this same venue — the principle's last
   *      clause: no provider may attribute retained compensation to market
   *      conditions without SEPARATELY PROVING the underlying movement.
   */
  providerRetainedMinorUnits: string;
}

/**
 * What was actually accelerated, and by whom.
 *
 * A timing fee is legitimate only against one of these. It exists so the
 * "absent when unused" half of the ruling is checkable rather than asserted:
 * with no accelerated service declared, a timing fee has nothing to name, and
 * the instruction is refused.
 */
export type AcceleratedServiceKind =
  | 'expedited-settlement'
  | 'liquidity-advance'
  | 'pre-finality-assurance';

export interface AcceleratedService {
  kind: AcceleratedServiceKind;
  serviceRef: string;
  /** Commitment of the participant/provider undertaking the risk. */
  providedByRef: string;
  /** When the service was quoted. Must precede acceptance. */
  quotedAt: string;
}

/**
 * ─── INSUFFICIENT DESTINATION LIQUIDITY — FOUR LEGITIMATE RESPONSES ─────────
 *
 * When the canonical 1:1 route lacks destination liquidity, the permitted
 * answers are exhaustively these four.
 *
 *   > It must never silently introduce slippage into the canonical settlement
 *   > rate.
 *
 * There is deliberately no fifth member, and none of the four is a rate
 * adjustment: the principal is not a lever the liquidity layer may pull.
 */
export type LiquidityShortfallResponse =
  | 'queue'
  | 'route-to-approved-alternate-source'
  | 'request-explicit-acceptance-of-external-execution'
  | 'refuse';

export const LIQUIDITY_SHORTFALL_RESPONSES: readonly LiquidityShortfallResponse[] = [
  'queue',
  'route-to-approved-alternate-source',
  'request-explicit-acceptance-of-external-execution',
  'refuse',
];

/** A liquidity advance — the ONLY authorised alternative to a final source debit. */
export interface AuthorisedLiquidityAdvance {
  advanceRef: string;
  /** Commitment of the authority that authorised the advance. Never a raw id. */
  authorisedByRef: string;
  at: string;
}

/**
 * ─── THE SETTLEMENT RECORD ──────────────────────────────────────────────────
 *
 * One cross-denomination payment, from instruction to terminal state.
 */
export interface CrossDenominationSettlement {
  settlementId: string;
  sourceDenomination: QriptoDenomination;
  destinationDenomination: QriptoDenomination;
  sourceNetwork: SettlementNetwork;
  destinationNetwork: SettlementNetwork;
  /** The value being moved between ledgers. Minor units, decimal string. */
  amountMinorUnits: string;
  protocolRate: ProtocolSettlementRate;
  /** Commitments — see ./refs.ts. Never a raw personaId. */
  payerRef: string;
  beneficiaryRef: string;
  delegationRef: string;
  sourceDebitRef?: string;
  dvnMessageRef?: string;
  destinationCreditRef?: string;
  state: SettlementState;
  feeBreakdown: SettlementFeeBreakdown;
  receiptRefs: string[];

  // ── The fee / market-fact split (operator ruling, 2026-07-29) ─────────────
  /** What was accelerated, if anything. A timing fee is legitimate only here. */
  acceleratedService?: AcceleratedService;
  /**
   * External conditions OBSERVED around this settlement. Not charges. Kept on
   * the settlement rather than in `feeBreakdown` precisely so the fee breakdown
   * cannot reach them — a market deviation inside a fee structure is an
   * exchange rate reintroduced into a cent-for-cent layer.
   */
  marketObservations?: MarketObservation[];
  /** Present only when execution happened away from parity at an outside venue. */
  externalExecution?: ExternalVenueExecution;

  // ── Exactly-once identity ────────────────────────────────────────────────
  /**
   * The payment instruction's own identity. Consumed EXACTLY ONCE per book: a
   * second instruction carrying this ref is a replay and is refused, whatever
   * settlementId it claims.
   */
  instructionRef: string;
  /**
   * Replay nonce carried by the DVN settlement message. Consumed exactly once,
   * independently of `instructionRef`, because the instruction and the message
   * are two separate opportunities to replay.
   */
  nonce: string;

  // ── Observed ledger movements (recorded, never inferred) ──────────────────
  /** What the payer's ledger actually lost. Must equal amount + Σ disclosed fees. */
  sourceDebitedMinorUnits?: string;
  /** What the beneficiary's ledger actually gained. Must equal amount, exactly. */
  destinationCreditedMinorUnits?: string;

  // ── Timing (fixture timestamps — never a clock) ───────────────────────────
  initiatedAt: string;
  expiresAt: string;
  sourceDebitFinalisedAt?: string;
  destinationCreditedAt?: string;
  settledAt?: string;

  /** Present only when the destination credit ran ahead of source finality. */
  liquidityAdvance?: AuthorisedLiquidityAdvance;
  /** Why this settlement is in an exception state. Never empty when it is. */
  exceptionReason?: string;
}

/**
 * ─── A NATIVE LEDGER ────────────────────────────────────────────────────────
 *
 * One denomination's own ledger on its own network. There is one of these per
 * denomination and they are NOT connected by a lock pool — the only connection
 * is the settlement message.
 *
 * The conservation identity every ledger holds at all times:
 *
 *   Σ wallet balances + settlement liquidity  ===  issued supply
 *
 * A settlement moves value BETWEEN the two terms on each side; it never changes
 * `issuedMinorUnits`. That is the whole "settlement ≠ issuance" claim, expressed
 * as an identity a reconciler can check rather than a sentence in a document.
 */
export interface NativeLedger {
  denomination: QriptoDenomination;
  network: SettlementNetwork;
  /** Governed maximum. Settlement never reads it as headroom and never changes it. */
  maxSupplyMinorUnits: string;
  /** Native issued supply. NO function in this substrate writes this. */
  issuedMinorUnits: string;
  /** Circulating wallet balances, by holder commitment. */
  balances: Record<string, string>;
  /** Native settlement liquidity held on this ledger. */
  settlementLiquidityMinorUnits: string;
  /** Earmarked against in-flight destination credits. Subset of the above. */
  reservedLiquidityMinorUnits: string;
  /** Fees collected on this ledger, held separately from settlement liquidity. */
  feesCollectedMinorUnits: string;
}

/** Why a settlement operation was refused. Every one is a named, testable cause. */
export type SettlementRefusal =
  | 'duplicate-settlement-id'
  | 'instruction-already-consumed'
  | 'nonce-already-consumed'
  | 'message-already-consumed'
  | 'credit-already-consumed'
  | 'authority-not-verified'
  | 'same-denomination'
  | 'denomination-network-mismatch'
  | 'malformed-amount'
  | 'non-positive-amount'
  | 'raw-identifier-in-instruction'
  | 'unknown-settlement'
  | 'wrong-state'
  | 'expired'
  | 'insufficient-payer-balance'
  | 'source-debit-not-final'
  | 'unauthorised-liquidity-advance'
  | 'insufficient-settlement-liquidity'
  | 'undisclosed-fee'
  | 'rate-deviation'
  // ── Fee classification (the 2026-07-29 ruling) ──────────────────────────
  /** A timing fee with no accelerated service or liquidity advance behind it. */
  | 'timing-fee-without-accelerated-service'
  /** A fee whose quote does not precede the instruction it is charged on. */
  | 'fee-not-quoted-before-authorisation'
  /** A fee with no charging service named. A fee nobody charges is a spread. */
  | 'fee-not-attributed'
  /** A market observation smuggled into the fee breakdown. */
  | 'market-deviation-in-fee-breakdown'
  /** A deliberately retained spread recorded as a market fact instead of a fee. */
  | 'retained-spread-recorded-as-market-fact'
  /** Retained compensation attributed to a market movement nobody evidenced. */
  | 'market-movement-not-separately-proven'
  /** Execution away from parity at an outside venue the payer never accepted. */
  | 'external-execution-without-authorisation'
  /** A market observation carrying a charge — an observation is not a charge. */
  | 'market-observation-carries-a-charge'
  // ── Liquidity assurance (the SECOND control layer) ──────────────────────
  | 'liquidity-band-refused'
  | 'settlement-exceeds-exposure-limit'
  | 'liquidity-proof-invalid';

export type SettlementOutcome =
  | { ok: true; settlement: CrossDenominationSettlement }
  | { ok: false; refusal: SettlementRefusal; detail: string };

/** An exception the book recorded. Exceptions are records, never silent. */
export interface SettlementException {
  settlementId: string;
  refusal: SettlementRefusal | 'destination-credit-failed' | 'source-debit-failed';
  detail: string;
  at: string;
  /** True when value had already left the payer — i.e. this is an OBLIGATION. */
  valueCommitted: boolean;
}
