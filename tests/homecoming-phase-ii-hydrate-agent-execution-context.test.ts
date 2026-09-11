/**
 * hydrateAgentExecutionContext — P0 Item 2 (operator brief 2026-08-16,
 * "hydrate the selected aigentMe as a real Agent, not merely a prompt
 * persona").
 *
 * Proves the selected Agent can answer from something specifically
 * available to that Agent (her declared Agent Card skills/description),
 * not merely speak in that Agent's voice — the exact distinction the brief
 * draws. Also proves genericity: nothing here branches on 'aletheon'
 * specifically — a second, unrelated agent id resolves through the exact
 * same code path and correctly gets NO capability/knowledge proxy (because
 * no hand-curated card exists for it), never Aletheon's by accident.
 */

import { describe, it, expect, vi } from 'vitest';

const ALETHEON_ROOT_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ROOT_ID = '22222222-2222-2222-2222-222222222222';

function fakeAdminFor(rowsByRootId: Record<string, Record<string, unknown> | null>) {
  return {
    from: (table: string) => {
      if (table !== 'agent_root_identity') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (_col: string, value: string) => ({
            maybeSingle: async () => ({ data: rowsByRootId[value] ?? null }),
          }),
        }),
      };
    },
  };
}

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () =>
    fakeAdminFor({
      [ALETHEON_ROOT_ID]: {
        id: ALETHEON_ROOT_ID,
        agent_id: 'polity-bound:aletheon',
        display_name: 'Aletheon',
        description: null,
        agent_card_slug: 'aletheon',
      },
      [OTHER_ROOT_ID]: {
        id: OTHER_ROOT_ID,
        agent_id: 'polity-bound:some-other-agent',
        display_name: 'Some Other Agent',
        description: 'A freshly genesised agent with no hand-curated card yet.',
        agent_card_slug: 'some-other-agent',
      },
    }),
}));

vi.mock('@/services/homecoming/delegateStanding', () => ({
  readDelegateStanding: async (agentId: string) =>
    agentId === 'polity-bound:aletheon' ? { overall: 12, bucket: 1, trustBandCeiling: 'L1_OBSERVED' } : null,
}));

const { hydrateAgentExecutionContext } = await import('@/services/agents/hydrateAgentExecutionContext');

describe('hydrateAgentExecutionContext — the selected Agent answers from HER OWN knowledge, not just her voice', () => {
  it('Aletheon hydrates with her own declared skills/description as the knowledge proxy', async () => {
    const ctx = await hydrateAgentExecutionContext(ALETHEON_ROOT_ID);
    expect(ctx).not.toBeNull();
    expect(ctx!.agentId).toBe('polity-bound:aletheon');
    expect(ctx!.displayName).toBe('Aletheon');

    // Her own Agent Card content — this is information specific to HER
    // Agent, not the generic persona voice from app/data/personas.ts.
    expect(ctx!.knowledge.proxy).not.toBeNull();
    expect(ctx!.knowledge.proxy!.skills.map((s) => s.id)).toContain('constitutional-reasoning');
    expect(ctx!.knowledge.proxy!.skills.map((s) => s.id)).toContain('institutional-memory');
    expect(ctx!.capabilities?.skills.length).toBeGreaterThan(0);

    // Honest about what this is NOT — never overclaimed as a real corpus.
    expect(ctx!.knowledge.hasDedicatedCorpus).toBe(false);
    expect(ctx!.memory).toBeNull();

    // Standing composed via the real delegateStanding key (agent_id, not the UUID).
    expect(ctx!.standing).toEqual({ overall: 12, bucket: 1, trustBandCeiling: 'L1_OBSERVED' });
  });

  it('an agent with no hand-curated card gets an honest absence, never Aletheon\'s data by accident (genericity proof)', async () => {
    const ctx = await hydrateAgentExecutionContext(OTHER_ROOT_ID);
    expect(ctx).not.toBeNull();
    expect(ctx!.agentId).toBe('polity-bound:some-other-agent');

    // No hand-curated card for this slug — the proxy is honestly absent,
    // not silently populated with some other agent's skills.
    expect(ctx!.knowledge.proxy).toBeNull();
    expect(ctx!.capabilities).toBeNull();
    // Falls back to her raw agent_root_identity.description (the only real
    // field available) rather than fabricating one.
    expect(ctx!.description).toBe('A freshly genesised agent with no hand-curated card yet.');
    expect(ctx!.standing).toBeNull();
  });

  it('an unresolvable agentRootId returns null rather than a fabricated context', async () => {
    const ctx = await hydrateAgentExecutionContext('does-not-exist');
    expect(ctx).toBeNull();
  });
});
