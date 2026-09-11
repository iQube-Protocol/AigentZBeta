/**
 * listCandidateSources' LIST projection — the Lambda 6MB / 413 canary
 * (2026-07-28 incident).
 *
 * The domain listing route (/api/corpus-scout/candidates) died with
 * 413 Content Too Large because every row carried its FULL normalized_text —
 * a single World Bank GEP report exceeds 1.3M chars, and a domain's listing
 * sums past the Lambda response cap. The fix: the list projection truncates
 * normalizedText to LIST_PREVIEW_CHARS and reports the true length in
 * normalizedTextChars. Single-row reads (getCandidateSource — what the
 * review route and ingestion broker consume) stay untruncated, so ingestion
 * NEVER chunks a preview instead of the document.
 */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { listCandidateSources, LIST_PREVIEW_CHARS } from '@/services/corpusScout/provenance';
import { listCandidates } from '@/services/invariants/discoveryEngine';

function fakeAdminReturning(rows: Array<Record<string, unknown>>): SupabaseClient {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain, order: chain, eq: chain,
    then: (
      onfulfilled: (v: { data: unknown; error: null }) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected),
  });
  return { from: () => builder } as unknown as SupabaseClient;
}

function fakeAdminErroring(message: string): SupabaseClient {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain, order: chain, eq: chain, is: chain,
    then: (
      onfulfilled: (v: { data: null; error: { message: string } }) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: { message } }).then(onfulfilled, onrejected),
  });
  return { from: () => builder } as unknown as SupabaseClient;
}

function dbRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'row-1', source_id: 'SRC-test-1', campaign_domain: 'commercialisation',
    campaign_sub_domain: 'commercial-governance', title: 'Doc',
    canonical_url: 'https://example.com/doc.pdf',
    review_workflow_status: 'pending_review', extraction_status: 'ok',
    normalized_text: '', created_at: '2026-07-28T00:00:00Z', updated_at: '2026-07-28T00:00:00Z',
    ...overrides,
  };
}

describe('listCandidateSources list projection — bounded payload (413 canary)', () => {
  it('truncates a huge normalized_text to LIST_PREVIEW_CHARS and reports the TRUE length', async () => {
    const huge = 'x'.repeat(1_300_000);
    const rows = await listCandidateSources(fakeAdminReturning([dbRow({ normalized_text: huge })]));
    expect(rows).toHaveLength(1);
    expect(rows[0].normalizedText).toHaveLength(LIST_PREVIEW_CHARS);
    expect(rows[0].normalizedTextChars).toBe(1_300_000);
  });

  it('a short text passes through whole, with the true length still reported', async () => {
    const rows = await listCandidateSources(fakeAdminReturning([dbRow({ normalized_text: 'short body' })]));
    expect(rows[0].normalizedText).toBe('short body');
    expect(rows[0].normalizedTextChars).toBe(10);
  });

  it('the projected list payload for a 1.3M-char corpus stays far under the 6MB response cap', async () => {
    const rows = await listCandidateSources(fakeAdminReturning(
      Array.from({ length: 100 }, (_, i) => dbRow({ id: `row-${i}`, source_id: `SRC-${i}`, normalized_text: 'y'.repeat(500_000) })),
    ));
    const payloadBytes = Buffer.byteLength(JSON.stringify(rows), 'utf8');
    // 100 × 500k chars = 50MB raw. Projected: 100 × ~1.5k previews ≈ well under 1MB.
    expect(payloadBytes).toBeLessThan(1_000_000);
    for (const r of rows) expect(r.normalizedTextChars).toBe(500_000);
  });
});

describe(
  'listCandidateSources — a query error THROWS, never silently becomes an empty corpus ' +
  '(RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001)',
  () => {
    it('a Supabase query error rejects the promise rather than resolving to []', async () => {
      // Before the fix, `if (error) return [];` made a genuine read failure
      // (a statement timeout, a dropped connection, an RLS error)
      // indistinguishable from a genuinely empty corpus. Every real caller
      // that matters already depends on this call THROWING on failure:
      // `resolveTrack2Population` (services/research/track2Population.ts)
      // wraps it in its own try/catch specifically to report the field as
      // `unreadable` rather than a false zero, and `loadTrack2ProgrammeState`
      // (services/research/researchProgrammeOrchestrator.ts) wraps every call
      // site in `.catch(() => null)` so a read failure renders Track 2's
      // Stage 1/Stage 2 as `unknown` — never a false `not-started`/`complete`.
      // A swallowed error defeated both of those already-written safeguards
      // silently, and was the root cause of a live EXP-P1 Track 2 regression:
      // a real corpus of 34 admitted + 18 pending sources intermittently
      // rendered as "0 discovered, 0 admitted" on a transient read failure.
      await expect(
        listCandidateSources(fakeAdminErroring('canceling statement due to statement timeout')),
      ).rejects.toThrow(/canceling statement due to statement timeout/);
    });
  },
);

describe(
  'listCandidates — the SAME fix, the SAME reason (RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001): ' +
  'a discovery_candidates query error THROWS, never silently becomes an empty cohort',
  () => {
    it('a Supabase query error rejects the promise rather than resolving to []', async () => {
      // Every Track 2 caller of this function reads it through
      // `loadTrack2ProgrammeState`'s `.catch(() => null)` (Stage 3/4's
      // discovery-candidate counts) expecting a genuine failure to become
      // `unknown`, never a false "0 candidate(s) extracted".
      await expect(
        listCandidates(fakeAdminErroring('canceling statement due to statement timeout'), 'financial-services'),
      ).rejects.toThrow(/canceling statement due to statement timeout/);
    });
  },
);
