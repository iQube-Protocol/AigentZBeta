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

  it('both mounts stay inside the !citizenPassportUsable branch — an existing usable Passport never remounts the wizard', () => {
    for (const file of [KNYTS_ROOM, CI_ROOM]) {
      const code = stripComments(readSource(file));
      const guardIdx = code.indexOf('if (!citizenPassportUsable)');
      const mountIdx = code.indexOf('routeTo="citizen"');
      expect(guardIdx, `${file}: !citizenPassportUsable guard not found`).toBeGreaterThan(-1);
      expect(mountIdx, `${file}: routeTo="citizen" mount not found`).toBeGreaterThan(guardIdx);
      // The next `if (` after the guard should be the established-Passport
      // render path, not another PassportBureauApplyTab mount.
      const secondMount = code.indexOf('PassportBureauApplyTab', mountIdx + 1);
      expect(secondMount, `${file}: a second PassportBureauApplyTab mount was found — must be exactly one`).toBe(-1);
    }
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
    expect(code).toContain('Polity Delegate Passport');
  });
});
