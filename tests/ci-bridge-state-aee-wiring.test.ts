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

  it('the JSON response still returns state/personaAuthenticated unchanged, plus the new additive aee key', () => {
    expect(src).toMatch(/NextResponse\.json\(\{\s*ok:\s*true,\s*state:\s*runtimeState,\s*personaAuthenticated,\s*aee\s*\}\)/);
  });

  it('assembles ExperienceIntentProjection inside the SAME fail-open try block — the SAME shared assembler KNYTS uses, no CI-specific experience model', () => {
    const anchorIdx = src.indexOf('let aee: Awaited<ReturnType<typeof computeJourneyAeeOutcome>> | null = null;');
    const tryIdx = src.indexOf('try {', anchorIdx);
    const catchIdx = src.indexOf('} catch {', tryIdx);
    const block = src.slice(tryIdx, catchIdx);
    expect(block).toMatch(/const experience = await assembleExperienceIntentProjection\(\{/);
    expect(block).toMatch(/experience,/);
  });

  it('imports exactly the two shared adaptive modules (orchestrator + experience assembler) — no CI-specific AEE/experience logic', () => {
    const adaptiveImports = [...src.matchAll(/from '(@\/services\/adaptive\/[^']+)'/g)].map((m) => m[1]);
    expect(new Set(adaptiveImports)).toEqual(
      new Set(['@/services/adaptive/journeyAeeOrchestrator', '@/services/adaptive/experienceIntentAssembly']),
    );
  });
});
