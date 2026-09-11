/**
 * `ctp.exchange.artifact.confirm` — the FIRST migrated OCSGA primitive
 * (2026-08-31, "CTP foundation", delivery amendment §3.2). Pins that this
 * primitive REUSES the existing reciprocalExchange.ts resolvers/
 * implementation rather than re-deriving authorization from scratch
 * (CTP-001A §3, "bind, don't rewrite"), and that the participant/state/
 * consequence mapping onto the CTP contract is faithful to what
 * `confirmOperatorAssistedArtifact` itself already enforces.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveExchangeActingPrincipal = vi.fn();
const mockLoadExchange = vi.fn();
const mockResolveMembership = vi.fn();
const mockCurrentArtifact = vi.fn();
const mockConfirmOperatorAssistedArtifact = vi.fn();

vi.mock('@/services/research/reciprocalExchange', () => ({
  resolveExchangeActingPrincipal: (...args: unknown[]) => mockResolveExchangeActingPrincipal(...args),
  loadExchange: (...args: unknown[]) => mockLoadExchange(...args),
  resolveMembership: (...args: unknown[]) => mockResolveMembership(...args),
  currentArtifact: (...args: unknown[]) => mockCurrentArtifact(...args),
  confirmOperatorAssistedArtifact: (...args: unknown[]) => mockConfirmOperatorAssistedArtifact(...args),
}));

import { exchangeArtifactConfirmPrimitive as primitive } from '@/services/ctp/primitives/exchangeArtifactConfirm';

const admin = {} as never;
const ctx = { channel: 'web' as const, channelSessionRef: null, callerPersonaId: 'caller-1', callerAuthProfileId: null };

beforeEach(() => {
  mockResolveExchangeActingPrincipal.mockReset();
  mockLoadExchange.mockReset();
  mockResolveMembership.mockReset();
  mockCurrentArtifact.mockReset();
  mockConfirmOperatorAssistedArtifact.mockReset();
});

describe('exchangeArtifactConfirmPrimitive — the registered contract', () => {
  it('is delegable, matching confirmOperatorAssistedArtifact\'s existing (unmodified) behaviour', () => {
    expect(primitive.delegability).toBe(true);
    expect(primitive.actorRequirement).toContain('AUTHORIZED_DELEGATE');
  });

  it('permits exactly web and mcp — the two channels that actually invoke this act today', () => {
    expect(primitive.permittedChannels.sort()).toEqual(['mcp', 'web']);
  });

  it('binds services/research/reciprocalExchange.ts#confirmOperatorAssistedArtifact — never a reimplementation', () => {
    expect(primitive.implementationRef).toBe('services/research/reciprocalExchange.ts#confirmOperatorAssistedArtifact');
  });
});

describe('resolveParticipants — reuses resolveExchangeActingPrincipal, never a second resolver', () => {
  it('a non-party caller is refused NOT_A_PARTY', async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: false, error: 'not-a-party' });
    const result = await primitive.resolveParticipants(admin, ctx, { exchangeId: 'ex-1' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reasonCode).toBe('NOT_A_PARTY');
  });

  it('a resolved principal-type party maps to actorKind "principal", subject === principal === the resolved persona', async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: true, personaId: 'bound-party-1', actorType: 'principal' });
    const result = await primitive.resolveParticipants(admin, ctx, { exchangeId: 'ex-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.participants).toEqual({
      subjectPersonaId: 'bound-party-1',
      principalPersonaId: 'bound-party-1',
      actorPersonaId: ctx.callerPersonaId,
      actorKind: 'principal',
      delegateGrantRef: null,
    });
  });

  it('a resolved delegated_agent-type party maps to actorKind "delegate"', async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: true, personaId: 'bound-party-1', actorType: 'delegated_agent' });
    const result = await primitive.resolveParticipants(admin, ctx, { exchangeId: 'ex-1' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.participants.actorKind).toBe('delegate');
  });
});

describe('resolveAuthority — VALID on exchange_party_membership, the same basis the charter\'s own example names', () => {
  it('returns VALID with the named basis', async () => {
    const result = await primitive.resolveAuthority(admin, {
      subjectPersonaId: 'p', principalPersonaId: 'p', actorPersonaId: 'p', actorKind: 'principal', delegateGrantRef: null,
    }, { exchangeId: 'ex-1' });
    expect(result).toEqual({ result: 'VALID', basis: ['exchange_party_membership'] });
  });
});

describe('readPriorState — reuses currentArtifact, the SAME per-party read every sibling function uses', () => {
  it('reports exists:false when the caller resolves to no party on this exchange', async () => {
    mockLoadExchange.mockResolvedValue({ ok: true, exchange: { id: 'ex-1' } });
    mockResolveMembership.mockReturnValue(null);
    const state = await primitive.readPriorState(admin, {
      subjectPersonaId: 'p', principalPersonaId: 'p', actorPersonaId: 'p', actorKind: 'principal', delegateGrantRef: null,
    }, { exchangeId: 'ex-1' });
    expect(state).toEqual({ exists: false, pendingPrincipalAttestation: null, artifactId: null, version: null });
    expect(mockCurrentArtifact).not.toHaveBeenCalled();
  });

  it('reports the artifact\'s real pendingPrincipalAttestation/version when one exists', async () => {
    mockLoadExchange.mockResolvedValue({ ok: true, exchange: { id: 'ex-1' } });
    mockResolveMembership.mockReturnValue('B');
    mockCurrentArtifact.mockResolvedValue({ id: 'art-1', version: 2, pendingPrincipalAttestation: true });
    const state = await primitive.readPriorState(admin, {
      subjectPersonaId: 'p', principalPersonaId: 'p', actorPersonaId: 'p', actorKind: 'principal', delegateGrantRef: null,
    }, { exchangeId: 'ex-1' });
    expect(state).toEqual({ exists: true, pendingPrincipalAttestation: true, artifactId: 'art-1', version: 2 });
  });
});

describe('projectConsequence — pure, no I/O', () => {
  it('projects the pendingPrincipalAttestation-clears effect when a confirmable artifact exists', () => {
    const projection = primitive.projectConsequence({ exists: true, pendingPrincipalAttestation: true, artifactId: 'a', version: 1 }, { exchangeId: 'ex-1' });
    expect(projection.effects).toContain('pendingPrincipalAttestation becomes false');
  });

  it('projects an idempotent no-op when already confirmed', () => {
    const projection = primitive.projectConsequence({ exists: true, pendingPrincipalAttestation: false, artifactId: 'a', version: 1 }, { exchangeId: 'ex-1' });
    expect(projection.effects).toEqual(['idempotent no-op — already confirmed']);
  });
});

describe('authorize — refuses only on NO_ARTIFACT_ON_RECORD, otherwise authorizes (the real gate is inside confirmOperatorAssistedArtifact)', () => {
  it('refuses when no artifact is on record', () => {
    const result = primitive.authorize(
      { subjectPersonaId: 'p', principalPersonaId: 'p', actorPersonaId: 'p', actorKind: 'principal', delegateGrantRef: null },
      { result: 'VALID', basis: [] },
      { exists: false, pendingPrincipalAttestation: null, artifactId: null, version: null },
      { effects: [] },
      { exchangeId: 'ex-1' },
    );
    expect(result).toEqual({ result: 'REFUSED', reasonCode: 'NO_ARTIFACT_ON_RECORD', reason: 'No artifact is on record for this party.' });
  });

  it('authorizes when an artifact exists, regardless of pending state — the idempotent no-op is authorized, not refused', () => {
    const result = primitive.authorize(
      { subjectPersonaId: 'p', principalPersonaId: 'p', actorPersonaId: 'p', actorKind: 'principal', delegateGrantRef: null },
      { result: 'VALID', basis: [] },
      { exists: true, pendingPrincipalAttestation: false, artifactId: 'a', version: 1 },
      { effects: [] },
      { exchangeId: 'ex-1' },
    );
    expect(result).toEqual({ result: 'AUTHORIZED' });
  });
});

describe('execute — calls the UNMODIFIED confirmOperatorAssistedArtifact, threading exchangeId/personaId/agentRef', () => {
  it('passes the resolved subjectPersonaId (not principal/actor) and the input agentRef through verbatim', async () => {
    mockConfirmOperatorAssistedArtifact.mockResolvedValue({ ok: true, artifact: { id: 'art-1', pendingPrincipalAttestation: false, version: 1, contentHash: 'h' } });
    const result = await primitive.execute(admin, {
      subjectPersonaId: 'bound-party-1', principalPersonaId: 'bound-party-1', actorPersonaId: 'caller-1', actorKind: 'delegate', delegateGrantRef: null,
    }, { exchangeId: 'ex-1', agentRef: 'agent-alias-1' });
    expect(mockConfirmOperatorAssistedArtifact).toHaveBeenCalledWith(admin, {
      exchangeId: 'ex-1', personaId: 'bound-party-1', agentRef: 'agent-alias-1',
    });
    expect(result).toEqual({ ok: true, result: { id: 'art-1', pendingPrincipalAttestation: false, version: 1, contentHash: 'h' } });
  });

  it('surfaces the implementation\'s own refusal verbatim, never swallowed or reworded', async () => {
    mockConfirmOperatorAssistedArtifact.mockResolvedValue({ ok: false, error: 'no artifact on record for this party' });
    const result = await primitive.execute(admin, {
      subjectPersonaId: 'p', principalPersonaId: 'p', actorPersonaId: 'p', actorKind: 'principal', delegateGrantRef: null,
    }, { exchangeId: 'ex-1' });
    expect(result).toEqual({ ok: false, error: 'no artifact on record for this party' });
  });
});

describe('resultingStateFrom / realizeConsequence — derived from the implementation\'s own result, never re-read', () => {
  const artifact = { id: 'art-1', pendingPrincipalAttestation: false, version: 3, contentHash: 'abc123' } as never;

  it('resultingStateFrom reports the artifact\'s real post-confirm shape', () => {
    expect(primitive.resultingStateFrom(artifact)).toEqual({
      exists: true, pendingPrincipalAttestation: false, artifactId: 'art-1', version: 3,
    });
  });

  it('realizeConsequence names the hash-unchanged guarantee', () => {
    expect(primitive.realizeConsequence?.(artifact)).toEqual({
      artifactId: 'art-1', contentHash: 'abc123', contentHashUnchanged: true,
    });
  });
});
