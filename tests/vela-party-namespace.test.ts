/**
 * Vela accelerator Phase 5 — party-namespace ref derivation
 * (`services/vela/velaPartyNamespace.ts`).
 *
 * docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md
 * "Phase 5 — multi-agent isolation" requires that existing structures can
 * bind a "permitted private-state namespace" per contributor within one
 * shared Vela app, without a new IAM system.
 *
 * This file proves:
 *   1. determinism — the same (applicationId, authorityPrincipal,
 *      confidentialPrivacyIdentity) triple always derives the same ref;
 *   2. within-app isolation — two DIFFERENT contributors in the SAME
 *      applicationId derive two DIFFERENT refs (the actual property a future
 *      stateful multi-party guest needs to avoid cross-party state
 *      collision);
 *   3. cross-app non-correlation — the SAME contributor in two DIFFERENT
 *      applicationIds derives two DIFFERENT refs (no accidental correlation
 *      across separate deployments);
 *   4. fails closed — a missing applicationId or identity value throws
 *      rather than silently deriving a ref from a partial input;
 *   5. one-way / opaque — the derived ref never contains the plaintext
 *      identity values or applicationId as a substring, and reuses the
 *      repo's EXISTING `constitutionalRef` commitment helper rather than a
 *      second hashing scheme;
 *   6. no accidental collisions across a reasonable sample of distinct
 *      inputs.
 *
 * OPERATOR-MANDATED ACCEPTANCE PROPERTY (2026-09-13), tested in the
 * "cross-party disclosure gate" describe block below:
 *   "Party A must be unable to cause Party B's confidential state to be
 *   read, combined, disclosed, or emitted unless the exact transaction/
 *   disclosure scope authorizes it."
 * Both directions are covered, not only denial: an unauthorized cross-party
 * access attempt is refused (the default), AND an explicitly-scoped,
 * legitimate multi-party disclosure (both parties consented for this exact
 * actionRef) is allowed — proving this is a real scope check, not a blanket
 * lockout. See `services/vela/velaPartyNamespace.ts`'s own header for the
 * precise, honest boundary of what this gate does and does not protect
 * (it enforces the property for TS-side evidence handling; it cannot by
 * itself enforce it INSIDE a future stateful WASM guest — that remains a
 * separate, open, blocking gap for Phase 11, documented there and in
 * `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-agent-namespace-investigation.md`).
 */
import { describe, expect, it } from 'vitest';
import {
  deriveVelaPartyNamespaceRef,
  isVelaCrossPartyAccessAuthorized,
  assertVelaCrossPartyAccessAuthorized,
  type VelaPartyNamespaceIdentities,
  type VelaDisclosureScope,
} from '@/services/vela/velaPartyNamespace';
import { constitutionalRef } from '@/services/identity/personaReferences';

const APP_A = '1001';
const APP_B = '2002';

const PARTY_ALICE: VelaPartyNamespaceIdentities = {
  authorityPrincipal: 'principal-alice',
  confidentialPrivacyIdentity: 'privacy-alice',
};
const PARTY_BOB: VelaPartyNamespaceIdentities = {
  authorityPrincipal: 'principal-bob',
  confidentialPrivacyIdentity: 'privacy-bob',
};

describe('deriveVelaPartyNamespaceRef', () => {
  it('is deterministic: same inputs always derive the same ref', () => {
    const first = deriveVelaPartyNamespaceRef(APP_A, PARTY_ALICE);
    const second = deriveVelaPartyNamespaceRef(APP_A, PARTY_ALICE);
    expect(first).toBe(second);
  });

  it('isolates two different contributors within the SAME shared application', () => {
    const alice = deriveVelaPartyNamespaceRef(APP_A, PARTY_ALICE);
    const bob = deriveVelaPartyNamespaceRef(APP_A, PARTY_BOB);
    expect(alice).not.toBe(bob);
  });

  it('never correlates the SAME contributor across two DIFFERENT applications', () => {
    const inAppA = deriveVelaPartyNamespaceRef(APP_A, PARTY_ALICE);
    const inAppB = deriveVelaPartyNamespaceRef(APP_B, PARTY_ALICE);
    expect(inAppA).not.toBe(inAppB);
  });

  it('fails closed on a missing applicationId', () => {
    expect(() => deriveVelaPartyNamespaceRef('', PARTY_ALICE)).toThrow(/applicationId/);
  });

  it('fails closed on a missing authorityPrincipal', () => {
    expect(() =>
      deriveVelaPartyNamespaceRef(APP_A, { authorityPrincipal: '', confidentialPrivacyIdentity: 'x' }),
    ).toThrow(/authorityPrincipal/);
  });

  it('fails closed on a missing confidentialPrivacyIdentity', () => {
    expect(() =>
      deriveVelaPartyNamespaceRef(APP_A, { authorityPrincipal: 'x', confidentialPrivacyIdentity: '' }),
    ).toThrow(/confidentialPrivacyIdentity/);
  });

  it('is a 16-hex-char commitment, reusing constitutionalRef rather than a second hashing scheme', () => {
    const ref = deriveVelaPartyNamespaceRef(APP_A, PARTY_ALICE);
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    // Same derivation `constitutionalRef` itself would produce for the exact
    // same namespace + composite id — proves this module composes the
    // existing helper rather than reimplementing sha256 independently.
    expect(ref).toBe(
      constitutionalRef(
        'vela-party-namespace',
        `${APP_A}:${PARTY_ALICE.authorityPrincipal}:${PARTY_ALICE.confidentialPrivacyIdentity}`,
      ),
    );
  });

  it('never leaks the plaintext applicationId or identity values into the ref', () => {
    const ref = deriveVelaPartyNamespaceRef(APP_A, PARTY_ALICE);
    expect(ref).not.toContain(APP_A);
    expect(ref).not.toContain(PARTY_ALICE.authorityPrincipal);
    expect(ref).not.toContain(PARTY_ALICE.confidentialPrivacyIdentity);
  });

  it('produces no collisions across a reasonable sample of distinct contributors', () => {
    const refs = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const ref = deriveVelaPartyNamespaceRef(APP_A, {
        authorityPrincipal: `principal-${i}`,
        confidentialPrivacyIdentity: `privacy-${i}`,
      });
      expect(refs.has(ref)).toBe(false);
      refs.add(ref);
    }
    expect(refs.size).toBe(500);
  });
});

describe('cross-party disclosure gate (operator-mandated acceptance property)', () => {
  const APP_SHARED = '3003'; // a single Vela applicationId shared by both parties
  const aliceRef = deriveVelaPartyNamespaceRef(APP_SHARED, PARTY_ALICE);
  const bobRef = deriveVelaPartyNamespaceRef(APP_SHARED, PARTY_BOB);

  it('always allows a party to access its own confidential state', () => {
    const scope: VelaDisclosureScope = { actionRef: 'action-1', ownerPartyNamespaceRef: aliceRef };
    expect(isVelaCrossPartyAccessAuthorized(scope, aliceRef)).toBe(true);
    expect(() => assertVelaCrossPartyAccessAuthorized(scope, aliceRef)).not.toThrow();
  });

  it('DENIES Party B reading/combining/disclosing Party A\'s state when no scope authorizes it (the default)', () => {
    const scope: VelaDisclosureScope = { actionRef: 'action-1', ownerPartyNamespaceRef: aliceRef };
    expect(isVelaCrossPartyAccessAuthorized(scope, bobRef)).toBe(false);
    expect(() => assertVelaCrossPartyAccessAuthorized(scope, bobRef)).toThrow(/not authorized/);
  });

  it('DENIES even when authorizedPartyNamespaceRefs is explicitly present but empty', () => {
    const scope: VelaDisclosureScope = {
      actionRef: 'action-1',
      ownerPartyNamespaceRef: aliceRef,
      authorizedPartyNamespaceRefs: [],
    };
    expect(isVelaCrossPartyAccessAuthorized(scope, bobRef)).toBe(false);
  });

  it('ALLOWS Party B when the exact transaction scope explicitly authorizes it (legitimate multi-party consent)', () => {
    const scope: VelaDisclosureScope = {
      actionRef: 'shared-liquidity-pilot-action-7',
      ownerPartyNamespaceRef: aliceRef,
      authorizedPartyNamespaceRefs: [bobRef],
    };
    expect(isVelaCrossPartyAccessAuthorized(scope, bobRef)).toBe(true);
    expect(() => assertVelaCrossPartyAccessAuthorized(scope, bobRef)).not.toThrow();
  });

  it('an authorization for one actionRef does NOT carry over to a different actionRef (no standing grant)', () => {
    const scopeForAction7: VelaDisclosureScope = {
      actionRef: 'shared-liquidity-pilot-action-7',
      ownerPartyNamespaceRef: aliceRef,
      authorizedPartyNamespaceRefs: [bobRef],
    };
    const scopeForAction8: VelaDisclosureScope = {
      actionRef: 'unrelated-action-8',
      ownerPartyNamespaceRef: aliceRef,
      authorizedPartyNamespaceRefs: [], // this action was never scoped to include Bob
    };
    expect(isVelaCrossPartyAccessAuthorized(scopeForAction7, bobRef)).toBe(true);
    expect(isVelaCrossPartyAccessAuthorized(scopeForAction8, bobRef)).toBe(false);
  });

  it('a third party never inherits an authorization scoped to a different requester', () => {
    const carolRef = deriveVelaPartyNamespaceRef(APP_SHARED, {
      authorityPrincipal: 'principal-carol',
      confidentialPrivacyIdentity: 'privacy-carol',
    });
    const scope: VelaDisclosureScope = {
      actionRef: 'shared-liquidity-pilot-action-7',
      ownerPartyNamespaceRef: aliceRef,
      authorizedPartyNamespaceRefs: [bobRef], // Carol was never named
    };
    expect(isVelaCrossPartyAccessAuthorized(scope, carolRef)).toBe(false);
  });
});
