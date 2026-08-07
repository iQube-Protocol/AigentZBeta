/**
 * Source-wiring canaries for "Close Nakamoto Pulse Enrollment — Final
 * Correlated Trace" (operator directive, 2026-08-06) — the two UI-facing
 * requirements: Pulse and P&L must never render as one solved item, and the
 * correlated enrollment trace panel must be reachable from every branch that
 * has a real tokenId to trace against.
 *
 * Source-scan style, matching this repo's existing canary convention (e.g.
 * tests/pulse-not-enrolled-surface.test.ts) — no React rendering harness is
 * set up in this codebase, so behavior is pinned by inspecting what the
 * component actually renders.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const source = read('components/journey/PulseTransparencyToggle.tsx');

describe('PulseTransparencyToggle — Pulse and P&L are never one solved item (2026-08-06)', () => {
  it('the success branch gates on Pulse alone, never AND-ed with the inferred P&L flag', () => {
    expect(source).toContain('if (horizen.pulse?.enabled) {');
    expect(source).not.toMatch(/if \(horizen\.pulse\?\.enabled && horizen\.pnl\?\.disclosureAuthorized\)/);
  });

  it('renders Pulse and P&L as two separate cards, not one combined "Pulse monitoring and P&L disclosure authorized" message', () => {
    expect(source).not.toContain('Pulse monitoring and P&amp;L disclosure authorized');
    expect(source).toContain('Pulse monitoring authorized');
    expect(source).toContain('P&amp;L disclosure —');
  });

  it('the P&L block states plainly that it is not independently confirmed, rather than mirroring Pulse\'s confirmation', () => {
    const match = source.match(/if \(horizen\.pulse\?\.enabled\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\*\n {3}\* PENDING/);
    expect(match, 'the Pulse-enabled branch must exist immediately before the PENDING branch').not.toBeNull();
    const block = match![1];
    expect(block).toMatch(/not independently confirmed|not yet authorized/);
    expect(block).toContain('there is no');
    expect(block).toContain('separate Horizen tool or authoritative reread for P&L disclosure specifically');
  });
});

describe('PulseTransparencyToggle — the correlated enrollment trace is reachable from every real-tokenId branch (2026-08-06)', () => {
  it('imports and instantiates PulseEnrollmentTracePanel exactly once, keyed to agentSlug', () => {
    expect(source).toMatch(/import \{ PulseEnrollmentTracePanel \} from ['"]\.\/PulseEnrollmentTracePanel['"]/);
    const instantiations = source.match(/const tracePanel = <PulseEnrollmentTracePanel agentSlug=\{agentSlug\} \/>;/g) ?? [];
    expect(instantiations).toHaveLength(1);
  });

  it('renders {tracePanel} in every branch below the tokenId gate — confirmed-but-unenriched, Pulse-enabled, pending, owner-conflict, not-enrolled, denied/expired, and the default not-yet-authorized state', () => {
    const occurrences = source.match(/\{tracePanel\}/g) ?? [];
    // One per branch: confirmed-but-unenriched (added 2026-08-07, the
    // authorization-confirmed/projection-incomplete split state), pulse-
    // enabled, pending, owner-source-conflict, not-enrolled, denied/expired,
    // default. Seven — exactly the branches that have a real tokenId to
    // trace against.
    expect(occurrences).toHaveLength(7);
  });

  it('never renders the trace panel before a tokenId is confirmed present (loading / no-tokenId branches stay untouched)', () => {
    const noTokenBranch = source.match(/if \(!horizen\?\.tokenId\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\*\n {3}\* The correlated/);
    expect(noTokenBranch, 'the no-tokenId branch must exist immediately before the tracePanel declaration').not.toBeNull();
    expect(noTokenBranch![1]).not.toContain('tracePanel');
    const loadingBranch = source.match(/if \(loading\) \{([\s\S]*?)\n {2}\}/);
    expect(loadingBranch).not.toBeNull();
    expect(loadingBranch![1]).not.toContain('tracePanel');
  });
});
