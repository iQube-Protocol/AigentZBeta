/**
 * Implementation singularity / bypass protection for `ctp.exchange.artifact.
 * confirm` (2026-08-31, "CTP foundation", delivery amendment §2.5 / #32):
 *
 *   "CI/tests MUST detect or prevent a second application implementation
 *    from independently reproducing the same constitutional mutation
 *    semantics... migrated web/MCP/agent routes invoke the CTP/runtime
 *    rather than independently mutating state."
 *
 * Source-level canaries (this repo's established convention for pinning
 * "which function calls what" — see tests/institution-verification-ui.test.ts,
 * tests/admission-queue-ui.test.ts) since a full request-level integration
 * test would need a live Supabase instance neither channel's route
 * currently mocks around. These are the CHEAP, ALWAYS-RUN half of the
 * requirement; tests/ctp-constitutional-runtime.test.ts and tests/
 * ctp-exchange-artifact-confirm-primitive.test.ts cover the runtime/
 * primitive's own behavioural contract.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const WEB_ROUTE = "app/api/research/exchanges/[exchangeId]/actions/route.ts";
const MCP_ACTS = 'services/threshold/mcpConstitutionalActs.ts';
const PRIMITIVE = 'services/ctp/primitives/exchangeArtifactConfirm.ts';
const RECIPROCAL_EXCHANGE = 'services/research/reciprocalExchange.ts';

describe('the web channel invokes the Constitutional Runtime for confirm — never confirmOperatorAssistedArtifact directly', () => {
  const src = stripComments(readSource(WEB_ROUTE));

  it('imports constitutionalRuntime and the primitive registration side-effect', () => {
    expect(src).toMatch(/from '@\/services\/ctp\/constitutionalRuntime'/);
    expect(src).toMatch(/import '@\/services\/ctp\/primitives\/exchangeArtifactConfirm'/);
  });

  it('does NOT import confirmOperatorAssistedArtifact — the ONE application-level thing this migration removes', () => {
    expect(src).not.toMatch(/confirmOperatorAssistedArtifact/);
  });

  it("the 'confirm' case dispatches through constitutionalRuntime.execute with primitiveId 'ctp.exchange.artifact.confirm'", () => {
    const caseStart = src.indexOf("case 'confirm':");
    const caseEnd = src.indexOf("case 'freeze':", caseStart);
    expect(caseStart).toBeGreaterThan(-1);
    expect(caseEnd).toBeGreaterThan(caseStart);
    const caseBody = src.slice(caseStart, caseEnd);
    expect(caseBody).toMatch(/constitutionalRuntime\.execute\(/);
    expect(caseBody).toMatch(/'ctp\.exchange\.artifact\.confirm'/);
    expect(caseBody).toMatch(/channel:\s*'web'/);
  });
});

describe('the MCP channel invokes the Constitutional Runtime for confirm — never confirmOperatorAssistedArtifact directly', () => {
  const src = stripComments(readSource(MCP_ACTS));

  it('imports constitutionalRuntime and the primitive registration side-effect', () => {
    expect(src).toMatch(/from '@\/services\/ctp\/constitutionalRuntime'/);
    expect(src).toMatch(/import '@\/services\/ctp\/primitives\/exchangeArtifactConfirm'/);
  });

  it('no longer imports confirmOperatorAssistedArtifact from reciprocalExchange — the primitive module is the ONE remaining caller', () => {
    const importStart = src.indexOf("from '@/services/research/reciprocalExchange'");
    const importBlockStart = src.lastIndexOf('import {', importStart);
    const importBlock = src.slice(importBlockStart, importStart);
    expect(importBlock).not.toMatch(/confirmOperatorAssistedArtifact/);
  });

  it('confirmOperatorAssistedArtifactViaMcp dispatches through constitutionalRuntime.execute with channel "mcp"', () => {
    const fnStart = src.indexOf('export async function confirmOperatorAssistedArtifactViaMcp');
    const fnEnd = src.indexOf('\n}', src.indexOf('return { ok: true as const, exchangeId', fnStart));
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/constitutionalRuntime\.execute\(/);
    expect(fnBody).toMatch(/'ctp\.exchange\.artifact\.confirm'/);
    expect(fnBody).toMatch(/channel:\s*'mcp'/);
    expect(fnBody).not.toMatch(/confirmOperatorAssistedArtifact\(/);
  });
});

describe('exactly ONE canonical implementation binding exists for ctp.exchange.artifact.confirm', () => {
  it('the primitive module is the ONLY place registerPrimitive is called for this primitive id, and it binds the real service function', () => {
    const src = stripComments(readSource(PRIMITIVE));
    const registerCalls = (src.match(/registerPrimitive\(/g) ?? []).length;
    expect(registerCalls).toBe(1);
    expect(src).toMatch(/implementationRef:\s*IMPLEMENTATION_REF/);
    expect(src).toMatch(/const IMPLEMENTATION_REF = 'services\/research\/reciprocalExchange\.ts#confirmOperatorAssistedArtifact'/);
  });

  it('confirmOperatorAssistedArtifact itself is exported exactly once from reciprocalExchange.ts — no sibling reimplementation', () => {
    const src = stripComments(readSource(RECIPROCAL_EXCHANGE));
    const defs = (src.match(/export async function confirmOperatorAssistedArtifact\(/g) ?? []).length;
    expect(defs).toBe(1);
  });
});

describe('refusal evidence never mutates protected state — structural check', () => {
  it("writeRefusalEvidence's only write target is the evidence table itself", () => {
    const src = stripComments(readSource('services/ctp/evidence.ts'));
    const fnStart = src.indexOf('export async function writeRefusalEvidence');
    const fnEnd = src.indexOf('\n}', src.indexOf('return evidence;', fnStart));
    const fnBody = src.slice(fnStart, fnEnd);
    // The only .from(...) call in this function must be the evidence table.
    const fromCalls = fnBody.match(/admin\.from\(([^)]+)\)/g) ?? [];
    expect(fromCalls.length).toBeGreaterThan(0);
    for (const call of fromCalls) expect(call).toMatch(/EVIDENCE_TABLE/);
  });
});
