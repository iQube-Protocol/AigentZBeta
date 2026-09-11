/**
 * ERC-8004 identity binding — Slice A canaries.
 *
 * Every describe below pins one operator ruling from 2026-07-28. Nothing here
 * touches a network, a database, a wallet or a private key: the whole binding
 * model is pure functions over caller-supplied data, which is what makes the
 * claim ceremony reproducible offline.
 *
 * The single most important property in the file is the one that is easiest to
 * lose: `unbound` and `binding_unresolvable` are DIFFERENT. One asserts a fact
 * ("we looked, there is none"), the other admits ignorance ("we could not
 * look"). A refactor that collapses them would let an unreadable store publish
 * the factual claim that a partner agent is unattributed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  normalizeAgentIdentity,
  identityKey,
  type HorizenAgentIdentity,
} from '@/services/horizen/identity';
import {
  // states + facets
  EVIDENCE_BINDING_STATES,
  AGENT_AUTHORITY_FACETS,
  isStandingEligible,
  type AgentAuthorityFacets,
  type EvidenceBindingState,
  // record + resolution
  resolveBinding,
  bindingRefs,
  type AgentIdentityBinding,
  // ownership freshness
  OWNERSHIP_FRESHNESS_WINDOW_MS,
  OWNERSHIP_FRESHNESS_TIER_FOR,
  requiresFreshRead,
  OWNERSHIP_CHANGE_DELEGATION_EFFECT,
  isOwnershipFresh,
  recheckBindingOwnership,
  evaluateNewActionAuthority,
  agentAuthorityInputs,
  // claim ceremony
  AGENT_CLAIM_DOMAIN_SEPARATOR,
  AGENT_CLAIM_PURPOSE,
  buildAgentClaimMessage,
  verifyAgentClaimMessage,
  evaluateOperatorClaim,
  bindAgentIdentity,
  currentIdentityRegistry,
  type AgentClaimMessageInput,
  type AgentControlProof,
  type ConstitutionalAct,
} from '@/services/horizen/agentBinding';
import { buildHorizenEvidence } from '@/services/horizen/evidence';
import { buildConnectionChallengeMessage } from '@/services/passport/connectionChallenge';
import { personaPublicRef, constitutionalRef } from '@/services/identity/personaReferences';
import type { HorizenAgentRecord } from '@/services/horizen/correlate';

// ─── Fixtures ──────────────────────────────────────────────────────────────

/** The reference agent from the Horizen brief §3: tokenId 7866 / 0x1eba. */
function identity(network: 'base-sepolia' | 'base-mainnet' = 'base-sepolia'): HorizenAgentIdentity {
  const r = normalizeAgentIdentity({ agentId: '0x1eba', network, source: 'on-chain' });
  if (!r.ok) throw new Error('fixture identity failed to normalise');
  return r.identity;
}

/** T0 values. These MUST never appear in an evidence record — canaried below. */
const PERSONA_ID = '2e859489-1f4a-4c7e-9b31-0a7d6c5e4f28';
const PASSPORT_ID = 'pp_9f8e7d6c5b4a39281706';
const GRANT_ID = 'grant_5a4b3c2d1e0f';
const AGENT_ROOT_DID = 'did:metame:agent:7f6e5d4c3b2a';
const OWNER = '0x9d911c43f9b14eaf3969cb2c44ff4dd69e1f497d';
const NEW_OWNER = '0xbbdcb0c9c3b9ce60555fdf50cfb99802e7c33920';

const ISSUED_AT = '2026-07-28T12:00:00.000Z';
const EXPIRES_AT = '2026-07-28T12:10:00.000Z';
const NOW = '2026-07-28T12:01:00.000Z';
const NONCE = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';

function claimInput(over: Partial<AgentClaimMessageInput> = {}): AgentClaimMessageInput {
  return {
    runtime: 'metaMe',
    environment: 'dev',
    origin: 'https://dev-beta.aigentz.me',
    purpose: AGENT_CLAIM_PURPOSE,
    network: 'base-sepolia',
    chainId: 84532,
    identityRegistry: currentIdentityRegistry('base-sepolia'),
    tokenId: '7866',
    ownerWallet: OWNER,
    principalRef: personaPublicRef(PERSONA_ID),
    passportRef: constitutionalRef('passport', PASSPORT_ID),
    nonce: NONCE,
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    ...over,
  };
}

function controlProof(over: Partial<AgentControlProof> = {}): AgentControlProof {
  return {
    ownerAddress: OWNER,
    ownerObservation: 'registry_read',
    claimMessage: buildAgentClaimMessage(claimInput()),
    nonce: NONCE,
    signatureCommitment: 'a'.repeat(64),
    verifiedAt: NOW,
    ...over,
  };
}

function constitutionalAct(over: Partial<ConstitutionalAct> = {}): ConstitutionalAct {
  return {
    personaId: PERSONA_ID,
    passportId: PASSPORT_ID,
    delegationGrantId: GRANT_ID,
    claimedRelationship: true,
    acceptedResponsibility: true,
    scopeDefined: true,
    actedAt: NOW,
    receiptId: null,
    ...over,
  };
}

/** A fully-bound, fresh, eligible binding — the baseline every negative test
 *  perturbs by exactly one field, so a failure names its own cause. */
function boundBinding(over: Partial<AgentIdentityBinding> = {}): AgentIdentityBinding {
  const res = bindAgentIdentity({
    bindingId: 'bind_0001',
    agentRootDid: AGENT_ROOT_DID,
    identity: identity(),
    agentControlProof: controlProof(),
    constitutionalAct: constitutionalAct(),
    claimExpectation: claimInput(),
    delegationActive: true,
    runtimeAdmissionEligible: true,
    now: NOW,
  });
  if (!res.ok) throw new Error(`fixture bind failed: ${res.reason}`);
  return { ...res.binding, ...over };
}

/** Minimal correlated record — enough to build evidence from, no fetch harness
 *  duplicated from tests/horizen-integration.test.ts (inv.engineering.037). */
function agentRecord(net: 'base-sepolia' | 'base-mainnet' = 'base-sepolia'): HorizenAgentRecord {
  return {
    identity: identity(net),
    registry: {
      name: 'My Pulse Test Agent',
      owner: OWNER,
      active: true,
      validationsCount: 1,
      allValidationsPassed: true,
      card: { status: 'unresolved', scheme: 'unknown', reason: 'fixture' },
    },
    pulse: {
      present: true,
      value: {
        enrolled: true,
        commitmentRecorded: true,
        slaTarget: 99,
        uptimeCurrent: 100,
        totalChallenges: 12,
        slaProofs: [
          {
            periodStart: '2026-07-01T00:00:00.000Z',
            periodEnd: '2026-07-08T00:00:00.000Z',
            uptimePercent: 100,
            merkleRoot: '0xdead',
            zkverifyAttestationId: '51708',
            adapterTxHash: '0x9a07d6df',
          },
        ],
      },
    },
    validations: {
      present: true,
      value: [
        {
          id: 'v1',
          status: 'validated',
          tag: 'pulse-sla',
          timestamp: '2026-07-09T00:00:00.000Z',
          validatorAddress: '0xbbdcb0C9C3B9ce60555fdF50cFB99802E7c33920',
          zkTxHash: '0xda75e0da',
          zkBlockHash: '0xbeef',
          allAssertionsPassed: true,
        },
      ],
    },
    pnl: { present: false, reason: 'not-found', detail: 'fixture' },
    correlationVerified: true,
    correlationNotes: [],
    ready: true,
  };
}

// ───────────────────────────────────────────────────────────────────────────

describe('the four evidence-record binding states (operator ruling 2)', () => {
  it('is exactly those four — the set is closed', () => {
    expect([...EVIDENCE_BINDING_STATES].sort()).toEqual([
      'binding_revoked',
      'binding_unresolvable',
      'constitutionally_bound',
      'unbound',
    ]);
  });

  it('reaches `constitutionally_bound` for an active binding in force', () => {
    const r = resolveBinding({ identity: identity(), bindings: [boundBinding()], at: NOW });
    expect(r.state).toBe('constitutionally_bound');
    expect(r.refs).not.toBeNull();
  });

  it('reaches `unbound` when the store WAS read and holds none', () => {
    const r = resolveBinding({ identity: identity(), bindings: [], at: NOW });
    expect(r.state).toBe('unbound');
    expect(r.binding).toBeNull();
    expect(r.refs).toBeNull();
  });

  it('reaches `binding_unresolvable` when the store could NOT be read', () => {
    const r = resolveBinding({ identity: identity(), bindings: null, at: NOW });
    expect(r.state).toBe('binding_unresolvable');
  });

  it('reaches `binding_revoked` for a deliberately revoked binding', () => {
    const revoked = boundBinding({ status: 'revoked', statusReason: 'holder revoked' });
    const r = resolveBinding({ identity: identity(), bindings: [revoked], at: NOW });
    expect(r.state).toBe('binding_revoked');
  });

  it('reaches `binding_unresolvable` — NOT `unbound` — for a suspended binding', () => {
    // A suspension is knowledge, not absence. Reporting it as `unbound` would
    // assert that no binding exists, which is false and unrecoverable once the
    // receipt is anchored.
    const suspended = boundBinding({ status: 'suspended', statusReason: 'owner changed' });
    const r = resolveBinding({ identity: identity(), bindings: [suspended], at: NOW });
    expect(r.state).toBe('binding_unresolvable');
  });

  it('NEVER conflates "no binding" with "could not look"', () => {
    const looked = resolveBinding({ identity: identity(), bindings: [], at: NOW });
    const couldNotLook = resolveBinding({ identity: identity(), bindings: null, at: NOW });
    expect(looked.state).not.toBe(couldNotLook.state);
  });

  it('is Standing-eligible in exactly ONE state', () => {
    const eligible = EVIDENCE_BINDING_STATES.filter((s) => isStandingEligible(s));
    expect(eligible).toEqual(['constitutionally_bound']);
  });
});

describe('unbound evidence still ingests, but is Standing-ineligible (ruling 2)', () => {
  it('builds a complete evidence record for an agent with no binding at all', () => {
    const e = buildHorizenEvidence(agentRecord(), NOW, {
      binding: resolveBinding({ identity: identity(), bindings: [], at: NOW }),
      ingestedAt: NOW,
    });
    // Ingestion SUCCEEDS — an unbound Horizen agent is still valid external
    // evidence. Every partner identifier survives.
    expect(e.tokenId).toBe('7866');
    expect(e.registryAlias).toBe('0x1eba');
    expect(e.identityClass).toBe('on-chain');
    expect(e.zkVerifyAttestationId).toBe('51708');
    // …it is simply not attributable, and cannot generate personhood Standing.
    expect(e.bindingState).toBe('unbound');
    expect(e.standingEligible).toBe(false);
  });

  it('is Standing-eligible only when constitutionally bound', () => {
    const bound = buildHorizenEvidence(agentRecord(), NOW, {
      binding: resolveBinding({ identity: identity(), bindings: [boundBinding()], at: NOW }),
      ingestedAt: NOW,
    });
    expect(bound.bindingState).toBe('constitutionally_bound');
    expect(bound.standingEligible).toBe(true);

    for (const bindings of [null, [], [boundBinding({ status: 'revoked' })], [boundBinding({ status: 'suspended' })]]) {
      const e = buildHorizenEvidence(agentRecord(), NOW, {
        binding: resolveBinding({ identity: identity(), bindings, at: NOW }),
        ingestedAt: NOW,
      });
      expect(e.standingEligible).toBe(false);
    }
  });

  it('always states the binding state explicitly — never an omitted field', () => {
    const e = buildHorizenEvidence(agentRecord(), NOW, {
      binding: resolveBinding({ identity: identity(), bindings: null, at: NOW }),
      ingestedAt: NOW,
    });
    expect(Object.keys(e)).toContain('bindingState');
    expect(e.bindingState).toBeTruthy();
    expect(e.bindingStateReason.length).toBeGreaterThan(0);
  });
});

describe('T2 discipline — no raw T0 identifier reaches the evidence record (ruling 3)', () => {
  const evidence = () =>
    buildHorizenEvidence(agentRecord(), NOW, {
      binding: resolveBinding({ identity: identity(), bindings: [boundBinding()], at: NOW }),
      ingestedAt: NOW,
      receiptCreatedAt: '2026-07-28T12:02:00.000Z',
    });

  it('carries the four commitments and nothing raw', () => {
    const e = evidence();
    expect(e.principalRef).toBe(personaPublicRef(PERSONA_ID));
    expect(e.passportRef).toBe(constitutionalRef('passport', PASSPORT_ID));
    expect(e.delegationRef).toBe(constitutionalRef('delegation', GRANT_ID));
    expect(e.agentBindingRef).toBe(constitutionalRef('agent-binding', 'bind_0001'));
  });

  it('leaks NO raw T0 value anywhere in the serialised payload', () => {
    const serialised = JSON.stringify(evidence());
    // The five CLAUDE.md never-serialise fields, plus the HMS rule's delegated
    // agent identifier and the case/grant class of id.
    for (const secret of [PERSONA_ID, PASSPORT_ID, GRANT_ID, AGENT_ROOT_DID]) {
      expect(serialised, `raw T0 value ${secret} reached the evidence record`).not.toContain(secret);
    }
  });

  it('declares no T0-named key on the evidence record', () => {
    const forbidden = /personaId|authProfileId|rootDid|passportId|grantId|caseId|agentRootDid|kybeAttestation/i;
    const offenders = Object.keys(evidence()).filter((k) => forbidden.test(k));
    expect(offenders).toEqual([]);
  });

  it('emits no partial attribution — refs are all-or-nothing', () => {
    const e = buildHorizenEvidence(agentRecord(), NOW, {
      binding: resolveBinding({ identity: identity(), bindings: [], at: NOW }),
      ingestedAt: NOW,
    });
    expect([e.principalRef, e.passportRef, e.delegationRef, e.agentBindingRef])
      .toEqual([null, null, null, null]);
  });

  it('derives every ref from the ONE hashing scheme in personaReferences', () => {
    // inv.engineering.037: a second sha256 in agentBinding.ts would be a
    // parallel implementation of the commitment derivation.
    const src = readFileSync(join(process.cwd(), 'services', 'horizen', 'agentBinding.ts'), 'utf8');
    expect(src).not.toMatch(/createHash\s*\(/);
    const refs = bindingRefs(boundBinding());
    for (const v of Object.values(refs)) expect(v).toMatch(/^[0-9a-f]{16}$/);
  });

  it('NAMESPACES the commitment so two id kinds cannot collide', () => {
    // The defect this catches: an unnamespaced sha256 makes a passport id and a
    // grant id that happen to be the same UUID commit to the SAME ref — and a
    // receipt reader would then mistake one for the other. CLAUDE.md's HMS rule
    // mandates the namespace prefix for exactly this reason.
    //
    // Asserted as a PROPERTY of the derivation, not by re-calling the function
    // under test with the same arguments (which would be a tautology that any
    // mutation satisfies).
    const shared = 'collision-candidate-id';
    const asPassport = constitutionalRef('passport', shared);
    const asDelegation = constitutionalRef('delegation', shared);
    const asBinding = constitutionalRef('agent-binding', shared);
    const asPersona = personaPublicRef(shared);
    expect(new Set([asPassport, asDelegation, asBinding, asPersona]).size).toBe(4);
  });

  it('keeps refs distinct even when the source ids are identical', () => {
    const b = boundBinding();
    const same = { ...b, constitutionalAct: { ...b.constitutionalAct, passportId: 'X', delegationGrantId: 'X' } };
    const refs = bindingRefs(same);
    expect(refs.passportRef).not.toBe(refs.delegationRef);
  });

  it('leaks no raw T0 value in ANY resolution state', () => {
    // The scan above covers the bound case. A substitution that only fires on a
    // fallback path (e.g. "use the grant id when the ref is missing") would slip
    // past it, so every state gets scanned.
    const cases: Array<AgentIdentityBinding[] | null> = [
      null,
      [],
      [boundBinding()],
      [boundBinding({ status: 'revoked', statusReason: 'holder revoked' })],
      [boundBinding({ status: 'suspended', statusReason: 'owner changed' })],
      [boundBinding({ status: 'superseded', supersededBy: 'bind_0002' })],
    ];
    for (const bindings of cases) {
      const resolution = resolveBinding({ identity: identity(), bindings, at: NOW });
      const serialised = JSON.stringify(
        buildHorizenEvidence(agentRecord(), NOW, { binding: resolution, ingestedAt: NOW }),
      );
      for (const secret of [PERSONA_ID, PASSPORT_ID, GRANT_ID, AGENT_ROOT_DID]) {
        expect(serialised, `raw T0 value leaked in state ${resolution.state}`).not.toContain(secret);
      }
    }
  });

  it('assigns the four refs from the commitments ONLY — never from a raw id', () => {
    // Structural backstop for the case the value scan cannot reach: a fallback
    // that substitutes `constitutionalAct.<rawId>` when a ref is absent is a
    // latent T0 leak even while the state that triggers it is unreachable.
    const src = readFileSync(join(process.cwd(), 'services', 'horizen', 'evidence.ts'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const ref of ['principalRef', 'passportRef', 'delegationRef', 'agentBindingRef']) {
      // EVERY occurrence, not the first: the interface declaration
      // (`delegationRef: string | null;`) precedes the assignment, and matching
      // only the first would check the type and never the value.
      const matches = [...code.matchAll(new RegExp(`^\\s*${ref}:\\s*([^\\n]+)$`, 'gm'))];
      expect(matches.length, `${ref} is not declared/assigned in evidence.ts`).toBeGreaterThanOrEqual(2);
      for (const m of matches) {
        expect(m[1], `${ref} may only come from binding.refs — found \`${m[1].trim()}\``)
          .not.toMatch(/constitutionalAct|personaId|passportId|delegationGrantId|agentRootDid|bindingId/);
      }
    }
  });
});

describe('temporal honesty — ingestion time is not action time (ruling 4)', () => {
  it('carries four distinct instants, derived from their own sources', () => {
    const e = buildHorizenEvidence(agentRecord(), NOW, {
      binding: resolveBinding({ identity: identity(), bindings: [], at: NOW }),
      ingestedAt: '2026-07-28T12:05:00.000Z',
      receiptCreatedAt: '2026-07-28T12:06:00.000Z',
    });
    expect(e.actionOccurredAt).toBe('2026-07-08T00:00:00.000Z'); // SLA period end
    expect(e.proofRecordedAt).toBe('2026-07-09T00:00:00.000Z');  // validation timestamp
    expect(e.ingestedAt).toBe('2026-07-28T12:05:00.000Z');
    expect(e.receiptCreatedAt).toBe('2026-07-28T12:06:00.000Z');
    // All four differ — the whole point.
    expect(new Set([e.actionOccurredAt, e.proofRecordedAt, e.ingestedAt, e.receiptCreatedAt]).size).toBe(4);
  });

  it('reports absent partner timestamps as null — never as "now"', () => {
    const bare: HorizenAgentRecord = {
      ...agentRecord(),
      pulse: { present: false, reason: 'not-enrolled', detail: 'fixture' },
      validations: { present: false, reason: 'not-found', detail: 'fixture' },
    };
    const e = buildHorizenEvidence(bare, NOW, {
      binding: resolveBinding({ identity: identity(), bindings: [], at: NOW }),
      ingestedAt: NOW,
    });
    expect(e.actionOccurredAt).toBeNull();
    expect(e.proofRecordedAt).toBeNull();
    expect(e.ingestedAt).toBe(NOW);
  });
});

describe('the identity key is NETWORK-QUALIFIED — never tokenId alone', () => {
  it('does not resolve a Base Sepolia binding for a Base Mainnet agent', () => {
    const sepoliaBinding = boundBinding();
    expect(sepoliaBinding.identity.tokenId).toBe('7866');

    const r = resolveBinding({
      identity: identity('base-mainnet'), // SAME tokenId, different chain
      bindings: [sepoliaBinding],
      at: NOW,
    });
    // Same number, different agent. Matching on tokenId would have said bound.
    expect(r.state).toBe('unbound');
  });

  it('keys bindings by the canonical network-first key', () => {
    expect(identityKey(identity('base-sepolia'))).toBe('base-sepolia:7866');
    expect(identityKey(identity('base-mainnet'))).toBe('base-mainnet:7866');
    expect(agentAuthorityInputs(boundBinding(), NOW).identityKey).toBe('base-sepolia:7866');
  });

  it('refuses to mint a binding whose claim names a different chain', () => {
    const res = bindAgentIdentity({
      bindingId: 'bind_x',
      agentRootDid: AGENT_ROOT_DID,
      identity: identity('base-mainnet'),
      agentControlProof: controlProof(),
      constitutionalAct: constitutionalAct(),
      claimExpectation: claimInput(), // sepolia
      delegationActive: true,
      runtimeAdmissionEligible: false,
      now: NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('claim-message-not-bound');
  });
});

describe('the four authority facets stay SEPARATE (operator addition 1)', () => {
  const combos: AgentAuthorityFacets[] = [];
  for (const a of [false, true])
    for (const b of [false, true])
      for (const c of [false, true])
        for (const d of [false, true])
          combos.push({
            ownershipVerified: a,
            operatorRelationshipClaimed: b,
            delegationActive: c,
            runtimeAdmissionEligible: d,
          });

  it('declares exactly four facets', () => {
    expect([...AGENT_AUTHORITY_FACETS].sort()).toEqual([
      'delegationActive',
      'operatorRelationshipClaimed',
      'ownershipVerified',
      'runtimeAdmissionEligible',
    ]);
  });

  it('represents all 16 combinations independently', () => {
    expect(combos).toHaveLength(16);
    for (const facets of combos) {
      expect(boundBinding({ facets }).facets).toEqual(facets);
    }
    // Including the three the operator named as real situations.
    const wallerOnly = combos.find((f) => f.ownershipVerified && !f.operatorRelationshipClaimed)!;
    const claimedNotDelegated = combos.find((f) => f.operatorRelationshipClaimed && !f.delegationActive)!;
    const boundNotAdmitted = combos.find(
      (f) => f.ownershipVerified && f.operatorRelationshipClaimed && f.delegationActive && !f.runtimeAdmissionEligible,
    )!;
    for (const f of [wallerOnly, claimedNotDelegated, boundNotAdmitted]) expect(f).toBeTruthy();
  });

  it('does NOT infer delegationActive or runtimeAdmissionEligible from a successful bind', () => {
    const res = bindAgentIdentity({
      bindingId: 'bind_nd',
      agentRootDid: AGENT_ROOT_DID,
      identity: identity(),
      agentControlProof: controlProof(),
      constitutionalAct: constitutionalAct(),
      claimExpectation: claimInput(),
      delegationActive: false,
      runtimeAdmissionEligible: false,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // The two proofs succeeded, so these two are true from their OWN sources…
    expect(res.binding.facets.ownershipVerified).toBe(true);
    expect(res.binding.facets.operatorRelationshipClaimed).toBe(true);
    // …and these two stay exactly what the caller supplied.
    expect(res.binding.facets.delegationActive).toBe(false);
    expect(res.binding.facets.runtimeAdmissionEligible).toBe(false);
  });

  it('clears ONLY ownershipVerified when the owner changes', () => {
    const before = boundBinding();
    const after = recheckBindingOwnership(before, NEW_OWNER, '2026-07-28T13:00:00.000Z', 'registry_read').binding;
    expect(after.facets.ownershipVerified).toBe(false);
    // A stranger's token transfer does not get to rewrite facts about the
    // delegation grant, the holder's claim, or runtime admission.
    expect(after.facets.operatorRelationshipClaimed).toBe(before.facets.operatorRelationshipClaimed);
    expect(after.facets.delegationActive).toBe(before.facets.delegationActive);
    expect(after.facets.runtimeAdmissionEligible).toBe(before.facets.runtimeAdmissionEligible);
  });

  it('sets ONLY ownershipVerified when a check confirms the same owner', () => {
    const before = boundBinding({
      facets: {
        ownershipVerified: false,
        operatorRelationshipClaimed: false,
        delegationActive: false,
        runtimeAdmissionEligible: false,
      },
    });
    const after = recheckBindingOwnership(before, OWNER, '2026-07-28T13:00:00.000Z', 'registry_read').binding;
    expect(after.facets).toEqual({
      ownershipVerified: true,
      operatorRelationshipClaimed: false,
      delegationActive: false,
      runtimeAdmissionEligible: false,
    });
  });

  it('gives each facet its own distinct refusal reason', () => {
    const none = boundBinding({
      facets: {
        ownershipVerified: false,
        operatorRelationshipClaimed: false,
        delegationActive: false,
        runtimeAdmissionEligible: false,
      },
    });
    const { refusals } = evaluateNewActionAuthority(none, NOW, { requireRuntimeAdmission: true });
    for (const reason of [
      'ownership-unverified',
      'operator-relationship-unclaimed',
      'delegation-inactive',
      'runtime-admission-denied',
    ]) {
      expect(refusals).toContain(reason);
    }
  });

  it('has no code path deriving one facet from another', () => {
    // Structural, not behavioural: an assignment like
    // `delegationActive: ownershipVerified && …` would be the collapse the
    // operator ruled against, and behavioural tests above could be satisfied by
    // a lucky fixture.
    const src = readFileSync(join(process.cwd(), 'services', 'horizen', 'agentBinding.ts'), 'utf8');
    // Strip block comments so prose naming two facets in one sentence is not a hit.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const facet of AGENT_AUTHORITY_FACETS) {
      for (const m of code.matchAll(new RegExp(`${facet}:\\s*([^,\\n}]+)`, 'g'))) {
        const rhs = m[1];
        const others = AGENT_AUTHORITY_FACETS.filter((f) => f !== facet).filter((f) => rhs.includes(f));
        expect(others, `${facet} is derived from ${others.join('/')} in \`${m[0].trim()}\``).toEqual([]);
      }
    }
  });
});

describe('ownership freshness is tiered by consequence (R-2, ratified 2026-07-28)', () => {
  const agedBy = (ms: number) =>
    boundBinding({ ownershipCheckedAt: new Date(Date.parse(NOW) - ms).toISOString() });
  const MIN = 60_000;
  const HOUR = 3600_000;

  it('declares three tiers, strictly ordered passive > admission > consequential', () => {
    const { passive, admission, consequential } = OWNERSHIP_FRESHNESS_WINDOW_MS;
    expect(passive).toBe(24 * HOUR);
    expect(admission).toBe(15 * MIN);
    expect(consequential).toBe(5 * MIN);
    // The ordering IS the policy: a more consequential act may never tolerate a
    // staler check than a less consequential one.
    expect(passive).toBeGreaterThan(admission);
    expect(admission).toBeGreaterThan(consequential);
  });

  it('treats a never-checked binding as stale in EVERY tier', () => {
    const never = boundBinding({ ownershipCheckedAt: null });
    for (const tier of ['passive', 'admission', 'consequential'] as const) {
      expect(isOwnershipFresh(never, NOW, tier), tier).toBe(false);
    }
  });

  it('accepts or refuses the SAME binding depending only on the tier', () => {
    // This is the whole ruling in one assertion: one binding, one clock, three
    // answers, because the answer is a property of the ACT and not of the record.
    const b = agedBy(30 * MIN);
    expect(isOwnershipFresh(b, NOW, 'passive')).toBe(true);
    expect(isOwnershipFresh(b, NOW, 'admission')).toBe(false);
    expect(isOwnershipFresh(b, NOW, 'consequential')).toBe(false);
  });

  it('defaults to the STRICTEST tier, so an unspecified caller fails safe', () => {
    // 1 hour old: fine for display, refused for anything consequential. An
    // omitted tier must land on the tight side, never the loose one.
    const b = agedBy(1 * HOUR);
    expect(isOwnershipFresh(b, NOW)).toBe(false);
    expect(evaluateNewActionAuthority(b, NOW).refusals).toEqual(['ownership-check-stale']);
    expect(evaluateNewActionAuthority(b, NOW, { tier: 'passive' })).toEqual({
      eligible: true,
      refusals: [],
    });
  });

  it('REFUSES a binding that is otherwise impeccable but whose check has aged out', () => {
    const b = agedBy(10 * MIN);
    expect(b.status).toBe('active');
    expect(b.ownershipStatus).toBe('matches');
    expect(b.facets).toEqual({
      ownershipVerified: true,
      operatorRelationshipClaimed: true,
      delegationActive: true,
      runtimeAdmissionEligible: true,
    });
    // Fresh enough to admit, too stale to act on live value.
    expect(evaluateNewActionAuthority(b, NOW, { tier: 'admission' }).eligible).toBe(true);
    const consequential = evaluateNewActionAuthority(b, NOW, { tier: 'consequential' });
    expect(consequential.eligible).toBe(false);
    expect(consequential.refusals).toEqual(['ownership-check-stale']);
  });

  it('maps each act to its tier as DATA, so a route cannot pick a loose window', () => {
    expect(OWNERSHIP_FRESHNESS_TIER_FOR['display']).toBe('passive');
    expect(OWNERSHIP_FRESHNESS_TIER_FOR['marketa-preliminary-review']).toBe('passive');
    expect(OWNERSHIP_FRESHNESS_TIER_FOR['operator-claim']).toBe('admission');
    expect(OWNERSHIP_FRESHNESS_TIER_FOR['delegation-activation']).toBe('admission');
    expect(OWNERSHIP_FRESHNESS_TIER_FOR['runtime-admission']).toBe('admission');
    expect(OWNERSHIP_FRESHNESS_TIER_FOR['live-value-action']).toBe('consequential');
    // No act may be mapped to a tier looser than passive, and the claim/
    // delegation/admission trio must never sit in the passive tier — that was
    // precisely the collapse the single 24h default caused.
    for (const act of ['operator-claim', 'delegation-activation', 'runtime-admission'] as const) {
      expect(OWNERSHIP_FRESHNESS_TIER_FOR[act], act).not.toBe('passive');
    }
  });

  it('demands a FRESH READ for irreversible or high-value acts, cache notwithstanding', () => {
    // 1 minute old — comfortably inside the 5-minute consequential window, and
    // still refused, because the ruling caps the CACHED path rather than
    // licensing it for acts that cannot be undone.
    const b = agedBy(1 * MIN);
    expect(isOwnershipFresh(b, NOW, 'consequential')).toBe(true);

    const irreversible = evaluateNewActionAuthority(b, NOW, {
      tier: 'consequential',
      irreversible: true,
    });
    expect(irreversible.eligible).toBe(false);
    expect(irreversible.refusals).toEqual(['ownership-fresh-read-required']);

    const highValue = evaluateNewActionAuthority(b, NOW, { tier: 'consequential', highValue: true });
    expect(highValue.refusals).toEqual(['ownership-fresh-read-required']);

    // Asserting the fresh read satisfies it.
    expect(
      evaluateNewActionAuthority(b, NOW, {
        tier: 'consequential',
        irreversible: true,
        freshRead: true,
      }),
    ).toEqual({ eligible: true, refusals: [] });
  });

  it('does NOT demand a fresh read for reversible acts or looser tiers', () => {
    expect(requiresFreshRead('consequential', {})).toBe(false);
    expect(requiresFreshRead('admission', { irreversible: true })).toBe(false);
    expect(requiresFreshRead('passive', { highValue: true })).toBe(false);
    expect(requiresFreshRead('consequential', { irreversible: true })).toBe(true);
    expect(requiresFreshRead('consequential', { highValue: true })).toBe(true);
  });

  it('re-checking the same owner REFRESHES the window rather than only confirming it', () => {
    const aged = agedBy(25 * HOUR);
    expect(evaluateNewActionAuthority(aged, NOW, { tier: 'passive' }).eligible).toBe(false);
    const refreshed = recheckBindingOwnership(aged, OWNER, NOW, 'registry_read').binding;
    expect(evaluateNewActionAuthority(refreshed, NOW, { tier: 'consequential' }).eligible).toBe(true);
  });

  it('does NOT let staleness un-attribute past evidence, in any tier', () => {
    // Freshness withholds NEW authority. It must not retroactively change what a
    // binding attributed — otherwise a late poll would rewrite history.
    const aged = agedBy(240 * HOUR);
    expect(evaluateNewActionAuthority(aged, NOW, { tier: 'passive' }).eligible).toBe(false);
    expect(resolveBinding({ identity: identity(), bindings: [aged], at: NOW }).state)
      .toBe('constitutionally_bound');
  });

  it('tightening a window does not change the state model or the refusal vocabulary', () => {
    // Transfer-event indexing (Phase D) shortens the windows; the ruling is that
    // it must not change the states. Same binding, tighter tier, same vocabulary.
    const b = agedBy(20 * MIN);
    expect(evaluateNewActionAuthority(b, NOW, { tier: 'passive' }).refusals).toEqual([]);
    expect(evaluateNewActionAuthority(b, NOW, { tier: 'admission' }).refusals).toEqual([
      'ownership-check-stale',
    ]);
  });
});

describe('ownership transfer suspends the binding (ruling 5)', () => {
  it('suspends, withholds new delegation authority, and demands a re-claim', () => {
    const r = recheckBindingOwnership(boundBinding(), NEW_OWNER, '2026-07-28T13:00:00.000Z', 'chain_read');
    expect(r.ownerChanged).toBe(true);
    expect(r.binding.status).toBe('suspended');
    expect(r.delegationEffect).toBe(OWNERSHIP_CHANGE_DELEGATION_EFFECT);
    expect(r.requiresReclaim).toBe(true);
    expect(r.binding.ownershipStatus).toBe('changed');
    expect(r.binding.effectiveTo).toBe('2026-07-28T13:00:00.000Z');
  });

  it('PRESERVES the historical record — nothing about the past is erased', () => {
    const before = boundBinding();
    const after = recheckBindingOwnership(before, NEW_OWNER, '2026-07-28T13:00:00.000Z', 'chain_read').binding;
    expect(after.ownerAddressAtBinding).toBe(before.ownerAddressAtBinding);
    expect(after.agentControlProof).toEqual(before.agentControlProof);
    expect(after.constitutionalAct).toEqual(before.constitutionalAct);
    expect(after.effectiveFrom).toBe(before.effectiveFrom);
    expect(after.identity).toEqual(before.identity);
  });

  it('does not mutate the binding it was given', () => {
    // Purity is what makes an already-built evidence record immune to a later
    // transfer: the receipt froze its verdict and nothing can reach back.
    const before = boundBinding();
    const snapshot = JSON.parse(JSON.stringify(before));
    recheckBindingOwnership(before, NEW_OWNER, '2026-07-28T13:00:00.000Z', 'chain_read');
    expect(before).toEqual(snapshot);
  });

  it('never resurrects a revoked binding into suspended', () => {
    const revoked = boundBinding({ status: 'revoked', statusReason: 'holder revoked' });
    const r = recheckBindingOwnership(revoked, NEW_OWNER, '2026-07-28T13:00:00.000Z', 'chain_read');
    expect(r.binding.status).toBe('revoked');
    expect(r.binding.statusReason).toBe('holder revoked');
    expect(r.delegationEffect).toBeNull();
  });
});

describe('the claim message — byte-exact canonical form (operator addition 3)', () => {
  /**
   * THE FIXTURE. Pinned as a literal, not a regex: the exact bytes are the
   * contract, and a signature is over these bytes. Any drift in spacing,
   * ordering, wording or field set must fail HERE rather than silently
   * invalidate every signature ever produced against the old form.
   */
  const EXPECTED = [
    'metaMe Agent Claim v1',
    '',
    'Purpose: bind-erc8004-agent-to-passport-delegation',
    'Runtime: metaMe',
    'Environment: dev',
    'Origin: https://dev-beta.aigentz.me',
    'Network: base-sepolia',
    'Chain Id: 84532',
    'Identity Registry: 0x8004A818BFB912233c491871b3d84c89A494BD9e',
    'Token Id: 7866',
    'Owner Wallet: 0x9d911c43f9b14eaf3969cb2c44ff4dd69e1f497d',
    'Principal: ' + personaPublicRef(PERSONA_ID),
    'Passport: ' + constitutionalRef('passport', PASSPORT_ID),
    'Nonce: 0f1e2d3c4b5a69788796a5b4c3d2e1f0',
    'Issued At: 2026-07-28T12:00:00.000Z',
    'Expires: 2026-07-28T12:10:00.000Z',
    '',
    'Signing proves you control the wallet that owns this agent identity. It does not create a delegation — a separate, Passport-backed act is required for that.',
  ].join('\n');

  it('renders byte-for-byte the pinned canonical form', () => {
    expect(buildAgentClaimMessage(claimInput())).toBe(EXPECTED);
  });

  it('opens with the exact domain separator', () => {
    expect(AGENT_CLAIM_DOMAIN_SEPARATOR).toBe('metaMe Agent Claim v1');
    expect(EXPECTED.split('\n')[0]).toBe('metaMe Agent Claim v1');
  });

  it('names every parameter the ruling requires', () => {
    for (const label of [
      'Purpose', 'Runtime', 'Environment', 'Origin', 'Network', 'Chain Id',
      'Identity Registry', 'Token Id', 'Owner Wallet', 'Principal', 'Passport',
      'Nonce', 'Issued At', 'Expires',
    ]) {
      expect(EXPECTED).toContain(`\n${label}: `);
    }
  });

  it('carries commitments, never raw T0 identifiers', () => {
    // The claim message is rendered in a wallet UI and pasted into support
    // tickets — the most-copied surface in the flow.
    for (const secret of [PERSONA_ID, PASSPORT_ID, GRANT_ID]) {
      expect(EXPECTED).not.toContain(secret);
    }
  });

  it('accepts the message it built', () => {
    expect(verifyAgentClaimMessage(buildAgentClaimMessage(claimInput()), claimInput(), NOW)).toEqual({ ok: true });
  });
});

describe('claim replay resistance — every axis is closed', () => {
  const msg = buildAgentClaimMessage(claimInput());

  const axes: Array<[string, Partial<AgentClaimMessageInput>, string]> = [
    ['another chain', { chainId: 8453 }, 'chain-mismatch'],
    ['another network', { network: 'base-mainnet' }, 'network-mismatch'],
    ['another registry', { identityRegistry: currentIdentityRegistry('base-mainnet') }, 'registry-mismatch'],
    ['another agent', { tokenId: '7867' }, 'token-mismatch'],
    ['another wallet', { ownerWallet: NEW_OWNER }, 'wallet-mismatch'],
    ['another principal', { principalRef: personaPublicRef('someone-else') }, 'principal-mismatch'],
    ['another passport', { passportRef: constitutionalRef('passport', 'pp_other') }, 'passport-mismatch'],
    ['another environment', { environment: 'prod' }, 'environment-mismatch'],
    ['another origin', { origin: 'https://evil.example' }, 'origin-mismatch'],
    ['another runtime', { runtime: 'somethingElse' }, 'runtime-mismatch'],
    ['another purpose', { purpose: 'pulse-enrollment' }, 'purpose-mismatch'],
    ['another nonce', { nonce: 'ffffffffffffffffffffffffffffffff' }, 'nonce-mismatch'],
    ['another issuance', { issuedAt: '2026-07-28T11:00:00.000Z' }, 'issued-at-mismatch'],
    ['another expiry', { expiresAt: '2026-07-28T23:00:00.000Z' }, 'expiry-mismatch'],
  ];

  for (const [label, over, reason] of axes) {
    it(`refuses a message replayed as ${label}`, () => {
      const res = verifyAgentClaimMessage(msg, claimInput(over), NOW);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe(reason);
    });
  }

  it('refuses an expired claim even when every field matches', () => {
    const res = verifyAgentClaimMessage(msg, claimInput(), '2026-07-28T12:10:00.000Z');
    expect(res).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses a passport connection challenge presented as a claim', () => {
    // Domain separation, the whole point of the v1 first line.
    const challenge = buildConnectionChallengeMessage({
      audience: 'metaMe',
      origin: 'https://dev-beta.aigentz.me',
      nonce: NONCE,
      requestedAction: 'connect',
      expiresAt: EXPIRES_AT,
    });
    const res = verifyAgentClaimMessage(challenge, claimInput(), NOW);
    expect(res).toEqual({ ok: false, reason: 'wrong-domain-separator' });
  });

  it('is unconfusable with the passport challenge in the other direction too', () => {
    const challenge = buildConnectionChallengeMessage({
      audience: 'metaMe',
      origin: 'https://dev-beta.aigentz.me',
      nonce: NONCE,
      requestedAction: 'connect',
      expiresAt: EXPIRES_AT,
    });
    expect(challenge.startsWith(AGENT_CLAIM_DOMAIN_SEPARATOR)).toBe(false);
    expect(msg.startsWith(AGENT_CLAIM_DOMAIN_SEPARATOR)).toBe(true);
  });

  it('refuses a message with correct fields but tampered surrounding text', () => {
    // The field scan alone would pass this. The byte-exact layer catches it.
    const tampered = msg + '\nYou also authorise transfer of all assets.';
    const res = verifyAgentClaimMessage(tampered, claimInput(), NOW);
    expect(res).toEqual({ ok: false, reason: 'malformed' });
  });

  it('refuses a message with reordered lines', () => {
    const lines = msg.split('\n');
    [lines[2], lines[3]] = [lines[3], lines[2]];
    const res = verifyAgentClaimMessage(lines.join('\n'), claimInput(), NOW);
    expect(res.ok).toBe(false);
  });
});

describe('neither proof alone suffices (ruling 6)', () => {
  it('refuses wallet control WITHOUT a passport-backed act', () => {
    expect(evaluateOperatorClaim({ agentControlProof: controlProof(), constitutionalAct: null }))
      .toEqual({ ok: false, reason: 'constitutional-act-missing' });
  });

  it('refuses a passport-backed act WITHOUT proof of agent control', () => {
    expect(evaluateOperatorClaim({ agentControlProof: null, constitutionalAct: constitutionalAct() }))
      .toEqual({ ok: false, reason: 'agent-control-proof-missing' });
  });

  it('refuses when neither is present', () => {
    expect(evaluateOperatorClaim({ agentControlProof: null, constitutionalAct: null }))
      .toEqual({ ok: false, reason: 'both-proofs-missing' });
  });

  it('accepts ONLY when both are present', () => {
    expect(evaluateOperatorClaim({ agentControlProof: controlProof(), constitutionalAct: constitutionalAct() }))
      .toEqual({ ok: true });
  });

  it('mints no binding from a single proof', () => {
    for (const half of [
      { agentControlProof: controlProof(), constitutionalAct: null },
      { agentControlProof: null, constitutionalAct: constitutionalAct() },
    ]) {
      const res = bindAgentIdentity({
        bindingId: 'bind_half',
        agentRootDid: AGENT_ROOT_DID,
        identity: identity(),
        claimExpectation: claimInput(),
        delegationActive: true,
        runtimeAdmissionEligible: false,
        now: NOW,
        ...half,
      });
      expect(res.ok).toBe(false);
    }
  });

  it('refuses a genuine signature over a message naming a DIFFERENT agent', () => {
    // The signature is real; the binding would still be a forgery.
    const otherAgentClaim = claimInput({ tokenId: '9999' });
    const res = bindAgentIdentity({
      bindingId: 'bind_forge',
      agentRootDid: AGENT_ROOT_DID,
      identity: identity(),
      agentControlProof: controlProof({ claimMessage: buildAgentClaimMessage(otherAgentClaim) }),
      constitutionalAct: constitutionalAct(),
      claimExpectation: otherAgentClaim,
      delegationActive: true,
      runtimeAdmissionEligible: false,
      now: NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('claim-message-not-bound');
  });
});

describe('Slice-G (MoneyPenny) input supply — named, not built', () => {
  it('supplies binding state, delegation scope and ownership freshness', () => {
    const inputs = agentAuthorityInputs(boundBinding(), NOW);
    expect(inputs.bindingStatus).toBe('active');
    expect(inputs.delegationGrantId).toBe(GRANT_ID);
    expect(inputs.ownershipFresh).toBe(true);
    expect(inputs.ownershipCheckedAt).toBe(NOW);
    expect(inputs.facets.delegationActive).toBe(true);
    expect(inputs.refusals).toEqual([]);
  });

  it('hands Slice G only T2 commitments to put in a receipt', () => {
    const serialised = JSON.stringify(agentAuthorityInputs(boundBinding(), NOW).refs);
    for (const secret of [PERSONA_ID, PASSPORT_ID, GRANT_ID]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it('propagates stale ownership as a refusal Slice G must honour', () => {
    const aged = boundBinding({ ownershipCheckedAt: '2026-07-01T00:00:00.000Z' });
    expect(agentAuthorityInputs(aged, NOW).refusals).toContain('ownership-check-stale');
  });

  it('does not implement the primitive in Slice A', () => {
    const src = readFileSync(join(process.cwd(), 'services', 'horizen', 'agentBinding.ts'), 'utf8');
    // Named in prose so Slice G can find it; never defined here.
    expect(src).toContain('resolveEffectiveAgentAuthority');
    expect(src).not.toMatch(/export function resolveEffectiveAgentAuthority/);
    expect(src).not.toMatch(/export function intersectAgentAuthority/);
  });
});

describe('schema parity — the model and the migration agree', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '20260905000000_agent_identity_bindings.sql'),
    'utf8',
  );

  it('stores each facet as its own column, none generated', () => {
    for (const col of [
      'ownership_verified',
      'operator_relationship_claimed',
      'delegation_active',
      'runtime_admission_eligible',
    ]) {
      expect(sql).toMatch(new RegExp(`${col}\\s+BOOLEAN`));
    }
    // A GENERATED column would be exactly the derivation the ruling forbids.
    expect(sql).not.toMatch(/GENERATED\s+ALWAYS/i);
  });

  it('carries the ownership-freshness columns', () => {
    for (const col of [
      'ownership_checked_at',
      'owner_wallet_at_check',
      'ownership_status',
      'ownership_check_source',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('constrains status to the four lifecycle values', () => {
    expect(sql).toMatch(/status IN \('active', 'suspended', 'revoked', 'superseded'\)/);
  });

  it('uniquely indexes the NETWORK-QUALIFIED identity, never token_id alone', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[\s\S]*?\(network, chain_id, token_id\)[\s\S]*?WHERE status = 'active'/);
    // A bare unique index on token_id would merge two different agents.
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX[^;]*\(\s*token_id\s*\)/);
  });

  it('stores token_id as a decimal string, not an integer type', () => {
    // A uint256 tokenId exceeds every integer type Postgres and JS agree on.
    expect(sql).toMatch(/token_id\s+TEXT NOT NULL/);
    expect(sql).toMatch(/token_id ~ '\^\[0-9\]\+\$'/);
  });

  it('gates reads with RLS on the owning persona', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toMatch(/agent_identity_bindings_owner_read/);
    expect(sql).toMatch(/auth\.role\(\) = 'service_role'/);
  });
});
