/**
 * Turn E (2026-09-02) — operator directive: "'real aggregates exist'
 * establishes data availability, while prepared evidence reflects the
 * required user review. A successful extraction alone must not silently
 * count as a reviewed profile."
 *
 * `has_profile` (fixed in Turn D — tests/moneypenny-empty-profile-evidence.test.ts)
 * proves a compute/manual-entry pass produced real aggregates. This pass
 * adds a SEPARATE, explicit-action-only signal (`reviewed_at`) so Prepare's
 * evidence bar requires both: data exists AND the person actually reviewed
 * it (a real button click, never a compute-pass side effect, never a
 * panel-mount/view effect).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

/**
 * Turn F (2026-09-02) — operator directive: "Confirm that editing or
 * replacing financial-profile data invalidates its prior review, or binds
 * that review to the reviewed revision." Every test above this point is a
 * source-shape assertion (regex against the file text) — real, but it
 * proves the code READS a certain way, not that calling the real functions
 * in sequence actually behaves that way. This block exercises
 * upsertFinancialProfileQube / markFinancialProfileReviewed against an
 * in-memory fake Supabase client and asserts the returned records
 * themselves: reviewedAt goes null -> set -> null across a real
 * compute -> review -> edit -> (refused re-review) sequence.
 */
function makeFakeFinancialProfileTable() {
  const rows = new Map<string, Record<string, unknown>>();
  const client = {
    from: (table: string) => {
      if (table !== 'financial_profile_qubes') throw new Error(`unexpected table: ${table}`);
      return {
        upsert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const personaId = row.persona_id as string;
              const merged = { ...rows.get(personaId), ...row };
              rows.set(personaId, merged);
              return { data: merged, error: null };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, personaId: string) => ({
            select: () => ({
              single: async () => {
                const existing = rows.get(personaId);
                if (!existing) return { data: null, error: { message: 'no row' } };
                const merged = { ...existing, ...patch };
                rows.set(personaId, merged);
                return { data: merged, error: null };
              },
            }),
          }),
        }),
        select: () => ({
          eq: (_col: string, personaId: string) => ({
            maybeSingle: async () => ({ data: rows.get(personaId) ?? null, error: null }),
          }),
        }),
      };
    },
  };
  return client;
}

describe('reviewed_at invalidation — real behavioral sequence, not just source shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('compute -> review -> edit -> reviewedAt is null again on the new revision (never carried forward)', async () => {
    const fake = makeFakeFinancialProfileTable();
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => fake }));
    const { upsertFinancialProfileQube, markFinancialProfileReviewed } = await import(
      '@/services/iqube/financialProfileQube'
    );

    const personaId = 'persona-reviewed-at-test';
    const input = {
      sourceUploadCount: 1,
      unreadableUploadCount: 0,
      blak: { aggregates: { monthlyIncome: 5000 } as unknown as Record<string, unknown> },
    } as Parameters<typeof upsertFinancialProfileQube>[1];

    // 1. First compute pass — a fresh profile has never been reviewed.
    const afterCompute = await upsertFinancialProfileQube(personaId, input);
    expect(afterCompute.meta.hasProfile).toBe(true);
    expect(afterCompute.meta.reviewedAt).toBeNull();

    // 2. Explicit review action — the ONLY thing that sets reviewedAt.
    const afterReview = await markFinancialProfileReviewed(personaId);
    expect(afterReview.meta.reviewedAt).not.toBeNull();
    const reviewedTimestamp = afterReview.meta.reviewedAt;

    // 3. A second compute/manual-entry pass — new data replaces the old
    //    revision. Per the operator's directive, this MUST invalidate the
    //    prior review rather than silently carrying it forward.
    const afterSecondCompute = await upsertFinancialProfileQube(personaId, {
      ...input,
      blak: { aggregates: { monthlyIncome: 6000 } as unknown as Record<string, unknown> },
    });
    expect(afterSecondCompute.meta.reviewedAt).toBeNull();
    expect(afterSecondCompute.meta.reviewedAt).not.toBe(reviewedTimestamp);
  });

  it('markFinancialProfileReviewed refuses (NoFinancialProfileToReviewError) when no profile row exists yet — reviewing nothing is not a real action', async () => {
    const fake = makeFakeFinancialProfileTable();
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => fake }));
    const { markFinancialProfileReviewed, NoFinancialProfileToReviewError } = await import(
      '@/services/iqube/financialProfileQube'
    );
    await expect(markFinancialProfileReviewed('persona-never-computed')).rejects.toThrow(
      NoFinancialProfileToReviewError,
    );
  });
});

describe('financial_profile_qubes.reviewed_at — schema', () => {
  it('the migration adds reviewed_at as a nullable timestamptz, additive only', () => {
    const src = readSource('supabase/migrations/20260902020000_financial_profile_qubes_reviewed_at.sql');
    expect(src).toMatch(/ADD COLUMN IF NOT EXISTS reviewed_at timestamptz/);
  });
});

describe('FinancialProfileQube service — reviewed_at discipline', () => {
  const src = stripComments(readSource('services/iqube/financialProfileQube.ts'));

  it('rowToRecord reads reviewed_at with an honest ?? null fallback (never fabricated as reviewed)', () => {
    expect(src).toMatch(/reviewedAt:\s*row\.reviewed_at\s*\?\?\s*null,/);
  });

  it('every fresh upsert clears reviewed_at to null — a new profile has not itself been reviewed', () => {
    const upsertFn = src.match(/export async function upsertFinancialProfileQube\([\s\S]*?\n\}/)?.[0] ?? '';
    expect(upsertFn).toMatch(/reviewed_at:\s*null,/);
  });

  it('markFinancialProfileReviewed is the ONLY writer of reviewed_at, and refuses when no profile exists yet', () => {
    expect(src).toMatch(/export async function markFinancialProfileReviewed/);
    expect(src).toMatch(/export class NoFinancialProfileToReviewError/);
    const fn = src.match(/export async function markFinancialProfileReviewed\([\s\S]*?\n\}/)?.[0] ?? '';
    expect(fn).toMatch(/if \(!existing \|\| !existing\.meta\.hasProfile\) \{\s*throw new NoFinancialProfileToReviewError\(\);/);
    expect(fn).toMatch(/update\(\{ reviewed_at: new Date\(\)\.toISOString\(\) \}\)/);
  });

  it('reviewed_at is set nowhere else in the file — grep the whole file for every write site', () => {
    const writeSites = [...src.matchAll(/reviewed_at:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
    // Exactly two write sites expected: the upsert's `null` clear, and
    // markFinancialProfileReviewed's `new Date().toISOString()` set.
    expect(writeSites.sort()).toEqual(['new Date().toISOString()', 'null'].sort());
  });
});

describe('hasPreparedFinancialProfile requires BOTH hasProfile AND reviewedAt — data availability is not review', () => {
  const src = stripComments(readSource('services/journey/financialSovereigntyEvidence.ts'));

  it('checks reviewedAt !== null in addition to the existing hasProfile check', () => {
    expect(src).toMatch(/record\?\.meta\.hasProfile === true && record\?\.meta\.reviewedAt !== null/);
  });
});

describe('POST /api/moneypenny/financial-profile/review — the one route allowed to mark reviewed', () => {
  const src = stripComments(readSource('app/api/moneypenny/financial-profile/review/route.ts'));

  it('requires an authenticated persona (getActivePersona), same spine discipline as every other MoneyPenny route', () => {
    expect(src).toMatch(/import \{ getActivePersona \} from '@\/services\/identity\/getActivePersona'/);
    expect(src).toMatch(/if \(!persona\?\.personaId\)/);
  });

  it('calls markFinancialProfileReviewed — no parallel write path', () => {
    expect(src).toMatch(/import \{\s*markFinancialProfileReviewed,/);
    expect(src).toMatch(/const record = await markFinancialProfileReviewed\(persona\.personaId\);/);
  });

  it('answers honestly (409) when there is nothing to review, never a fabricated success', () => {
    expect(src).toMatch(/NoFinancialProfileToReviewError/);
    expect(src).toMatch(/status: 409/);
  });
});

describe('Shared client module — fetchFinancialProfileSummary carries reviewedAt; markFinancialProfileReviewed is the one client-side caller', () => {
  const src = stripComments(readSource('services/moneypenny/financialProfileSummary.ts'));

  it('FinancialProfileSummary includes reviewedAt', () => {
    expect(src).toMatch(/reviewedAt:\s*string \| null;/);
  });

  it('fetchFinancialProfileSummary reads meta.reviewedAt with an honest ?? null fallback', () => {
    expect(src).toMatch(/reviewedAt:\s*json\.meta\?\.reviewedAt\s*\?\?\s*null,/);
  });

  it('markFinancialProfileReviewed POSTs to the one review route', () => {
    expect(src).toMatch(/personaFetch\('\/api\/moneypenny\/financial-profile\/review', \{ method: 'POST' \}\)/);
  });
});

describe('Prepare stage — no longer conflates "aggregates exist" with "profile reviewed"', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx'));

  it('the label depends on isReviewed, not merely hasProfile — the exact bug the operator named', () => {
    expect(src).toMatch(/isReviewed \? 'Profile reviewed' : 'Profile computed — not yet reviewed'/);
  });

  it('renders an explicit mark-as-reviewed action that calls the shared markFinancialProfileReviewed()', () => {
    expect(src).toMatch(/import \{ fetchFinancialProfileSummary, markFinancialProfileReviewed, type FinancialProfileSummary \}/);
    expect(src).toMatch(/const ok = await markFinancialProfileReviewed\(\);/);
  });

  it('Continue to Operate is NEVER gated on review — navigation stays free regardless of review state', () => {
    const fn = src.match(/const handleContinueToOperate = \(\) => \{([\s\S]*?)\};/)?.[1] ?? '';
    expect(fn).not.toMatch(/isReviewed|reviewedAt/);
    expect(fn).toMatch(/if \(nextStageId\) selectStage\(nextStageId\);/);
  });
});

describe('Financial Profile capsule (FinancialProfilePanel.tsx) — same review affordance, same shared function, no parallel logic', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/FinancialProfilePanel.tsx'));

  it('imports the SAME markFinancialProfileReviewed from the shared module — no second implementation', () => {
    expect(src).toMatch(/import \{ markFinancialProfileReviewed \} from "@\/services\/moneypenny\/financialProfileSummary"/);
  });

  it('shows an honest "Not yet reviewed" state distinct from a reviewed timestamp', () => {
    expect(src).toMatch(/Not yet reviewed/);
    expect(src).toMatch(/Reviewed \{new Date\(profile\.meta\.reviewedAt\)\.toLocaleString\(\)\}/);
  });
});
