/**
 * services/strategy/experienceMatrixDeriver.ts — uncertainty-semantics repair
 * (AEE-XP-001 §10, 2026-09-01), applying the Track 2 invariant here too:
 * "Unknown is not empty. Read failure must never become state."
 *
 * Before this fix, `deriveMatrixCalibration`'s two reads (`experience_qubes`,
 * `venture_qubes`) each swallowed EVERY error identically to "no row found"
 * — a genuine outage looked exactly like a persona who never configured an
 * experience model, and both collapsed into `source: 'default'` with no way
 * for a caller to tell them apart. Any future authoritative consumer (the
 * AEE ExperiencePrescription assembler) reading `source === 'default'` alone
 * would have confidently prescribed a Visitor/beginner experience for a
 * persona whose real calibration was simply unreadable at that moment.
 *
 * This test proves three states stay distinct:
 *   1. successful read, genuinely no row  → uncertain: false, source: 'default'
 *   2. successful read, real data         → uncertain: false, source reflects data
 *   3. failed/thrown read                 → uncertain: true, unreadableSources set
 * and that a missing-table error (PGRST205/42P01 — a deployment-state fact,
 * not a read failure) is still treated as case 1, unchanged from before.
 */
import { describe, it, expect } from 'vitest';
import { deriveMatrixCalibration } from '@/services/strategy/experienceMatrixDeriver';

type FakeResult = { data?: unknown; error?: { code?: string; message?: string } | null };

/** One result per `.from()` call, in call order — mirrors the two sequential
 *  reads `deriveMatrixCalibration` performs (experience_qubes, venture_qubes). */
function fakeSupabaseClientSequence(results: FakeResult[]) {
  const queue = [...results];
  return {
    from: () => {
      const result = queue.shift() ?? { data: null, error: null };
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
  } as any;
}

/** Same shape, but `.from()` (or a chained method) THROWS synchronously —
 *  the "not even an error-shaped response" failure mode. */
function throwingSupabaseClient() {
  return {
    from: () => {
      throw new Error('connection reset');
    },
  } as any;
}

describe('deriveMatrixCalibration — uncertainty semantics', () => {
  it('successful reads, genuinely no rows → uncertain: false, source: default (unchanged legitimate onboarding state)', async () => {
    const client = fakeSupabaseClientSequence([
      { data: null, error: null },
      { data: [], error: null },
    ]);
    const result = await deriveMatrixCalibration(client, 'persona-1');
    expect(result.uncertain).toBe(false);
    expect(result.unreadableSources).toBeUndefined();
    expect(result.source).toBe('default');
    expect(result.hasExperienceModel).toBe(false);
  });

  it('successful reads with real data → uncertain: false, calibration reflects the data (legitimate low/high maturity)', async () => {
    const client = fakeSupabaseClientSequence([
      {
        data: {
          current_stage: 'growth',
          experience_name: 'Test Venture',
          experience_type: 'business',
          blak_qube: { personalGuide: { sphereMaturity: { energy: 'sustaining' } } },
        },
        error: null,
      },
      { data: [], error: null },
    ]);
    const result = await deriveMatrixCalibration(client, 'persona-2');
    expect(result.uncertain).toBe(false);
    expect(result.unreadableSources).toBeUndefined();
    expect(result.hasExperienceModel).toBe(true);
    expect(result.source).toBe('experience_model');
  });

  it('a missing-table error (PGRST205) is still treated as "not configured yet", never as unreadable', async () => {
    const client = fakeSupabaseClientSequence([
      { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.experience_qubes'" } },
      { data: null, error: { code: '42P01', message: 'relation "venture_qubes" does not exist' } },
    ]);
    const result = await deriveMatrixCalibration(client, 'persona-3');
    expect(result.uncertain).toBe(false);
    expect(result.unreadableSources).toBeUndefined();
    expect(result.source).toBe('default');
  });

  it('a real read failure on experience_qubes (error-shaped, non-missing-table code) is reported as uncertain, not as default beginner state', async () => {
    const client = fakeSupabaseClientSequence([
      { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } },
      { data: [], error: null },
    ]);
    const result = await deriveMatrixCalibration(client, 'persona-4');
    expect(result.uncertain).toBe(true);
    expect(result.unreadableSources).toEqual(['experience_qubes']);
    // The position is still a best-effort default for non-authoritative
    // visual surfaces, but callers MUST check `uncertain` before treating
    // `source === 'default'` as a confirmed beginner state.
    expect(result.source).toBe('default');
  });

  it('a thrown (not error-shaped) failure on venture_qubes is also reported as uncertain', async () => {
    const client = fakeSupabaseClientSequence([{ data: null, error: null }]);
    // Second .from() call throws — simulate by overriding after the first read.
    let calls = 0;
    const throwingAfterFirst = {
      from: () => {
        calls += 1;
        if (calls === 1) {
          const builder: any = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          };
          return builder;
        }
        throw new Error('network unreachable');
      },
    } as any;
    const result = await deriveMatrixCalibration(throwingAfterFirst, 'persona-5');
    expect(result.uncertain).toBe(true);
    expect(result.unreadableSources).toEqual(['venture_qubes']);
  });

  it('both reads thrown → uncertain: true, both sources listed, never masquerading as a confirmed default', async () => {
    const client = throwingSupabaseClient();
    const result = await deriveMatrixCalibration(client, 'persona-6');
    expect(result.uncertain).toBe(true);
    expect(result.unreadableSources).toEqual(['experience_qubes', 'venture_qubes']);
    expect(result.source).toBe('default');
    expect(result.reason).toMatch(/unable to read/i);
  });
});
