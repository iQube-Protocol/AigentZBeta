/**
 * app/api/journey/knyts-bridge/state/route.ts — XP-1 wiring canary
 * (AEE-XP-001 §6, 2026-09-01): the first LIVE HTTP-reachable caller of
 * `computeJourneyAeeOutcome`. Source-level (not a full mocked route
 * integration test — the route already needs heavy Supabase/persona
 * mocking covered elsewhere) because what matters here is structural:
 * the AEE computation is ADDITIVE and FAIL-OPEN, never able to break the
 * existing `state` response.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/journey/knyts-bridge/state/route.ts';

describe('KNYTS bridge state route — AEE wiring is additive and fail-open', () => {
  const src = stripComments(readSource(ROUTE));

  it('parses activatedBranches from the request and passes it into resolveJourneyState', () => {
    expect(src).toMatch(/parseActivatedBranchesParam\(req\.nextUrl\.searchParams\.get\('activatedBranches'\)\)/);
    expect(src).toMatch(/resolveJourneyState\(KNYTS_BRIDGE_CROSSING_JOURNEY, platformState, activatedBranches\)/);
  });

  it('computes the AEE outcome inside a try/catch that falls open to null — never blocks the response', () => {
    const anchorIdx = src.indexOf('let aee: Awaited<ReturnType<typeof computeJourneyAeeOutcome>> | null = null;');
    expect(anchorIdx).toBeGreaterThan(-1);
    const tryIdx = src.indexOf('try {', anchorIdx);
    const catchIdx = src.indexOf('} catch {', tryIdx);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(tryIdx);
    const block = src.slice(tryIdx, catchIdx + 200);
    expect(block).toMatch(/aee = await computeJourneyAeeOutcome/);
    expect(block).toMatch(/aee = null/);
  });

  it('assembles ExperienceIntentProjection inside the SAME fail-open try block — an assembly failure falls open exactly like an AEE failure', () => {
    const anchorIdx = src.indexOf('let aee: Awaited<ReturnType<typeof computeJourneyAeeOutcome>> | null = null;');
    const tryIdx = src.indexOf('try {', anchorIdx);
    const catchIdx = src.indexOf('} catch {', tryIdx);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(tryIdx);
    const block = src.slice(tryIdx, catchIdx);
    expect(block).toMatch(/const experience = await assembleExperienceIntentProjection\(\{/);
    expect(block).toMatch(/experience,/);
  });

  it('the JSON response still returns state/personaAuthenticated unchanged, plus the new additive aee key', () => {
    expect(src).toMatch(/NextResponse\.json\(\{\s*ok:\s*true,\s*state:\s*runtimeState,\s*personaAuthenticated,\s*aee\s*\}\)/);
  });
});
