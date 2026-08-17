/**
 * WP-C2 — delegation authority gate at the connector execution seam
 * (Homecoming Closeout, operator brief 2026-08-17).
 *
 * "aigentMe = role/surface. Aletheon is the acting Agent. Mansa Meta is the
 * principal. The delegation grant is the authority." This proves the gate
 * enforces exactly that, generically (no Aletheon-specific branching in the
 * code under test — the fixtures below use a hypothetical agent for most
 * cases and Aletheon only where the brief explicitly names her).
 */

import { describe, it, expect, vi } from 'vitest';

const mockResolveConstitutionalContext = vi.fn();
const mockReadActiveGrant = vi.fn();
const mockIncrementActionsTaken = vi.fn(async () => undefined);

vi.mock('@/services/identity/constitutionalContext', () => ({
  resolveConstitutionalContext: (...args: unknown[]) => mockResolveConstitutionalContext(...args),
}));

vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrant: (...args: unknown[]) => mockReadActiveGrant(...args),
  incrementActionsTaken: (...args: unknown[]) => mockIncrementActionsTaken(...args),
}));

const { checkDelegationAuthority } = await import('@/services/delegation/delegationAuthorityGate');

const fakeRequest = {} as import('next/server').NextRequest;
const PERSONA_ID = 'persona-1';
const AGENT_ROOT_ID = 'root-agent-x';
const AGENT_DID = 'did:polity:agent-x';

function ctxWith(currentAigentMe: string | null, displayName = 'Agent X') {
  return {
    persona: { personaId: PERSONA_ID, displayLabel: 'Mansa Meta' },
    boundAgents: currentAigentMe
      ? [{ agentId: AGENT_ROOT_ID, agentDid: AGENT_DID, displayName, agentClass: 'polity_bound', passportBound: true, relationship: 'binding' as const }]
      : [],
    currentAigentMe,
  };
}

function grant(overrides: Partial<{
  grant_id: string; agent_root_did: string; allowed_actions: string[]; allowed_surfaces: string[];
  max_actions: number; actions_taken: number;
}> = {}) {
  return {
    grant_id: 'grant-1',
    agent_root_did: AGENT_DID,
    allowed_actions: ['draft_email', 'send_email'],
    allowed_surfaces: ['metame'],
    max_actions: 20,
    actions_taken: 0,
    ...overrides,
  };
}

describe('checkDelegationAuthority — the generic delegation-authority gate', () => {
  it('no Agent assigned (Default aigentMe) -> not delegated, always allowed, never inherits any grant', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(null));
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.send', surface: 'metame', requiresApproval: true,
    });
    expect(result).toEqual({ delegated: false, allowed: true });
    expect(mockReadActiveGrant).not.toHaveBeenCalled();
  });

  it('read-only/non-consequential connectors are always ungated, even with an Agent assigned', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID));
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.drive.search', surface: 'metame', requiresApproval: false,
    });
    expect(result).toEqual({ delegated: false, allowed: true });
    expect(mockReadActiveGrant).not.toHaveBeenCalled();
  });

  it('Agent assigned, no active grant -> refused', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID));
    mockReadActiveGrant.mockResolvedValueOnce(null);
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.send', surface: 'metame', requiresApproval: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('no-active-grant');
  });

  it('active grant belongs to a DIFFERENT agent than currently assigned -> refused', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID));
    mockReadActiveGrant.mockResolvedValueOnce(grant({ agent_root_did: 'did:polity:someone-else' }));
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.send', surface: 'metame', requiresApproval: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('grant-agent-mismatch');
  });

  it('action absent from allowed_actions -> refused (proves refusal when action is absent from grant)', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID));
    mockReadActiveGrant.mockResolvedValueOnce(grant({ allowed_actions: ['draft_email'] }));
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.send', surface: 'metame', requiresApproval: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('action-not-granted');
  });

  it('surface absent from allowed_surfaces -> refused', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID));
    mockReadActiveGrant.mockResolvedValueOnce(grant({ allowed_surfaces: ['some-other-surface'] }));
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.send', surface: 'metame', requiresApproval: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('surface-not-granted');
  });

  it('action budget exhausted -> refused', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID));
    mockReadActiveGrant.mockResolvedValueOnce(grant({ max_actions: 5, actions_taken: 5 }));
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.send', surface: 'metame', requiresApproval: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('action-budget-exhausted');
  });

  it('Aletheon: everything covered -> allowed, with correct attribution fields', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID, 'Aletheon'));
    mockReadActiveGrant.mockResolvedValueOnce(grant());
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.send', surface: 'metame', requiresApproval: true,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed && result.delegated) {
      expect(result.attribution).toEqual({
        principalPersonaId: PERSONA_ID,
        actingAgentRootId: AGENT_ROOT_ID,
        actingAgentDid: AGENT_DID,
        actingAgentDisplayName: 'Aletheon',
        actingRole: 'aigentMe',
        delegationGrantId: 'grant-1',
        delegatedAction: 'send_email',
        executionSurface: 'metame',
        executionMode: 'approved',
        connectorId: 'google.gmail.send',
      });
    }
  });

  it('a drafting (no-approval) connector is labeled executionMode: autonomous', async () => {
    mockResolveConstitutionalContext.mockResolvedValueOnce(ctxWith(AGENT_ROOT_ID, 'Aletheon'));
    mockReadActiveGrant.mockResolvedValueOnce(grant());
    const result = await checkDelegationAuthority({
      request: fakeRequest, connectorId: 'google.gmail.draft', surface: 'metame', requiresApproval: false,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed && result.delegated) {
      expect(result.attribution.executionMode).toBe('autonomous');
      expect(result.attribution.delegatedAction).toBe('draft_email');
    }
  });
});
