/**
 * The canonical classification of every difference a settlement can produce.
 *
 * ─── THE CONSTITUTIONAL TRADING TRANSPARENCY PRINCIPLE ──────────────────────
 *
 * Ratified 2026-07-29, across the whole Financial Services Runtime. This module
 * is the settlement layer's instance of it:
 *
 *   > A financial transaction must distinguish observable market movement from
 *   > provider compensation. Market movement is recorded as a market fact. Any
 *   > spread, markup, premium, or differential deliberately retained by a
 *   > provider is compensation and must be disclosed as a fee. No provider may
 *   > attribute retained compensation to market conditions without separately
 *   > proving the underlying market movement.
 *
 * Operational corollary — the shape of `SettlementValueBreakdown` below:
 *
 *   > Every consequential financial-services receipt must separate principal,
 *   > market deviation, network cost, service fee, liquidity or finality
 *   > premium, and provider-retained spread.
 *
 * The transparency standard the principle enforces:
 *
 *   reference value
 *   + observable market movement
 *   + explicit service fee
 *   + explicit liquidity/finality premium
 *   = authorised total cost
 *
 * No hidden spread. No unexplained slippage. No provider margin disguised as
 * "the market." This is not a promise that markets will never move — it is a
 * guarantee that the system will not lie about why the customer paid more.
 *
 * ─── THE SETTLEMENT RULING IT IMPLEMENTS ────────────────────────────────────
 *
 * Operator ruling, same date. The two classes the first build FLAGGED rather
 * than mapped are resolved here, and the resolution is a THREE-WAY distinction
 * rather than two extra fee fields:
 *
 *   > Parity governs the protocol principal. Fees pay for services and risk.
 *   > Market deviations describe external conditions.
 *
 * Three different kinds of thing. Collapsing any two is the defect, and the two
 * collapses have opposite failure modes:
 *
 *   fee → market fact   a charge laundered as "market pricing". The payer is
 *                       charged, nobody is named as charging, and the amount is
 *                       explained by an external condition that did not cause it.
 *   market fact → fee   an external observation admitted into the fee breakdown,
 *                       which reimports an EXCHANGE RATE into a layer that is
 *                       deliberately cent-for-cent. Once a rate-shaped field
 *                       exists in the fee structure, any spread can live in it.
 *
 * ─── WHAT THIS MODULE OWNS ──────────────────────────────────────────────────
 *
 *   - `SETTLEMENT_CLASSIFICATION_TABLE` — the ruling's table, as DATA. The
 *     enforcement below reads it; it is not decoration beside hard-coded logic.
 *     Change a row's `recordedIn` and a refusal changes with it.
 *   - `classificationRefusal` — the gate `initiateSettlement` calls. Every
 *     misclassification is refused BEFORE any ledger effect.
 *   - `classificationViolations` — the same properties re-checked after the
 *     fact by `reconcileBook`, against the recorded settlement rather than the
 *     instruction. Two independent checks, because a gate can be bypassed by a
 *     later mutation and a reconciler cannot prevent one.
 *   - `settlementValueBreakdown` — the categories a DVN receipt must keep
 *     distinguishable, never blended into one net figure.
 *
 * Deterministic: no clock, no randomness. Amounts are minor-unit decimal
 * strings; arithmetic in `BigInt`.
 */

import {
  ATTRIBUTED_FEE_CLASSES,
  LIQUIDITY_SHORTFALL_RESPONSES,
  MARKET_OBSERVATION_CLASSES,
  PREFERRED_FEE_BEARING,
  TIMING_FEE_CLASSES,
  type AttributedFee,
  type CrossDenominationSettlement,
  type FeeBearing,
  type LiquidityShortfallResponse,
  type MarketObservation,
  type SettlementFeeBreakdown,
  type SettlementRefusal,
} from './types';
// TYPE ONLY, and the direction matters: `liquidity.ts` imports from `types.ts`
// alone, so depending on its disposition union here is acyclic — and it makes a
// new disposition a compile error in `shortfallResponsesFor` rather than a
// silently unhandled case that returns nothing.
import type { LiquidityDisposition } from './liquidity';

// ─── The classification table, as data ──────────────────────────────────────

/**
 * Where a classified thing is RECORDED. Exactly one of three places — a thing
 * recorded in two of them is double-counted, and a thing recorded in the wrong
 * one is the misclassification this whole module exists to prevent.
 */
export type ClassificationRecord = 'principal' | 'fee-breakdown' | 'market-observation-record';

export type Classification =
  | 'settlement-amount'
  | 'network-fee'
  | 'liquidity-or-finality-fee'
  | 'expedited-settlement-fee'
  | 'market-fact'
  | 'fee'
  | 'market-execution-result';

export interface ClassificationRow {
  situation: string;
  classification: Classification;
  recordedIn: ClassificationRecord;
  /** True where the ruling requires the payer to have accepted the path. */
  requiresExplicitAuthorisation: boolean;
}

/**
 * The ruling's table, verbatim in structure.
 *
 * The two rows that decide the hard cases sit next to each other on purpose:
 * a secondary-market premium or discount is a MARKET FACT, and a provider's
 * deliberately retained margin is a FEE. Same arithmetic difference, opposite
 * classification, because the question is not *how big* but *who decided*.
 */
export const SETTLEMENT_CLASSIFICATION_TABLE: readonly ClassificationRow[] = [
  {
    situation: 'Principal conversion at 1:1',
    classification: 'settlement-amount',
    recordedIn: 'principal',
    requiresExplicitAuthorisation: false,
  },
  {
    situation: 'Network execution cost',
    classification: 'network-fee',
    recordedIn: 'fee-breakdown',
    requiresExplicitAuthorisation: false,
  },
  {
    situation: 'Liquidity advanced before finality',
    classification: 'liquidity-or-finality-fee',
    recordedIn: 'fee-breakdown',
    requiresExplicitAuthorisation: false,
  },
  {
    situation: 'Expedited service',
    classification: 'expedited-settlement-fee',
    recordedIn: 'fee-breakdown',
    requiresExplicitAuthorisation: false,
  },
  {
    situation: 'Secondary-market premium or discount',
    classification: 'market-fact',
    recordedIn: 'market-observation-record',
    requiresExplicitAuthorisation: false,
  },
  {
    situation: 'Provider-retained spread or markup',
    classification: 'fee',
    recordedIn: 'fee-breakdown',
    requiresExplicitAuthorisation: false,
  },
  {
    situation: 'External venue execution away from parity',
    classification: 'market-execution-result',
    recordedIn: 'market-observation-record',
    requiresExplicitAuthorisation: true,
  },
];

/** The table row for a classification. Throws on an unlisted one — a
 *  classification with no row is a classification nobody ruled on. */
export function classificationRow(classification: Classification): ClassificationRow {
  const row = SETTLEMENT_CLASSIFICATION_TABLE.find((r) => r.classification === classification);
  if (!row) throw new Error(`no classification row for '${classification}'`);
  return row;
}

/** Where a classification is recorded, read from the table rather than restated. */
export function recordedIn(classification: Classification): ClassificationRecord {
  return classificationRow(classification).recordedIn;
}

/** Whether the payer must have accepted this path, read from the table. */
export function requiresExplicitAuthorisation(classification: Classification): boolean {
  return classificationRow(classification).requiresExplicitAuthorisation;
}

// ─── Fee arithmetic, split by who bears it ──────────────────────────────────

function minor(value: string): bigint {
  return BigInt(value);
}

/** Attributed fees, or an empty list. */
export function attributedFees(fees: SettlementFeeBreakdown): readonly AttributedFee[] {
  return fees.attributedFees ?? [];
}

/** A fee's bearing, defaulting to the PREFERRED form when unstated. */
export function feeBearingOf(fee: AttributedFee): FeeBearing {
  return fee.bearing ?? PREFERRED_FEE_BEARING;
}

/** The four ordinary categories. Always borne separately, as they always were. */
export function totalOrdinaryFees(fees: SettlementFeeBreakdown): bigint {
  return (
    minor(fees.networkFee ?? '0') +
    minor(fees.serviceFee ?? '0') +
    minor(fees.liquidityFee ?? '0') +
    minor(fees.reconciliationFee ?? '0')
  );
}

/**
 * Fees the payer pays ON TOP of the principal — the PREFERRED form. These
 * increase the source debit and leave the delivered principal whole.
 */
export function feesBorneSeparately(fees: SettlementFeeBreakdown): bigint {
  return (
    totalOrdinaryFees(fees) +
    attributedFees(fees)
      .filter((f) => feeBearingOf(f) === 'borne-separately')
      .reduce((acc, f) => acc + minor(f.amountMinorUnits), 0n)
  );
}

/**
 * Fees taken OUT of the principal — the non-preferred form. These do not
 * increase the source debit; they reduce what the recipient receives, and they
 * may do so ONLY by an itemised, attributed, pre-quoted amount.
 */
export function feesDeductedFromPrincipal(fees: SettlementFeeBreakdown): bigint {
  return attributedFees(fees)
    .filter((f) => feeBearingOf(f) === 'deducted-from-principal')
    .reduce((acc, f) => acc + minor(f.amountMinorUnits), 0n);
}

/** Timing fees only — the three classes the ruling names. */
export function totalTimingFees(fees: SettlementFeeBreakdown): bigint {
  return attributedFees(fees)
    .filter((f) => (TIMING_FEE_CLASSES as readonly string[]).includes(f.feeClass))
    .reduce((acc, f) => acc + minor(f.amountMinorUnits), 0n);
}

/** Retained-margin fees only — the sharp line's disclosure. */
export function totalProviderRetainedSpreadFees(fees: SettlementFeeBreakdown): bigint {
  return attributedFees(fees)
    .filter((f) => f.feeClass === 'provider-retained-spread-fee')
    .reduce((acc, f) => acc + minor(f.amountMinorUnits), 0n);
}

/**
 * What the beneficiary actually receives: the authorised principal, less any
 * fee explicitly borne out of it. In the PREFERRED form this is the principal
 * itself, as a string — no arithmetic touches it at all.
 */
export function deliveredPrincipal(
  amountMinorUnits: string,
  fees: SettlementFeeBreakdown,
): string {
  const deducted = feesDeductedFromPrincipal(fees);
  return deducted === 0n ? amountMinorUnits : (minor(amountMinorUnits) - deducted).toString();
}

// ─── The gate: refuse a misclassification before any ledger effect ──────────

/** The shape `classificationRefusal` inspects — the instruction, or a record. */
export interface ClassifiableSettlement {
  amountMinorUnits: string;
  feeBreakdown: SettlementFeeBreakdown;
  initiatedAt: string;
  acceleratedService?: CrossDenominationSettlement['acceleratedService'];
  marketObservations?: readonly MarketObservation[];
  externalExecution?: CrossDenominationSettlement['externalExecution'];
}

export interface ClassificationRefusal {
  refusal: SettlementRefusal;
  detail: string;
}

const MINOR_UNITS = /^[0-9]+$/;

/**
 * Every classification rule, checked in one place, returning the FIRST refusal.
 *
 * Ordered so the most structural failures answer first: a market fact inside
 * the fee breakdown is a category error, and reporting it as "unattributed fee"
 * would send the reader looking for a missing name rather than a misplaced kind.
 */
export function classificationRefusal(
  s: ClassifiableSettlement,
): ClassificationRefusal | null {
  const fees = s.feeBreakdown;

  // ── 1. A market observation must not be reachable from the fee breakdown ──
  //
  // Checked over the SERIALISED breakdown rather than over known keys: the
  // failure being guarded is a new field appearing, and a check that only looks
  // at fields it already knows about cannot see a new one.
  const feeText = JSON.stringify(fees ?? {});
  const strayClass = MARKET_OBSERVATION_CLASSES.find((c) => feeText.includes(c));
  if (strayClass) {
    return {
      refusal: 'market-deviation-in-fee-breakdown',
      detail: `the fee breakdown carries the market-observation class '${strayClass}'; market conditions are recorded in ${recordedIn('market-fact')}, never among fees — a deviation inside a fee structure is an exchange rate reintroduced into a cent-for-cent layer`,
    };
  }

  // ── 2. Every attributed fee is a well-formed, attributed, pre-quoted charge ─
  for (const fee of attributedFees(fees)) {
    if (!MINOR_UNITS.test(fee.amountMinorUnits)) {
      return {
        refusal: 'malformed-amount',
        detail: `${fee.feeClass} amount '${fee.amountMinorUnits}' is not a minor-unit decimal string`,
      };
    }
    if (!(ATTRIBUTED_FEE_CLASSES as readonly string[]).includes(fee.feeClass)) {
      return {
        refusal: 'undisclosed-fee',
        detail: `'${fee.feeClass}' is not a ruled fee class`,
      };
    }
    if (!fee.chargedByRef || !fee.quoteRef || !fee.basis) {
      return {
        refusal: 'fee-not-attributed',
        detail: `a ${fee.feeClass} must name the charging service, its quote and its basis — an amount nobody is recorded as charging is a spread, not a fee`,
      };
    }
    // Quoted BEFORE authorisation. A quote produced at or after acceptance was
    // not something the payer could have accepted.
    if (!(fee.quotedAt < s.initiatedAt)) {
      return {
        refusal: 'fee-not-quoted-before-authorisation',
        detail: `a ${fee.feeClass} quoted at ${fee.quotedAt} was not presented before the instruction was authorised at ${s.initiatedAt}`,
      };
    }
  }

  // ── 3. A timing fee requires an accelerated service that was actually used ──
  //
  //   > absent when no accelerated service or liquidity advance is used
  //
  // A fee that always appears is not a fee for a service.
  const timing = attributedFees(fees).filter((f) =>
    (TIMING_FEE_CLASSES as readonly string[]).includes(f.feeClass),
  );
  if (timing.length > 0) {
    const service = s.acceleratedService;
    if (!service || !service.serviceRef || !service.providedByRef) {
      return {
        refusal: 'timing-fee-without-accelerated-service',
        detail: `${timing[0].feeClass} is charged with no accelerated service or liquidity advance declared — a timing/finality premium is a fee ONLY where a participant undertook additional risk or advanced destination liquidity before ordinary source finality`,
      };
    }
    const mismatched = timing.find((f) => f.serviceRef !== service.serviceRef);
    if (mismatched) {
      return {
        refusal: 'timing-fee-without-accelerated-service',
        detail: `${mismatched.feeClass} names service ${mismatched.serviceRef}, which is not the accelerated service ${service.serviceRef} this settlement used`,
      };
    }
    if (!(service.quotedAt < s.initiatedAt)) {
      return {
        refusal: 'fee-not-quoted-before-authorisation',
        detail: `the accelerated service was quoted at ${service.quotedAt}, not before authorisation at ${s.initiatedAt}`,
      };
    }
  }

  // ── 4. A market observation is an observation, never a charge ─────────────
  for (const observation of s.marketObservations ?? []) {
    const text = JSON.stringify(observation);
    if (/"(amountMinorUnits|chargedByRef|bearing|feeClass)"/.test(text)) {
      return {
        refusal: 'market-observation-carries-a-charge',
        detail: `a ${observation.observationClass} carries a charge field — a market deviation describes an external condition; nobody is charged and nobody receives it`,
      };
    }
    if (!observation.venueRef || !observation.observedAt) {
      return {
        refusal: 'market-observation-carries-a-charge',
        detail: `a ${observation.observationClass} must name the venue observed and when — an unattributed observation is indistinguishable from an assertion`,
      };
    }
  }

  // ── 5. THE SHARP LINE ────────────────────────────────────────────────────
  //
  //   > A market movement is a market fact. A deliberately retained spread is
  //   > a fee.
  //
  // A provider that retains value out of a deviation has CHARGED for it, and
  // the retained amount must appear as a fee. Recording it only as a market
  // fact is the loophole through which any charge becomes "market pricing".
  const execution = s.externalExecution;
  if (execution) {
    if (!MINOR_UNITS.test(execution.providerRetainedMinorUnits)) {
      return {
        refusal: 'malformed-amount',
        detail: `retained amount '${execution.providerRetainedMinorUnits}' is not a minor-unit decimal string`,
      };
    }
    const retainedAsFact = minor(execution.providerRetainedMinorUnits);
    if (retainedAsFact > 0n) {
      const disclosed = totalProviderRetainedSpreadFees(fees);
      if (disclosed !== retainedAsFact) {
        return {
          refusal: 'retained-spread-recorded-as-market-fact',
          detail: `the provider retained ${retainedAsFact} out of the venue deviation but only ${disclosed} is disclosed as a provider-retained-spread fee — any spread, markup, premium or differential deliberately retained by a provider is COMPENSATION and must be disclosed as a fee, even when presented through an exchange rate; recording it as a market fact is how compensation is concealed as market pricing`,
        };
      }
    }

    // ── THE PRINCIPLE'S LAST CLAUSE, WITH A MECHANISM ─────────────────────
    //
    //   > No provider may attribute retained compensation to market conditions
    //   > without SEPARATELY PROVING the underlying market movement.
    //
    // Without this, a provider asserts "the market moved", retains against the
    // assertion, and nobody ever has to evidence the movement — the same
    // laundering one step further back, and invisible because the fee IS
    // disclosed. So an off-parity execution must be accompanied by an
    // observation record naming the same venue. The observation is the proof;
    // the execution record is the claim, and a claim is not its own evidence.
    const proven = (s.marketObservations ?? []).some((o) => o.venueRef === execution.venueRef);
    if (!proven) {
      return {
        refusal: 'market-movement-not-separately-proven',
        detail: `execution at venue ${execution.venueRef} is attributed to market conditions with no market observation recorded for that venue — market conditions may explain a price difference, but a provider may not attribute retained compensation to a movement it has not separately proven`,
      };
    }
    // ── 6. Execution away from parity is legitimate only when ACCEPTED ──────
    //
    // The requirement is read from the classification table, so the table is
    // load-bearing: flip that row and this gate changes with it.
    if (requiresExplicitAuthorisation('market-execution-result')) {
      const auth = execution.authorisation;
      if (!auth || !auth.authorisationRef || !auth.acceptedByRef || !auth.at) {
        return {
          refusal: 'external-execution-without-authorisation',
          detail: `execution at venue ${execution.venueRef} ran ${execution.executionDeviationBps} bps away from parity with no recorded payer acceptance — a settlement executed away from parity at an external venue is a market execution result, legitimate only when the payer accepted that path`,
        };
      }
    }
  }

  // A provider-retained-spread fee with no external execution behind it has
  // nothing it could have been retained OUT OF.
  if (totalProviderRetainedSpreadFees(fees) > 0n && !execution) {
    return {
      refusal: 'fee-not-attributed',
      detail: 'a provider-retained-spread fee is disclosed with no external venue execution it was retained out of',
    };
  }

  return null;
}

// ─── The reconciler: the same properties, checked against the record ────────

/**
 * Classification identities over a RECORDED settlement. Empty means the
 * settlement classified every difference the way the ruling requires.
 *
 * These overlap the gate deliberately. The gate reads an instruction and can be
 * bypassed by a later mutation; the reconciler reads the settlement as it now
 * stands and cannot prevent anything. Neither alone is sufficient.
 */
export function classificationViolations(s: CrossDenominationSettlement): string[] {
  const violations: string[] = [];

  const refusal = classificationRefusal({
    amountMinorUnits: s.amountMinorUnits,
    feeBreakdown: s.feeBreakdown,
    initiatedAt: s.initiatedAt,
    ...(s.acceleratedService ? { acceleratedService: s.acceleratedService } : {}),
    ...(s.marketObservations ? { marketObservations: s.marketObservations } : {}),
    ...(s.externalExecution ? { externalExecution: s.externalExecution } : {}),
  });
  if (refusal) violations.push(`${s.settlementId}: ${refusal.refusal} — ${refusal.detail}`);

  // A liquidity-advance fee charged on a settlement where no advance was ever
  // made. The gate cannot see this: the advance is authorised at CREDIT time,
  // long after the instruction was accepted.
  const advanceFee = attributedFees(s.feeBreakdown).find((f) => f.feeClass === 'liquidity-advance-fee');
  if (advanceFee && s.state === 'settled' && s.liquidityAdvance === undefined) {
    violations.push(
      `${s.settlementId}: a liquidity-advance fee of ${advanceFee.amountMinorUnits} was charged on a settlement that never advanced destination liquidity — a fee that appears when no accelerated service was used is a spread wearing a fee's name`,
    );
  }

  // The principal is never reduced by a market observation. An observation may
  // be recorded on any settlement; it may never explain a delivered figure.
  if (s.destinationCreditedMinorUnits !== undefined) {
    const expected = deliveredPrincipal(s.amountMinorUnits, s.feeBreakdown);
    if (s.destinationCreditedMinorUnits !== expected) {
      violations.push(
        `${s.settlementId}: delivered ${s.destinationCreditedMinorUnits} against an authorised principal of ${s.amountMinorUnits} less ${feesDeductedFromPrincipal(s.feeBreakdown)} of itemised deductions (= ${expected}) — the remainder is an undisclosed reduction of the protocol principal`,
      );
    }
  }

  return violations;
}

// ─── The liquidity-shortfall responses ──────────────────────────────────────

/**
 * The responses available when the canonical 1:1 route lacks destination
 * liquidity, given what the liquidity assessment said.
 *
 * Every return is a subset of `LIQUIDITY_SHORTFALL_RESPONSES`, and that list
 * contains no rate adjustment — so no disposition, at any band, can answer a
 * shortfall by moving the settlement rate. The principal is not a lever this
 * layer may pull.
 */
export function shortfallResponsesFor(
  disposition: LiquidityDisposition,
): readonly LiquidityShortfallResponse[] {
  switch (disposition) {
    case 'permit':
      return [];
    case 'queue-or-split':
      // Too large for the band: hold it, or find liquidity elsewhere.
      return ['queue', 'route-to-approved-alternate-source'];
    case 'requires-explicit-override':
    case 'refuse':
      // Nothing ordinary may proceed. The payer may be OFFERED an external
      // path — offered, and only with their explicit acceptance recorded.
      return [
        'queue',
        'route-to-approved-alternate-source',
        'request-explicit-acceptance-of-external-execution',
        'refuse',
      ];
  }
}

/** Guard the list itself: a fifth response, or a rate lever, is a defect. */
export function shortfallResponsesAreExhaustive(): boolean {
  return (
    LIQUIDITY_SHORTFALL_RESPONSES.length === 4 &&
    !LIQUIDITY_SHORTFALL_RESPONSES.some((r) => /rate|slip|margin|adjust/i.test(r))
  );
}

// ─── The categories a receipt must keep distinguishable ─────────────────────

/** A market deviation as it appears ON A RECEIPT. Still not an amount. */
export interface MarketDeviationDisclosure {
  observations: Array<{ observationClass: string; venueRef: string; deviationBps: string }>;
}

/** An externally authorised execution rate as it appears on a receipt. */
export interface ExternalExecutionDisclosure {
  venueRef: string;
  executionDeviationBps: string;
  authorisationRef: string;
  acceptedByRef: string;
}

/**
 * ─── SEVEN LINES, BECAUSE TWO RATIFIED SIXES OVERLAP IN FIVE ────────────────
 *
 * Two texts each name SIX components a receipt must separate, and they are not
 * the same six:
 *
 *   settlement ruling §7   principal · network · service · liquidity/finality ·
 *                          observed market deviation ·
 *                          externally authorised execution rate
 *   transparency corollary principal · market deviation · network cost ·
 *                          service fee · liquidity or finality premium ·
 *                          PROVIDER-RETAINED SPREAD
 *
 * They share five and differ in one each. Reporting either six alone would drop
 * a line the other requires, so this carries their UNION — seven lines, of
 * which each ratified six is a subset that stays separately checkable.
 *
 * The split that matters most is the last one: `provider-retained-spread-fee`
 * gets its OWN line and does not fold into `serviceFee`. Folding it there would
 * satisfy "it is disclosed as a fee" while destroying the very distinction the
 * transparency principle exists to make — a reader could no longer tell
 * compensation the provider retained out of a price difference from an ordinary
 * service charge, which is precisely what "no provider margin disguised" means.
 *
 * The two non-amount lines are TYPED so they cannot become amounts. That is
 * what stops the seven collapsing back into one blended number by addition: a
 * market fact has no addend to contribute.
 */
export interface SettlementValueBreakdown {
  principalMinorUnits: string;
  /** Market FACT. Not an amount, never a charge, contributes nothing to cost. */
  observedMarketDeviation: MarketDeviationDisclosure | null;
  networkCostMinorUnits: string;
  serviceFeeMinorUnits: string;
  liquidityOrFinalityPremiumMinorUnits: string;
  /** Compensation the provider retained. Its own line, never inside the above. */
  providerRetainedSpreadMinorUnits: string;
  /** Market execution RESULT, legitimate only where the payer accepted it. */
  externallyAuthorisedExecutionRate: ExternalExecutionDisclosure | null;
}

/** Every line, in the order the ratified texts name them. */
export const SETTLEMENT_VALUE_BREAKDOWN_KEYS: readonly (keyof SettlementValueBreakdown)[] = [
  'principalMinorUnits',
  'observedMarketDeviation',
  'networkCostMinorUnits',
  'serviceFeeMinorUnits',
  'liquidityOrFinalityPremiumMinorUnits',
  'providerRetainedSpreadMinorUnits',
  'externallyAuthorisedExecutionRate',
];

/**
 * The transparency corollary's six, by name. Kept as a separate constant so the
 * canary asserts the RATIFIED list rather than whatever the interface happens
 * to contain — a check that reads the implementation proves only that the
 * implementation equals itself.
 */
export const TRANSPARENCY_COROLLARY_COMPONENTS: readonly (keyof SettlementValueBreakdown)[] = [
  'principalMinorUnits',
  'observedMarketDeviation',
  'networkCostMinorUnits',
  'serviceFeeMinorUnits',
  'liquidityOrFinalityPremiumMinorUnits',
  'providerRetainedSpreadMinorUnits',
];

/** The settlement ruling §7 six, by name. Same reason. */
export const SETTLEMENT_RULING_RECEIPT_COMPONENTS: readonly (keyof SettlementValueBreakdown)[] = [
  'principalMinorUnits',
  'networkCostMinorUnits',
  'serviceFeeMinorUnits',
  'liquidityOrFinalityPremiumMinorUnits',
  'observedMarketDeviation',
  'externallyAuthorisedExecutionRate',
];

export function settlementValueBreakdown(
  s: Pick<
    CrossDenominationSettlement,
    'amountMinorUnits' | 'feeBreakdown' | 'marketObservations' | 'externalExecution'
  >,
): SettlementValueBreakdown {
  const fees = s.feeBreakdown;
  const observations = s.marketObservations ?? [];
  const execution = s.externalExecution;
  const auth = execution?.authorisation;

  return {
    // The AUTHORISED principal, always — never principal-minus-fees. A receipt
    // that reported the net figure here would make a deducted fee vanish.
    principalMinorUnits: s.amountMinorUnits,
    observedMarketDeviation:
      observations.length === 0
        ? null
        : {
            observations: observations.map((o) => ({
              observationClass: o.observationClass,
              venueRef: o.venueRef,
              deviationBps: o.deviationBps,
            })),
          },
    networkCostMinorUnits: BigInt(fees.networkFee ?? '0').toString(),
    // Reconciliation/exception handling IS a service the platform performed;
    // a provider-retained spread is NOT, and it is deliberately absent here.
    serviceFeeMinorUnits: (
      BigInt(fees.serviceFee ?? '0') + BigInt(fees.reconciliationFee ?? '0')
    ).toString(),
    liquidityOrFinalityPremiumMinorUnits: (
      BigInt(fees.liquidityFee ?? '0') + totalTimingFees(fees)
    ).toString(),
    providerRetainedSpreadMinorUnits: totalProviderRetainedSpreadFees(fees).toString(),
    externallyAuthorisedExecutionRate:
      execution && auth
        ? {
            venueRef: execution.venueRef,
            executionDeviationBps: execution.executionDeviationBps,
            authorisationRef: auth.authorisationRef,
            acceptedByRef: auth.acceptedByRef,
          }
        : null,
  };
}

/**
 * Throw when a receipt would present fewer than every ratified category.
 *
 * A missing key is how many become one: drop `providerRetainedSpreadMinorUnits`
 * and retained compensation silently folds into whatever total the reader
 * computes — disclosed as *an amount*, concealed as *compensation*. The check is
 * on KEY PRESENCE, not on values: `null` is a legitimate value for the two
 * non-amount lines and is meaningfully different from absent ("there was none"
 * versus "we did not say").
 */
export function assertSixCategoriesDistinguished(
  breakdown: SettlementValueBreakdown,
  context: string,
): void {
  const missing = SETTLEMENT_VALUE_BREAKDOWN_KEYS.filter(
    (k) => !Object.prototype.hasOwnProperty.call(breakdown, k),
  );
  if (missing.length > 0) {
    throw new Error(
      `${context}: a consequential financial-services receipt must separate principal, market deviation, network cost, service fee, liquidity or finality premium, provider-retained spread, and any externally authorised execution rate. Missing: ${missing.join(', ')}. A receipt that presents one blended figure cannot be audited back to what was charged and what was merely observed.`,
    );
  }
  const blended = SETTLEMENT_VALUE_BREAKDOWN_KEYS.filter(
    (k) => k.endsWith('MinorUnits') && !MINOR_UNITS.test(String(breakdown[k])),
  );
  if (blended.length > 0) {
    throw new Error(
      `${context}: the amount categories must each be a minor-unit decimal string; ${blended.join(', ')} is not`,
    );
  }
}
