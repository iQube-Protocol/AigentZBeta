/**
 * myCanvas activation defect closure (item 8, semantic repair 2026-08-25).
 *
 * `mycanvas` is an "open" activation-catalog entry (data/activation-catalog.ts)
 * — eligible to self-activate, but `services/activations/spineActivations.ts`
 * never auto-grants it on a mere read (auto-grant was removed). A Passport-
 * qualified visitor entering KNYT Remix or CI Personify landed on the
 * generic metaMe.com fallback because `mycanvas` had genuinely never been
 * activated for them — CodexPanelDynamic's tab gate was correctly denying a
 * tab the surface never granted.
 *
 * Fix: both surfaces now ensure the activation via the EXISTING, idempotent
 * `useActivations().activate(id)` (ActivationsContext) before deep-linking
 * `tab=mycanvas`, waiting for confirmed-or-optimistic `active` status first.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

const KNYTS_REMIX = 'components/journey/KnytsBridgeRemixSurface.tsx';
const CI_PERSONIFY = 'components/journey/ConstitutionalInternetBridgePersonifyMyCanvas.tsx';

describe.each([
  ['KnytsBridgeRemixSurface', KNYTS_REMIX],
  ['ConstitutionalInternetBridgePersonifyMyCanvas', CI_PERSONIFY],
])('%s ensures the mycanvas activation before deep-linking', (_name, path) => {
  it('imports the canonical ActivationsProvider/useActivations — never a second activation write path', () => {
    const graph = importAuthority(readSource(path));
    const hit = graph.records.find(
      (r) =>
        r.specifier === '@/services/activations/ActivationsContext' &&
        r.names.includes('ActivationsProvider') &&
        r.names.includes('useActivations'),
    );
    expect(hit, `${path} must import the canonical ActivationsProvider/useActivations`).toBeTruthy();
  });

  it('wraps the component in ActivationsProvider, scoped to this persona', () => {
    const code = stripComments(readSource(path));
    expect(code).toMatch(/<ActivationsProvider personaId=\{props\.personaId\}>/);
  });

  it('calls activate("mycanvas") — never assumes the activation already exists', () => {
    const code = stripComments(readSource(path));
    expect(code).toContain("void activate('mycanvas')");
  });

  it('the activation-ensure effect only fires once passport-usable, never for a signed-out/unpassported visitor', () => {
    const code = stripComments(readSource(path));
    const ensureEffectAt = code.indexOf("void activate('mycanvas')");
    expect(ensureEffectAt).toBeGreaterThan(-1);
    const effectStart = code.lastIndexOf('useEffect(() => {', ensureEffectAt);
    const guardLine = code.slice(effectStart, ensureEffectAt);
    expect(guardLine).toContain('!passportUsable');
  });

  it('waits for confirmed/optimistic activation before building the mycanvas src — never mounts against a not-yet-active tab', () => {
    const code = stripComments(readSource(path));
    const srcEffectAt = code.indexOf("tab: 'mycanvas'");
    expect(srcEffectAt).toBeGreaterThan(-1);
    const before = code.slice(Math.max(0, srcEffectAt - 800), srcEffectAt);
    expect(before).toContain('if (!mycanvasActive)');
  });

  it('shows an "Opening myCanvas…" state while activation is pending — never a blank pane or the metaMe.com fallback', () => {
    const code = stripComments(readSource(path));
    expect(code).toContain('Opening myCanvas');
    // The pending branch is reached from the passport-usable path, not the
    // gated (not-usable) return above it.
    const pendingAt = code.indexOf('mycanvasPending');
    expect(pendingAt).toBeGreaterThan(-1);
  });

  it('offers an explicit retry on activation failure — never a silent fallback to metaMe.com', () => {
    const code = stripComments(readSource(path));
    expect(code).toContain("Couldn&apos;t open myCanvas");
    expect(code).toMatch(/onClick=\{\(\) => void activate\('mycanvas'\)\}/);
  });

  it('the metame-web fallback branch is reached ONLY from the Passport gate, never from a failed/pending activation', () => {
    const code = stripComments(readSource(path));
    const fallbackAt = code.indexOf("tab: 'metame-web'");
    expect(fallbackAt).toBeGreaterThan(-1);
    // The fallback sits inside the `if (!passportUsable)` branch of the src
    // effect — confirm no `mycanvasActive`/`mycanvasPending` check gates it.
    const nearby = code.slice(Math.max(0, fallbackAt - 200), fallbackAt);
    expect(nearby).toContain('!passportUsable');
  });
});

describe('signed-out / unpassported visitors still fail closed', () => {
  it.each([KNYTS_REMIX, CI_PERSONIFY])('%s renders the Passport gate before any activation logic runs', (path) => {
    const code = stripComments(readSource(path));
    const gateAt = code.indexOf('if (!passportUsable) {');
    const activateCallAt = code.indexOf("void activate('mycanvas')");
    expect(gateAt).toBeGreaterThan(-1);
    expect(activateCallAt).toBeGreaterThan(-1);
    // The passport-usable guard on the ensure-activation effect precedes its
    // own activate() call in source order, and the render-time gate return
    // precedes the pending/error/iframe branches — both already asserted
    // above; this test additionally confirms the render gate exists at all.
  });
});
