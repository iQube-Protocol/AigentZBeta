/**
 * MoneyPenny Financial Profile — MPY2-2 (SPEC-MPY-002 §5, 2026-09-01).
 *
 * Proves the aggregation is pure and honest (no guessing — an unrecognized
 * statement shape or a missing balance column reports itself, never
 * fabricates a number), and that the capability-rail/panel wiring landed
 * without disturbing the pinned tabGroups/tab-list canaries other tests
 * already own.
 */
import { describe, it, expect, vi } from 'vitest';
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
    // No `aggregates` key at all on total failure — see
    // tests/moneypenny-empty-profile-evidence.test.ts for why this matters:
    // upsertFinancialProfileQube's has_profile derives from this.
    expect(result.aggregates).toBeUndefined();
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

/**
 * Turn G (2026-09-03) — AC-C06 ("unauthorized principal cannot read another
 * profile or media", `docs/specs/moneypenny/MoneyPenny_Cartridge_Spec_v1.md:293`).
 * Previously PARTIAL with the named gap "no dedicated cross-persona-read-denial
 * test located this pass." This closes exactly that gap: source-shape proof
 * that no financial-profile route accepts a caller-supplied personaId, plus a
 * real behavioral proof that the service layer's persona filter actually
 * isolates two personas' rows rather than merely appearing to in source text.
 */
describe('AC-C06 — cross-persona read denial: no route accepts a caller-supplied personaId', () => {
  const routeFiles = [
    'app/api/moneypenny/financial-profile/route.ts',
    'app/api/moneypenny/financial-profile/compute/route.ts',
    'app/api/moneypenny/financial-profile/manual/route.ts',
    'app/api/moneypenny/financial-profile/review/route.ts',
  ];

  it.each(routeFiles)('%s derives personaId only from getActivePersona(req), never from a query param or request body', async (path) => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const src = stripComments(readSource(path));
    expect(src).toMatch(/getActivePersona\(req\)/);
    expect(src).not.toMatch(/searchParams\.get\(['"]personaId['"]\)/);
    expect(src).not.toMatch(/body\??\.personaId/);
    expect(src).not.toMatch(/body\[['"]personaId['"]\]/);
  });
});

describe('AC-C06 — cross-persona read denial: the service layer actually isolates rows, not just in source text', () => {
  it('getFinancialProfileQube(personaId) returns ONLY the requested persona\'s row when two personas have rows in the same table', async () => {
    vi.resetModules();
    const rows = new Map<string, Record<string, unknown>>([
      ['persona-A', { persona_id: 'persona-A', has_profile: true, last_computed_at: 't', source_upload_count: 1, unreadable_upload_count: 0, blak_qube: { aggregates: { incomeMonthly: 4000 } }, reviewed_at: null, created_at: 't', updated_at: 't' }],
      ['persona-B', { persona_id: 'persona-B', has_profile: true, last_computed_at: 't', source_upload_count: 1, unreadable_upload_count: 0, blak_qube: { aggregates: { incomeMonthly: 9999 } }, reviewed_at: null, created_at: 't', updated_at: 't' }],
    ]);
    const fake = {
      from: (table: string) => {
        if (table !== 'financial_profile_qubes') throw new Error(`unexpected table: ${table}`);
        return {
          select: () => ({
            eq: (col: string, personaId: string) => {
              if (col !== 'persona_id') throw new Error(`unexpected filter column: ${col}`);
              return { maybeSingle: async () => ({ data: rows.get(personaId) ?? null, error: null }) };
            },
          }),
        };
      },
    };
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => fake }));
    const { getFinancialProfileQube } = await import('@/services/iqube/financialProfileQube');

    const recordA = await getFinancialProfileQube('persona-A');
    expect(recordA?.blak.aggregates?.incomeMonthly).toBe(4000);

    const recordB = await getFinancialProfileQube('persona-B');
    expect(recordB?.blak.aggregates?.incomeMonthly).toBe(9999);

    // The defining assertion: requesting A's profile never returns B's data
    // (or vice versa) even though both rows exist in the same fake table.
    expect(recordA?.blak.aggregates?.incomeMonthly).not.toBe(recordB?.blak.aggregates?.incomeMonthly);
  });

  it('a persona with no row of their own gets null, never another persona\'s row by fallback', async () => {
    vi.resetModules();
    const rows = new Map<string, Record<string, unknown>>([
      ['persona-A', { persona_id: 'persona-A', has_profile: true, last_computed_at: 't', source_upload_count: 1, unreadable_upload_count: 0, blak_qube: { aggregates: { incomeMonthly: 4000 } }, reviewed_at: null, created_at: 't', updated_at: 't' }],
    ]);
    const fake = {
      from: () => ({
        select: () => ({
          eq: (_col: string, personaId: string) => ({ maybeSingle: async () => ({ data: rows.get(personaId) ?? null, error: null }) }),
        }),
      }),
    };
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => fake }));
    const { getFinancialProfileQube } = await import('@/services/iqube/financialProfileQube');
    const record = await getFinancialProfileQube('persona-with-no-profile');
    expect(record).toBeNull();
  });
});

describe('MoneyPenny capability-rail / cartridge wiring — MPY2-2', () => {
  it('the Financial Profile capability item now points at a real panel, not null', async () => {
    const { MONEYPENNY_CAPABILITY_GROUPS } = await import('@/app/(shell)/moneypenny/components/moneypennyCapabilities');
    const item = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'financial-profile');
    expect(item).toBeDefined();
    expect(item!.panel).toBe('financial-profile');
  });

  it('financial-profile is a real MoneyPennyPanelKey, reachable as the My Money native tab\'s own default panel (navigation-hierarchy correction, 2026-09-03, second pass — five real native area tabs, not one collapsed tab)', async () => {
    const { MONEYPENNY_CARTRIDGE } = await import('@/data/codex-configs');
    const myMoneyTab = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.slug === 'my-money');
    expect(myMoneyTab).toBeDefined();
    expect(myMoneyTab!.config.component).toBe('MoneyPennyPanelTab');
    expect((myMoneyTab!.config.props as { area?: string }).area).toBe('my-money');
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const panelTabSrc = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));
    expect(panelTabSrc).toContain('"financial-profile": FinancialProfilePanel,');
    const capsSrc = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));
    expect(capsSrc).toMatch(/"financial-profile":\s*"my-money"/);
  });

  it('financial_document is a recognized upload useKind end to end — the type union AND the /api/uploads route allowlist both carry it (the exact drift class that route\'s own comment warns about)', async () => {
    const { readSource, stripComments } = await import('./_lib/sourceAuthority');
    const serviceSrc = stripComments(readSource('services/uploads/personaUploadService.ts'));
    expect(serviceSrc).toMatch(/'financial_document'/);
    const routeSrc = stripComments(readSource('app/api/uploads/route.ts'));
    expect(routeSrc).toMatch(/'financial_document'/);
  });
});
