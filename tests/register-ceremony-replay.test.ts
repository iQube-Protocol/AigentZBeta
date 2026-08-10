/**
 * Pre-recording Horizen polish, part C (operator directive, 2026-08-10) —
 * a non-mutating, read-only replay of Register's seven-step ceremony for
 * an ALREADY-REGISTERED agent. Source-scan style, matching this repo's
 * existing convention (no React rendering harness is set up here) — see
 * tests/cfs-055-coherence-canaries.test.ts, tests/register-stage-receipt-
 * agent-isolation.test.ts for the same pattern.
 *
 * The operator's requirements, verbatim, that this canary pins:
 *   - MoneyPenny is already registered and MUST NOT be registered again.
 *   - Render completed items as read-only/proven ceremony steps.
 *   - They must not be executable controls.
 *   - If evidence exists, allow expansion into its evidence/receipt.
 *   - Do not fabricate evidence for `Mandate prepared` or other
 *     non-receipted preparatory states — show only the level of proof
 *     actually available.
 *   - This is not a special MoneyPenny demo mode — build it generically.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const stateRoute = read('app/api/journey/moneypenny-horizen/state/route.ts');
const replayComponent = read('components/journey/RegisterCeremonyReplay.tsx');
const pilotJourneyTab = read('app/triad/components/codex/tabs/PilotJourneyTab.tsx');
const journeyRunSurface = read('components/journey/JourneyRunSurface.tsx');

const register = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'register')!;

describe('Register ceremony replay — surface registration', () => {
  it('is declared on the register stage, after register-agent-panel — never a replacement for it', () => {
    const refs = register.surfaces.map((s) => s.ref);
    const panelAt = refs.indexOf('register-agent-panel');
    const replayAt = refs.indexOf('register-ceremony-replay');
    expect(panelAt).toBeGreaterThan(-1);
    expect(replayAt).toBeGreaterThan(-1);
    expect(replayAt).toBeGreaterThan(panelAt);
  });

  it('is registered in JOURNEY_SURFACES as a real, built component — never a placeholder', () => {
    const descriptor = JOURNEY_SURFACES['register-ceremony-replay'];
    expect(descriptor).toBeDefined();
    expect(descriptor.kind).toBe('component');
    expect((descriptor as { component: string }).component).toBe('RegisterCeremonyReplay');
  });
});

describe('Register ceremony replay — state route projection: two authority tiers, never conflated', () => {
  it('defines all seven ceremony steps, keyed exactly as the operator named them', () => {
    const at = stateRoute.indexOf('const registerCeremony = {');
    expect(at, 'registerCeremony object not found').toBeGreaterThan(-1);
    const section = stateRoute.slice(at, at + 900);
    for (const key of [
      'principalWalletReady',
      'mandatePrepared',
      'mandateSigned',
      'invocationApproved',
      'transactionBroadcast',
      'horizenConfirmed',
      'registryBindingRecorded',
    ]) {
      expect(section).toContain(`${key}:`);
    }
  });

  it('principalWalletReady/mandatePrepared use the inferred-authority helper — NEVER receiptBackedSubPredicate (no receipt type exists for either)', () => {
    const at = stateRoute.indexOf('const registerCeremony = {');
    const section = stateRoute.slice(at, at + 900);
    expect(section).toMatch(/principalWalletReady:\s*inferredCeremonyStep\('principalWalletReady'\)/);
    expect(section).toMatch(/mandatePrepared:\s*inferredCeremonyStep\('mandatePrepared'\)/);
  });

  it('the remaining five steps use receiptBackedSubPredicate against their real, distinct receipt types — never fabricated evidence', () => {
    const at = stateRoute.indexOf('const registerCeremony = {');
    const section = stateRoute.slice(at, at + 900);
    expect(section).toMatch(/mandateSigned:\s*receiptBackedSubPredicate\('mandateSigned',\s*'principal_registration_mandate_signed'\)/);
    expect(section).toMatch(/invocationApproved:\s*receiptBackedSubPredicate\('invocationApproved',\s*'agent_registry_transaction_signed'\)/);
    expect(section).toMatch(/transactionBroadcast:\s*receiptBackedSubPredicate\('transactionBroadcast',\s*'horizen_registration_submitted'\)/);
    expect(section).toMatch(/horizenConfirmed:\s*receiptBackedSubPredicate\('horizenConfirmed',\s*'horizen_registration_confirmed'\)/);
    expect(section).toMatch(/registryBindingRecorded:\s*receiptBackedSubPredicate\('registryBindingRecorded',\s*'agent_registry_binding_recorded'\)/);
  });

  it('inferredCeremonyStep never carries authority: evidence — only inferred or none, gated on the same Register canonicalOutcome the resolver already settled', () => {
    const at = stateRoute.indexOf('const inferredCeremonyStep');
    expect(at, 'inferredCeremonyStep helper not found').toBeGreaterThan(-1);
    const section = stateRoute.slice(at, at + 500);
    expect(section).toMatch(/registerStageEstablished \? \('inferred' as const\) : \('none' as const\)/);
    expect(section).not.toMatch(/'evidence' as const/);
    expect(stateRoute).toMatch(
      /const registerStageEstablished = resolution\.stages\.find\(\(s\) => s\.stageId === 'register'\)\?\.canonicalOutcome === true;/,
    );
  });

  it('registerCeremony is returned to the client — not merely computed and dropped', () => {
    const returnAt = stateRoute.indexOf('return NextResponse.json({');
    expect(returnAt).toBeGreaterThan(-1);
    expect(stateRoute.slice(returnAt)).toMatch(/registerCeremony,/);
  });
});

describe('Register ceremony replay — component never mutates, never fabricates', () => {
  it('contains no executable control — zero <button> elements that can perform a live action', () => {
    // The receipt-expansion toggle is a non-mutating disclosure control, not
    // a registration action — it never calls personaFetch with a mutating
    // method, so it is excluded from this check by verifying the file has
    // no POST/PUT/PATCH/DELETE fetch call anywhere.
    expect(replayComponent).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it('renders nothing while Register has not yet canonically completed', () => {
    expect(replayComponent).toMatch(/if \(!registerStageEstablished \|\| !registerCeremony\) return null;/);
  });

  it("distinguishes 'inferred' (no receipt) from 'evidence' (real receipt) — never renders an inferred step as proven", () => {
    expect(replayComponent).toMatch(/authority === 'inferred'/);
    expect(replayComponent).toMatch(/authority === 'evidence'/);
    expect(replayComponent).toMatch(/Implied — no receipt/);
  });

  it('only a step with real receiptRefs (authority evidence) can expand — inferred steps are never expandable', () => {
    expect(replayComponent).toMatch(/const canExpand = isEvidence && receiptIds\.length > 0;/);
  });

  it('names itself explicitly as a replay, not a live action — states plainly it cannot be re-run here', () => {
    expect(replayComponent).toMatch(/read-only reconstruction/i);
    expect(replayComponent).toMatch(/cannot be re-run here/i);
  });

  it('is built generically — no MoneyPenny-specific (or any other agent-specific) literal in the component', () => {
    expect(replayComponent).not.toMatch(/moneypenny/i);
    expect(replayComponent).not.toMatch(/nakamoto/i);
  });

  it('hydrates receipts by exact id via the existing /api/assistant/receipts?ids= route — never a fresh type/agent search', () => {
    expect(replayComponent).toMatch(/\/api\/assistant\/receipts\?ids=\$\{receiptIds\.join\(','\)\}/);
    expect(replayComponent).not.toMatch(/actionType=/);
  });
});

describe('Register ceremony replay — wiring: one canonical projection, no second computation', () => {
  it('JourneyRunSurface fetches registerCeremony ONCE from /state and threads it through resolveSurfaceProps — same discipline as ratifySubPredicates', () => {
    expect(journeyRunSurface).toMatch(/setRegisterCeremony\(\(json\.registerCeremony as typeof registerCeremony\) \?\? null\)/);
    expect(journeyRunSurface).toMatch(
      /resolveSurfaceProps\?\.\(\{ surfaceRef, descriptor, stage: activeStage, runtimeState, pnlEvidence, ratifySubPredicates, registerCeremony \}\)/,
    );
  });

  it('PilotJourneyTab threads the SAME registerCeremony object to RegisterCeremonyReplay, gated on the observer\'s own resolved Register stage state', () => {
    const at = pilotJourneyTab.indexOf("descriptor.component === 'RegisterCeremonyReplay'");
    expect(at).toBeGreaterThan(-1);
    const block = pilotJourneyTab.slice(at, at + 500);
    expect(block).toMatch(/registerStageEstablished: runtimeState\?\.stages\.find\(\(s\) => s\.stageId === 'register'\)\?\.state === 'COMPLETE'/);
    expect(block).toMatch(/registerCeremony,/);
  });
});
