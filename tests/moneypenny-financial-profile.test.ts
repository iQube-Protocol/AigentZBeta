/**
 * MoneyPenny Financial Profile — MPY2-2 (SPEC-MPY-002 §5, 2026-09-01).
 *
 * Proves the aggregation is pure and honest (no guessing — an unrecognized
 * statement shape or a missing balance column reports itself, never
 * fabricates a number), and that the capability-rail/panel wiring landed
 * without disturbing the pinned tabGroups/tab-list canaries other tests
 * already own.
 */
import { describe, it, expect } from 'vitest';
import { computeFinancialProfile, type StatementSourceRows } from '@/services/financialServices/financialProfileAggregation';

function csvRows(rows: Array<Record<string, string>>): Array<Record<string, string>> {
  return rows;
}

describe('computeFinancialProfile — recognized shapes', () => {
  it('a signed-amount CSV with date/description/amount/balance produces real aggregates, never fabricated ones', () => {
    const sources: StatementSourceRows[] = [
      {
        uploadId: 'up-1',
        rows: csvRows([
          { Date: '2026-06-02', Description: 'Employer Payroll', Amount: '4000.00', Balance: '5200.00' },
          { Date: '2026-06-05', Description: 'Netflix.com', Amount: '-15.00', Balance: '5185.00' },
          { Date: '2026-06-10', Description: 'Rent Payment', Amount: '-1800.00', Balance: '3385.00' },
          { Date: '2026-07-02', Description: 'Employer Payroll', Amount: '4000.00', Balance: '5585.00' },
          { Date: '2026-07-05', Description: 'Netflix.com', Amount: '-15.00', Balance: '5570.00' },
          { Date: '2026-07-10', Description: 'Rent Payment', Amount: '-1800.00', Balance: '3770.00' },
        ]),
      },
    ];
    const result = computeFinancialProfile(sources);
    expect(result.ok).toBe(true);
    expect(result.readableUploadIds).toEqual(['up-1']);
    expect(result.unreadableUploadIds).toEqual([]);
    expect(result.aggregates!.incomeMonthly).toBe(4000);
    expect(result.aggregates!.expenditureMonthly).toBe(1815);
    expect(result.aggregates!.availableSurplusMonthly).toBe(2185);
    // Two months observed, real volatility number.
    expect(result.aggregates!.cashFlowVolatility).not.toBeNull();
    // Balance column present -> a real liquidity buffer, not null.
    expect(result.aggregates!.liquidityBufferDays).not.toBeNull();
    // Netflix + Rent both recur across the two months.
    const labels = result.aggregates!.recurringCommitments.map((c) => c.label);
    expect(labels).toContain('Rent Payment');
    expect(labels).toContain('Netflix.com');
    // Surplus is positive -> a candidate envelope IS proposed.
    expect(result.envelope).toBeDefined();
    expect(result.envelope!.strategyConstraints.some((s) => /no authority to trade/i.test(s))).toBe(true);
  });

  it('a debit/credit-column CSV (no signed amount column) is recognized and produces the same signed-amount math', () => {
    const sources: StatementSourceRows[] = [
      {
        uploadId: 'up-2',
        rows: csvRows([
          { Date: '2026-06-01', Description: 'Salary', Credit: '3000.00', Debit: '' },
          { Date: '2026-06-15', Description: 'Groceries', Credit: '', Debit: '400.00' },
        ]),
      },
    ];
    const result = computeFinancialProfile(sources);
    expect(result.ok).toBe(true);
    expect(result.aggregates!.incomeMonthly).toBe(3000);
    expect(result.aggregates!.expenditureMonthly).toBe(400);
  });
});

describe('computeFinancialProfile — honest failure, never a guess', () => {
  it('a non-CSV upload (rows: null) is reported unreadable, never silently skipped or coerced into zero', () => {
    const sources: StatementSourceRows[] = [{ uploadId: 'pdf-1', rows: null }];
    const result = computeFinancialProfile(sources);
    expect(result.ok).toBe(false);
    expect(result.unreadableUploadIds).toEqual(['pdf-1']);
    expect(result.readableUploadIds).toEqual([]);
    expect(result.notes.join(' ')).toMatch(/no usable transaction rows/i);
  });

  it('a CSV with an unrecognized column shape (no date/amount-ish headers) is reported unreadable rather than guessed at', () => {
    const sources: StatementSourceRows[] = [
      { uploadId: 'weird-1', rows: csvRows([{ Foo: 'bar', Baz: '123' }]) },
    ];
    const result = computeFinancialProfile(sources);
    expect(result.ok).toBe(false);
    expect(result.unreadableUploadIds).toEqual(['weird-1']);
  });

  it('one unreadable upload alongside one readable upload does not withhold the readable one — exception isolation, same discipline as admissionPreparation.ts', () => {
    const sources: StatementSourceRows[] = [
      { uploadId: 'pdf-1', rows: null },
      { uploadId: 'up-1', rows: csvRows([
        { Date: '2026-06-01', Description: 'Salary', Amount: '2000' },
        { Date: '2026-06-15', Description: 'Rent', Amount: '-900' },
      ]) },
    ];
    const result = computeFinancialProfile(sources);
    expect(result.ok).toBe(true);
    expect(result.readableUploadIds).toEqual(['up-1']);
    expect(result.unreadableUploadIds).toEqual(['pdf-1']);
    expect(result.aggregates!.incomeMonthly).toBe(2000);
  });

  it('cashFlowVolatility is null (never a fabricated 0) with only one statement month observed', () => {
    const sources: StatementSourceRows[] = [
      { uploadId: 'up-1', rows: csvRows([{ Date: '2026-06-01', Description: 'Salary', Amount: '2000' }]) },
    ];
    const result = computeFinancialProfile(sources);
    expect(result.aggregates!.cashFlowVolatility).toBeNull();
    expect(result.notes.join(' ')).toMatch(/single month/i);
  });

  it('liquidityBufferDays is null (never guessed from transaction totals) when no statement carries a balance column', () => {
    const sources: StatementSourceRows[] = [
      { uploadId: 'up-1', rows: csvRows([
        { Date: '2026-06-01', Description: 'Salary', Amount: '2000' },
        { Date: '2026-07-01', Description: 'Salary', Amount: '2000' },
      ]) },
    ];
    const result = computeFinancialProfile(sources);
    expect(result.aggregates!.liquidityBufferDays).toBeNull();
    expect(result.notes.join(' ')).toMatch(/no uploaded statement carried a balance column/i);
  });

  it('no candidate envelope is proposed when average expenditure meets or exceeds average income — never a recommendation to risk money that is not there', () => {
    const sources: StatementSourceRows[] = [
      { uploadId: 'up-1', rows: csvRows([
        { Date: '2026-06-01', Description: 'Salary', Amount: '2000' },
        { Date: '2026-06-15', Description: 'Rent', Amount: '-2500' },
      ]) },
    ];
    const result = computeFinancialProfile(sources);
    expect(result.ok).toBe(true);
    expect(result.envelope).toBeUndefined();
    expect(result.notes.join(' ')).toMatch(/no candidate trading envelope is proposed/i);
  });
});

describe('computeFinancialProfile — determinism', () => {
  it('is a pure function: the same input yields byte-identical output across two runs', () => {
    const sources: StatementSourceRows[] = [
      { uploadId: 'up-1', rows: csvRows([
        { Date: '2026-06-01', Description: 'Salary', Amount: '2000', Balance: '5000' },
        { Date: '2026-06-15', Description: 'Groceries', Amount: '-300', Balance: '4700' },
      ]) },
    ];
    const a = computeFinancialProfile(sources);
    const b = computeFinancialProfile(sources);
    expect(a).toEqual(b);
  });
});

describe('MoneyPenny capability-rail / cartridge wiring — MPY2-2', () => {
  it('the Financial Profile capability item now points at a real panel, not null', async () => {
    const { MONEYPENNY_CAPABILITY_GROUPS } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    const item = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'financial-profile');
    expect(item).toBeDefined();
    expect(item!.panel).toBe('financial-profile');
  });

  it('MONEYPENNY_CARTRIDGE gets a real financial-profile tab in the EXISTING operate group — tabGroups itself is untouched (pinned by fs-operate-embed-viewport-parity.test.ts)', async () => {
    const { MONEYPENNY_CARTRIDGE } = await import('@/data/codex-configs');
    const groupIds = (MONEYPENNY_CARTRIDGE.tabGroups ?? []).map((g) => g.id);
    expect(groupIds).toEqual(['operate', 'connect', 'service', 'administer']);
    const tab = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.slug === 'financial-profile');
    expect(tab).toBeDefined();
    expect(tab!.group).toBe('operate');
  });

  it('financial_document is a recognized upload useKind end to end — the type union AND the /api/uploads route allowlist both carry it (the exact drift class that route\'s own comment warns about)', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const serviceSrc = stripComments(readSource('services/uploads/personaUploadService.ts'));
    expect(serviceSrc).toMatch(/'financial_document'/);
    const routeSrc = stripComments(readSource('app/api/uploads/route.ts'));
    expect(routeSrc).toMatch(/'financial_document'/);
  });
});
