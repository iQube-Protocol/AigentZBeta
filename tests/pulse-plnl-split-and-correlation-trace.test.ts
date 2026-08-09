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

  it('the P&L block states three independent facts plainly, rather than mirroring Pulse\'s confirmation (three-tier vocabulary correction, 2026-08-09)', () => {
    const match = source.match(/if \(horizen\.pulse\?\.enabled\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\*\n {3}\* PENDING/);
    expect(match, 'the Pulse-enabled branch must exist immediately before the PENDING branch').not.toBeNull();
    const block = match![1];
    // Disclosure (operator's own permission grant), Service (Horizen's own
    // onboarding), and Evidence (independently verified proof) must each
    // render as their own row — never one row whose text switches depending
    // on whichever signal happens to be present, and never inferred from
    // Pulse's own "enabled" state above.
    expect(block).toContain('P&amp;L transparency — three independent facts');
    expect(block).toContain('P&amp;L disclosure —');
    expect(block).toContain('P&amp;L service —');
    expect(block).toContain('P&amp;L evidence —');
    expect(block).toMatch(/structured\?\.verifiablePnlRegistered === undefined/);
    expect(block).toContain('NOT Horizen approving or registering financial performance');
    expect(block).toContain('distinct from, and never inferred from, service registration above');
  });
});

describe('PulseTransparencyToggle — the correlated enrollment trace is reachable from every real-tokenId branch (2026-08-06)', () => {
  it('imports and instantiates PulseEnrollmentTracePanel exactly once, keyed to agentSlug, gated on showDiagnostics (2026-08-08 demotion)', () => {
    expect(source).toMatch(/import \{ PulseEnrollmentTracePanel \} from ['"]\.\/PulseEnrollmentTracePanel['"]/);
    const instantiations = source.match(/const tracePanel = showDiagnostics \? <PulseEnrollmentTracePanel agentSlug=\{agentSlug\} \/> : null;/g) ?? [];
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

describe('PulseTransparencyToggle — "Run correlated trace" demoted out of the ordinary ceremony (operator directive, 2026-08-08)', () => {
  it('showDiagnostics defaults to false — the diagnostic is opt-in, never shown in the ordinary Ratify/Verify ceremony by default', () => {
    // Destructuring is multi-line and gained a sibling prop
    // (`pnlServiceVerified`, 2026-08-09 P&L vocabulary correction) — match
    // across the remaining destructured props up to the closing brace rather
    // than requiring `showDiagnostics = false` immediately precede it.
    expect(source).toMatch(/showDiagnostics\s*=\s*false,[\s\S]*?\}:\s*PulseTransparencyToggleProps/);
  });

  it('PilotJourneyTab threads its own isAdmin through to PulseTransparencyToggle as showDiagnostics — the existing adminOnly-prop convention, never a new gating mechanism', () => {
    const tabSource = read('app/triad/components/codex/tabs/PilotJourneyTab.tsx');
    expect(tabSource).toContain('showDiagnostics: isAdmin === true');
  });
});
