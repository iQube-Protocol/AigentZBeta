/**
 * The joined evidence chain — Slice B canaries.
 *
 * Operator ruling, 2026-07-28: surface
 *
 *   Horizen agent identity + Horizen proof/validation + DVN ingestion receipt
 *     + passport-backed delegation  →  Attributable constitutional evidence
 *
 * in the Partner Workspace, and *"the UI should not expose raw T2 identifiers.
 * It should show safe status and commitments."*
 *
 * FIVE properties this file exists to fail on, each one a defect that would
 * otherwise ship looking correct:
 *
 *  1. A raw identifier reaching the screen — T0 (persona/passport/grant/agent
 *     DID) OR the four T2 commitment strings, which are receipt-safe but are
 *     NOT screen-safe under this ruling.
 *  2. The client re-deriving a status the server already decided. A second
 *     implementation of `isStandingEligible` or of the four independent
 *     authority facets is free to drift from the first (inv.engineering.036/037)
 *     — and it drifts silently, because both render plausible words.
 *  3. "ineligible" with no reason — the Terminal Outcome defect: an outcome the
 *     operator can only diagnose from a SQL console is unobservable.
 *  4. `unbound` and `binding_unresolvable` rendering alike. "We looked and found
 *     none" and "we could not look" are different facts; collapsing them lets an
 *     unreadable store publish a factual claim about a partner's agent.
 *  5. The surface being unreachable. Denial canaries prove exclusion, never
 *     availability (Composed Liveness corollary 6) — so the reachability block
 *     drives the REAL tab filter and asserts EXACT sets.
 */

import { describe, it, expect } from 'vitest';

import { normalizeAgentIdentity, type HorizenAgentIdentity } from '@/services/horizen/identity';
import {
  bindAgentIdentity,
  buildAgentClaimMessage,
  currentIdentityRegistry,
  resolveBinding,
  AGENT_CLAIM_PURPOSE,
  type AgentClaimMessageInput,
  type AgentIdentityBinding,
  type BindingResolution,
} from '@/services/horizen/agentBinding';
import { buildHorizenEvidence, type HorizenEvidenceRecord } from '@/services/horizen/evidence';
import type { HorizenAgentRecord } from '@/services/horizen/correlate';
import {
  projectEvidenceChain,
  bindingAvailability,
  CHAIN_LINK_IDS,
  MAX_CORRELATION_NOTES,
  type ChainLink,
  type EvidenceChainView,
  type ReceiptAnchor,
} from '@/services/horizen/evidenceChain';
import { personaPublicRef, constitutionalRef } from '@/services/identity/personaReferences';
import { readSource, stripComments } from './_lib/sourceAuthority';

// ─── Fixtures ──────────────────────────────────────────────────────────────

/** T0 values — none may reach the projected view or the component source. */
const PERSONA_ID = '2e859489-1f4a-4c7e-9b31-0a7d6c5e4f28';
const PASSPORT_ID = 'pp_9f8e7d6c5b4a39281706';
const GRANT_ID = 'grant_5a4b3c2d1e0f';
const AGENT_ROOT_DID = 'did:metame:agent:7f6e5d4c3b2a';
const OWNER = '0x9d911c43f9b14eaf3969cb2c44ff4dd69e1f497d';

const NOW = '2026-07-28T12:01:00.000Z';
const NONCE = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';

/** The four T2 commitments the bound fixture derives — receipt-safe, and under
 *  this ruling still forbidden on screen. Computed, never hard-coded, so a
 *  change to the derivation cannot leave this canary checking a stale string. */
const REFS = [
  personaPublicRef(PERSONA_ID),
  constitutionalRef('passport', PASSPORT_ID),
  constitutionalRef('delegation', GRANT_ID),
  constitutionalRef('agent-binding', 'bind_0001'),
];

function identity(): HorizenAgentIdentity {
  const r = normalizeAgentIdentity({ agentId: '0x1eba', network: 'base-sepolia', source: 'on-chain' });
  if (!r.ok) throw new Error('fixture identity failed to normalise');
  return r.identity;
}

function claimInput(): AgentClaimMessageInput {
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
    issuedAt: '2026-07-28T12:00:00.000Z',
    expiresAt: '2026-07-28T12:10:00.000Z',
  };
}

function boundBinding(over: Partial<AgentIdentityBinding> = {}): AgentIdentityBinding {
  const res = bindAgentIdentity({
    bindingId: 'bind_0001',
    agentRootDid: AGENT_ROOT_DID,
    identity: identity(),
    agentControlProof: {
      ownerAddress: OWNER,
      ownerObservation: 'registry_read',
      claimMessage: buildAgentClaimMessage(claimInput()),
      nonce: NONCE,
      signatureCommitment: 'a'.repeat(64),
      verifiedAt: NOW,
    },
    constitutionalAct: {
      personaId: PERSONA_ID,
      passportId: PASSPORT_ID,
      delegationGrantId: GRANT_ID,
      claimedRelationship: true,
      acceptedResponsibility: true,
      scopeDefined: true,
      actedAt: NOW,
      receiptId: null,
    },
    claimExpectation: claimInput(),
    delegationActive: true,
    runtimeAdmissionEligible: true,
    now: NOW,
  });
  if (!res.ok) throw new Error(`fixture bind failed: ${res.reason}`);
  return { ...res.binding, ...over };
}

/** A correlated record with a gateway-attested validation and an SLA proof. */
function agentRecord(over: Partial<HorizenAgentRecord> = {}): HorizenAgentRecord {
  return {
    identity: identity(),
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
    ...over,
  };
}

function evidenceFor(
  bindings: AgentIdentityBinding[] | null,
  record: HorizenAgentRecord = agentRecord(),
): { evidence: HorizenEvidenceRecord; binding: BindingResolution } {
  const binding = resolveBinding({ identity: identity(), bindings, at: NOW });
  return {
    binding,
    evidence: buildHorizenEvidence(record, NOW, { binding, ingestedAt: NOW }),
  };
}

function chainFor(
  bindings: AgentIdentityBinding[] | null,
  receiptAnchor: ReceiptAnchor = { kind: 'none' },
  record: HorizenAgentRecord = agentRecord(),
): EvidenceChainView {
  const { evidence, binding } = evidenceFor(bindings, record);
  return projectEvidenceChain({ evidence, binding, receiptAnchor });
}

function link(view: EvidenceChainView, id: ChainLink['id']): ChainLink {
  const l = view.links.find((x) => x.id === id);
  if (!l) throw new Error(`link ${id} missing from the projection`);
  return l;
}

const TAB_SOURCE = 'app/triad/components/codex/tabs/PartnerProgrammesTab.tsx';
const ROUTE_SOURCE = 'app/api/venture/workspace/[workspaceId]/evidence-chain/route.ts';

// ─── 1. The chain is complete and ordered as the ruling states it ───────────

describe('the joined chain surfaces every element the ruling enumerates', () => {
  it('projects exactly the seven links, in the ruling’s order', () => {
    const view = chainFor([boundBinding()]);
    expect(view.links.map((l) => l.id)).toEqual([...CHAIN_LINK_IDS]);
    // The operator's own vocabulary, so the demo reads as specified rather
    // than as whatever words a refactor happened to leave behind.
    expect(view.links.map((l) => l.label)).toEqual([
      'Agent identity',
      'Operator relationship',
      'Passport backing',
      'Delegation',
      'Authority scope',
      'Horizen proof',
      'DVN receipt',
    ]);
  });

  it('every link carries a status, a state and a non-empty reason — in EVERY binding state', () => {
    const cases: Array<AgentIdentityBinding[] | null> = [
      [boundBinding()],
      [],
      null,
      [boundBinding({ status: 'revoked', statusReason: 'holder revoked the binding' })],
      [boundBinding({ status: 'suspended', statusReason: 'owner changed' })],
    ];
    for (const bindings of cases) {
      const view = chainFor(bindings);
      for (const l of view.links) {
        expect(l.status.length, `${l.id} rendered an empty status`).toBeGreaterThan(0);
        expect(['affirmed', 'negative', 'indeterminate']).toContain(l.state);
        expect(l.detail.length, `${l.id} rendered a status with no reason`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 2. COMPOSED LIVENESS — the chain can actually be fully affirmed ────────
//
// Every other block below is a NEGATIVE or a DISTINCTION. A projection that
// returned `indeterminate` for everything would satisfy all of them and still
// be useless — the same gap Invariant B names, one layer down from the access
// gates. This is the demonstrated end-to-end path.

describe('composed liveness — a fully bound, validated, anchored agent affirms every link', () => {
  it('affirms all seven links and reports Standing eligible', () => {
    const view = chainFor([boundBinding()], { kind: 'read', receiptStatus: 'dvn_recorded' });
    const notAffirmed = view.links.filter((l) => l.state !== 'affirmed').map((l) => `${l.id}=${l.status}`);
    expect(notAffirmed, 'the chain admits nobody — no configuration reaches a full affirmation').toEqual([]);
    expect(view.links.map((l) => l.status)).toEqual([
      'verified',
      'claimed',
      'confirmed',
      'active',
      'present',
      'validated',
      'recorded',
    ]);
    expect(view.standing.eligible).toBe(true);
    expect(view.standing.status).toBe('eligible');
    expect(view.standing.reasonCode).toBe('constitutionally-bound');
    expect(view.bindingState).toBe('constitutionally_bound');
    // The chain's own Horizen half is demonstrable to the partner: their public
    // proof identifiers survive the projection.
    expect(view.proof.zkVerifyAttestationId).toBe('51708');
    expect(view.proof.adapterTxHash).toBe('0x9a07d6df');
    expect(view.proof.gatewayAttested).toBe(true);
    expect(view.agent.tokenId).toBe('7866');
    expect(view.agent.registryAlias).toBe('0x1eba');
  });

  it('all four commitments are HELD (presence true) exactly when the binding is in force', () => {
    const bound = chainFor([boundBinding()]);
    expect(bound.commitments).toEqual({
      principal: true,
      passport: true,
      delegation: true,
      agentBinding: true,
    });
    const unbound = chainFor([]);
    expect(unbound.commitments).toEqual({
      principal: false,
      passport: false,
      delegation: false,
      agentBinding: false,
    });
  });
});

// ─── 3. NO RAW IDENTIFIER — T0 or T2 — REACHES THE SCREEN ──────────────────

describe('the rendered object exposes no raw identifier of any tier', () => {
  const ALL_STATES: Array<AgentIdentityBinding[] | null> = [
    [boundBinding()],
    [],
    null,
    [boundBinding({ status: 'revoked', statusReason: 'holder revoked' })],
    [boundBinding({ status: 'suspended', statusReason: 'owner changed' })],
  ];

  it('leaks no T0 value in any binding state', () => {
    for (const bindings of ALL_STATES) {
      const view = chainFor(bindings, { kind: 'read', receiptStatus: 'dvn_recorded' });
      const serialised = JSON.stringify(view);
      for (const secret of [PERSONA_ID, PASSPORT_ID, GRANT_ID, AGENT_ROOT_DID]) {
        expect(serialised, `raw T0 value ${secret} reached the screen (${view.bindingState})`).not.toContain(secret);
      }
    }
  });

  it('leaks no T2 COMMITMENT either — the ruling withholds the refs, not just the ids', () => {
    // This is the assertion that distinguishes Slice B's rule from Slice A's.
    // The four refs are receipt-safe; the operator's ruling is that the UI
    // shows status derived from them, so a projection that passed them through
    // would be Slice-A-correct and Slice-B-wrong.
    for (const bindings of ALL_STATES) {
      const serialised = JSON.stringify(chainFor(bindings));
      for (const ref of REFS) {
        expect(ref).toMatch(/^[0-9a-f]{16}$/); // the fixture really is a commitment
        expect(serialised, `T2 commitment ${ref} was rendered`).not.toContain(ref);
      }
    }
  });

  it('declares no ref-shaped or T0-named key anywhere in the view', () => {
    const forbiddenKey = /Ref$|personaId|authProfileId|rootDid|passportId|grantId|agentRootDid|kybeAttestation|validatorAddress/i;
    const offenders: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (forbiddenKey.test(k)) offenders.push(`${path}.${k}`);
          walk(v, `${path}.${k}`);
        }
      }
    };
    for (const bindings of ALL_STATES) walk(chainFor(bindings), 'view');
    expect(offenders).toEqual([]);
  });

  it('the SURFACE names no identifier field either — the screen cannot render what it never reads', () => {
    const src = stripComments(readSource(TAB_SOURCE));
    for (const field of ['principalRef', 'passportRef', 'delegationRef', 'agentBindingRef', 'validatorAddress', 'personaId:']) {
      // `personaId:` (with the colon) targets an object field read, not the
      // component's own `personaId` prop, which is legitimate and required.
      expect(src, `${TAB_SOURCE} reads ${field} — the refs are withheld from this surface`).not.toContain(field);
    }
  });
});

// ─── 4. NO CLIENT-SIDE RE-DERIVATION ───────────────────────────────────────

describe('every status is decided server-side and rendered, never recomputed on the client', () => {
  it('the surface never names a facet, a gate, or a binding-state comparison', () => {
    const src = stripComments(readSource(TAB_SOURCE));
    // The four INDEPENDENT authority facets. A client that read one would be
    // re-deriving a status the projection already decided — and, worse, could
    // infer one facet from another, which Slice A forbids outright.
    for (const facet of [
      'ownershipVerified',
      'operatorRelationshipClaimed',
      'delegationActive',
      'runtimeAdmissionEligible',
    ]) {
      expect(src, `${TAB_SOURCE} reads the ${facet} facet directly`).not.toContain(facet);
    }
    for (const gate of ['isStandingEligible', 'resolveBinding', 'evaluateNewActionAuthority', 'bindingAvailability']) {
      expect(src, `${TAB_SOURCE} calls ${gate} — the gate has two implementations`).not.toContain(gate);
    }
    // A branch on the binding state IS a re-derivation: it decides what the
    // state means. The surface renders `bindingState` as a word and branches
    // only on the server-supplied three-valued `state`.
    expect(src).not.toMatch(/bindingState\s*===/);
    expect(src).not.toMatch(/constitutionally_bound|binding_unresolvable|binding_revoked/);
    expect(src).not.toMatch(/standing\.eligible\s*\?/);
  });

  it('the surface imports the view TYPE only — no server module enters the bundle', () => {
    const raw = readSource(TAB_SOURCE);
    const chainImport = raw.match(/^import\s+(type\s+)?\{[^}]*\}\s+from\s+"@\/services\/horizen\/evidenceChain";$/m);
    expect(chainImport, 'the surface does not import the view shape from its single source').toBeTruthy();
    expect(chainImport![1], 'the evidenceChain import is a VALUE import — server code would enter the client bundle').toBe('type ');
    const src = stripComments(raw);
    expect(src).not.toMatch(/from "@\/services\/horizen\/(evidence|agentBinding|correlate|client)"/);
  });

  it('the projection is the ONE place standing eligibility is decided for this surface', () => {
    // Behavioural, not structural: whatever the projection says must equal what
    // the evidence record already derived. Two sources here would drift.
    for (const bindings of [[boundBinding()], [], null, [boundBinding({ status: 'revoked' })]] as Array<AgentIdentityBinding[] | null>) {
      const { evidence, binding } = evidenceFor(bindings);
      const view = projectEvidenceChain({ evidence, binding, receiptAnchor: { kind: 'none' } });
      expect(view.standing.eligible).toBe(evidence.standingEligible);
      expect(view.standing.status).toBe(evidence.standingEligible ? 'eligible' : 'ineligible');
    }
  });

  it('each link reads its OWN fact — no facet is inferred from another', () => {
    // THE MUTATION THIS EXISTS FOR (found escaping every other canary in this
    // file, 2026-07-28): a link that reads a NEIGHBOURING facet still produces
    // a plausible word for every state, so nothing above notices. Slice A's
    // ruling is that the four facets are INDEPENDENT and none may imply
    // another; a projection that inferred "operator relationship claimed" from
    // "delegation active" would reintroduce exactly the compression the
    // operator refused, and would do it invisibly.
    //
    // Demonstrated by INDEPENDENCE, not by re-stating the mapping: flip one
    // fact, assert exactly one link moves.
    const bound = boundBinding();
    const cases: Array<[string, AgentIdentityBinding, ChainLink['id']]> = [
      ['ownershipVerified', { ...bound, facets: { ...bound.facets, ownershipVerified: false } }, 'agent-identity'],
      ['operatorRelationshipClaimed', { ...bound, facets: { ...bound.facets, operatorRelationshipClaimed: false } }, 'operator-relationship'],
      ['delegationActive', { ...bound, facets: { ...bound.facets, delegationActive: false } }, 'delegation'],
      ['scopeDefined', { ...bound, constitutionalAct: { ...bound.constitutionalAct, scopeDefined: false } }, 'authority-scope'],
    ];
    const baseline = chainFor([bound], { kind: 'read', receiptStatus: 'dvn_recorded' });
    for (const [fact, mutated, expectedLink] of cases) {
      const view = chainFor([mutated], { kind: 'read', receiptStatus: 'dvn_recorded' });
      const moved = view.links
        .filter((l) => l.state !== baseline.links.find((b) => b.id === l.id)!.state)
        .map((l) => l.id);
      expect(moved, `flipping ${fact} moved the wrong link(s)`).toEqual([expectedLink]);
      expect(link(view, expectedLink).state).toBe('negative');
    }

    // `runtimeAdmissionEligible` is the fourth facet and belongs to the
    // Financial Services Runtime (Slice G) — it is NOT part of this chain.
    // Folding it in would make the workspace refuse to affirm a perfectly
    // bound agent that simply has not been admitted to the FSR.
    const notAdmitted = chainFor(
      [{ ...bound, facets: { ...bound.facets, runtimeAdmissionEligible: false } }],
      { kind: 'read', receiptStatus: 'dvn_recorded' },
    );
    expect(notAdmitted.links.map((l) => l.state)).toEqual(baseline.links.map((l) => l.state));
    expect(notAdmitted.standing.eligible).toBe(true);
  });

  it('the projection never re-implements the eligibility rule', () => {
    // Structural backstop for the case above: a second `state === "constitutionally_bound"`
    // in the projection would agree with the evidence record TODAY and diverge
    // the day either side changes.
    const src = stripComments(readSource('services/horizen/evidenceChain.ts'));
    expect(src).not.toContain('isStandingEligible');
    const eligibleAssignments = [...src.matchAll(/\beligible:\s*([^,\n]+)/g)]
      .map((m) => m[1].trim())
      // Drop the interface declaration (`eligible: boolean;`) — this asserts
      // what the field is ASSIGNED FROM, not what it is typed as.
      .filter((v) => !/^(boolean|string|number)\b/.test(v));
    expect(eligibleAssignments).toEqual(['evidence.standingEligible']);
  });
});

// ─── 5. INELIGIBILITY ALWAYS CARRIES ITS REASON ────────────────────────────

describe('standing ineligibility is never a bare verdict', () => {
  it('every ineligible state carries a reason code AND the resolution’s own reason', () => {
    const cases: Array<[AgentIdentityBinding[] | null, string]> = [
      [[], 'no-constitutional-binding'],
      [null, 'binding-unresolvable'],
      [[boundBinding({ status: 'revoked', statusReason: 'holder revoked the binding' })], 'binding-revoked'],
      [[boundBinding({ status: 'suspended', statusReason: 'owner changed at 2026-07-28' })], 'binding-unresolvable'],
    ];
    for (const [bindings, code] of cases) {
      const { evidence, binding } = evidenceFor(bindings);
      const view = projectEvidenceChain({ evidence, binding, receiptAnchor: { kind: 'none' } });
      expect(view.standing.eligible).toBe(false);
      expect(view.standing.status).toBe('ineligible');
      expect(view.standing.reasonCode).toBe(code);
      expect(view.standing.reason.length, `${code} rendered ineligible with no reason`).toBeGreaterThan(0);
      // THE REASON COMES FROM THE RESOLUTION, not from prose beside the badge.
      // Prose written next to a verdict stops describing it the moment either
      // changes; this ties them together structurally.
      expect(view.standing.reason).toBe(binding.reason);
    }
  });

  it('the eligible state also states WHY, so the field is never conditionally populated', () => {
    const view = chainFor([boundBinding()]);
    expect(view.standing.eligible).toBe(true);
    expect(view.standing.reason.length).toBeGreaterThan(0);
  });

  it('the surface renders the reason, not a bare status word', () => {
    const src = stripComments(readSource(TAB_SOURCE));
    expect(src).toContain('standing.reason');
    expect(src).toContain('standing.reasonCode');
  });
});

// ─── 6. `unbound` AND `binding_unresolvable` MUST NOT RENDER ALIKE ─────────

describe('“we looked and found none” never renders as “we could not look”', () => {
  it('the two states differ in reason code, in link state, and in every constitutional link', () => {
    const unbound = chainFor([]);
    const unresolvable = chainFor(null);

    expect(unbound.bindingState).toBe('unbound');
    expect(unresolvable.bindingState).toBe('binding_unresolvable');
    expect(unbound.standing.reasonCode).not.toBe(unresolvable.standing.reasonCode);
    expect(unbound.standing.reason).not.toBe(unresolvable.standing.reason);

    // The five constitutional links: unbound asserts a FACT (negative);
    // unresolvable admits IGNORANCE (indeterminate). Same badge for both is
    // the defect.
    const constitutional: ChainLink['id'][] = [
      'agent-identity',
      'operator-relationship',
      'passport-backing',
      'delegation',
      'authority-scope',
    ];
    for (const id of constitutional) {
      expect(link(unbound, id).state, `${id} lost the unbound/unresolvable distinction`).toBe('negative');
      expect(link(unresolvable, id).state, `${id} lost the unbound/unresolvable distinction`).toBe('indeterminate');
      expect(link(unbound, id).status).not.toBe(link(unresolvable, id).status);
    }
  });

  it('a SUSPENDED binding is unresolvable-with-a-record, not unbound and not silently affirmed', () => {
    // The subtle third case: a record EXISTS, so the facets are readable, and
    // the honest projection reads them rather than falling back to "unknown".
    // What must not happen is it rendering as `unbound` (no record) — the
    // suspension is knowledge.
    const suspended = chainFor([boundBinding({ status: 'suspended', statusReason: 'owner changed' })]);
    expect(suspended.bindingState).toBe('binding_unresolvable');
    expect(suspended.standing.eligible).toBe(false);
    expect(bindingAvailability(resolveBinding({ identity: identity(), bindings: [boundBinding({ status: 'suspended' })], at: NOW })).kind)
      .toBe('binding');
    // …and it is distinguishable from the store-unreadable case, which has no
    // record to read facets from.
    expect(link(suspended, 'operator-relationship').state).not.toBe(
      link(chainFor(null), 'operator-relationship').state,
    );
  });

  it('an UNBOUND agent renders fully and does not read as an error', () => {
    // Ruling 2: unbound is valid external evidence. Its Horizen half must be
    // complete, and its constitutional half must explain itself.
    const view = chainFor([]);
    expect(view.agent.tokenId).toBe('7866');
    expect(view.agent.identityClass).toBe('on-chain');
    expect(link(view, 'horizen-proof').state).toBe('affirmed');
    expect(view.standing.reasonCode).toBe('no-constitutional-binding');
    for (const id of ['agent-identity', 'operator-relationship', 'passport-backing', 'delegation', 'authority-scope'] as ChainLink['id'][]) {
      expect(link(view, id).detail).toContain('no constitutional binding');
      expect(link(view, id).detail).toContain('valid external evidence');
    }
    // The surface paints `negative` neutral slate, never rose — an unbound
    // agent is a fact, not a failure.
    const src = stripComments(readSource(TAB_SOURCE));
    const tone = src.match(/const CHAIN_TONE[^;]+;/s);
    expect(tone, 'the tone map disappeared').toBeTruthy();
    expect(tone![0]).not.toMatch(/negative:\s*"[^"]*rose/);
    expect(tone![0]).toMatch(/negative:\s*"[^"]*slate/);
  });
});

// ─── 7. THE HORIZEN AND DVN HALVES ARE JUDGED HONESTLY ─────────────────────

describe('partner proof and DVN anchoring report what is known, and no more', () => {
  it('a validation that did not come through the gateway is indeterminate, not validated', () => {
    const selfReported = agentRecord({
      validations: {
        present: true,
        value: [{ id: 'v1', status: 'validated', tag: 'pulse-sla', timestamp: NOW, validatorAddress: null, zkTxHash: null, zkBlockHash: null, allAssertionsPassed: null }],
      },
    });
    const view = chainFor([boundBinding()], { kind: 'none' }, selfReported);
    expect(link(view, 'horizen-proof').state).toBe('indeterminate');
    expect(link(view, 'horizen-proof').status).toBe('self-reported');
  });

  it('no validation at all is a fact about the agent, and says so', () => {
    const none = agentRecord({ validations: { present: false, reason: 'not-found', detail: 'none' } });
    const view = chainFor([boundBinding()], { kind: 'none' }, none);
    expect(link(view, 'horizen-proof').status).toBe('unvalidated');
    expect(link(view, 'horizen-proof').detail).toContain('§9');
  });

  it('the DVN link separates “no receipt”, “could not read”, “pending”, “anchored” and “failed”', () => {
    const anchors: Array<[ReceiptAnchor, string, ChainLink['state']]> = [
      [{ kind: 'none' }, 'not-recorded', 'negative'],
      [{ kind: 'unreadable', detail: 'store unreadable' }, 'unknown', 'indeterminate'],
      [{ kind: 'read', receiptStatus: 'local' }, 'pending', 'indeterminate'],
      [{ kind: 'read', receiptStatus: 'dvn_pending' }, 'pending', 'indeterminate'],
      [{ kind: 'read', receiptStatus: 'dvn_recorded' }, 'recorded', 'affirmed'],
      [{ kind: 'read', receiptStatus: 'dvn_failed' }, 'anchor-failed', 'negative'],
    ];
    const seen = new Set<string>();
    for (const [anchor, status, state] of anchors) {
      const l = link(chainFor([boundBinding()], anchor), 'dvn-receipt');
      expect(l.status).toBe(status);
      expect(l.state).toBe(state);
      seen.add(`${l.status}/${l.state}`);
    }
    // Five distinct renderings from six inputs (both pending statuses share
    // one) — proof the five situations have not been collapsed into two.
    expect(seen.size).toBe(5);
  });
});

// ─── 8. BOUNDED PAYLOAD ────────────────────────────────────────────────────

describe('the payload cannot grow with the data (the 413 discipline)', () => {
  it('caps correlation notes and carries no card body or evidence prose', () => {
    const noisy = agentRecord({
      correlationVerified: false,
      correlationNotes: Array.from({ length: 40 }, (_, i) => `note ${i}`),
      registry: {
        ...agentRecord().registry,
        card: { status: 'parsed', scheme: 'https', card: { name: 'x', description: 'y'.repeat(5000) } } as HorizenAgentRecord['registry']['card'],
      },
    });
    const view = chainFor([boundBinding()], { kind: 'none' }, noisy);
    expect(view.agent.correlationNotes.length).toBe(MAX_CORRELATION_NOTES);
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain('y'.repeat(100));
    // The card enters as a STATUS, never as content or as its commitment.
    expect(view.agent.agentCardStatus).toBe('parsed');
    expect(serialised.length, 'the projected view is no longer a bounded object').toBeLessThan(12_000);
  });
});

// ─── 9. THE ROUTE IS GATED BY THE EXISTING SPINE, NOT A BESPOKE CHECK ──────

describe('the serving route reuses the participation gate rather than inventing one', () => {
  it('authenticates through the spine and scopes to THIS workspace', () => {
    const src = stripComments(readSource(ROUTE_SOURCE));
    expect(src).toMatch(/getActivePersona\(/);
    expect(src).toMatch(
      /satisfiesWorkspaceScope\(\s*\{[^}]*grants[^}]*\},\s*ws\.participation\.domain,\s*ws\.id,\s*isAdmin,?\s*\)/s,
    );
    // Membership resolved through the SAME self-view resolver the sibling
    // route and /api/participation/my-access use — one answer to "is this
    // caller a member", not two.
    expect(src).toMatch(/resolveParticipationSelfView\(/);
    // No parallel admin allowlist, no domain-only shortcut.
    expect(src).not.toMatch(/allowedScopes\s*\?\?\s*\[\]/);
  });

  it('never converts an unreadable binding store into the claim “unbound”', () => {
    // `readAgentIdentityBindings` returns null for "could not read" and [] for
    // "read, none". A `?? []` in the route would erase the distinction the
    // whole four-state model rests on — and would do it invisibly.
    const src = stripComments(readSource(ROUTE_SOURCE));
    expect(src).toMatch(/readAgentIdentityBindings\(/);
    expect(src).not.toMatch(/readAgentIdentityBindings\([^)]*\)\s*\?\?\s*\[\]/);
    expect(src).not.toMatch(/bindings\s*(:|=)\s*[^;]*\?\?\s*\[\]/);
  });

  it('returns statuses, not stored bodies', () => {
    const src = stripComments(readSource(ROUTE_SOURCE));
    expect(src).toMatch(/projectEvidenceChain\(/);
    // The correlated record and the evidence record both carry more than the
    // view does; returning either directly is the 413 defect.
    expect(src).not.toMatch(/chains?:\s*.*\brecord\b/);
    expect(src).not.toMatch(/NextResponse\.json\([^)]*\bevidence\b/s);
  });
});

// ─── 10. REACHABILITY — the surface is actually openable ───────────────────
//
// Composed Liveness corollary 6 (ratified 2026-07-28): denial canaries prove
// exclusion, never availability. Everything above would pass at its maximum if
// the Evidence surface were unreachable by every caller. This block drives the
// REAL tab filter with the REAL config and asserts EXACT sets.

describe('reachability — a granted partner operator can open the evidence chain', () => {
  const grantedPartnerOperator = {
    loaded: true as const,
    grants: [{ accessDomain: 'venture-lab', role: 'partner-operator', allowedScopes: ['horizen-pilot-series-001'] }],
  };

  it('the Evidence entrance survives getEnabledTabs, and the Tier-2 set is EXACTLY the four Tier-2 views', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const { getEnabledTabs } = await import('../app/hooks/useCodexConfig');
    const enabled = getEnabledTabs(
      VENTURE_LAB_CODEX,
      false, // isAdmin — nothing but the grant
      false,
      false,
      new Set(),
      { isGlobalAdmin: false, cartridgeSlugs: new Set() },
      grantedPartnerOperator,
    );
    const partnerSlugs = enabled.filter((t) => t.group === 'partner').map((t) => t.slug).sort();
    const expectedTier2 = VENTURE_LAB_CODEX.tabs
      .filter(
        (t: { group?: string; participationDomain?: string; adminOnly?: boolean }) =>
          t.group === 'partner' && t.participationDomain === 'venture-lab' && !t.adminOnly,
      )
      .map((t: { slug: string }) => t.slug)
      .sort();
    expect(partnerSlugs).toEqual(expectedTier2);
    expect(partnerSlugs, 'the Evidence entrance is not reachable — the chain has no door').toContain('partner-evidence');
  });

  it('that entrance mounts the workspace surface on the evidence sub-surface', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === 'partner-evidence') as
      | { config?: { component?: string; props?: Record<string, unknown> } }
      | undefined;
    expect(tab, 'the partner-evidence tab was removed').toBeTruthy();
    expect(tab!.config?.component).toBe('PartnerProgrammesTab');
    // The panel renders inside `surface === "evidence"`; a tab that opened any
    // other surface would leave the chain built and unreachable.
    expect(tab!.config?.props).toMatchObject({ initialSurface: 'evidence' });
  });

  it('the workspace behind that entrance declares the reference agents the chain needs', async () => {
    const { getPartnerWorkspace } = await import('../services/venture/partnerWorkspace');
    const { satisfiesWorkspaceScope } = await import('../services/passport/participationTabGate');
    // The same caller who passed the tab gate must also be scoped to the
    // workspace — passing the tab and finding an empty picker is the same
    // invisible surface from the operator's seat.
    expect(satisfiesWorkspaceScope(grantedPartnerOperator, 'venture-lab', 'horizen-pilot-series-001', false)).toBe(true);
    const ws = getPartnerWorkspace('horizen-pilot-series-001');
    expect(ws, 'the Horizen pilot left the registry').toBeTruthy();
    const agents = ws!.referenceAgents ?? [];
    expect(agents.length, 'the pilot declares no reference agent — the Evidence surface has nothing to join').toBeGreaterThan(0);
    for (const a of agents) {
      // Network-qualified ALWAYS (identity.ts §4.4): the same tokenId names
      // different agents on the two networks, so an alias-only entry is a
      // cross-network read waiting to happen.
      expect(['base-sepolia', 'base-mainnet']).toContain(a.network);
      expect(a.registryAlias.length).toBeGreaterThan(0);
      expect(normalizeAgentIdentity({ agentId: a.registryAlias, network: a.network }).ok).toBe(true);
    }
  });

  it('the surface mounts the panel on the evidence surface and fetches through the spine transport', () => {
    const src = stripComments(readSource(TAB_SOURCE));
    expect(src).toMatch(/surface === "evidence"[\s\S]{0,900}<EvidenceChainPanel/);
    // personaFetch WITH the hint — a raw fetch 401s, and a Bearer-only helper
    // silently resolves the wrong persona (CLAUDE.md, 2026-07-20 incident).
    expect(src).toMatch(/personaFetch\(\s*\n?\s*`\/api\/venture\/workspace\/\$\{encodeURIComponent\(workspaceId\)\}\/evidence-chain`/);
    expect(src).toMatch(/personaIdHint: personaId/);
    expect(src).not.toMatch(/authedFetchHeaders/);
  });
});

// ─── 11. HOUSE STYLE ───────────────────────────────────────────────────────

describe('canonical slate surface styling', () => {
  it('the new panel introduces no white hairline', () => {
    const src = stripComments(readSource(TAB_SOURCE));
    expect(src).not.toMatch(/border-white\//);
    expect(src).not.toMatch(/rgba\(255,\s*255,\s*255/);
  });
});

// ─── 12. Pulse and Verifiable PnL — two INDEPENDENT status cards (2026-08-07) ─

describe('pulseStatus — three states, never collapsed into pulseEnrolled alone', () => {
  it('not enrolled reads negative, and names it a valid agent state, not a defect', () => {
    const view = chainFor([boundBinding()], { kind: 'none' }, agentRecord({
      pulse: { present: false, reason: 'not-enrolled', detail: 'fixture' },
    }));
    expect(view.pulseStatus).toMatchObject({ label: 'Pulse monitoring', status: 'not enrolled', state: 'negative' });
    expect(view.pulseStatus.detail).toContain('not enrolled');
  });

  it('enrolled but commitment not recorded reads indeterminate, naming what it blocks (SLA proofs)', () => {
    const view = chainFor([boundBinding()], { kind: 'none' }, agentRecord({
      pulse: {
        present: true,
        value: { enrolled: true, commitmentRecorded: false, slaTarget: 99, uptimeCurrent: 100, totalChallenges: 0, slaProofs: [] },
      },
    }));
    expect(view.pulseStatus).toMatchObject({ status: 'commitment pending', state: 'indeterminate' });
    expect(view.pulseStatus.detail).toContain('SLA proofs cannot finalise');
  });

  it('enrolled AND commitment recorded — the exact Nakamoto case — reads affirmed', () => {
    // agentRecord()'s own default: enrolled:true, commitmentRecorded:true.
    const view = chainFor([boundBinding()]);
    expect(view.pulseStatus).toMatchObject({ status: 'enrolled', state: 'affirmed' });
    expect(view.agent.pulseEnrolled).toBe(true);
    expect(view.agent.pulseCommitmentRecorded).toBe(true);
  });
});

describe('verifiablePnlStatus — independent of Pulse, never derived from it', () => {
  it('no PnL correlation reads negative — the exact Nakamoto case (Pulse enrolled, PnL absent)', () => {
    // agentRecord()'s own default: pnl absent, pulse enrolled+committed.
    const view = chainFor([boundBinding()]);
    expect(view.pulseStatus.state).toBe('affirmed'); // Pulse is fine —
    expect(view.verifiablePnlStatus).toMatchObject({ label: 'Verifiable PnL', status: 'not registered', state: 'negative' }); // — and PnL is independently pending.
    // The text MAY explain the independence in prose (that is honest, helpful
    // framing) — what must never happen is the STATE/STATUS being derived
    // from Pulse's fields, which the dedicated test below pins directly.
    expect(view.verifiablePnlStatus.detail).toContain('independent of');
  });

  it('states plainly that producing a PnL record is a Horizen-side act with no registration action on this platform — never invents one', () => {
    const view = chainFor([boundBinding()]);
    expect(view.verifiablePnlStatus.detail).toContain('Horizen-side act');
    expect(view.verifiablePnlStatus.detail).toContain('no registration action');
  });

  it('a present PnL correlation reads affirmed and reports the partner\'s own status string verbatim, never re-interpreted', () => {
    const view = chainFor([boundBinding()], { kind: 'none' }, agentRecord({
      pnl: { present: true, value: { uuid: 'pnl-uuid-123', erc8004Chain: 'base-sepolia', status: 'active' } },
    }));
    expect(view.verifiablePnlStatus).toMatchObject({ status: 'active', state: 'affirmed' });
    expect(view.verifiablePnlStatus.detail).toContain('"active"');
  });

  it('a present PnL correlation with no partner status string still reads affirmed, honestly, without fabricating one', () => {
    const view = chainFor([boundBinding()], { kind: 'none' }, agentRecord({
      pnl: { present: true, value: { uuid: 'pnl-uuid-123', erc8004Chain: 'base-sepolia', status: null } },
    }));
    expect(view.verifiablePnlStatus.state).toBe('affirmed');
    expect(view.verifiablePnlStatus.status).toBe('registered');
  });

  it('is NEVER computed from pulseEnrolled/pulseCommitmentRecorded — an already-Pulse-enrolled agent with no PnL record still reads not registered', () => {
    const enrolledNoPnl = chainFor([boundBinding()]); // enrolled+committed, pnl absent, by agentRecord()'s defaults.
    expect(enrolledNoPnl.pulseStatus.state).toBe('affirmed');
    expect(enrolledNoPnl.verifiablePnlStatus.state).toBe('negative');
  });
});

describe('the panel renders both independent cards, never folding either into the ratified seven links', () => {
  it('pulseStatus and verifiablePnlStatus are not among the seven CHAIN_LINK_IDS', () => {
    const view = chainFor([boundBinding()]);
    const linkIds = view.links.map((l) => l.id);
    expect(linkIds).toEqual([...CHAIN_LINK_IDS]);
    expect(linkIds).toHaveLength(7);
  });

  it('the tab renders both status cards via the shared ChainStatus component, independently of the links grid', () => {
    const src = stripComments(readSource(TAB_SOURCE));
    expect(src).toMatch(/row\.chain\.pulseStatus\.label/);
    expect(src).toMatch(/row\.chain\.verifiablePnlStatus\.label/);
  });
});
