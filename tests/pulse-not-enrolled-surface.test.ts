/**
 * Source-wiring canaries for the "not enrolled" Pulse state (operator's
 * follow-up brief, 2026-08-06) — PulseTransparencyToggle.tsx.
 *
 * Al's evidence: a live `get_onboarding_status` reread answered, in words,
 * "Not enrolled in Pulse monitoring. Next step: Enroll" and the surface
 * rendered "Verification pending — Horizen has not yet responded", which is
 * false — Horizen HAD responded, definitively. This asserts the fix at the
 * source level: the not-enrolled branch exists, offers the retry
 * immediately, and the pending branch's copy is never reachable for this
 * state.
 *
 * Source-scan style, matching this repo's existing canary convention (e.g.
 * tests/horizen-agent-page-surface-wiring.test.ts) — no React rendering
 * harness is set up in this codebase (environment: "node" in
 * vitest.config.mjs), so component behavior is pinned by inspecting what the
 * component actually renders for each branch, not by mounting it.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const source = read('components/journey/PulseTransparencyToggle.tsx');

describe('PulseTransparencyToggle — not-enrolled is a distinct, immediately-retryable state (2026-08-06)', () => {
  it('declares not-enrolled in the VerifyStatusState union', () => {
    expect(source).toMatch(/type VerifyStatusState = [^;]*'not-enrolled'/);
  });

  it('the not-enrolled branch renders "Create fresh authorization" — the retry is available immediately, not gated behind another state', () => {
    const match = source.match(/if \(status\?\.state === 'not-enrolled'\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\*\n {3}\* DENIED/);
    expect(match, 'the not-enrolled branch must exist immediately before the DENIED/EXPIRED branch').not.toBeNull();
    const block = match![1];
    expect(block).toContain('Pulse is not enrolled');
    expect(block).toContain('Create fresh authorization');
    expect(block).toContain('void authorize()');
    expect(block).toContain('Check status again');
    expect(block).toContain('void checkStatus()');
    // Explicitly not framed as a signature/ownership failure.
    expect(block).toMatch(/not a signature or ownership failure/i);
  });

  it('the not-enrolled branch never uses the pending branch\'s "has not yet responded" copy — Horizen DID respond', () => {
    const match = source.match(/if \(status\?\.state === 'not-enrolled'\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\*\n {3}\* DENIED/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toMatch(/has not yet responded/i);
    expect(match![1]).not.toMatch(/verification pending/i);
  });

  it('the not-enrolled branch is checked BEFORE the pending branch\'s auto-poll condition, and is excluded from it — it must never be swallowed by the 30s poll loop', () => {
    // The polling effect only re-arms for 'pending' — asserted here so a
    // future refactor that widens the poll condition to 'not-enrolled' (which
    // would silently keep re-checking a CONCLUSIVE answer as though it were
    // still ambiguous) fails this canary.
    const pollEffect = source.match(/useEffect\(\(\) => \{\n\s*if \(status\?\.state === 'pending'\) \{[\s\S]*?\n {2}\}, \[status\?\.state, checkStatus\]\);/);
    expect(pollEffect, 'the polling useEffect must exist with this exact shape').not.toBeNull();
    expect(pollEffect![0]).not.toContain("'not-enrolled'");
  });

  it('checkStatus (Check status again / Check status now) never signs or submits — GET only, no signing dependency imported', () => {
    const fn = source.match(/const checkStatus = useCallback\(async \(\) => \{([\s\S]*?)\n {2}\}, \[agentSlug, refresh\]\);/);
    expect(fn, 'checkStatus must exist with this exact dependency array').not.toBeNull();
    expect(fn![1]).toMatch(/method:\s*['"]GET['"]|personaFetch\(`\/api\/journey\/moneypenny-horizen\/verify\/status/);
    expect(fn![1]).not.toContain("method: 'POST'");
    expect(fn![1]).not.toMatch(/sign|nonce/i);
  });
});
