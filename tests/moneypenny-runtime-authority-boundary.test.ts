/**
 * MoneyPenny Runtime — Principal-Delegate Separation canary (PRD-MPY-001
 * Phase 4, Increment P4-2).
 *
 * MoneyPenny may form and accept her own side of a Constitutional Agreement
 * (see moneyPennyArchitect / the RuntimePanel's Form+Accept buttons), but
 * only a human, acting through the browser, may authorize one. This test
 * pins that boundary structurally: the Runtime route must never import or
 * call `authorizeAgreement`, and the P4-1 shadow-mode clamp (mode is always
 * 'shadow' server-side regardless of the request body) must still hold.
 *
 * Mirrors the readFileSync source-scan style of
 * tests/irl-run-lifecycle.test.ts's "route never imports X" canaries.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE_PATH = join(process.cwd(), 'app/api/moneypenny/runtime/route.ts');
const ARCHITECT_ROUTE_PATH = join(process.cwd(), 'app/api/moneypenny/architect/route.ts');
const PANEL_PATH = join(process.cwd(), 'app/(shell)/moneypenny/components/RuntimePanel.tsx');

describe('MoneyPenny Runtime route — authority boundary', () => {
  it('never imports or calls authorizeAgreement', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src).not.toContain('authorizeAgreement');
  });

  it('never imports settlementExecutor (no fund movement in this route)', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src.toLowerCase()).not.toContain('settlementexecutor');
  });

  it('still hard-clamps mode to shadow server-side (P4-1 safety clamp intact)', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    expect(src).toMatch(/mode:\s*'shadow'/);
  });
});

describe('MoneyPenny Architect route — proposal-only boundary (regression)', () => {
  it('never imports authorizeAgreement, acceptAgreement, or settlementExecutor', () => {
    const src = readFileSync(ARCHITECT_ROUTE_PATH, 'utf8');
    expect(src).not.toContain('authorizeAgreement');
    expect(src).not.toContain('acceptAgreement');
    expect(src.toLowerCase()).not.toContain('settlementexecutor');
  });
});

describe('RuntimePanel — client-side agreement lifecycle', () => {
  it('uses personaFetch, never raw fetch, for the spine-authenticated runtime + agreement calls', () => {
    const src = readFileSync(PANEL_PATH, 'utf8');
    // no raw global fetch( -- personaFetch only (its lowercase never matches "Fetch(")
    expect(src).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(src).toContain('personaFetch(');
  });

  it('offers form/accept/authorize as three distinct actions (no single "approve-all")', () => {
    const src = readFileSync(PANEL_PATH, 'utf8');
    expect(src).toContain('"form"');
    expect(src).toContain('"accept"');
    expect(src).toContain('"authorize"');
  });
});
