/**
 * Source-wiring canaries for the "owner-source-conflict" Pulse state (Al's
 * escalation, 2026-08-06) — PulseTransparencyToggle.tsx.
 *
 * Evidence: a live investigation proved Horizen's REST `/agents/:id` and
 * their `get_onboarding_status` MCP tool disagreed about who owns Nakamoto's
 * token 8798 — the REST value was corroborated three independent ways
 * (mint event, direct `ownerOf()`, cross-validation against other tokenIds).
 * This asserts the UI never frames that partner-side conflict as our
 * signature/wallet being wrong, and never offers a retry that cannot
 * possibly resolve it.
 *
 * Source-scan style, matching this repo's existing canary convention (e.g.
 * tests/pulse-not-enrolled-surface.test.ts) — no React rendering harness is
 * set up in this codebase.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const source = read('components/journey/PulseTransparencyToggle.tsx');

describe('PulseTransparencyToggle — owner-source-conflict blocks retries and names both addresses (2026-08-06)', () => {
  it('declares owner-source-conflict in the VerifyStatusState union', () => {
    expect(source).toMatch(/type VerifyStatusState = [^;]*'owner-source-conflict'/);
  });

  function extractBranch(): string {
    const match = source.match(/if \(status\?\.state === 'owner-source-conflict'\) \{([\s\S]*?)\n {2}\}\n\n {2}if \(status\?\.state === 'not-enrolled'\)/);
    expect(match, 'the owner-source-conflict branch must exist immediately before the not-enrolled branch').not.toBeNull();
    return match![1];
  }

  it('never renders "Create fresh authorization" — no local retry can resolve a partner-side conflict', () => {
    const block = extractBranch();
    expect(block).not.toContain('Create fresh authorization');
    expect(block).not.toContain('void authorize()');
  });

  it('never frames this as a signature, wallet, or ownership defect on our side', () => {
    const block = extractBranch();
    expect(block).toMatch(/not a signature, wallet, or\s*\n?\s*ownership issue on our side/);
    expect(block).not.toMatch(/\binvalid signature\b/i);
  });

  it('still offers a read-only status check — Check status again, never a POST/signing action', () => {
    const block = extractBranch();
    expect(block).toContain('Check status again');
    expect(block).toContain('void checkStatus()');
  });

  it('shows the conflicting values on demand rather than hiding the evidence', () => {
    const block = extractBranch();
    expect(block).toContain('refusalDetail');
    expect(block).toContain('the conflicting values');
  });

  it('is excluded from the pending branch\'s 30s auto-poll, same as not-enrolled — a conclusive-but-unresolvable state needs no further automatic re-checking', () => {
    const pollEffect = source.match(/useEffect\(\(\) => \{\n\s*if \(status\?\.state === 'pending'\) \{[\s\S]*?\n {2}\}, \[status\?\.state, checkStatus\]\);/);
    expect(pollEffect, 'the polling useEffect must exist with this exact shape').not.toBeNull();
    expect(pollEffect![0]).not.toContain("'owner-source-conflict'");
  });
});
