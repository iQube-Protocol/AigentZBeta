/**
 * QubeTalk peer channel — pins the pure, security-relevant helpers:
 *  - a counterparty ref must be a Polity Public Reference, NEVER a persona UUID;
 *  - the pair key is order-independent so (a,b) and (b,a) are one channel.
 */
import { describe, it, expect } from 'vitest';
import { isPublicRefLike, peerPairKey, QUBETALK_HUMAN_MESSAGE_TYPES } from '@/services/qubetalk/peerChannel';
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
});
