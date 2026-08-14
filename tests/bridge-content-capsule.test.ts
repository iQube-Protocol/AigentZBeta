/**
 * BridgeContentCapsule owns projection, never constitutional state
 * (2026-08-11).
 *
 * The operator's architectural boundary, stated verbatim: the capsule "owns
 * ONLY spatial/presentation state — active rail card, active viewport
 * renderer, local carousel position, fullscreen/hero state, local audio UI
 * state, capsule projection index" and must NEVER independently determine
 * journey stage completion, Passport state, constitutional authority,
 * delegation, Standing, or durable completion. Selecting a card changes
 * presentation, not constitutional state.
 *
 * This is enforced structurally: the shared shell must not itself call
 * fetch/personaFetch or import any journey/receipt/access service. Any
 * capsule HYDRATION (View, Orient, Personify) is free to fetch/mutate real
 * state in ITS OWN file — this canary only guards the shared shell.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO = path.join(__dirname, '..');
const SOURCE_PATH = 'components/journey/BridgeContentCapsule.tsx';
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const src = stripComments(fs.readFileSync(path.join(REPO, SOURCE_PATH), 'utf8'));

describe('BridgeContentCapsule — presentation-only boundary', () => {
  it('exists and exports the expected shell', () => {
    expect(src).toMatch(/export function BridgeContentCapsule/);
  });

  it('never calls fetch or personaFetch — it must not read or write any durable state itself', () => {
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/personaFetch/);
  });

  it('never imports a journey, receipt, access, or DVN service — those are the hydration\'s job, not the shell\'s', () => {
    expect(src).not.toMatch(/from ['"]@\/services\/journey/);
    expect(src).not.toMatch(/from ['"]@\/services\/dvn/);
    expect(src).not.toMatch(/from ['"]@\/services\/access/);
    expect(src).not.toMatch(/from ['"]@\/services\/identity/);
    expect(src).not.toMatch(/from ['"]@\/utils\/personaSpine/);
  });

  it('never references journey/completion/passport/standing vocabulary — the shell has no notion of them', () => {
    expect(src).not.toMatch(/completionEvidence|journeyState|Passport|Standing|evaluateAccess|getActivePersona/);
  });

  it('the only state it owns is presentation state (active rail card + fullscreen)', () => {
    const stateHooks = src.match(/useState[<(]/g) ?? [];
    // internalActive (rail selection), fullscreen, mounted (SSR-safety) — no more, no less.
    expect(stateHooks.length).toBe(3);
  });

  it('renderViewport/renderStrip are injected render-prop functions, not owned data — the shell never inlines business content', () => {
    expect(src).toMatch(/renderViewport:\s*\(activeRailId: string, opts: \{ fullscreen: boolean \}\) => React\.ReactNode/);
    expect(src).toMatch(/renderStrip\?:\s*\(activeRailId: string\) => React\.ReactNode/);
  });
});
