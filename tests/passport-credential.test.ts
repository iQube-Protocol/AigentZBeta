/**
 * Phase A passport credential envelope — claimability gates + T0 canaries.
 * Mirrors the canary pattern from tests/access-spine.test.ts: the serialized
 * envelope must never carry server-internal identifiers.
 *
 * FIXTURE CHANGE (Phase 5.1a, 2026-09-11, tracked explicitly): `issuer.id` is
 * now `requireBureauIssuerDid()` (a configured stable DID) rather than a
 * host-derived string, for every credential `buildPassportCredential`
 * builds — so this file now sets `PASSPORT_BUREAU_ISSUER_DID` for every
 * test via a top-level `beforeEach`/`afterEach`, or the builder throws. No
 * existing assertion's expected value changed.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildPassportCredential,
  isClaimable,
  type PassportRecordRow,
} from '../services/passport/passportCredential';

const HOST = 'https://dev-beta.aigentz.me';
// Placeholder/example only — never a real production hostname or a
// fallback default in code (CLAUDE.md's No-Guessing rule).
const TEST_ISSUER_DID = 'did:web:passport.example.test';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.PASSPORT_BUREAU_ISSUER_DID = TEST_ISSUER_DID;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function participantRecord(overrides: Partial<PassportRecordRow> = {}): PassportRecordRow {
  return {
    passport_id: 'ppp-test-0001',
    passport_class: 'agent_participant',
    citizen_status: null,
    participant_status: 'approved',
    passport_grade: 'agent_participant',
    // An agent has no kybe_identity at all — its Passport row carries
    // root_did_public_ref, never kybe_did_public_ref (DiDQube Phase 3
    // item 4). kybe_did_public_ref is left null here deliberately: a
    // participant record realistically never has one set.
    kybe_did_public_ref: null,
    root_did_public_ref: 'rootdid-commit-xyz789',
    persona_public_ref: 'persona-commit-def456',
    registry_record_id: 'marketa-agent-xyz',
    issuer_id: 'polity-passport-bureau',
    issued_at: '2026-06-11T00:00:00Z',
    expires_at: '2027-06-11T00:00:00Z',
    revoked: false,
    ...overrides,
  };
}

describe('isClaimable', () => {
  it('approved participant passport is claimable', () => {
    expect(isClaimable(participantRecord()).claimable).toBe(true);
  });

  it('revoked participant passport is not claimable', () => {
    const res = isClaimable(participantRecord({ revoked: true }));
    expect(res.claimable).toBe(false);
    expect(res.reason).toMatch(/revoked/);
  });

  it('pending participant passport is not claimable', () => {
    expect(isClaimable(participantRecord({ participant_status: 'pending_approval' })).claimable).toBe(false);
  });

  it('active citizen passport is claimable; superseded is not', () => {
    const citizen = participantRecord({
      passport_class: 'citizen',
      participant_status: null,
      citizen_status: 'active',
    });
    expect(isClaimable(citizen).claimable).toBe(true);
    expect(isClaimable({ ...citizen, citizen_status: 'superseded_by_reissue' }).claimable).toBe(false);
  });
});

describe('buildPassportCredential', () => {
  it('produces a VC-shaped envelope, agent-participant subject anchored on RootDID (not KybeDID)', () => {
    const credential = buildPassportCredential(participantRecord(), HOST) as Record<string, any>;
    expect(credential.type).toContain('VerifiableCredential');
    expect(credential.type).toContain('PolityAgentParticipantPassport');
    expect(credential.credentialSubject.id).toBe('rootdid-commit-xyz789');
    expect(credential.credentialSubject.passportId).toBe('ppp-test-0001');
    expect(credential.credentialStatus.statusListUrl).toBe(`${HOST}/api/polity-passport/registry`);
    expect(credential.proof.type).toMatch(/^PolityBureau(HmacStub|UnsignedStub)\/v0$/);
  });

  it('citizen envelope carries the irrevocability claim and is anchored on KybeDID (not RootDID)', () => {
    const credential = buildPassportCredential(
      participantRecord({
        passport_class: 'citizen',
        participant_status: null,
        citizen_status: 'active',
        kybe_did_public_ref: 'kybe-commit-abc123',
      }),
      HOST,
    ) as Record<string, any>;
    expect(credential.type).toContain('PolityCitizenPassport');
    expect(credential.credentialSubject.citizenPassportIrrevocable).toBe(true);
    expect(credential.credentialSubject.id).toBe('kybe-commit-abc123');
  });

  it('class-sensitive subject: a citizen record never anchors on root_did_public_ref, even when both refs are present', () => {
    const credential = buildPassportCredential(
      participantRecord({
        passport_class: 'citizen',
        participant_status: null,
        citizen_status: 'active',
        kybe_did_public_ref: 'kybe-commit-abc123',
        root_did_public_ref: 'rootdid-commit-should-be-ignored',
      }),
      HOST,
    ) as Record<string, any>;
    expect(credential.credentialSubject.id).toBe('kybe-commit-abc123');
  });

  it('class-sensitive subject: an agent-participant record never anchors on kybe_did_public_ref, even when both refs are present', () => {
    const credential = buildPassportCredential(
      participantRecord({ kybe_did_public_ref: 'kybe-commit-should-be-ignored' }),
      HOST,
    ) as Record<string, any>;
    expect(credential.credentialSubject.id).toBe('rootdid-commit-xyz789');
  });

  it('a passport record with no anchor for its class produces an undefined subject id rather than a wrong-field fallback', () => {
    const credential = buildPassportCredential(
      participantRecord({ root_did_public_ref: null }),
      HOST,
    ) as Record<string, any>;
    expect(credential.credentialSubject.id).toBeUndefined();
  });

  it('T0 canary: envelope never serialises server-internal identifiers', () => {
    // The credential/wallet routes select persona_id (ownership gate) and
    // credential_claimed_at, so the builder receives records carrying them.
    // The canary must exercise that realistic input: a refactor that spreads
    // the record into the envelope would leak the T0 value.
    const recordWithServerFields = {
      ...participantRecord(),
      persona_id: 'persona-T0-secret-0000-uuid',
      credential_claimed_at: '2026-06-12T00:00:00Z',
    } as PassportRecordRow;
    const serialized = JSON.stringify(buildPassportCredential(recordWithServerFields, HOST));
    expect(serialized).not.toContain('persona-T0-secret-0000-uuid');
    for (const forbidden of [
      'persona_id',
      'personaId"',
      'kybe_identity_id',
      'root_identity_id',
      'rootDid',
      'authProfileId',
      'vault_content',
      'credential_claimed_at',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
