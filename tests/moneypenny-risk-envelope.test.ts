/**
 * MoneyPenny Risk Envelope — MPY2-3 (SPEC-MPY-002 §5/§8, 2026-09-01).
 *
 * Proves: risk assessment is honest (a factor is asserted only when its
 * underlying aggregate is present; absence is reported, never defaulted to
 * 'low'), limits are conservative (the WORST observed severity governs the
 * whole envelope), the recommend-vs-authority framing reuses the existing
 * FinancialServiceConsequenceClass vocabulary rather than inventing one,
 * and the consequence evaluator reuses CTP-001's own ConsequenceProjection
 * type. Also pins the capability-rail/panel wiring.
 */
import { describe, it, expect } from 'vitest';
import { assessRisk, deriveRiskLimits, evaluateActionAgainstRiskEnvelope } from '@/services/financialServices/riskEnvelope';
import type { FinancialProfileAggregates } from '@/services/iqube/financialProfileQube';
import {
  MONEYPENNY_ADVISOR,
  MONEYPENNY_ARCHITECT,
  MONEYPENNY_RUNTIME,
  MONEYPENNY_RUNTIME_CONSTITUTIONAL,
} from '@/services/financialServices/serviceCatalog';

function aggregates(overrides: Partial<FinancialProfileAggregates> = {}): FinancialProfileAggregates {
  return {
    incomeMonthly: 4000,
    expenditureMonthly: 1800,
    availableSurplusMonthly: 2200,
    cashFlowVolatility: 0.1,
    liquidityBufferDays: 120,
    recurringCommitments: [{ label: 'Rent', monthlyAmount: 1200, observedMonths: 3 }],
    topCategories: [{ category: 'Rent', monthlyAmount: 1200, shareOfExpenditure: 0.667 }],
    ...overrides,
  };
}

describe('assessRisk — honest, never defaults absent data to low risk', () => {
  it('asserts a factor for every present aggregate, with a rationale citing which field it came from', () => {
    const a = aggregates();
    const result = assessRisk(a);
    expect(result.factors.map((f) => f.category).sort()).toEqual(['commitment-coverage', 'concentration', 'liquidity', 'volatility']);
    for (const f of result.factors) {
      expect(f.rationale.length).toBeGreaterThan(0);
      expect(f.derivedFrom.length).toBeGreaterThan(0);
    }
    expect(result.unassessed).toEqual([]);
  });

  it('a null liquidityBufferDays produces NO liquidity factor and reports it unassessed, never a fabricated "low"', () => {
    const a = aggregates({ liquidityBufferDays: null });
    const result = assessRisk(a);
    expect(result.factors.find((f) => f.category === 'liquidity')).toBeUndefined();
    expect(result.unassessed.some((u) => u.category === 'liquidity')).toBe(true);
  });

  it('a null cashFlowVolatility (single month observed) produces NO volatility factor', () => {
    const a = aggregates({ cashFlowVolatility: null });
    const result = assessRisk(a);
    expect(result.factors.find((f) => f.category === 'volatility')).toBeUndefined();
    expect(result.unassessed.some((u) => u.category === 'volatility')).toBe(true);
  });

  it('high concentration (>50% share) is severity "high"; low concentration (<20%) is "low"', () => {
    const high = assessRisk(aggregates({ topCategories: [{ category: 'Rent', monthlyAmount: 1000, shareOfExpenditure: 0.6 }] }));
    const low = assessRisk(aggregates({ topCategories: [{ category: 'Groceries', monthlyAmount: 200, shareOfExpenditure: 0.1 }] }));
    expect(high.factors.find((f) => f.category === 'concentration')?.severity).toBe('high');
    expect(low.factors.find((f) => f.category === 'concentration')?.severity).toBe('low');
  });
});

describe('deriveRiskLimits — conservative (worst severity governs), PROPOSAL-class only', () => {
  it('no envelope is proposed when surplus is not positive — never a recommendation to risk money that is not there', () => {
    const a = aggregates({ incomeMonthly: 1000, expenditureMonthly: 1500, availableSurplusMonthly: -500 });
    const assessment = assessRisk(a);
    expect(deriveRiskLimits(a, assessment)).toBeNull();
  });

  it('a single high-severity factor governs the whole envelope, even when other factors are low', () => {
    const a = aggregates({ liquidityBufferDays: 5 }); // high severity liquidity risk; everything else calm
    const assessment = assessRisk(a);
    const limits = deriveRiskLimits(a, assessment)!;
    expect(limits).not.toBeNull();
    // 'high' severity -> SEVERITY_NOTIONAL_MONTHS.high = 0.5 months of surplus
    expect(limits.positionNotionalLimit).toBe(Math.round(a.availableSurplusMonthly * 0.5 * 100) / 100);
    expect(limits.rationale.join(' ')).toMatch(/governing severity: high/i);
  });

  it('serviceClass is always PROPOSAL — reuses the existing FinancialServiceConsequenceClass vocabulary, never a second one', () => {
    const a = aggregates();
    const limits = deriveRiskLimits(a, assessRisk(a))!;
    expect(limits.serviceClass).toBe('PROPOSAL');
    // The literal string must be a real member of the catalog's own vocabulary
    // — reused, not a parallel one. MONEYPENNY_ARCHITECT itself declares
    // 'PROPOSAL', confirming Risk Envelope sits at the same Architect tier.
    const knownClasses = new Set(
      [MONEYPENNY_ADVISOR, MONEYPENNY_ARCHITECT, MONEYPENNY_RUNTIME, MONEYPENNY_RUNTIME_CONSTITUTIONAL].map((s) => s.serviceClass),
    );
    expect(knownClasses.has(limits.serviceClass)).toBe(true);
    expect(MONEYPENNY_ARCHITECT.serviceClass).toBe('PROPOSAL');
  });

  it('unassessed categories are named in the rationale — the limits stay honest about what could not be checked', () => {
    const a = aggregates({ liquidityBufferDays: null });
    const limits = deriveRiskLimits(a, assessRisk(a))!;
    expect(limits.rationale.join(' ')).toMatch(/liquidity/i);
    expect(limits.rationale.join(' ')).toMatch(/not assessable|unknown/i);
  });

  it('concentration limits are only proposed for categories currently above the low-risk share threshold', () => {
    const a = aggregates({
      topCategories: [
        { category: 'Rent', monthlyAmount: 1200, shareOfExpenditure: 0.667 },
        { category: 'Groceries', monthlyAmount: 100, shareOfExpenditure: 0.05 },
      ],
    });
    const limits = deriveRiskLimits(a, assessRisk(a))!;
    const categories = limits.concentrationLimits.map((c) => c.category);
    expect(categories).toContain('Rent');
    expect(categories).not.toContain('Groceries');
  });
});

describe('evaluateActionAgainstRiskEnvelope — pure, reuses CTP-001\'s ConsequenceProjection, never authorizes', () => {
  it('an action within limits reports no exceedance and always states MoneyPenny holds no authority', () => {
    const a = aggregates();
    const limits = deriveRiskLimits(a, assessRisk(a))!;
    const result = evaluateActionAgainstRiskEnvelope({ label: 'Small trade', notional: 10 }, limits);
    expect(result.effects.some((e) => /within the recommended position notional limit/i.test(e))).toBe(true);
    expect(result.effects.some((e) => /no authority to permit or refuse/i.test(e))).toBe(true);
    expect(result.categories).not.toContain('position-limit-exceeded');
  });

  it('an action exceeding the notional limit is flagged, never silently allowed', () => {
    const a = aggregates();
    const limits = deriveRiskLimits(a, assessRisk(a))!;
    const result = evaluateActionAgainstRiskEnvelope({ label: 'Big trade', notional: limits.positionNotionalLimit + 1000 }, limits);
    expect(result.categories).toContain('position-limit-exceeded');
  });

  it('returns exactly the ConsequenceProjection shape (effects: string[], categories?: string[]) — no extra authority-bearing fields', () => {
    const a = aggregates();
    const limits = deriveRiskLimits(a, assessRisk(a))!;
    const result = evaluateActionAgainstRiskEnvelope({ label: 'Test', notional: 5 }, limits);
    expect(Object.keys(result).sort()).toEqual(['categories', 'effects']);
    expect(Array.isArray(result.effects)).toBe(true);
  });
});

describe('MoneyPenny capability-rail / cartridge wiring — MPY2-3', () => {
  it('the Risk & Limits capability item now points at a real panel, not null', async () => {
    const { MONEYPENNY_CAPABILITY_GROUPS } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    const item = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'risk-envelope');
    expect(item).toBeDefined();
    expect(item!.panel).toBe('risk-envelope');
  });

  it('MONEYPENNY_CARTRIDGE gets a real risk-envelope tab in the EXISTING operate group — tabGroups itself stays pinned', async () => {
    const { MONEYPENNY_CARTRIDGE } = await import('@/data/codex-configs');
    const groupIds = (MONEYPENNY_CARTRIDGE.tabGroups ?? []).map((g) => g.id);
    expect(groupIds).toEqual(['operate', 'connect', 'service', 'administer']);
    const tab = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.slug === 'risk-envelope');
    expect(tab).toBeDefined();
    expect(tab!.group).toBe('operate');
  });
});
