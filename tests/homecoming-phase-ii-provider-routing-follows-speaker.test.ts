/**
 * Provider/model routing — P1 Item 7 (operator brief 2026-08-16, "provider/
 * model routing must follow the assigned Agent").
 *
 * Before this fix, app/api/codex/chat/route.ts's buildProviderAttempts()
 * call was passed `resolvedAgentId` — the SURFACE claim (e.g. 'aigent-me')
 * — never the resolved SPEAKER (`systemPromptPersonaId`, e.g.
 * 'aigent-aletheon' once she is assigned to the aigentMe role). So even
 * once WP-A/P0 Item 1 correctly resolved Aletheon's VOICE, her provider/
 * model configuration was never consulted — the surface's own generic
 * config was used regardless of who was actually speaking.
 *
 * The fix routes on the speaker WHEN that speaker actually has a runtime
 * provider configuration (RUNTIME_AGENT_IDS), falling back to the surface's
 * own default otherwise — "capability != authority" applied to
 * infrastructure: an unconfigured speaker degrades gracefully rather than
 * silently borrowing a DIFFERENT, unrelated agent's provider config.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { normalizeAgentId } from '@/services/metame/agentLlmOrchestra';

const ROUTE = 'app/api/codex/chat/route.ts';

describe('provider routing prefers the resolved speaker over the generic surface, with a safe fallback', () => {
  it('normalizeAgentId resolves a configured speaker (e.g. Marketa) and refuses an unconfigured one (e.g. Aletheon today)', () => {
    // The primitive the routing preference is built on: proves WHY the
    // fallback triggers for Aletheon today (she is not yet registered in
    // RUNTIME_AGENT_IDS) and why it would stop triggering the moment she is
    // added — no code change needed at that point, only a data addition.
    expect(normalizeAgentId('aigent-marketa')).toBe('aigent-marketa');
    expect(normalizeAgentId('aigent-aletheon')).toBeNull();
  });

  it('the chat route computes providerRoutingAgentId preferring the speaker, falling back to the surface', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).toContain(
      'const providerRoutingAgentId = normalizeAgentId(systemPromptPersonaId)\n      ? systemPromptPersonaId\n      : resolvedAgentId;',
    );
  });

  it('buildProviderAttempts is called with providerRoutingAgentId, never the raw surface claim directly', () => {
    const code = stripComments(readSource(ROUTE));
    const idx = code.indexOf('buildProviderAttempts(\n      requestedProviderId,');
    expect(idx, 'buildProviderAttempts call site not found in expected shape').toBeGreaterThan(-1);
    const block = code.slice(idx, idx + 150);
    expect(block).toContain('providerRoutingAgentId');
    expect(block).not.toMatch(/buildProviderAttempts\(\s*requestedProviderId,\s*requestedModelId,\s*resolvedAgentId,/);
  });
});
