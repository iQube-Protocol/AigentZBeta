/**
 * "Close Pulse now" — the final UI projection boundary (operator directive,
 * 2026-08-08).
 *
 * The operator's acceptance test: seed local REFUSED/PARTNER_NOT_ENROLLED,
 * return the exact live structured Horizen response, and require:
 *
 *   Pulse                  ENROLLED
 *   Identity commitment    RECORDED
 *   Endpoint               HEALTHY / no warning
 *   Verifiable P&L         NOT REGISTERED
 *
 * with no "Create fresh authorization" affordance, because there is nothing
 * left to authorize.
 *
 * This codebase has no React rendering harness (see
 * tests/pulse-plnl-split-and-correlation-trace.test.ts's own header) — every
 * PulseTransparencyToggle canary in this repo is source-scan style, pinning
 * what the component's render logic actually does rather than what a mounted
 * tree would show. This file follows the same convention for the CLIENT
 * half of the projection boundary; the SERVER half (verify/status/route.ts
 * forwarding `structuredStatus` from `verifyHorizenTransparencyActivation`)
 * is pinned by tests/journey-verify-status-route.test.ts's own "forwards the
 * structured projection" test, and the RECONCILIATION boundary itself
 * (`verifyHorizenTransparencyActivation`'s structured-first classification)
 * by tests/horizen-authorization-client.test.ts's "Close Pulse now" describe
 * block.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const source = read('components/journey/PulseTransparencyToggle.tsx');

// The exact branch the operator's acceptance test lands on: `horizen.pulse?.enabled`,
// up to (not including) the next branch's own leading comment.
const enrolledBranchMatch = source.match(
  /if \(horizen\.pulse\?\.enabled\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\*\n {3}\* AUTHORIZATION CONFIRMED, PROJECTION INCOMPLETE/,
);

describe('PulseTransparencyToggle — checkStatus() carries the structured projection through, never re-derived from prose (2026-08-08)', () => {
  it('captures json.structuredStatus into VerifyStatusInfo.structuredStatus', () => {
    expect(source).toMatch(/structuredStatus:\s*\n?\s*json\.structuredStatus/);
  });
});

describe('PulseTransparencyToggle — the enrolled branch projects Pulse/Identity commitment/Endpoint/Verifiable P&L (2026-08-08)', () => {
  it('the enrolled branch exists immediately before the confirmed-but-unenriched branch', () => {
    expect(enrolledBranchMatch, 'the horizen.pulse?.enabled branch must exist immediately before the enrichment-incomplete branch').not.toBeNull();
  });

  const block = enrolledBranchMatch ? enrolledBranchMatch[1] : '';

  it('projects "Identity commitment" from structured.pulseCommitmentRecorded, never fabricated when absent', () => {
    expect(block).toContain('Identity commitment:');
    expect(block).toMatch(/structured\?\.pulseCommitmentRecorded !== undefined/);
  });

  it('projects "Endpoint" health from the structured endpointWarning field, distinguishing null (healthy) from a real warning', () => {
    expect(block).toContain('Endpoint:');
    expect(block).toContain("hasEndpointWarning");
    expect(block).toMatch(/endpointWarning === null \? 'Healthy/);
  });

  it('projects "Verifiable P&L" as the AUTHORITATIVE fact when structured evidence exists — never silently deferring to the inferred Agent Card flag', () => {
    expect(block).toContain('Verifiable P&amp;L —');
    expect(block).toMatch(/structured\?\.verifiablePnlRegistered !== undefined/);
  });

  it('never renders a "Create fresh authorization" affordance in the enrolled branch — there is nothing left to authorize', () => {
    expect(block).not.toContain('Create fresh authorization');
    expect(block).not.toContain('void authorize()');
  });
});

describe('PulseTransparencyToggle — enrichment-pending copy never says "not enrolled" (2026-08-08)', () => {
  const pendingBranchMatch = source.match(
    /if \(status\?\.state === 'complete' && status\.enrichmentRefusalCode\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\*\n {3}\* PENDING/,
  );

  it('the confirmed-but-unenriched branch exists immediately before the pending branch', () => {
    expect(pendingBranchMatch, 'the enrichment-incomplete branch must exist immediately before the pending branch').not.toBeNull();
  });

  const block = pendingBranchMatch ? pendingBranchMatch[1] : '';

  it('renders "Pulse enrolled · local enrichment pending" — the operator\'s exact required copy', () => {
    expect(block).toContain('Pulse enrolled');
    expect(block).toContain('local enrichment pending');
  });

  it('never renders "not enrolled" or "Pulse is not enrolled" in this branch', () => {
    expect(block.toLowerCase()).not.toContain('not enrolled');
  });
});
