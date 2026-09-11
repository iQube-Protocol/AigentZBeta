/**
 * Risk Envelope — MoneyPenny MPY2-3 (SPEC-MPY-002 §5/§8, work package
 * MPY2-3, 2026-09-01, operator direction: "MoneyPenny's bounded
 * financial-authority layer").
 *
 * Pure derivation FROM the Financial Profile aggregates MPY2-2 already
 * computes (services/financialServices/financialProfileAggregation.ts) —
 * this module reads no raw statement, does no I/O, and produces no second
 * financial-state model. It answers, in order:
 *
 *   1. What financial state exists       -> the input FinancialProfileAggregates
 *   2. What risks follow from it         -> assessRisk()          -> RiskAssessment
 *   3. What limits should apply          -> deriveRiskLimits()    -> RiskLimits
 *   4. What consequence would a candidate
 *      action have against those limits  -> evaluateActionAgainstRiskEnvelope()
 *                                           -> ConsequenceProjection (CTP-001's
 *                                           own type, types/ctp.ts — reused, not
 *                                           re-declared)
 *   5. What MoneyPenny may recommend vs.
 *      what requires explicit authority  -> RiskLimits.serviceClass is ALWAYS
 *                                           'PROPOSAL' (types/financialServices.ts's
 *                                           existing three-rung vocabulary).
 *                                           Nothing in this module ever grants,
 *                                           checks, or bypasses authority —
 *                                           real enforcement is Runtime's job,
 *                                           via the existing constitutionalAgreement.ts
 *                                           gate (CTP-001 charter names this as the
 *                                           required path; services/ctp/** and
 *                                           types/ctp.ts are deliberately NOT
 *                                           modified by this module — SPEC-MPY-002
 *                                           §13 reserves them for the parallel AEE
 *                                           workstream).
 *
 * ── No guessing (repo-wide rule, applied here explicitly) ───────────────────
 *
 * A risk category is asserted only when its underlying aggregate is present.
 * `liquidityBufferDays === null` (no balance column in any uploaded
 * statement) yields NO liquidity risk factor and NO liquidity-derived limit
 * figure — it is reported in `RiskAssessment.unassessed`, never defaulted to
 * 'low' (which would be a false reassurance) or silently omitted (which
 * would look like nothing was checked).
 */

import type {
  FinancialProfileAggregates,
  RiskAssessment,
  RiskFactor,
  RiskLimits,
  RiskCategory,
  RiskSeverity,
  ConcentrationLimit,
} from '@/services/iqube/financialProfileQube';
import type { ConsequenceProjection } from '@/types/ctp';

// ── Tunables — named and documented, not magic numbers (same discipline as
//    admissionRecommendation.ts's CONFIDENCE_* constants). ───────────────────

const LIQUIDITY_LOW_DAYS = 90; // >= this many days of buffer -> 'low'
const LIQUIDITY_MODERATE_DAYS = 45;
const LIQUIDITY_ELEVATED_DAYS = 14; // < this -> 'high'

const CONCENTRATION_LOW_SHARE = 0.2; // top category <= this share of expenditure -> 'low'
const CONCENTRATION_MODERATE_SHARE = 0.35;
const CONCENTRATION_ELEVATED_SHARE = 0.5;

const VOLATILITY_LOW = 0.15; // coefficient of variation <= this -> 'low'
const VOLATILITY_MODERATE = 0.35;
const VOLATILITY_ELEVATED = 0.6;

const COMMITMENT_COVERAGE_LOW = 0.3; // recurring commitments <= this share of income -> 'low'
const COMMITMENT_COVERAGE_MODERATE = 0.5;
const COMMITMENT_COVERAGE_ELEVATED = 0.7;

function bucketAscending(value: number, low: number, moderate: number, elevated: number, lowerIsSafer: boolean): RiskSeverity {
  // lowerIsSafer=false: higher value = safer (e.g. liquidity days). true: higher value = riskier.
  if (!lowerIsSafer) {
    if (value >= low) return 'low';
    if (value >= moderate) return 'moderate';
    if (value >= elevated) return 'elevated';
    return 'high';
  }
  if (value <= low) return 'low';
  if (value <= moderate) return 'moderate';
  if (value <= elevated) return 'elevated';
  return 'high';
}

// ── Step 2: what risks follow from the observed financial state ────────────

export function assessRisk(aggregates: FinancialProfileAggregates): RiskAssessment {
  const factors: RiskFactor[] = [];
  const unassessed: RiskAssessment['unassessed'] = [];

  // Liquidity risk — from liquidityBufferDays.
  if (aggregates.liquidityBufferDays !== null) {
    const days = aggregates.liquidityBufferDays;
    const severity = bucketAscending(days, LIQUIDITY_LOW_DAYS, LIQUIDITY_MODERATE_DAYS, LIQUIDITY_ELEVATED_DAYS, false);
    factors.push({
      category: 'liquidity',
      severity,
      rationale: `Observed balance covers roughly ${days} day(s) of average monthly expenditure.`,
      derivedFrom: 'liquidityBufferDays',
    });
  } else {
    unassessed.push({ category: 'liquidity', reason: 'No uploaded statement carried a balance column — liquidityBufferDays is null.' });
  }

  // Concentration risk — from the largest topCategories share.
  if (aggregates.topCategories.length > 0) {
    const top = aggregates.topCategories[0];
    const severity = bucketAscending(top.shareOfExpenditure, CONCENTRATION_LOW_SHARE, CONCENTRATION_MODERATE_SHARE, CONCENTRATION_ELEVATED_SHARE, true);
    factors.push({
      category: 'concentration',
      severity,
      rationale: `Largest expenditure category ('${top.category}') is ${(top.shareOfExpenditure * 100).toFixed(0)}% of average monthly expenditure.`,
      derivedFrom: 'topCategories[0].shareOfExpenditure',
    });
  } else {
    unassessed.push({ category: 'concentration', reason: 'No expenditure category data available — no expenditure rows or all uploads unreadable.' });
  }

  // Volatility risk — from cashFlowVolatility.
  if (aggregates.cashFlowVolatility !== null) {
    const severity = bucketAscending(aggregates.cashFlowVolatility, VOLATILITY_LOW, VOLATILITY_MODERATE, VOLATILITY_ELEVATED, true);
    factors.push({
      category: 'volatility',
      severity,
      rationale: `Month-to-month net cash flow varies by roughly ${(aggregates.cashFlowVolatility * 100).toFixed(0)}% (coefficient of variation).`,
      derivedFrom: 'cashFlowVolatility',
    });
  } else {
    unassessed.push({ category: 'volatility', reason: 'Fewer than 2 statement months observed — cashFlowVolatility is null.' });
  }

  // Commitment-coverage risk — recurring commitments as a share of income.
  if (aggregates.recurringCommitments.length > 0 && aggregates.incomeMonthly > 0) {
    const totalRecurring = aggregates.recurringCommitments.reduce((s, c) => s + c.monthlyAmount, 0);
    const share = totalRecurring / aggregates.incomeMonthly;
    const severity = bucketAscending(share, COMMITMENT_COVERAGE_LOW, COMMITMENT_COVERAGE_MODERATE, COMMITMENT_COVERAGE_ELEVATED, true);
    factors.push({
      category: 'commitment-coverage',
      severity,
      rationale: `Recurring commitments total ${(share * 100).toFixed(0)}% of average monthly income.`,
      derivedFrom: 'recurringCommitments, incomeMonthly',
    });
  } else if (aggregates.incomeMonthly <= 0) {
    unassessed.push({ category: 'commitment-coverage', reason: 'No positive average monthly income observed — coverage ratio is not meaningful.' });
  } else {
    unassessed.push({ category: 'commitment-coverage', reason: 'No recurring commitments observed (fewer than 2 months of data, or none recur).' });
  }

  return { factors, unassessed };
}

// ── Step 3: what limits should apply, given the assessed risk ──────────────

const SEVERITY_NOTIONAL_MONTHS: Record<RiskSeverity, number> = { low: 3, moderate: 2, elevated: 1, high: 0.5 };
const SEVERITY_LOSS_BUDGET_FRACTION: Record<RiskSeverity, number> = { low: 0.2, moderate: 0.12, elevated: 0.06, high: 0.02 };
const SEVERITY_LIQUIDITY_RESERVE_MONTHS: Record<RiskSeverity, number> = { low: 3, moderate: 4, elevated: 6, high: 9 };
const SEVERITY_DRAWDOWN_FRACTION: Record<RiskSeverity, number> = { low: 0.25, moderate: 0.15, elevated: 0.08, high: 0.03 };

export function deriveRiskLimits(aggregates: FinancialProfileAggregates, assessment: RiskAssessment): RiskLimits | null {
  if (aggregates.availableSurplusMonthly <= 0) {
    return null; // No positive surplus — no envelope is proposed, mirrors financialProfileAggregation.ts's own rule.
  }

  // The WORST observed severity governs the whole envelope — a single
  // elevated/high factor (e.g. thin liquidity) is never diluted by
  // averaging against a calmer one (e.g. low concentration). Conservative
  // by construction.
  const severityRank: Record<RiskSeverity, number> = { low: 0, moderate: 1, elevated: 2, high: 3 };
  const worst = assessment.factors.reduce<RiskSeverity>((acc, f) => (severityRank[f.severity] > severityRank[acc] ? f.severity : acc), 'low');

  const rationale: string[] = [
    `Governing severity: ${worst}${assessment.factors.length > 0 ? ` (worst of ${assessment.factors.map((f) => `${f.category}=${f.severity}`).join(', ')})` : ' (no risk factors could be assessed — most conservative posture applied)'}.`,
  ];
  if (assessment.unassessed.length > 0) {
    rationale.push(`${assessment.unassessed.length} risk categor${assessment.unassessed.length === 1 ? 'y was' : 'ies were'} not assessable: ${assessment.unassessed.map((u) => u.category).join(', ')} — treated as unknown, not as low risk.`);
  }

  const concentrationLimits: ConcentrationLimit[] = aggregates.topCategories
    .filter((c) => c.shareOfExpenditure > CONCENTRATION_LOW_SHARE)
    .map((c) => ({
      category: c.category,
      limitShare: CONCENTRATION_LOW_SHARE,
      rationale: `Currently ${(c.shareOfExpenditure * 100).toFixed(0)}% of monthly expenditure — recommend capping new commitments in this category near ${(CONCENTRATION_LOW_SHARE * 100).toFixed(0)}%.`,
    }));

  return {
    positionNotionalLimit: Math.round(aggregates.availableSurplusMonthly * SEVERITY_NOTIONAL_MONTHS[worst] * 100) / 100,
    lossRiskBudget: Math.round(aggregates.availableSurplusMonthly * SEVERITY_LOSS_BUDGET_FRACTION[worst] * 100) / 100,
    drawdownLimit: Math.round(aggregates.availableSurplusMonthly * SEVERITY_DRAWDOWN_FRACTION[worst] * 100) / 100,
    liquidityReserve: Math.round(aggregates.expenditureMonthly * SEVERITY_LIQUIDITY_RESERVE_MONTHS[worst] * 100) / 100,
    concentrationLimits,
    serviceClass: 'PROPOSAL',
    rationale,
  };
}

// ── Step 4: what consequence would a candidate action have ─────────────────

export interface CandidateAction {
  label: string;
  /** The amount the action would put at risk/commit. */
  notional: number;
  category?: string;
}

/**
 * PURE — no I/O, no authority check, no execution. Reuses CTP-001's own
 * `ConsequenceProjection` shape (types/ctp.ts) so a future CTP primitive or
 * the MPY2-4 Scenario Engine can consume this without a second consequence
 * vocabulary. This function NEVER authorizes anything — it only describes
 * what would follow if the action were taken against these limits.
 */
export function evaluateActionAgainstRiskEnvelope(action: CandidateAction, limits: RiskLimits): ConsequenceProjection {
  const effects: string[] = [];
  const categories: string[] = [];

  if (action.notional > limits.positionNotionalLimit) {
    effects.push(`'${action.label}' (${action.notional}) exceeds the recommended position notional limit of ${limits.positionNotionalLimit}.`);
    categories.push('position-limit-exceeded');
  } else {
    effects.push(`'${action.label}' (${action.notional}) is within the recommended position notional limit of ${limits.positionNotionalLimit}.`);
  }

  if (action.notional > limits.lossRiskBudget) {
    effects.push(`If fully lost, '${action.label}' would exceed the recommended loss/risk budget of ${limits.lossRiskBudget}.`);
    categories.push('loss-budget-exceeded');
  }

  if (action.category) {
    const matched = limits.concentrationLimits.find((c) => c.category === action.category);
    if (matched) {
      effects.push(`'${action.category}' already carries a recommended concentration limit (${(matched.limitShare * 100).toFixed(0)}% of expenditure) — this action would add to an already-flagged category.`);
      categories.push('concentration-limit-flagged');
    }
  }

  effects.push('This is a recommendation only (RiskLimits.serviceClass = PROPOSAL) — MoneyPenny holds no authority to permit or refuse this action.');

  return { effects, categories };
}
