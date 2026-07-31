/**
 * metaMe Threshold — Constitutional Handshake session canary (Increment 2a).
 *
 * Locks the pure scope-check semantics of a scoped gateway session:
 *  - a null session grants nothing (fail-closed);
 *  - an exact capability grant matches only that capability;
 *  - a `prefix.*` wildcard grant matches capabilities under that prefix, and
 *    nothing outside it.
 *
 * The lifecycle (create/activate/resolve/revoke) is Supabase-backed and covered
 * by integration checks against a live table; this canary guards the decision
 * logic that gates every future mutating tool.
 */

import { describe, it, expect } from 'vitest';
import { hasScope, type ScopedSession } from '../services/threshold/gatewaySession';

const session = (scope: string[]): ScopedSession => ({
  id: 'sess',
  principalPublicRef: 'ppr_t2',
  agentAlias: 'agent_t2',
  agreementId: 'agr',
  scope,
  initiatingService: 'irl',
  expiresAt: null,
  serviceAgreements: {},
});

describe('hasScope', () => {
  it('fails closed for a null session', () => {
    expect(hasScope(null, 'research.read')).toBe(false);
  });

  it('matches an exact capability grant', () => {
    const s = session(['research.read', 'qubetalk.send']);
    expect(hasScope(s, 'research.read')).toBe(true);
    expect(hasScope(s, 'qubetalk.send')).toBe(true);
    expect(hasScope(s, 'research.submit')).toBe(false);
  });

  it('honours a prefix wildcard grant but stays inside the prefix', () => {
    const s = session(['research.*']);
    expect(hasScope(s, 'research.read')).toBe(true);
    expect(hasScope(s, 'research.submit')).toBe(true);
    expect(hasScope(s, 'qubetalk.send')).toBe(false);
  });

  it('an empty scope grants nothing', () => {
    expect(hasScope(session([]), 'research.read')).toBe(false);
  });
});
