/**
 * app/api/journey/constitutional-internet-bridge/state/route.ts — CI AEE
 * parity (AEE-XP-001 §6, 2026-09-01). Identical wiring canary to
 * tests/knyts-bridge-state-aee-wiring.test.ts — same orchestrator, same
 * AdaptiveInteractionContext path, same additive/fail-open contract, no
 * CI-specific AEE logic.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/journey/constitutional-internet-bridge/state/route.ts';

describe('CI bridge state route — AEE wiring is additive and fail-open, identical to KNYTS', () => {
  const src = stripComments(readSource(ROUTE));

  it('parses activatedBranches from the request and passes it into resolveJourneyState', () => {
    expect(src).toMatch(/parseActivatedBranchesParam\(req\.nextUrl\.searchParams\.get\('activatedBranches'\)\)/);
    expect(src).toMatch(/resolveJourneyState\(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, platformState, activatedBranches\)/);
  });

  it('computes the AEE outcome via the SAME computeJourneyAeeOutcome orchestrator, inside a try/catch that falls open to null', () => {
    expect(src).toMatch(/from '@\/services\/adaptive\/journeyAeeOrchestrator'/);
    const tryIdx = src.indexOf('try {\n    aee = await computeJourneyAeeOutcome');
    expect(tryIdx).toBeGreaterThan(-1);
    const block = src.slice(tryIdx, tryIdx + 400);
    expect(block).toMatch(/catch\s*\{/);
    expect(block).toMatch(/aee = null/);
  });

  it('the JSON response still returns state/personaAuthenticated unchanged, plus the new additive aee key', () => {
    expect(src).toMatch(/NextResponse\.json\(\{\s*ok:\s*true,\s*state:\s*runtimeState,\s*personaAuthenticated,\s*aee\s*\}\)/);
  });

  it('no CI-specific AEE logic — the route imports no adaptive module other than the shared orchestrator', () => {
    const adaptiveImports = [...src.matchAll(/from '(@\/services\/adaptive\/[^']+)'/g)].map((m) => m[1]);
    expect(new Set(adaptiveImports)).toEqual(new Set(['@/services/adaptive/journeyAeeOrchestrator']));
  });
});
