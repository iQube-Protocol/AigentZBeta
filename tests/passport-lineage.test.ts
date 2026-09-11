/**
 * Passport consolidation / lineage canaries — Amendment A §A.5
 * (ratified 2026-07-27).
 *
 * The charter-mandated canary leads: the lineage resolver can NEVER merge on
 * a matching email or display name. Two passports sharing both, carrying
 * different personhood proofs, MUST remain two lineages.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';
import {
  groupIntoLineages,
  canonicalOriginOf,
  reconcileLineage,
  planConsolidation,
  isOriginCandidate,
  type LineagePassportRecord,
} from '@/services/passport/passportLineage';

const SERVICE = 'services/passport/passportLineage.ts';

function member(overrides: Partial<LineagePassportRecord> & { id: string }): LineagePassportRecord {
  return {
    passportClass: 'citizen',
    citizenStatus: 'active',
    participantStatus: null,
    kybeIdentityId: null,
    worldIdNullifierHash: null,
    worldIdVerifiedAt: null,
    revoked: false,
    expiresAt: null,
    issuedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('THE charter canary — never merge on email or display name', () => {
  it('two passports sharing email + display name but different personhood proofs do NOT merge', () => {
    // Same mailbox, same label, different humans (different nullifiers,
    // different kybes). The extra fields are exactly what a naive matcher
    // would key on — the resolver must be structurally blind to them.
    const a = {
      ...member({ id: 'pp-a', kybeIdentityId: 'kybe-1', worldIdNullifierHash: '0xnullifier-one' }),
      email: 'family@example.com',
      displayName: 'A. Citizen',
    };
    const b = {
      ...member({ id: 'pp-b', kybeIdentityId: 'kybe-2', worldIdNullifierHash: '0xnullifier-two' }),
      email: 'family@example.com',
      displayName: 'A. Citizen',
    };
    const lineages = groupIntoLineages([a, b]);
    expect(lineages).toHaveLength(2);
  });

  it('two records with NO personhood key never merge — no evidence, no lineage', () => {
    const a = { ...member({ id: 'pp-a' }), email: 'same@example.com' };
    const b = { ...member({ id: 'pp-b' }), email: 'same@example.com' };
    expect(groupIntoLineages([a, b])).toHaveLength(2);
  });

  it('structurally: the lineage module never reads a contact or presentation field', () => {
    const code = stripComments(readSource(SERVICE));
    for (const forbidden of ['email', 'display_name', 'displayName', 'fio_handle']) {
      expect(code, `${SERVICE} touches ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('records merge on personhood evidence only — shared nullifier or shared kybe', () => {
    const verified = member({
      id: 'pp-verified',
      kybeIdentityId: 'kybe-1',
      worldIdNullifierHash: '0xn1',
      worldIdVerifiedAt: '2026-07-10T00:00:00.000Z',
    });
    const provisionalSameKybe = member({ id: 'pp-prov', kybeIdentityId: 'kybe-1' });
    const stranger = member({ id: 'pp-stranger', kybeIdentityId: 'kybe-9' });
    const lineages = groupIntoLineages([verified, provisionalSameKybe, stranger]);
    expect(lineages).toHaveLength(2);
    const big = lineages.find((l) => l.members.length === 2);
    expect(big?.members.map((m) => m.id).sort()).toEqual(['pp-prov', 'pp-verified']);
  });
});

describe('the deterministic origin rule', () => {
  const older = member({ id: 'pp-old', kybeIdentityId: 'k', createdAt: '2026-05-01T00:00:00.000Z' });
  const newer = member({ id: 'pp-new', kybeIdentityId: 'k', createdAt: '2026-07-01T00:00:00.000Z' });

  it('the EARLIEST valid passport is canonical by default', () => {
    const result = canonicalOriginOf({ members: [newer, older] });
    expect(result).toEqual({ ok: true, canonical: older });
  });

  it('an explicit citizen selection of another valid member wins', () => {
    const result = canonicalOriginOf({ members: [newer, older] }, 'pp-new');
    expect(result).toEqual({ ok: true, canonical: newer });
  });

  it('an explicit selection of an INVALID member is an error, never a silent fallback', () => {
    const revoked = member({ id: 'pp-revoked', kybeIdentityId: 'k', revoked: true });
    const result = canonicalOriginOf({ members: [older, revoked] }, 'pp-revoked');
    expect(result).toEqual({ ok: false, reason: 'invalid_selection' });
  });

  it('issuance date beats creation date when present, and the order is total', () => {
    const issuedEarly = member({
      id: 'pp-b',
      kybeIdentityId: 'k',
      createdAt: '2026-07-01T00:00:00.000Z',
      issuedAt: '2026-04-01T00:00:00.000Z',
    });
    const result = canonicalOriginOf({ members: [older, issuedEarly] });
    expect(result.ok && result.canonical.id).toBe('pp-b');
  });

  it('revoked, expired, non-active and non-citizen members are never origin candidates', () => {
    expect(isOriginCandidate(member({ id: 'x', revoked: true }))).toBe(false);
    expect(isOriginCandidate(member({ id: 'x', expiresAt: '2020-01-01T00:00:00.000Z' }))).toBe(false);
    expect(isOriginCandidate(member({ id: 'x', citizenStatus: 'dormant' }))).toBe(false);
    expect(
      isOriginCandidate(
        member({ id: 'x', passportClass: 'agent_participant', citizenStatus: null, participantStatus: 'approved' }),
      ),
    ).toBe(false);
    expect(isOriginCandidate(member({ id: 'x' }))).toBe(true);
  });
});

describe('reconciliation — no duplicated standing, no resurrected delegation', () => {
  it('standing collapses to ONE object with deduplicated restrictions', () => {
    const result = reconcileLineage(
      [
        { passportRecordId: 'pp-a', privilegeStatus: 'full_privileges', activeRestrictions: ['r1'] },
        { passportRecordId: 'pp-b', privilegeStatus: 'restricted', activeRestrictions: ['r1', 'r2'] },
      ],
      [],
    );
    expect(result.standing).toEqual({
      privilegeStatus: 'restricted',
      activeRestrictions: ['r1', 'r2'], // deduped — never one per predecessor
    });
  });

  it('the most restrictive predecessor standing survives — consolidation cannot launder a restriction', () => {
    const result = reconcileLineage(
      [
        { passportRecordId: 'pp-a', privilegeStatus: 'minimal_privileges', activeRestrictions: [] },
        { passportRecordId: 'pp-b', privilegeStatus: 'full_privileges', activeRestrictions: [] },
      ],
      [],
    );
    expect(result.standing?.privilegeStatus).toBe('minimal_privileges');
  });

  it('THE delegation canary: a revocation anywhere in the lineage is never resurrected', () => {
    // Predecessor A revoked the delegation; predecessor B still holds a live
    // grant for the same (capability, agent). Post-consolidation it is
    // REVOKED — a merge must never re-arm what one predecessor turned off.
    const result = reconcileLineage(
      [],
      [
        { agreementRef: 'agr-1', capabilityRef: 'cap.pay', agentRef: 'agent.z', state: 'revoked' },
        { agreementRef: 'agr-2', capabilityRef: 'cap.pay', agentRef: 'agent.z', state: 'granted' },
      ],
    );
    expect(result.delegations).toHaveLength(1);
    expect(result.delegations[0].state).toBe('revoked');
    expect(result.delegations[0].sourceAgreementRefs.sort()).toEqual(['agr-1', 'agr-2']);
  });

  it('revocation dominates regardless of input order', () => {
    const result = reconcileLineage(
      [],
      [
        { agreementRef: 'agr-2', capabilityRef: 'cap.pay', agentRef: 'agent.z', state: 'granted' },
        { agreementRef: 'agr-1', capabilityRef: 'cap.pay', agentRef: 'agent.z', state: 'revoked' },
        { agreementRef: 'agr-3', capabilityRef: 'cap.pay', agentRef: 'agent.z', state: 'granted' },
      ],
    );
    expect(result.delegations[0].state).toBe('revoked');
  });

  it('duplicate grants collapse to one entry per (capability, agent) — delegation is never duplicated either', () => {
    const result = reconcileLineage(
      [],
      [
        { agreementRef: 'agr-1', capabilityRef: 'cap.read', agentRef: 'agent.z', state: 'granted' },
        { agreementRef: 'agr-2', capabilityRef: 'cap.read', agentRef: 'agent.z', state: 'granted' },
        { agreementRef: 'agr-3', capabilityRef: 'cap.read', agentRef: 'agent.c', state: 'granted' },
      ],
    );
    expect(result.delegations).toHaveLength(2);
    const pair = result.delegations.find((d) => d.agentRef === 'agent.z');
    expect(pair?.state).toBe('granted');
    expect(pair?.sourceAgreementRefs.sort()).toEqual(['agr-1', 'agr-2']);
  });
});

describe('consolidation uses the RATIFIED transition and composes step-up', () => {
  const canonical = member({ id: 'pp-canonical', kybeIdentityId: 'k', createdAt: '2026-05-01T00:00:00.000Z' });
  const predecessor = member({ id: 'pp-pred', kybeIdentityId: 'k', createdAt: '2026-06-01T00:00:00.000Z' });

  it('plans active → superseded_by_reissue with reissue_continuity_binding — the existing machine edge, never an invented one', () => {
    const plan = planConsolidation({
      lineage: { members: [canonical, predecessor] },
      presentedProofGrade: 'world_id',
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.canonicalPassportRecordId).toBe('pp-canonical');
      expect(plan.steps).toEqual([
        {
          passportRecordId: 'pp-pred',
          from: 'active',
          to: 'superseded_by_reissue',
          evidence: 'reissue_continuity_binding',
          receipt: 'passport_status_changed',
        },
      ]);
    }
  });

  it('THE composition canary: consolidation is step-up gated at world_id — the two increments compose', () => {
    for (const insufficient of ['captcha', 'passkey', 'operator_attestation'] as const) {
      const plan = planConsolidation({
        lineage: { members: [canonical, predecessor] },
        presentedProofGrade: insufficient,
      });
      expect(plan).toEqual({ ok: false, reason: 'step_up_required', requiredGrade: 'world_id' });
    }
  });

  it('non-active and non-citizen predecessors are honestly skipped, never forced', () => {
    const dormant = member({ id: 'pp-dormant', kybeIdentityId: 'k', citizenStatus: 'dormant' });
    const participant = member({
      id: 'pp-agent',
      kybeIdentityId: 'k',
      passportClass: 'agent_participant',
      citizenStatus: null,
      participantStatus: 'approved',
    });
    const plan = planConsolidation({
      lineage: { members: [canonical, dormant, participant] },
      presentedProofGrade: 'world_id',
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.steps).toHaveLength(0);
      expect(plan.skipped).toEqual(
        expect.arrayContaining([
          { passportRecordId: 'pp-dormant', reason: 'no_ratified_transition' },
          { passportRecordId: 'pp-agent', reason: 'not_citizen_class' },
        ]),
      );
    }
  });

  it('the explicit selection flows through to the plan', () => {
    const plan = planConsolidation({
      lineage: { members: [canonical, predecessor] },
      presentedProofGrade: 'world_id',
      explicitSelectionId: 'pp-pred',
    });
    expect(plan.ok && plan.canonicalPassportRecordId).toBe('pp-pred');
    expect(plan.ok && plan.steps.map((s) => s.passportRecordId)).toEqual(['pp-canonical']);
  });
});

describe('boundaries', () => {
  it('the lineage module describes — it composes the status machine and step-up policy, and never invents either', () => {
    const graph = importAuthority(readSource(SERVICE));
    const specs = graph.records.map((r) => r.specifier);
    expect(specs.some((s) => s.includes('passportStatusMachine'))).toBe(true);
    expect(specs.some((s) => s.includes('stepUpPolicy'))).toBe(true);
  });

  it('touches no protected spine or DVN file', () => {
    for (const file of [
      SERVICE,
      'services/passport/stepUpPolicy.ts',
      'services/passport/passkeyService.ts',
    ]) {
      const graph = importAuthority(readSource(file));
      for (const r of graph.records) {
        expect(r.specifier, `${file} imports ${r.specifier}`).not.toMatch(
          /getActivePersona|evaluateAccess|policyResolvers|personaSessionToken|services\/content\/|services\/dvn\/|services\/ops\//,
        );
      }
    }
  });

  it('no protected file learned about the new modules', () => {
    for (const file of [
      'services/identity/getActivePersona.ts',
      'services/access/evaluateAccess.ts',
      'services/identity/personaSessionToken.ts',
    ]) {
      const code = stripComments(readSource(file));
      for (const marker of ['passportLineage', 'stepUpPolicy', 'passkeyService']) {
        expect(code, `${file} now knows about ${marker}`).not.toContain(marker);
      }
    }
  });
});
