/**
 * Factor journey parity (MoneyPenny x Horizen journey-completion pass,
 * 2026-09-05). `aigent-factor` is now selectable in the Register stage's
 * agent dropdown — this file pins that Factor traverses the SAME generic,
 * agent-parameterized state machine every other registrable agent does,
 * never a Factor-specific copy of the journey and never a hardcoded
 * Nakamoto-only path that would silently exclude it.
 *
 * Source-scan style, matching this repo's existing canary convention
 * (tests/horizen-agent-page-surface-wiring.test.ts's own header) — no React
 * rendering harness, no live network/Supabase call.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSource, stripComments } from './_lib/sourceAuthority';

function src(repoRelativePath: string): string {
  return stripComments(readFileSync(join(process.cwd(), repoRelativePath), 'utf8'));
}

describe('the journey state route resolves receipts by the SELECTED agent, never a fixed one — no cross-agent leak between Factor and Nakamoto', () => {
  const stateRouteSrc = src('app/api/journey/moneypenny-horizen/state/route.ts');

  it('finds receipts scoped to agent.runtimeAgentId (the resolved, request-selected agent) — never a literal nakamoto/moneypenny runtimeAgentId', () => {
    expect(stateRouteSrc).toMatch(/findAgentReceiptRefs\(agent\.runtimeAgentId/);
    expect(stateRouteSrc).not.toMatch(/findAgentReceiptRefs\(['"]aigent-nakamoto['"]/);
    expect(stateRouteSrc).not.toMatch(/findAgentReceiptRefs\(['"]aigent-moneypenny['"]/);
  });

  it('resolves the agent generically via resolveRegistrableAgent, not a hardcoded slug branch', () => {
    expect(stateRouteSrc).toContain('resolveRegistrableAgent');
  });
});

describe('the Operate/aigentMe disposition route is agent-selectable, not hardcoded to a single agent', () => {
  const routeSrc = src('app/api/journey/moneypenny-horizen/aigentme/disposition/route.ts');

  it('resolves the agent from the request (agentSlug), defaulting only when omitted — never fixed to moneypenny or nakamoto', () => {
    expect(routeSrc).toContain('resolveRegistrableAgent(body.agentSlug)');
    expect(routeSrc).toContain('resolveRegistrableAgent(agentSlug)');
    expect(routeSrc).toContain('DEFAULT_REGISTRABLE_AGENT_SLUG');
  });

  it('tags both the activation and disposition receipts with the RESOLVED agent\'s own runtimeAgentId, not a literal one', () => {
    expect(routeSrc).toContain('agent.runtimeAgentId');
    expect(routeSrc).not.toMatch(/runtimeAgentId:\s*['"]aigent-nakamoto['"]/);
  });
});

describe('no Horizen journey route under app/api/journey/moneypenny-horizen hardcodes aigent-nakamoto as an exclusive/required agent', () => {
  it('the only "nakamoto" references left in these routes are a DEFAULT (never an exclusivity check)', () => {
    // A source-level regression here would mean some route silently refuses
    // (or silently no-ops for) any agent other than Nakamoto — exactly the
    // shape of bug this canary exists to catch before it reaches a real
    // Factor rehearsal.
    const traceRouteSrc = src('app/api/journey/moneypenny-horizen/verify/pulse-trace/route.ts');
    expect(traceRouteSrc).toContain("DEFAULT_TRACE_AGENT_SLUG = 'nakamoto'");
    // A default is fine — an equality/exclusivity gate is not.
    expect(traceRouteSrc).not.toMatch(/agentSlug\s*!==\s*['"]nakamoto['"]/);
    expect(traceRouteSrc).not.toMatch(/only\s+nakamoto/i);
  });
});

describe('registrableAgents — Factor is a config row, sourced from the same table Register\'s dropdown already reads (never a parallel agent list)', () => {
  it('RegisterAgentPanel.tsx builds its dropdown from listRegistrableAgents(), not a hand-maintained agent array', () => {
    const panelSrc = readSource('components/journey/RegisterAgentPanel.tsx');
    expect(panelSrc).toContain('listRegistrableAgents()');
  });
});
