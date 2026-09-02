/**
 * Turn D (2026-09-02) — Prepare empty-state semantics: "users may continue
 * to appropriate learning or simulation, but an empty profile must not earn
 * 'financial profile prepared' evidence."
 *
 * Confirmed defect: `upsertFinancialProfileQube` hardcoded `has_profile:
 * true` on every write, including a compute pass where EVERY uploaded
 * statement was unreadable (computeFinancialProfile returns no `aggregates`
 * at all — see tests/moneypenny-financial-profile.test.ts's "honest failure"
 * describe block). `hasPreparedFinancialProfile()`
 * (services/journey/financialSovereigntyEvidence.ts) reads exactly this
 * flag to decide fs-prepare's completionEvidence — so a fully-failed upload
 * pass was silently earning "prepared" evidence. Fixed by deriving
 * `has_profile` from whether real aggregates exist, not from "a write
 * happened."
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { computeFinancialProfile, computeManualFinancialProfile } from '@/services/financialServices/financialProfileAggregation';

describe('upsertFinancialProfileQube derives has_profile from real aggregates, never a hardcoded true', () => {
  const src = stripComments(readSource('services/iqube/financialProfileQube.ts'));

  it('has_profile is Boolean(input.blak.aggregates), not a literal true', () => {
    expect(src).not.toMatch(/has_profile:\s*true,/);
    expect(src).toMatch(/has_profile:\s*Boolean\(input\.blak\.aggregates\),/);
  });
});

describe('hasPreparedFinancialProfile reads the real per-persona record, never a click/navigation event', () => {
  const src = stripComments(readSource('services/journey/financialSovereigntyEvidence.ts'));

  it('checks meta.hasProfile === true against getFinancialProfileQube, not a session/navigation flag', () => {
    expect(src).toMatch(/import \{ getFinancialProfileQube \} from '@\/services\/iqube\/financialProfileQube'/);
    expect(src).toMatch(/record\?\.meta\.hasProfile === true/);
  });
});

describe('The upstream compute path genuinely produces no aggregates on a fully-failed upload pass', () => {
  it('every uploaded statement unreadable -> no aggregates key at all (not an empty object)', () => {
    const result = computeFinancialProfile([{ uploadId: 'pdf-1', rows: null }]);
    expect(result.ok).toBe(false);
    expect(result.aggregates).toBeUndefined();
  });

  it('zero uploads -> same honest no-aggregates outcome', () => {
    const result = computeFinancialProfile([]);
    expect(result.ok).toBe(false);
    expect(result.aggregates).toBeUndefined();
  });
});

describe('Manual entry always produces real aggregates (a self-reported figure is still a real figure, even $0)', () => {
  it('income=0, expenditure=0 still returns a defined aggregates object — a legitimate prepared state, not empty', () => {
    const result = computeManualFinancialProfile({ incomeMonthly: 0, expenditureMonthly: 0, liquidityBufferDays: null });
    expect(result.ok).toBe(true);
    expect(result.aggregates).toBeDefined();
  });
});

describe('The compute route still calls the ONE canonical writer even on a fully-failed pass — the fix must live in the writer, not by skipping the write', () => {
  const src = stripComments(readSource('app/api/moneypenny/financial-profile/compute/route.ts'));

  it('upsertFinancialProfileQube is called unconditionally after computeFinancialProfile, not gated on result.ok', () => {
    // No early return between computeFinancialProfile and the upsert call —
    // the honest-write-of-failure design (still records source/unreadable
    // counts even when nothing was derived), which is exactly why the fix
    // had to live in the writer's has_profile derivation, not in this route.
    const computeIdx = src.indexOf('const result = computeFinancialProfile(sources);');
    const upsertIdx = src.indexOf('const record = await upsertFinancialProfileQube(');
    expect(computeIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(computeIdx);
    const between = src.slice(computeIdx, upsertIdx);
    expect(between).not.toMatch(/return NextResponse\.json/);
  });
});
