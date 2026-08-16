/**
 * Homecoming Phase II WP-A Increment 2 — the aigentMe-role runtime
 * resolution (codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md,
 * WP-A Amendment three-axis model).
 *
 * "aigentMe" is a ROLE. WHO fulfils it is resolved server-side from the
 * persona's existing `currentAigentMe` assignment
 * (services/identity/constitutionalContext.ts) — never from a client-supplied
 * identity. Selecting an agent for the role changes routing only; it never
 * creates, modifies, or implies a delegation grant.
 *
 * Behavioural tests mock resolveConstitutionalContext directly — the exact
 * seam resolveAigentMeIdentity() composes — so these prove the resolution
 * LOGIC, not Supabase plumbing already covered elsewhere.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const mockResolveConstitutionalContext = vi.fn();

vi.mock('@/services/identity/constitutionalContext', () => ({
  resolveConstitutionalContext: (...args: unknown[]) => mockResolveConstitutionalContext(...args),
}));

// A minimal NextRequest stand-in — resolveAigentMeIdentity only forwards it
// to the mocked resolver, never reads it directly.
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

describe('WP-A Increment 2 — resolveAigentMeIdentity', () => {
  beforeEach(() => {
    mockResolveConstitutionalContext.mockReset();
  });

  it('no assignment -> Default aigentMe identity, unchanged from today', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(ctxWith({ currentAigentMe: null }));
    const { resolveAigentMeIdentity, DEFAULT_AIGENT_ME_IDENTITY } = await import(
      '@/services/agents/aigentMeRoleResolution'
    );
    const result = await resolveAigentMeIdentity(fakeRequest);
    expect(result).toEqual(DEFAULT_AIGENT_ME_IDENTITY);
    expect(result.personaKey).toBe('aigent-me');
    expect(result.specialistId).toBeNull();
  });

  it('Aletheon assigned as aigentMe -> resolves to the aletheon specialist identity', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(
      ctxWith({
        currentAigentMe: 'agent-root-aletheon',
        boundAgents: [{ agentId: 'agent-root-aletheon', displayName: 'Aletheon' }],
      }),
    );
    const { resolveAigentMeIdentity } = await import('@/services/agents/aigentMeRoleResolution');
    const result = await resolveAigentMeIdentity(fakeRequest);
    expect(result.specialistId).toBe('aletheon');
    expect(result.personaKey).toBe('aigent-aletheon');
    expect(result.agentRootId).toBe('agent-root-aletheon');
  });

  it('changing the assignment changes the resolved routing (two calls, two identities)', async () => {
    const { resolveAigentMeIdentity } = await import('@/services/agents/aigentMeRoleResolution');

    mockResolveConstitutionalContext.mockResolvedValueOnce(
      ctxWith({
        currentAigentMe: 'agent-root-aletheon',
        boundAgents: [{ agentId: 'agent-root-aletheon', displayName: 'Aletheon' }],
      }),
    );
    const first = await resolveAigentMeIdentity(fakeRequest);
    expect(first.specialistId).toBe('aletheon');

    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith({ currentAigentMe: null }));
    const second = await resolveAigentMeIdentity(fakeRequest);
    expect(second.specialistId).toBeNull();
    expect(second.personaKey).toBe('aigent-me');
  });

  it('an assignment whose display name maps to no wired specialist fails open to Default (never throws, never fabricates a persona)', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(
      ctxWith({
        currentAigentMe: 'agent-root-unknown',
        boundAgents: [{ agentId: 'agent-root-unknown', displayName: 'Some Unwired Delegate' }],
      }),
    );
    const { resolveAigentMeIdentity, DEFAULT_AIGENT_ME_IDENTITY } = await import(
      '@/services/agents/aigentMeRoleResolution'
    );
    const result = await resolveAigentMeIdentity(fakeRequest);
    expect(result).toEqual(DEFAULT_AIGENT_ME_IDENTITY);
  });

  it('resolution failure fails open to Default rather than throwing (voice choice, not a security gate)', async () => {
    mockResolveConstitutionalContext.mockRejectedValue(new Error('supabase unreachable'));
    const { resolveAigentMeIdentity, DEFAULT_AIGENT_ME_IDENTITY } = await import(
      '@/services/agents/aigentMeRoleResolution'
    );
    await expect(resolveAigentMeIdentity(fakeRequest)).resolves.toEqual(DEFAULT_AIGENT_ME_IDENTITY);
  });
});

describe('WP-A Increment 2 — assignment grants no authority (structural regression pin)', () => {
  it('aigentMeRoleResolution.ts never reads or writes delegation_grants — it only reads currentAigentMe/boundAgents', () => {
    const src = stripComments(readSource('services/agents/aigentMeRoleResolution.ts'));
    expect(src).not.toMatch(/delegation_grants|delegationGrantStore|evaluateAccess/);
  });

  it('AigentMeRoleSelector.tsx only ever calls persona-assignments (role assignment), never a grants/delegation endpoint', () => {
    const src = stripComments(readSource('components/smarttriad/copilot/AigentMeRoleSelector.tsx'));
    expect(src).toContain('/api/identity/persona-assignments');
    expect(src).not.toMatch(/delegation-grant|\/api\/identity\/delegat/);
    // Every write sets role to 'aigentMe' or 'delegate' — never anything
    // that could be mistaken for an authority scope.
    const roleValues = [...src.matchAll(/role:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(roleValues.length).toBeGreaterThan(0);
    for (const r of roleValues) expect(['aigentMe', 'delegate']).toContain(r);
  });
});

describe('WP-A Increment 2 — chat route: role gating unchanged, identity resolution added correctly', () => {
  const src = stripComments(readSource('app/api/codex/chat/route.ts'));

  it('resolvedAgentId is still computed from the raw client aigentId/persona fields (the ROLE claim — unchanged)', () => {
    expect(src).toContain("normalizeAgentId(aigentId)) ||\n      defaultAgentIdForPersona(persona)");
  });

  it('systemPromptPersonaId is resolved server-side ONLY when the role is aigent-me, and buildSystemPrompt is called with it', () => {
    const idx = src.indexOf("resolvedAgentId === 'aigent-me'");
    expect(idx, 'the aigent-me role gate for identity resolution was not found').toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('resolveAigentMeIdentity(request)');
    expect(src).toContain('buildSystemPrompt(metadata, systemPromptPersonaId,');
    // Regression pin: the raw client-controlled `persona`/`aigentId` fields
    // must NEVER be passed directly into buildSystemPrompt again — that was
    // the client-trusted-identity defect this increment fixes.
    expect(src).not.toContain('buildSystemPrompt(metadata, persona,');
    expect(src).not.toContain('buildSystemPrompt(metadata, aigentId,');
  });

  it('every existing resolvedAgentId/resolvedPersonaId === "aigent-me" role gate is untouched (feature gating stays keyed on the ROLE, not the resolved voice)', () => {
    // These are the exact gates the WP-A Amendment's audit named as
    // default-aigentMe PRODUCT features that must keep firing regardless of
    // which agent speaks — confirms Increment 2 did not collapse them.
    expect(src).toContain("resolvedPersonaId === 'aigent-me' && userContext?.metameContext");
    expect(src).toMatch(/isAigentMe\s*=\s*resolvedAgentId === 'aigent-me'/);
  });
});

describe('WP-A Increment 2 — specialist consultation remains independently available (no regression)', () => {
  it('Increment 1s specialist wiring is untouched — aletheon still resolvable through ask-agent independent of the aigentMe role', () => {
    const routerSrc = stripComments(readSource('services/agents/specialistRouter.ts'));
    const askAgentSrc = stripComments(readSource('app/api/assistant/ask-agent/route.ts'));
    expect(routerSrc).toMatch(/SPECIALIST_LABELS[\s\S]{0,400}aletheon:\s*'Aletheon'/);
    const idx = askAgentSrc.indexOf('const VALID_SPECIALISTS');
    expect(askAgentSrc.slice(idx, askAgentSrc.indexOf(';', idx))).toContain("'aletheon'");
  });
});
