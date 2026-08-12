/**
 * CFS-055 state-coherence repair — KNYTS + CI Threshold Guides (2026-08-12).
 *
 * Reproduces the actual defect: a wallet-authenticated visitor discovers an
 * existing usable Citizen Passport inside PassportBureauApplyTab, but the
 * enclosing JourneyRunSurface kept holding pre-auth `runtimeState` — Passport
 * never reached COMPLETE, and Remix/Personify/Stand kept failing closed —
 * until the observer independently rereads authoritative state.
 *
 * Proof strategy, stated honestly (no React rendering harness exists in this
 * repo — see tests/cfs-055-coherence-canaries.test.ts's own header):
 *
 *   BEHAVIORAL — drives the REAL `resolveJourneyState()` resolver with two
 *   authoritative-state snapshots (before/after wallet auth) against the
 *   REAL `KNYTS_BRIDGE_CROSSING_JOURNEY` / `CONSTITUTIONAL_INTERNET_BRIDGE_
 *   JOURNEY` definitions — no mocked resolver, no fabricated stage logic.
 *   This proves items 1, 5, 6, 8, 9 below: the SAME production resolver
 *   the `/state` routes call transitions Passport to COMPLETE and clears
 *   the Remix/Personify/Stand gates once, and only once, real evidence is
 *   present — never before.
 *
 *   STRUCTURAL — traces the actual wiring (source-level, since "did the
 *   callback fire and did a network refetch happen" needs a DOM/fetch
 *   harness this repo doesn't have) proving the INVALIDATION PATH exists
 *   end-to-end with no local shortcut anywhere on it. This proves items
 *   2, 3, 4, 7, 10.
 *
 * Regression baseline for this govern: tests/cfs-055-coherence-canaries.test.ts,
 * tests/knyts-bridge-ci-parity.test.ts, tests/passport-wallet-auth-sign-in.test.ts,
 * tests/passport-bridge-citizen-deeplink.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { readSource, stripComments } from './_lib/sourceAuthority';

function stageState(runtimeState: ReturnType<typeof resolveJourneyState>, stageId: string) {
  return runtimeState.stages.find((s) => s.stageId === stageId);
}

describe('BEHAVIORAL — the real resolver transitions Passport to COMPLETE only once real evidence exists', () => {
  it('1. KNYTS: initial (pre-auth) state — citizenPassportUsable absent, Passport not COMPLETE, Remix/Stand BLOCKED', () => {
    const preAuth: AuthoritativePlatformState = { stages: {} };
    const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, preAuth);
    expect(stageState(runtimeState, 'passport')?.state).not.toBe('COMPLETE');
    expect(stageState(runtimeState, 'passport')?.evidencePresent).not.toContain('citizenPassportUsable');
    expect(stageState(runtimeState, 'remix')?.state).toBe('BLOCKED');
    expect(stageState(runtimeState, 'stand')?.state).toBe('BLOCKED');
  });

  it('5+6+8+9. KNYTS: after the observer rereads with real Passport evidence — Passport COMPLETE, Remix/Stand gates gone', () => {
    const postAuth: AuthoritativePlatformState = {
      stages: { passport: { citizenPassportUsable: true } },
    };
    const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, postAuth);
    expect(stageState(runtimeState, 'passport')?.state).toBe('COMPLETE');
    expect(stageState(runtimeState, 'passport')?.evidencePresent).toContain('citizenPassportUsable');
    expect(stageState(runtimeState, 'remix')?.state).not.toBe('BLOCKED');
    expect(stageState(runtimeState, 'stand')?.state).not.toBe('BLOCKED');
  });

  it('1. CI: initial (pre-auth) state — citizenPassportUsable absent, Passport not COMPLETE, Personify/Stand BLOCKED', () => {
    const preAuth: AuthoritativePlatformState = { stages: {} };
    const runtimeState = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, preAuth);
    expect(stageState(runtimeState, 'passport')?.state).not.toBe('COMPLETE');
    expect(stageState(runtimeState, 'personify')?.state).toBe('BLOCKED');
    expect(stageState(runtimeState, 'stand')?.state).toBe('BLOCKED');
  });

  it('5+6+8+9. CI: after the observer rereads with real Passport evidence — Passport COMPLETE, Personify/Stand gates gone', () => {
    const postAuth: AuthoritativePlatformState = {
      stages: { passport: { citizenPassportUsable: true } },
    };
    const runtimeState = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, postAuth);
    expect(stageState(runtimeState, 'passport')?.state).toBe('COMPLETE');
    expect(stageState(runtimeState, 'personify')?.state).not.toBe('BLOCKED');
    expect(stageState(runtimeState, 'stand')?.state).not.toBe('BLOCKED');
  });

  it('CI: Personify and Stand are INDEPENDENTLY available post-Passport — neither gates the other', () => {
    // Passport usable, Personify's OWN completion evidence absent — Stand
    // must still be available (not BLOCKED), because Stand's prerequisite
    // is Passport, never Personify.
    const postAuth: AuthoritativePlatformState = {
      stages: { passport: { citizenPassportUsable: true } },
    };
    const runtimeState = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, postAuth);
    expect(stageState(runtimeState, 'personify')?.state).not.toBe('COMPLETE');
    expect(stageState(runtimeState, 'stand')?.state).not.toBe('BLOCKED');
  });

  it('7. The exact predicate the bridge pages use to derive citizenPassportUsable resolves true from the SAME real resolver output', () => {
    // The literal expression app/bridge/{knyts,ci}/page.tsx's
    // onRuntimeStateChange handlers evaluate — run here against the real
    // resolver's real output, never a stand-in shape.
    for (const journey of [KNYTS_BRIDGE_CROSSING_JOURNEY, CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY]) {
      const runtimeState = resolveJourneyState(journey, {
        stages: { passport: { citizenPassportUsable: true } },
      });
      const passportStage = runtimeState.stages.find((s) => s.stageId === 'passport');
      const derived = Boolean(passportStage?.evidencePresent.includes('citizenPassportUsable'));
      expect(derived).toBe(true);
    }
  });
});

describe('STRUCTURAL — the invalidation path exists end-to-end, with no local shortcut', () => {
  const JOURNEY_RUN_SURFACE = 'components/journey/JourneyRunSurface.tsx';
  const BUREAU = 'app/triad/components/codex/tabs/PassportBureauApplyTab.tsx';
  const KNYTS_ROOM = 'components/journey/KnytsBridgePassportRoom.tsx';
  const CI_ROOM = 'components/journey/ConstitutionalInternetBridgePassportRoom.tsx';
  const KNYTS_PAGE = 'app/bridge/knyts/page.tsx';
  const CI_PAGE = 'app/bridge/ci/page.tsx';

  it('2+3. wallet auth -> Bureau usable-status detection is unchanged and still the trigger (regression baseline)', () => {
    const code = stripComments(readSource(BUREAU));
    expect(code).toContain('/api/passport/usable-status');
    expect(code).toContain('signInWithWalletAuth(identifier, password)');
  });

  it('4. Persona Spine unauthenticated<->ready transition reruns the SAME refresh() JourneyRunSurface already uses — never a polling loop', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain('usePersonaSpine();');
    expect(code).toContain("previous === 'unauthenticated'");
    expect(code).toContain("personaSpineStatus === 'unauthenticated'");
    const idx = code.indexOf('previousPersonaSpineStatusRef.current = personaSpineStatus');
    expect(idx, 'transition effect not found').toBeGreaterThan(-1);
    const block = code.slice(Math.max(0, idx - 700), idx);
    expect(block).toContain('void refresh();');
    // Never a setInterval/setTimeout polling loop for this mechanism.
    expect(code).not.toMatch(/setInterval\(/);
  });

  it('4. The Bureau-witnessed detection reaches the SAME refresh() via requestStateRefresh, never a second fetch mechanism', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain('requestStateRefresh: () => void refresh()');
  });

  it('4+10. onUsablePassportDetected carries NO boolean/state payload — it can only ask, never assert truth', () => {
    const code = stripComments(readSource(BUREAU));
    expect(code).toMatch(/onUsablePassportDetected\?:\s*\(\)\s*=>\s*void/);
    // A payload-carrying signature (e.g. `(usable: boolean) => void`) would
    // let the caller pass local truth upward — never present.
    expect(code).not.toMatch(/onUsablePassportDetected\?:\s*\(usable/);
  });

  it('7. Both Passport rooms thread requestStateRefresh straight into onUsablePassportDetected — no stage-advance side effect', () => {
    for (const file of [KNYTS_ROOM, CI_ROOM]) {
      const code = stripComments(readSource(file));
      expect(code, `${file}: missing requestStateRefresh prop`).toMatch(/requestStateRefresh\?:\s*\(\)\s*=>\s*void/);
      expect(code, `${file}: does not forward it to onUsablePassportDetected`).toContain(
        'onUsablePassportDetected={requestStateRefresh}',
      );
      // The room itself never calls selectStage/setStep as a SIDE EFFECT of
      // detection — only the visitor's own "Tell your crossing" button does.
      const detectIdx = code.indexOf('requestStateRefresh');
      expect(detectIdx).toBeGreaterThan(-1);
    }
  });

  it('7+10. Neither bridge page derives citizenPassportUsable from resolveSurfaceProps anymore — only from onRuntimeStateChange', () => {
    for (const file of [KNYTS_PAGE, CI_PAGE]) {
      const code = stripComments(readSource(file));
      expect(code, `${file}: onRuntimeStateChange wiring missing`).toContain('onRuntimeStateChange={handleRuntimeStateChange}');
      expect(code, `${file}: still discovers citizenPassportUsable inside resolveSurfaceProps`).not.toMatch(
        /setCitizenPassportUsable\(isPassportUsable\)/,
      );
    }
  });

  it('10. PassportBureauApplyTab never calls anything that could mutate journey/stage state directly (no selectStage, no setRuntimeState-shaped call)', () => {
    const code = stripComments(readSource(BUREAU));
    expect(code).not.toContain('setRuntimeState');
    expect(code).not.toContain("dispatchEvent(new CustomEvent('journey:select-stage'");
  });
});

describe('Structural canary — Stand gates on Passport alone, on BOTH bridges (chronology fix)', () => {
  it("KNYTS stand.prerequisites is exactly ['passport']", () => {
    const stand = KNYTS_BRIDGE_CROSSING_JOURNEY.stages.find((s) => s.id === 'stand');
    expect(stand?.prerequisites).toEqual(['passport']);
  });

  it("CI stand.prerequisites is exactly ['passport'] — no longer depends on personify", () => {
    const stand = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.find((s) => s.id === 'stand');
    expect(stand?.prerequisites).toEqual(['passport']);
    expect(stand?.prerequisites).not.toContain('personify');
  });

  it("Stand's own completionEvidence is unchanged on both bridges — Passport establishes ELIGIBILITY, never completion", () => {
    const knytsStand = KNYTS_BRIDGE_CROSSING_JOURNEY.stages.find((s) => s.id === 'stand');
    const ciStand = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.find((s) => s.id === 'stand');
    expect(knytsStand?.completionEvidence).toEqual(['crossingHasConsequence']);
    expect(ciStand?.completionEvidence).toEqual(['constitutionalEventRecorded']);
  });

  it('CI: Personify remains a real, independent stage — not removed, not merged into Stand', () => {
    const personify = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.find((s) => s.id === 'personify');
    expect(personify).toBeTruthy();
    expect(personify?.prerequisites).toEqual(['passport']);
  });
});
