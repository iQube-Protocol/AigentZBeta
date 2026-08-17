/**
 * /api/persona/sponsored-agents — P1 Item 3 (operator brief 2026-08-16,
 * "make resolveConstitutionalContext() the sole source of currentAigentMe").
 *
 * Before this fix, the route independently queried
 * agent_root_identity.is_aigent_me to decide which sponsored agent is the
 * persona's aigentMe — a second resolution path that could disagree with
 * resolveConstitutionalContext() (the Wallet/Bureau/floating-copilot source
 * of truth), and that a stale/legacy row could silently overwrite.
 *
 * This test proves the route's aigentMe determination is driven SOLELY by
 * resolveConstitutionalContext()'s ctx.currentAigentMe: a fake row set
 * carries no is_aigent_me-shaped signal at all (the column isn't even
 * selected), yet the row matching ctx.currentAigentMe is correctly marked
 * isAigentMe and sorted first.
 */

import { describe, it, expect, vi } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/persona/sponsored-agents/route.ts';
const PERSONA_ID = 'persona-1';
const AUTH_PROFILE_ID = 'auth-profile-1';
const AIGENT_ME_ROOT_ID = 'agent-root-b'; // deliberately NOT first or last in row order

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: async () => ({ personaId: PERSONA_ID, authProfileId: AUTH_PROFILE_ID, fioHandle: 'citizen@polity' }),
}));

vi.mock('@/services/identity/constitutionalContext', () => ({
  resolveConstitutionalContext: async () => ({
    citizen: { personId: AUTH_PROFILE_ID },
    passport: { passportId: null, grade: null },
    persona: { personaId: PERSONA_ID, displayLabel: 'Citizen' },
    boundAgents: [],
    assignedAgents: [],
    currentAigentMe: AIGENT_ME_ROOT_ID,
  }),
}));

vi.mock('@/services/agents/provisionAigentMePersona', () => ({
  provisionAigentMePersona: vi.fn(async () => null),
}));

vi.mock('@/services/crm/crmDataAccess', () => ({
  getCrmClient: () => ({
    from: () => ({
      select: () => ({ in: async () => ({ data: [] }) }),
    }),
  }),
}));

const AGENT_ROWS = [
  { id: 'agent-root-a', agent_id: 'polity-bound:agent-a', did_uri: 'did:agent:root:a', agent_class: 'polity_bound', display_name: 'Agent A', description: null, agent_card_url: null, agent_card_slug: 'agent-a', sponsor_passport_id: null, bound_passport_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: AIGENT_ME_ROOT_ID, agent_id: 'polity-bound:agent-b', did_uri: 'did:agent:root:b', agent_class: 'polity_bound', display_name: 'Agent B (the aigentMe)', description: null, agent_card_url: null, agent_card_slug: 'agent-b', sponsor_passport_id: null, bound_passport_id: null, created_at: '2025-06-01T00:00:00Z' },
  { id: 'agent-root-c', agent_id: 'polity-bound:agent-c', did_uri: 'did:agent:root:c', agent_class: 'polity_bound', display_name: 'Agent C', description: null, agent_card_url: null, agent_card_slug: 'agent-c', sponsor_passport_id: null, bound_passport_id: null, created_at: '2026-03-01T00:00:00Z' },
];

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table === 'agent_root_identity') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: AGENT_ROWS, error: null }) }) }) };
      }
      if (table === 'polity_passport_records') {
        return { select: () => ({ in: async () => ({ data: [] }), eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
      }
      if (table === 'polity_passport_applications') {
        return { select: () => ({ in: async () => ({ data: [] }) }) };
      }
      if (table === 'personas') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

const { GET } = await import('@/app/api/persona/sponsored-agents/route');

describe('/api/persona/sponsored-agents — currentAigentMe comes SOLELY from resolveConstitutionalContext()', () => {
  it('the row matching ctx.currentAigentMe is marked isAigentMe and sorted first, with no is_aigent_me column involved', async () => {
    const res = await GET({} as any);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const agents = json.agents as Array<{ agentRootId: string; isAigentMe: boolean }>;
    expect(agents).toHaveLength(3);

    // Sorted first, despite NOT having the newest created_at (agent-root-c does).
    expect(agents[0].agentRootId).toBe(AIGENT_ME_ROOT_ID);
    expect(agents[0].isAigentMe).toBe(true);

    // Every other row — including the newest one — is correctly NOT aigentMe.
    const others = agents.filter((a) => a.agentRootId !== AIGENT_ME_ROOT_ID);
    expect(others).toHaveLength(2);
    for (const a of others) expect(a.isAigentMe).toBe(false);
  });

  it('the route source no longer queries or branches on agent_root_identity.is_aigent_me', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code, 'a direct is_aigent_me reference is back — resolveConstitutionalContext() must be the sole source').not.toMatch(/is_aigent_me/);
    expect(code).toContain('resolveConstitutionalContext(req)');
    expect(code).toContain('ctx.currentAigentMe');
  });
});
