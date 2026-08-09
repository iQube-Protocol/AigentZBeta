/**
 * Al's review, verbatim (2026-08-06): "Do not make one HTTP request wait
 * through t+0/5/15/30... this could fail before returning the trace and
 * recreate the same ambiguity. Use a persisted attempt plus short read-only
 * polling calls... There must be exactly one submission and multiple
 * separately invoked status reads under the same attemptId. Do not use
 * setTimeout/sleep inside a long-running API request."
 *
 * This pins that structurally: neither server-side route, nor the
 * start/continue service functions, may contain a sleep/setTimeout on the
 * request path. The ONLY place a scheduling delay is allowed to exist is the
 * CLIENT component (PulseEnrollmentTracePanel.tsx), which owns the +5/+15/+30s
 * cadence via its own browser-side timers calling a separate, fast
 * "continue" route — never a server-held sleep.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { stripComments } from './_lib/sourceAuthority';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

// stripComments so this canary checks CODE for setTimeout/setInterval, not
// the doc comments that (correctly) quote Al's review verbatim — those
// quotes contain the literal words "setTimeout" and "t+0/5/15/30" as
// PROSE explaining what must NOT exist in code, which would otherwise make
// this canary cry wolf on its own compliant documentation.
const serviceSource = stripComments(read('services/horizen/pulseEnrollmentTrace.ts'));
const startRouteSource = stripComments(read('app/api/journey/moneypenny-horizen/verify/pulse-trace/route.ts'));
const continueRouteSource = stripComments(read('app/api/journey/moneypenny-horizen/verify/pulse-trace/continue/route.ts'));
const panelSource = read('components/journey/PulseEnrollmentTracePanel.tsx');

describe('Pulse correlation trace — no server-side sleep through the full t+0/5/15/30 schedule (Al, 2026-08-06)', () => {
  it('the service module (start + continue) never calls setTimeout/setInterval — no sleep helper exists', () => {
    expect(serviceSource).not.toMatch(/setTimeout|setInterval/);
    expect(serviceSource).not.toMatch(/function sleep\(/);
  });

  it('the start route never calls setTimeout/setInterval', () => {
    expect(startRouteSource).not.toMatch(/setTimeout|setInterval/);
  });

  it('the continue route never calls setTimeout/setInterval, and never signs or submits (no reference to signing/submission stages)', () => {
    expect(continueRouteSource).not.toMatch(/setTimeout|setInterval/);
    expect(continueRouteSource).not.toMatch(/runHorizenTransparencyAuthorization|prepareHorizenTransparencyAuthorization|signHorizenTransparencyAuthorization|submitHorizenTransparencyAuthorization/);
  });

  it('exports two distinct entry points — start (build->sign->submit->t+0, once) and continue (one reread, repeatable) — never a single combined function that runs all four reads', () => {
    expect(serviceSource).toContain('export async function startPulseEnrollmentTrace(');
    expect(serviceSource).toContain('export async function continuePulseEnrollmentTrace(');
    expect(serviceSource).not.toContain('export async function runPulseEnrollmentTrace(');
  });

  it('startPulseEnrollmentTrace calls the submission ceremony exactly once (one call to runHorizenTransparencyAuthorization, not a loop)', () => {
    const fn = serviceSource.match(/export async function startPulseEnrollmentTrace\(([\s\S]*?)\n\}/);
    expect(fn, 'startPulseEnrollmentTrace must exist').not.toBeNull();
    const occurrences = fn![1].match(/runHorizenTransparencyAuthorization\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('continuePulseEnrollmentTrace calls the reread exactly once per invocation (one call to verifyHorizenTransparencyActivation, not a loop)', () => {
    const fn = serviceSource.match(/export async function continuePulseEnrollmentTrace\(([\s\S]*?)\n\}/);
    expect(fn, 'continuePulseEnrollmentTrace must exist').not.toBeNull();
    const occurrences = fn![1].match(/verifyHorizenTransparencyActivation\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('the client panel owns the +5/+15/+30s cadence via its own setTimeout, calling the separate continue route — not the server', () => {
    expect(panelSource).toMatch(/setTimeout\(\(\) => void continueOnce/);
    expect(panelSource).toContain("'/api/journey/moneypenny-horizen/verify/pulse-trace/continue'");
    expect(panelSource).toContain("REREAD_DELAYS_MS");
  });

  it('the start route documents the risk it no longer carries — no 30s+ maxDuration budget claim remains', () => {
    expect(startRouteSource).not.toMatch(/t\+0\/5\/15\/30/);
    expect(continueRouteSource).toMatch(/maxDuration = 30/);
  });
});
