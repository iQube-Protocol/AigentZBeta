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
    const tryIdx = src.indexOf('try {\n    aee = await computeJourneyAeeOutcome');
    expect(tryIdx).toBeGreaterThan(-1);
    const block = src.slice(tryIdx, tryIdx + 400);
    expect(block).toMatch(/catch\s*\{/);
    expect(block).toMatch(/aee = null/);
  });

  it('the JSON response still returns state/personaAuthenticated unchanged, plus the new additive aee key', () => {
    expect(src).toMatch(/NextResponse\.json\(\{\s*ok:\s*true,\s*state:\s*runtimeState,\s*personaAuthenticated,\s*aee\s*\}\)/);
  });
});
