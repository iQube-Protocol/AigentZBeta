/**
 * WPA-3 finishing pass, item 1 (operator brief 2026-08-17) — "selected
 * aigentMe must speak as the selected Agent."
 *
 * Before this fix, resolveAigentMeIdentity() ONLY matched the assigned
 * Agent's display_name against the fixed ~10-entry specialist label map
 * (services/agents/specialistRouter.ts's SPECIALIST_LABELS). Any assigned
 * Agent outside that hardcoded list silently fell back to the generic
 * Agent Me identity — REGARDLESS of whether she had her own real personas[]
 * system prompt. This test proves the new, generic Tier 1 resolution (via
 * hydrateAgentExecutionContext's agentCardSlug) works independently of that
 * legacy list — using a hypothetical agent whose display name matches NO
 * specialist label, so if Tier 1 didn't exist this would still fall to
 * Default (proving Tier 1 is doing real, independent work) — while Aletheon
 * (who happens to be in both) and the no-assignment Default case are also
 * covered per the brief's explicit three scenarios.
 */

import { describe, it, expect, vi } from 'vitest';

const mockResolveConstitutionalContext = vi.fn();
const mockHydrateAgentExecutionContext = vi.fn();

vi.mock('@/services/identity/constitutionalContext', () => ({
  resolveConstitutionalContext: (...args: unknown[]) => mockResolveConstitutionalContext(...args),
}));

vi.mock('@/services/agents/hydrateAgentExecutionContext', () => ({
  hydrateAgentExecutionContext: (...args: unknown[]) => mockHydrateAgentExecutionContext(...args),
}));

const fakeRequest = {} as import('next/server').NextRequest;

function ctxWith(overrides: {
  currentAigentMe?: string | null;
  boundAgents?: Array<{ agentId: string; displayName: string }>;
}) {
  return {
    citizen: { personId: null },
    passport: { passportId: null, grade: null },
    standing: { overall: null, maxTrustBand: null },
    persona: { personaId: 'persona-1', displayLabel: 'Mansa Meta' },
    boundAgents: (overrides.boundAgents ?? []).map((a) => ({
      agentId: a.agentId,
      agentDid: `did:polity:${a.agentId}`,
      displayName: a.displayName,
      agentClass: 'polity_bound',
      passportBound: true,
      relationship: 'binding' as const,
    })),
    assignedAgents: [],
    currentAigentMe: overrides.currentAigentMe ?? null,
    workspace: null,
    session: { sessionId: null },
  };
}

describe('resolveAigentMeIdentity — generic speaker resolution (WPA-3)', () => {
  it('no assignment -> Default aigentMe identity, unchanged', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith({ currentAigentMe: null }));
    const { resolveAigentMeIdentity, DEFAULT_AIGENT_ME_IDENTITY } = await import('@/services/agents/aigentMeRoleResolution');
    const identity = await resolveAigentMeIdentity(fakeRequest);
    expect(identity).toEqual(DEFAULT_AIGENT_ME_IDENTITY);
    expect(mockHydrateAgentExecutionContext).not.toHaveBeenCalled();
  });

  it('Aletheon assigned as aigentMe -> resolves to her own persona (Tier 1, via agentCardSlug)', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(
      ctxWith({ currentAigentMe: 'root-aletheon', boundAgents: [{ agentId: 'root-aletheon', displayName: 'Aletheon' }] }),
    );
    mockHydrateAgentExecutionContext.mockResolvedValueOnce({
      agentRootId: 'root-aletheon',
      agentId: 'polity-bound:aletheon',
      agentCardSlug: 'aletheon',
      displayName: 'Aletheon',
    });
    const { resolveAigentMeIdentity } = await import('@/services/agents/aigentMeRoleResolution');
    const identity = await resolveAigentMeIdentity(fakeRequest);
    expect(identity.personaKey).toBe('aigent-aletheon');
    expect(identity.displayLabel).toBe('Aletheon');
    expect(identity.agentRootId).toBe('root-aletheon');
  });

  it('a hypothetical delegate NOT in the specialist label list still speaks with her own personas[] entry (proves Tier 1 is independent of the legacy specialist map)', async () => {
    // Display name deliberately matches NO SPECIALIST_LABELS entry — if Tier
    // 1 (agentCardSlug-based) didn't exist, this would fall straight to
    // Default even though a real personas[] entry exists for her slug.
    mockResolveConstitutionalContext.mockResolvedValueOnce(
      ctxWith({ currentAigentMe: 'root-newdelegate', boundAgents: [{ agentId: 'root-newdelegate', displayName: 'A Totally New Delegate' }] }),
    );
    mockHydrateAgentExecutionContext.mockResolvedValueOnce({
      agentRootId: 'root-newdelegate',
      agentId: 'polity-bound:newdelegate',
      agentCardSlug: 'marketa', // maps to the REAL personas['aigent-marketa'] entry
      displayName: 'A Totally New Delegate',
    });
    const { resolveAigentMeIdentity } = await import('@/services/agents/aigentMeRoleResolution');
    const identity = await resolveAigentMeIdentity(fakeRequest);
    expect(identity.personaKey).toBe('aigent-marketa');
    expect(identity.displayLabel).toBe('A Totally New Delegate');
  });

  it('an assignment with no resolvable agentCardSlug AND no specialist match fails open to Default (never throws, never fabricates)', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(
      ctxWith({ currentAigentMe: 'root-unknown', boundAgents: [{ agentId: 'root-unknown', displayName: 'Totally Unregistered Agent' }] }),
    );
    mockHydrateAgentExecutionContext.mockResolvedValueOnce({
      agentRootId: 'root-unknown',
      agentId: 'polity-bound:unknown',
      agentCardSlug: null,
      displayName: 'Totally Unregistered Agent',
    });
    const { resolveAigentMeIdentity, DEFAULT_AIGENT_ME_IDENTITY } = await import('@/services/agents/aigentMeRoleResolution');
    const identity = await resolveAigentMeIdentity(fakeRequest);
    expect(identity).toEqual(DEFAULT_AIGENT_ME_IDENTITY);
  });

  it('changing the assigned Agent changes the resolved speaker across successive calls', async () => {
    const { resolveAigentMeIdentity } = await import('@/services/agents/aigentMeRoleResolution');

    mockResolveConstitutionalContext.mockResolvedValueOnce(
      ctxWith({ currentAigentMe: 'root-aletheon', boundAgents: [{ agentId: 'root-aletheon', displayName: 'Aletheon' }] }),
    );
    mockHydrateAgentExecutionContext.mockResolvedValueOnce({
      agentRootId: 'root-aletheon',
      agentId: 'polity-bound:aletheon',
      agentCardSlug: 'aletheon',
      displayName: 'Aletheon',
    });
    const first = await resolveAigentMeIdentity(fakeRequest);
    expect(first.personaKey).toBe('aigent-aletheon');

    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith({ currentAigentMe: null }));
    const second = await resolveAigentMeIdentity(fakeRequest);
    expect(second.personaKey).toBe('aigent-me');
  });
});

describe('End-to-end: resolved speaker identity survives alongside the aigentMe surface context', () => {
  it('Aletheon-as-aigentMe: her own system prompt is used AND the aigentMe surface blocks remain (surfaceRoleId separation, P0 Item 1, untouched by WPA-3)', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(
      ctxWith({ currentAigentMe: 'root-aletheon', boundAgents: [{ agentId: 'root-aletheon', displayName: 'Aletheon' }] }),
    );
    mockHydrateAgentExecutionContext.mockResolvedValueOnce({
      agentRootId: 'root-aletheon',
      agentId: 'polity-bound:aletheon',
      agentCardSlug: 'aletheon',
      displayName: 'Aletheon',
    });

    const { resolveAigentMeIdentity } = await import('@/services/agents/aigentMeRoleResolution');
    const identity = await resolveAigentMeIdentity(fakeRequest);

    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
    const { buildSystemPrompt } = await import('@/app/api/codex/chat/route');

    const metadata = { characters: [], episodes: [], stats: { characterCount: 0, episodeCount: 0, coverCount: 0, masterCount: 0 } };
    const userContext = {
      domain: 'protocol',
      roles: ['fan'],
      primaryRole: 'fan',
      metameContext: { experienceName: 'WPA-3 Verification' },
    } as any;

    const result = buildSystemPrompt(
      metadata as any,
      identity.personaKey,
      userContext,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      'aigent-me', // surfaceRoleId — the surface never changes
    );

    // Her own voice (from personas['aigent-aletheon'], resolved generically —
    // not via a hardcoded Aletheon branch anywhere in this test's SUBJECT code).
    expect(result).toContain("You are Aletheon — the First Citizen's Constitutional Companion Intelligence");
    // The aigentMe surface context is still present.
    expect(result).toContain('WPA-3 Verification');
  });
});
