/**
 * KNYTS Remix live defect — `citizenPassportUsable` propagation race
 * (operator-diagnosed, 2026-08-21).
 *
 * ROOT CAUSE: `JourneyRunSurface.tsx`'s `refresh()` had no request-ordering
 * guard. Several independent triggers call it close together around a
 * Citizen-recognition/passkey-completion moment (the mount effect, the
 * persona-spine authentication-transition effect, every surface's own
 * `requestStateRefresh()`) — none coordinate, so an OLDER, slower request
 * could resolve AFTER a NEWER one and silently overwrite fresh state with
 * stale state. `citizenPassportUsable` would regress from true back to
 * false/undefined for exactly as long as that took. Stage selection
 * (`selectStage('remix')`) does not itself wait for or trigger a refresh, so
 * a visitor who moved into Remix inside that window got
 * `KnytsBridgeRemixSurface`'s `metame-web` fallback despite a genuinely
 * established Passport.
 *
 * TWO fixes, matching the operator's own "preferred repair":
 *   1. Root fix — `refreshSeqRef` in JourneyRunSurface.tsx discards a
 *      response once a newer refresh has been issued.
 *   2. Defense-in-depth — `mergeCitizenPassportUsable` in
 *      app/bridge/knyts/page.tsx treats a Citizen Passport, once observed
 *      usable in this client session, as monotonically true (no denied/
 *      revoked transition exists for CitizenPassportStatus in an ordinary
 *      session) — so a later reported false/undefined is never applied as a
 *      regression.
 *
 * `mergeCitizenPassportUsable` is a genuine, directly unit-testable pure
 * function (no render harness needed — none exists anywhere in tests/, per
 * this codebase's established convention). Everything else here is
 * structural/source-authority, mirroring
 * tests/passport-session-grant-sequential.test.ts's convention.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { mergeCitizenPassportUsable } from '@/app/bridge/knyts/page';

const JOURNEY_RUN_SURFACE = 'components/journey/JourneyRunSurface.tsx';
const KNYTS_PAGE = 'app/bridge/knyts/page.tsx';
const REMIX_SURFACE = 'components/journey/KnytsBridgeRemixSurface.tsx';

describe('mergeCitizenPassportUsable — the monotonic-true merge, in isolation', () => {
  it('an undefined/unresolved prior value simply adopts the new observation', () => {
    expect(mergeCitizenPassportUsable(undefined, true)).toBe(true);
    expect(mergeCitizenPassportUsable(undefined, false)).toBe(false);
  });

  it('a prior false value also adopts a fresh observation either way', () => {
    expect(mergeCitizenPassportUsable(false, true)).toBe(true);
    expect(mergeCitizenPassportUsable(false, false)).toBe(false);
  });

  it('THE regression case: once true, a later false/undefined observation never regresses it', () => {
    expect(mergeCitizenPassportUsable(true, false)).toBe(true);
  });

  it('reproduces the exact live sequence: Passport observed usable, then a stale/regressed read arrives', () => {
    let citizenPassportUsable: boolean | undefined;
    // Passport stage completes — the authoritative read reports usable.
    citizenPassportUsable = mergeCitizenPassportUsable(citizenPassportUsable, true);
    expect(citizenPassportUsable).toBe(true);
    // An out-of-order / transient read resolves afterward reporting false —
    // exactly what an older, slower refresh() response looked like before
    // the request-ordering guard existed.
    citizenPassportUsable = mergeCitizenPassportUsable(citizenPassportUsable, false);
    // The value Remix receives must still be true.
    expect(citizenPassportUsable).toBe(true);
  });
});

describe('JourneyRunSurface.refresh() — out-of-order response guard', () => {
  it('every refresh() call is sequence-numbered and a stale response is discarded before it can overwrite state', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain('const refreshSeqRef = useRef(0);');
    const refreshAt = code.indexOf('const refresh = useCallback(async () => {');
    expect(refreshAt, 'expected the refresh() definition').toBeGreaterThan(-1);
    const refreshEnd = code.indexOf('[stateUrl, personaId]);', refreshAt);
    const refreshBody = code.slice(refreshAt, refreshEnd);
    expect(refreshBody).toContain('const seq = ++refreshSeqRef.current;');
    // The success path must check staleness BEFORE applying setRuntimeState.
    const setRuntimeAt = refreshBody.indexOf('setRuntimeState(');
    const staleCheckAt = refreshBody.indexOf('if (seq !== refreshSeqRef.current) return;');
    expect(staleCheckAt, 'expected a staleness check in the success path').toBeGreaterThan(-1);
    expect(staleCheckAt).toBeLessThan(setRuntimeAt);
  });
});

describe('KnytsBridgeRemixSurface — the fallback/mycanvas branches are exhaustive and non-overlapping', () => {
  it('tab=mycanvas is only ever requested when passportUsable is true', () => {
    const code = stripComments(readSource(REMIX_SURFACE));
    const gateAt = code.indexOf('if (!passportUsable) {');
    expect(gateAt, 'expected the !passportUsable early branch').toBeGreaterThan(-1);
    const braceAt = code.indexOf('{', gateAt);
    let depth = 1;
    let end = -1;
    for (let i = braceAt + 1; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    expect(end).toBeGreaterThan(-1);
    const fallbackBlock = code.slice(gateAt, end + 1);
    const afterFallback = code.slice(end + 1);

    // Inside the fallback branch: metame-web, never mycanvas.
    expect(fallbackBlock).toContain("tab: 'metame-web'");
    expect(fallbackBlock).not.toContain("tab: 'mycanvas'");

    // After the fallback branch (i.e. only reached when passportUsable is
    // true): mycanvas, never a second metame-web request.
    expect(afterFallback).toContain("tab: 'mycanvas'");
    expect(afterFallback).not.toContain("tab: 'metame-web'");
  });

  it('a passport-less visitor gets the metame-web iframe AND the BridgePassportGate fallback, not a silent blank', () => {
    const code = stripComments(readSource(REMIX_SURFACE));
    expect(code).toContain("import { BridgePassportGate } from '@/components/journey/BridgePassportGate';");
    const returnAt = code.indexOf('if (!passportUsable) {', code.indexOf('function KnytsBridgeRemixSurface'));
    const jsxReturnAt = code.indexOf('return (', returnAt);
    const jsxBlock = code.slice(jsxReturnAt, code.indexOf('if (!src) return null;', jsxReturnAt));
    expect(jsxBlock).toContain('<BridgePassportGate');
    expect(jsxBlock).toContain('publicSrc &&');
    expect(jsxBlock).toContain('onProceedToPassport={() => selectStage(\'passport\')}');
  });

  it('undefined (not yet resolved) is treated as NOT usable — never optimistically shows mycanvas', () => {
    const code = stripComments(readSource(REMIX_SURFACE));
    expect(code).toContain('const passportUsable = citizenPassportUsable === true;');
  });
});

describe('KnytsBridgePage — one merged, monotonic source feeds both the Passport room and Remix', () => {
  it('handleRuntimeStateChange merges through mergeCitizenPassportUsable, never a plain assignment', () => {
    const code = stripComments(readSource(KNYTS_PAGE));
    expect(code).toContain('setCitizenPassportUsable((prev) => mergeCitizenPassportUsable(prev, observedNow));');
    // The old, unguarded plain-assignment form must not have crept back in.
    expect(code).not.toMatch(/setCitizenPassportUsable\(Boolean\(/);
  });

  it('both the Passport room and the Remix surface read the SAME page-level value — no second derivation', () => {
    const code = stripComments(readSource(KNYTS_PAGE));
    expect((code.match(/citizenPassportUsable/g) ?? []).length).toBeGreaterThan(0);
    expect(code).toContain("return { citizenPassportUsable, personaId, requestStateRefresh };");
    expect(code).toContain('return { personaId, citizenPassportUsable };');
  });
});
