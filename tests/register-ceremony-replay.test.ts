/**
 * Register ceremony projection — the `registerCeremony` field computed by
 * the state route for an ALREADY-REGISTERED agent's seven-step ceremony.
 *
 * The UI surface that once rendered this projection (`RegisterCeremonyReplay`,
 * Pre-recording Horizen polish part C, 2026-08-10) was removed from the
 * journey UI (2026-08-11, operator directive) — Register returns to one
 * canonical operational surface (`register-agent-panel`) plus the standard
 * Evidence drawer, with no duplicate "historical replay" block. The
 * `registerCeremony` projection itself, and its generic thread-through in
 * JourneyRunSurface, were kept: removing the UI consumer does not require
 * touching the underlying state/evidence computation. This file now pins
 * only what survives that removal.
 *
 * Source-scan style, matching this repo's existing convention (no React
 * rendering harness is set up here) — see tests/cfs-055-coherence-canaries.test.ts,
 * tests/register-stage-receipt-agent-isolation.test.ts for the same pattern.
 *
 * The operator's requirements, verbatim, that this canary pins:
 *   - MoneyPenny is already registered and MUST NOT be registered again.
 *   - Do not fabricate evidence for `Mandate prepared` or other
 *     non-receipted preparatory states — show only the level of proof
 *     actually available.
 *   - This is not a special MoneyPenny demo mode — build it generically.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const stateRoute = read('app/api/journey/moneypenny-horizen/state/route.ts');
const journeyRunSurface = read('components/journey/JourneyRunSurface.tsx');

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

describe('Register ceremony replay — wiring: one canonical projection, no second computation', () => {
  it('JourneyRunSurface fetches registerCeremony ONCE from /state and threads it through resolveSurfaceProps — same discipline as ratifySubPredicates', () => {
    expect(journeyRunSurface).toMatch(/setRegisterCeremony\(\(json\.registerCeremony as typeof registerCeremony\) \?\? null\)/);
    expect(journeyRunSurface).toMatch(
      /resolveSurfaceProps\?\.\(\{ surfaceRef, descriptor, stage: activeStage, runtimeState, pnlEvidence, ratifySubPredicates, registerCeremony \}\)/,
    );
  });
});
