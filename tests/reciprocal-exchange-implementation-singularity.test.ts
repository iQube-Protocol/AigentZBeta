/**
 * Implementation-singularity regression suite (2026-08-29 incident).
 *
 * services/research/reciprocalExchange.ts and services/threshold/
 * mcpConstitutionalActs.ts each shipped TWO full, functionally-divergent
 * implementations of registerArtifactOperatorAssisted /
 * confirmOperatorAssistedArtifact / confirmOperatorAssistedArtifactViaMcp.
 * `tsc` flagged this ("Duplicate function implementation") but
 * next.config.js's `typescript.ignoreBuildErrors: true` let it ship anyway —
 * JS function-declaration semantics silently let the LATER (and, in this
 * case, less safe) definition win at runtime, while services/threshold/
 * gateway.ts's real tool dispatcher still called the EARLIER definition's
 * signature, so the live MCP tool was permanently broken
 * ("artifactId is required" on every call).
 *
 * A constitutional primitive requires implementation singularity, not just
 * state singularity: one canonical state machine must not be backed by two
 * silently competing implementations of the same act. This suite fails the
 * build the moment a second implementation of any of these acts reappears —
 * structurally (source-text) and via a real, scoped `tsc` pass that is not
 * suppressible by ignoreBuildErrors, since this test invokes `tsc` directly.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe('Reciprocal Exchange constitutional acts — exactly one implementation each', () => {
  const reciprocalExchangeSrc = readFileSync(
    path.join(ROOT, 'services/research/reciprocalExchange.ts'),
    'utf8',
  );
  const mcpActsSrc = readFileSync(path.join(ROOT, 'services/threshold/mcpConstitutionalActs.ts'), 'utf8');

  it('registerArtifactOperatorAssisted has exactly one exported implementation', () => {
    expect(countOccurrences(reciprocalExchangeSrc, 'export async function registerArtifactOperatorAssisted(')).toBe(1);
  });

  it('confirmOperatorAssistedArtifact has exactly one exported implementation', () => {
    expect(countOccurrences(reciprocalExchangeSrc, 'export async function confirmOperatorAssistedArtifact(')).toBe(1);
  });

  it('confirmOperatorAssistedArtifactViaMcp has exactly one exported implementation', () => {
    expect(countOccurrences(mcpActsSrc, 'export async function confirmOperatorAssistedArtifactViaMcp(')).toBe(1);
  });

  it('ConfirmOperatorAssistedArtifactMcpArgs has exactly one exported declaration', () => {
    expect(countOccurrences(mcpActsSrc, 'export interface ConfirmOperatorAssistedArtifactMcpArgs {')).toBe(1);
  });

  it('the canonical register function derives party from membership, never from a caller-supplied slot', () => {
    // The removed (unsafe) implementation took a caller-supplied `partySlot`
    // and never checked resolveMembership before inserting a Party B row —
    // an artifact could be attributed to a principal who was never actually
    // bound as the exchange's counterparty. The surviving implementation
    // MUST take boundPrincipalPersonaId and derive the party via
    // resolveMembership, refusing 'not-a-party' otherwise.
    expect(reciprocalExchangeSrc).toContain('boundPrincipalPersonaId: string;');
    expect(reciprocalExchangeSrc).not.toContain('partySlot: PartySlot,');
    const registerBody = reciprocalExchangeSrc.slice(
      reciprocalExchangeSrc.indexOf('export async function registerArtifactOperatorAssisted('),
      reciprocalExchangeSrc.indexOf('export async function confirmOperatorAssistedArtifact('),
    );
    expect(registerBody).toMatch(/resolveMembership\(exchange, input\.boundPrincipalPersonaId\)/);
    expect(registerBody).toMatch(/if \(!party\) return \{ ok: false, error: 'not-a-party' \};/);
  });

  it('confirmOperatorAssistedArtifact never writes a nonexistent updated_at column', () => {
    // exchange_artifacts has no updated_at column — the removed
    // implementation wrote one unconditionally, which would fail even after
    // the operator-assisted migration lands.
    const confirmBody = reciprocalExchangeSrc.slice(
      reciprocalExchangeSrc.indexOf('export async function confirmOperatorAssistedArtifact('),
    );
    const updateCall = confirmBody.slice(0, confirmBody.indexOf('return { ok: true, artifact: confirmed };'));
    expect(updateCall).not.toContain('updated_at');
  });

  // Scoped, dependency-resolved tsc pass — deliberately NOT suppressible by
  // next.config.js's ignoreBuildErrors (that setting only affects `next
  // build`; invoking tsc directly here always surfaces real compiler
  // errors). Scoped via tsconfig.constitutional.json to keep this fast
  // (~5s) rather than running the full, ~1100-pre-existing-error project
  // typecheck on every test run.
  it('a scoped tsc pass reports zero errors in the constitutional/runtime modules touched by this incident', () => {
    const OWNED_FILES = [
      'services/research/reciprocalExchange.ts',
      'services/threshold/mcpConstitutionalActs.ts',
      'services/journey/boundaryResearchExchangeAdmission.ts',
      'app/api/admin/exchanges/[exchangeId]/register-counterparty-artifact/route.ts',
      'app/api/admin/exchanges/operator-assisted-admission/route.ts',
    ];

    let output = '';
    try {
      output = execFileSync(
        'npx',
        ['tsc', '-p', 'tsconfig.constitutional.json', '--noEmit'],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err: unknown) {
      // tsc exits non-zero when it reports ANY error, including in files
      // transitively pulled in that this incident did not touch — those are
      // pre-existing debt tracked separately, not this suite's concern.
      output = (err as { stdout?: string }).stdout ?? '';
    }

    const errorLines = output.split('\n').filter((line) => line.includes(': error TS'));

    const ownedErrors = errorLines.filter((line) => OWNED_FILES.some((f) => line.startsWith(f)));
    expect(ownedErrors).toEqual([]);

    const duplicateErrors = errorLines.filter((line) => /duplicate|redeclare/i.test(line));
    expect(duplicateErrors).toEqual([]);
  }, 30_000);
});
