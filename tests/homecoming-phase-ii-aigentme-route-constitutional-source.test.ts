/**
 * /api/agents/aigentme — P1 Item 3 (operator brief 2026-08-16, "make
 * resolveConstitutionalContext() the sole source of currentAigentMe").
 *
 * This route both READS (GET, POST idempotency, PATCH existence checks) and
 * WRITES (POST creation, PATCH promotion) the legacy is_aigent_me column.
 * The WRITE side is untouched — it is the actual persistence mechanism
 * resolveConstitutionalContext()'s own internal fallback depends on. Only
 * the READ side is retired: GET/POST/PATCH must determine "does this person
 * already have an aigentMe, and which one" via
 * resolveConstitutionalContext()'s ctx.currentAigentMe, never by
 * independently re-querying `.eq('is_aigent_me', true)`.
 *
 * The concrete defect this closes: an aigentMe established solely through a
 * persisted persona_agent_assignments row (no is_aigent_me column ever set)
 * previously read as "no aigentMe" here — POST would then create a SECOND,
 * conflicting aigentMe for a person who already had one.
 */

import { describe, it, expect, vi } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/agents/aigentme/route.ts';
const PERSONA_ID = 'persona-1';
const AUTH_PROFILE_ID = 'auth-profile-1';
const AIGENT_ME_ROOT_ID = 'agent-root-assignment-only';

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
  listOwnedPersonaRows: async () => [],
}));

vi.mock('@/services/agents/provisionAigentMePersona', () => ({
  provisionAigentMePersona: vi.fn(async () => null),
}));

// This row's OWN is_aigent_me column reads false — she was assigned via
// persona_agent_assignments alone. The route must still find her via
// ctx.currentAigentMe and never fall through to creating a duplicate.
const ASSIGNMENT_ONLY_ROW = {
  id: AIGENT_ME_ROOT_ID,
  agent_id: 'polity-bound:assignment-only',
  did_uri: 'did:agent:root:assignment-only',
  agent_class: 'polity_bound',
  display_name: 'Assignment-Only Agent',
  description: null,
  agent_card_url: null,
  agent_card_slug: 'assignment-only',
  is_aigent_me: false,
  created_at: '2026-01-01T00:00:00Z',
};

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table === 'agent_root_identity') {
        return {
          select: () => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: async () => ({ data: value === AIGENT_ME_ROOT_ID ? ASSIGNMENT_ONLY_ROW : null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

const { GET, POST } = await import('@/app/api/agents/aigentme/route');

describe('/api/agents/aigentme — currentAigentMe comes SOLELY from resolveConstitutionalContext()', () => {
  it('GET finds an aigentMe established via assignment alone (is_aigent_me column false) and projects isAigentMe: true', async () => {
    const res = await GET({} as any);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.agent).not.toBeNull();
    expect(json.agent.agentRootId).toBe(AIGENT_ME_ROOT_ID);
    // Authoritatively true via ctx, even though the raw column says false.
    expect(json.agent.isAigentMe).toBe(true);
  });

  it('POST idempotency finds the same assignment-only aigentMe and refuses to create a second one', async () => {
    const res = await POST({ json: async () => ({}) } as any);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.created).toBe(false);
    expect(json.agent.agentRootId).toBe(AIGENT_ME_ROOT_ID);
    expect(json.agent.isAigentMe).toBe(true);
  });

  it('the route source has no direct is_aigent_me READ filter left (the WRITE mechanism is untouched)', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code, 'a direct is_aigent_me existence-check filter is back').not.toMatch(/\.eq\(\s*['"]is_aigent_me['"]\s*,\s*true\s*\)/);
    // The write mechanism (the legacy designation itself) must remain.
    expect(code).toContain(".update({ is_aigent_me: true })");
    expect(code).toContain('resolveConstitutionalContext(req)');
  });
});
