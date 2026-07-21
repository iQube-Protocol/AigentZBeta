/**
 * QubeTalk peer channel — pins the pure, security-relevant helpers:
 *  - a counterparty ref must be a Polity Public Reference, NEVER a persona UUID;
 *  - the pair key is order-independent so (a,b) and (b,a) are one channel.
 */
import { describe, it, expect } from 'vitest';
import {
  isPublicRefLike,
  peerPairKey,
  peerCommitment,
  QUBETALK_HUMAN_MESSAGE_TYPES,
  normalizeRights,
  DEFAULT_RIGHTS,
} from '@/services/qubetalk/peerChannel';
import { personaPublicRef } from '@/services/identity/personaReferences';

describe('QubeTalk peer channel helpers', () => {
  it('accepts a Polity Public Reference (16 hex) but REJECTS a persona UUID', () => {
    const ref = personaPublicRef('11111111-2222-3333-4444-555555555555');
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    expect(isPublicRefLike(ref)).toBe(true);
    // A raw UUID must never be accepted as a channel counterparty ref (T0 leak guard).
    expect(isPublicRefLike('11111111-2222-3333-4444-555555555555')).toBe(false);
    expect(isPublicRefLike('')).toBe(false);
    expect(isPublicRefLike('not-a-ref')).toBe(false);
    // Forward-compat pairwise form.
    expect(isPublicRefLike('prf_0123456789abcdef')).toBe(true);
  });

  it('pair key is order-independent — (a,b) and (b,a) collapse to one channel', () => {
    const a = personaPublicRef('aaaaaaaa-0000-0000-0000-000000000001');
    const b = personaPublicRef('bbbbbbbb-0000-0000-0000-000000000002');
    expect(peerPairKey(a, b)).toBe(peerPairKey(b, a));
    expect(peerPairKey(a, b)).toContain(':');
  });

  it('Phase 1 admits only human message types', () => {
    expect([...QUBETALK_HUMAN_MESSAGE_TYPES]).toEqual([
      'message',
      'question',
      'response',
      'acknowledgement',
      'introduction',
    ]);
    // Content/workflow/agent types are NOT in the Phase-1 human set.
    expect(QUBETALK_HUMAN_MESSAGE_TYPES.includes('artifact_share' as never)).toBe(false);
    expect(QUBETALK_HUMAN_MESSAGE_TYPES.includes('review_request' as never)).toBe(false);
  });

  it('rights envelope defaults are conservative — view only, everything else off', () => {
    expect(DEFAULT_RIGHTS.view).toBe(true);
    expect(DEFAULT_RIGHTS.copyToLocker).toBe(false);
    expect(DEFAULT_RIGHTS.reshare).toBe(false);
    expect(DEFAULT_RIGHTS.agentInference).toBe(false);
    // An empty/absent rights object normalises to the conservative default.
    expect(normalizeRights(undefined)).toEqual(DEFAULT_RIGHTS);
    expect(normalizeRights({})).toEqual(DEFAULT_RIGHTS);
  });

  it('normalizeRights coerces untrusted input, only honouring explicit booleans', () => {
    const r = normalizeRights({ view: true, agentInference: true, reshare: 'yes', copyToLocker: 1 });
    expect(r.agentInference).toBe(true); // explicit boolean honoured
    expect(r.reshare).toBe(false); // non-boolean ignored -> conservative default
    expect(r.copyToLocker).toBe(false); // non-boolean ignored
    expect(r.download).toBe(false);
  });

  it('peerCommitment is a T2-safe 16-hex commitment — deterministic, one-way, never the raw id', () => {
    const channelId = 'c1a2b3c4-d5e6-7788-99aa-bbccddeeff00';
    const c = peerCommitment('channel', channelId);
    // 16 lowercase hex — the same shape as a Polity Public Reference (T2-safe).
    expect(c).toMatch(/^[0-9a-f]{16}$/);
    // Deterministic (idempotent receipts correlate to the same commitment).
    expect(peerCommitment('channel', channelId)).toBe(c);
    // Namespaced — a channel and an artifact with the same id never collide.
    expect(peerCommitment('artifact', channelId)).not.toBe(c);
    // The raw UUID must NEVER appear in the commitment (chain-bound payload guard).
    expect(c).not.toContain(channelId);
    expect(c.includes('-')).toBe(false);
  });

  it('copy-to-locker is default-denied — copyToLocker must be EXPLICITLY granted', () => {
    // The recipient-pull copy-to-locker path (2b) gates on rights.copyToLocker.
    // An artifact shared with no rights, or with a non-boolean copyToLocker,
    // normalises to copyToLocker=false — so the gate denies by default.
    expect(normalizeRights(undefined).copyToLocker).toBe(false);
    expect(normalizeRights({ copyToLocker: 'true' }).copyToLocker).toBe(false);
    expect(normalizeRights({ view: true }).copyToLocker).toBe(false);
    // Only an explicit boolean true opens the gate.
    expect(normalizeRights({ copyToLocker: true }).copyToLocker).toBe(true);
  });
});
