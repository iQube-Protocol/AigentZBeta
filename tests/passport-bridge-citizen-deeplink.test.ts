/**
 * Passport entry-point refinement — KNYTS + CI Bridges (2026-08-12).
 *
 * Both Threshold Guide bridges are explicitly human/Citizen crossings, so
 * their Passport surfaces must deep-link straight past the generic
 * Citizen/Agent class picker into the Citizen route's own next step
 * (Account: New account | Sign in — or straight to Personhood binding when
 * already signed in). This reuses PassportBureauApplyTab's EXISTING
 * `routeTo` prop and its `autoRoutedRef` auto-route effect (the same
 * mechanism PilotJourneyTab already drives from its own observer) — no new
 * deep-link parameter, no CSS-hiding, no fork of the Bureau component.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('KNYTS + CI Passport rooms deep-link straight to the Citizen route', () => {
  const KNYTS_ROOM = 'components/journey/KnytsBridgePassportRoom.tsx';
  const CI_ROOM = 'components/journey/ConstitutionalInternetBridgePassportRoom.tsx';

  it('KnytsBridgePassportRoom mounts PassportBureauApplyTab with routeTo="citizen"', () => {
    const code = stripComments(readSource(KNYTS_ROOM));
    const idx = code.indexOf('<PassportBureauApplyTab');
    const end = code.indexOf('/>', idx);
    const mount = code.slice(idx, end);
    expect(mount).toContain('personaId={personaId}');
    expect(mount).toContain('routeTo="citizen"');
    expect(mount).toContain('onUsablePassportDetected={requestStateRefresh}');
  });

  it('ConstitutionalInternetBridgePassportRoom mounts PassportBureauApplyTab with routeTo="citizen"', () => {
    const code = stripComments(readSource(CI_ROOM));
    const idx = code.indexOf('<PassportBureauApplyTab');
    const end = code.indexOf('/>', idx);
    const mount = code.slice(idx, end);
    expect(mount).toContain('personaId={personaId}');
    expect(mount).toContain('routeTo="citizen"');
    expect(mount).toContain('onUsablePassportDetected={requestStateRefresh}');
  });

  it('both mounts stay inside the !citizenPassportUsable branch — an existing usable Passport never remounts the CITIZEN wizard', () => {
    for (const file of [KNYTS_ROOM, CI_ROOM]) {
      const code = stripComments(readSource(file));
      const guardIdx = code.indexOf('if (!citizenPassportUsable)');
      const mountIdx = code.indexOf('routeTo="citizen"');
      expect(guardIdx, `${file}: !citizenPassportUsable guard not found`).toBeGreaterThan(-1);
      expect(mountIdx, `${file}: routeTo="citizen" mount not found`).toBeGreaterThan(guardIdx);
      // The CITIZEN wizard specifically is never remounted a second time —
      // narrowed 2026-08-21 (KNYTS delegate affordance) from "no second
      // PassportBureauApplyTab mount at all", since KnytsBridgePassportRoom
      // now legitimately carries a SECOND, confirm-gated routeTo="delegate"
      // mount in the established branch (see the test below). This
      // canary's real invariant — the Citizen claim flow itself never
      // remounts once a Passport is usable — is unaffected and still
      // enforced.
      const secondCitizenMount = code.indexOf('routeTo="citizen"', mountIdx + 1);
      expect(secondCitizenMount, `${file}: a second routeTo="citizen" mount was found — must be exactly one`).toBe(
        -1,
      );
    }
  });

  it('the KNYTS delegate affordance (2026-08-21) is the ONLY additional mount — CI room is unchanged', () => {
    const ciCode = stripComments(readSource(CI_ROOM));
    expect(
      (ciCode.match(/<PassportBureauApplyTab/g) ?? []).length,
      'ConstitutionalInternetBridgePassportRoom mount count changed — this task never touched CI',
    ).toBe(1);

    const knytsCode = stripComments(readSource(KNYTS_ROOM));
    expect((knytsCode.match(/<PassportBureauApplyTab/g) ?? []).length).toBe(2);
    expect(knytsCode).toContain('routeTo="delegate"');
    // The delegate mount is a confirm-gated, optional, post-activation
    // capability — never unconditional, never a second automatic Passport
    // claim.
    const delegateMountIdx = knytsCode.indexOf('routeTo="delegate"');
    const gateIdx = knytsCode.lastIndexOf('delegateFlowOpen &&', delegateMountIdx);
    expect(gateIdx, 'the delegate mount is not gated behind delegateFlowOpen').toBeGreaterThan(-1);
  });
});

describe('routeTo is additive — generic Bureau access and other journeys keep the class picker', () => {
  const BUREAU = 'app/triad/components/codex/tabs/PassportBureauApplyTab.tsx';

  it('routeTo defaults to undefined, which renders the Citizen/Agent class picker unchanged', () => {
    const code = stripComments(readSource(BUREAU));
    expect(code).toContain("useState<StepId>('class')");
    // The auto-route effect only fires when routeTo is truthy — standalone/
    // direct Bureau access (no routeTo prop) always starts at the class step.
    expect(code).toMatch(/if \(!routeTo \|\| autoRoutedRef\.current \|\| step !== 'class'\) return;/);
  });

  it('the class picker (Citizen | Agent) itself is not removed', () => {
    const code = stripComments(readSource(BUREAU));
    expect(code).toContain('Who is this Passport for?');
    expect(code).toContain('Polity Citizen Passport');
    // "Delegate Passport" retired from public copy (semantic repair,
    // 2026-08-25) — the public class name is "Polity Agent Passport".
    expect(code).toContain('Polity Agent Passport');
  });
});
