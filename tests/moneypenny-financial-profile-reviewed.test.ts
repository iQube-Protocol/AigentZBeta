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
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

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
