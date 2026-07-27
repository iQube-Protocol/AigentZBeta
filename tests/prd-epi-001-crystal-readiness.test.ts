/**
 * Canary — PRD-EPI-001 §3.1 Crystal Intrinsic Readiness Report.
 *
 * Pins the honest-degradation contract: a domain with no invariants yet
 * (the expected state right now — Track 2, the crystal source-material
 * work, is paused per PRD-EPI-001 §0.6/§9) must report `ok: false` with
 * zero counts, never crash, and never silently report readiness.
 */

import { describe, it, expect, vi } from 'vitest';
import { runCrystalReadinessReport } from '../services/research/crystalReadiness';
import { listInvariants } from '@/services/invariants/store';

// Pass through to the real store by default, so the tests below still exercise
// the genuine substrate path. One test overrides it for a single call to make
// the empty-collection path reachable in EVERY environment — see its comment.
vi.mock('@/services/invariants/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/invariants/store')>();
  return { ...actual, listInvariants: vi.fn(actual.listInvariants) };
});

describe('PRD-EPI-001 §3.1 — Crystal Intrinsic Readiness Report', () => {
  it('reports ok: false, never throws, for a domain with no invariants yet', async () => {
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'constitutional-reasoning-does-not-exist-yet',
    });
    expect(report.ok).toBe(false);
    expect(report.invariantCount).toBe(0);
    expect(report.eligibleCount).toBe(0);
    expect(report.checks.length).toBeGreaterThan(0);
    for (const check of report.checks) {
      expect(typeof check.name).toBe('string');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.detail).toBe('string');
    }
  });

  it('every check fails closed on a KNOWN-empty collection (substrate-independent)', async () => {
    // Determinism matters here, and its absence hid a real bug until
    // 2026-07-26. The sibling test below only reaches the per-check loop when
    // the invariant substrate is REACHABLE and returns zero rows. In an
    // environment with no Supabase credentials the fetch throws, the report
    // short-circuits to a single failing 'invariant-fetch' check, and the loop
    // never runs — so CI was green while a real fail-open sat in the code:
    // `duplicate-detection` reported passed:true on an empty collection
    // ("no duplicates found" is vacuously true with nothing to compare).
    // It surfaced only on a machine that HAD credentials.
    //
    // Forcing an empty result makes the full check list reachable everywhere,
    // so this class of vacuous pass fails the build rather than depending on
    // who runs it.
    vi.mocked(listInvariants).mockResolvedValueOnce([]);
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'constitutional-reasoning-does-not-exist-yet',
    });
    expect(report.ok).toBe(false);
    expect(report.invariantCount).toBe(0);
    expect(report.checks.length).toBeGreaterThan(1);
    expect(report.checks.map((c) => c.name)).toContain('duplicate-detection');
    for (const check of report.checks) {
      expect(check.passed, `check '${check.name}' passed on zero invariants`).toBe(false);
    }
  });

  it('every check on an empty domain fails closed, not silently passes', async () => {
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'constitutional-reasoning-does-not-exist-yet',
    });
    // If the substrate itself is unreachable in this environment, the
    // function still returns a well-formed report (a single failing
    // 'invariant-fetch' check) rather than throwing — either way `ok` must
    // be false and no check may report passed:true on zero data.
    if (report.checks.length === 1 && report.checks[0].name === 'invariant-fetch') {
      expect(report.checks[0].passed).toBe(false);
    } else {
      for (const check of report.checks) {
        expect(check.passed).toBe(false);
      }
    }
  });

  it('defaults crystalDomain to constitutional-reasoning when omitted', async () => {
    // Must not throw even though no live invariant_contexts row is tagged
    // with this domain yet — the whole point of the honest-degradation
    // contract (PRD-EPI-001 §3.1 doc comment).
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1' });
    expect(report.ok).toBe(false);
    expect(Array.isArray(report.checks)).toBe(true);
  });

  // ── §2a as refined 2026-07-27 — evidence provenance decides the population ──

  function inv(id: string, provenance: Record<string, unknown>) {
    return {
      id,
      statement: `If ${id} holds then the successor state is entailed, provided that the predicate is met.`,
      semanticType: id.endsWith('1') ? 'constraint' : 'principle',
      timesValidated: 3,
      provenance,
    } as unknown as Awaited<ReturnType<typeof listInvariants>>[number];
  }

  it('reports the A/B/C/unclassified split and BOTH the core and ablation counts', async () => {
    // Mutation: drop `populations` from the report, or stop counting the
    // ablation as A ∪ B, and this fails. The ablation is now a permanent
    // feature of every crystal report, not a "where feasible".
    vi.mocked(listInvariants).mockResolvedValueOnce([
      inv('x1', { provenanceClass: 'external-established' }),
      inv('x2', { provenanceClass: 'platform-derived' }),
      inv('x3', { provenanceClass: 'platform-hypothesized' }),
      inv('x4', { provenanceClass: 'platform-doctrine' }),
      inv('x5', { source: 'CFS-009 Law XVI' }),
    ]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(report.populations).toEqual({ A: 1, B: 2, C: 1, unclassified: 1, ablationCount: 3 });
    expect(report.eligibleCount).toBe(1);
    const check = report.checks.find((c) => c.name === 'provenance-eligibility');
    expect(check?.detail).toContain('P1 Ablation');
    // Not eligible: only 1 of 5 is Population A.
    expect(check?.passed).toBe(false);
  });

  it('admits an IDE-discovered invariant from an EXTERNAL corpus to the primary population', async () => {
    // The ruling's central case, asserted through the real report path:
    // discovery provenance `ide` must not exclude it. Mutation: make
    // eligibility consult discoveryProvenance → eligibleCount drops to 0.
    vi.mocked(listInvariants).mockResolvedValueOnce([
      inv('f1', { provenanceClass: 'external-established', discoveryProvenance: 'ide', source: 'FATF R.16' }),
      inv('f2', { provenanceClass: 'external-empirical', discoveryProvenance: 'ide', source: 'Basel III' }),
    ]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(report.populations.A).toBe(2);
    expect(report.populations.B).toBe(0);
    expect(report.eligibleCount).toBe(2);
    expect(report.checks.find((c) => c.name === 'provenance-eligibility')?.passed).toBe(true);
  });

  it('keeps an IDE-discovered invariant from the PLATFORM corpus out of the primary population', async () => {
    vi.mocked(listInvariants).mockResolvedValueOnce([
      inv('p1', { source: 'PRD-IDE-002 §9.1 C-001; evidenceProvenance=platform-derived; discoveryProvenance=ide.' }),
    ]);
    const report = await runCrystalReadinessReport({ experimentId: 'EXP-P1', crystalDomain: 'd' });
    expect(report.populations).toMatchObject({ A: 0, B: 1, ablationCount: 1 });
    expect(report.eligibleCount).toBe(0);
    expect(report.checks.find((c) => c.name === 'provenance-eligibility')?.passed).toBe(false);
  });

  it('applies the illustrative override parameters without throwing', async () => {
    const report = await runCrystalReadinessReport({
      experimentId: 'EXP-P1',
      crystalDomain: 'constitutional-reasoning-does-not-exist-yet',
      minMeaningfulSliceSize: 1,
      minDerivationEligibleFraction: 0,
      maxDominantShapeFraction: 1,
      duplicateSimilarityThreshold: 0.99,
      fetchLimit: 10,
    });
    expect(typeof report.ok).toBe('boolean');
  });
});
