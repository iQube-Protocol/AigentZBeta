/**
 * Phase A passport credential envelope — claimability gates + T0 canaries.
 * Mirrors the canary pattern from tests/access-spine.test.ts: the serialized
 * envelope must never carry server-internal identifiers.
 */

import { describe, expect, it } from 'vitest';
import {
  buildPassportCredential,
  isClaimable,
  type PassportRecordRow,
} from '../services/passport/passportCredential';

const HOST = 'https://dev-beta.aigentz.me';

function participantRecord(overrides: Partial<PassportRecordRow> = {}): PassportRecordRow {
  return {
    passport_id: 'ppp-test-0001',
    passport_class: 'agent_participant',
    citizen_status: null,
    participant_status: 'approved',
    passport_grade: 'agent_participant',
    kybe_did_public_ref: 'kybe-commit-abc123',
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
  it('produces a VC-shaped envelope with subject anchored on the KybeDID commitment ref', () => {
    const credential = buildPassportCredential(participantRecord(), HOST) as Record<string, any>;
    expect(credential.type).toContain('VerifiableCredential');
    expect(credential.type).toContain('PolityAgentParticipantPassport');
    expect(credential.credentialSubject.id).toBe('kybe-commit-abc123');
    expect(credential.credentialSubject.passportId).toBe('ppp-test-0001');
    expect(credential.credentialStatus.statusListUrl).toBe(`${HOST}/api/polity-passport/registry`);
    expect(credential.proof.type).toMatch(/^PolityBureau(HmacStub|UnsignedStub)\/v0$/);
  });

  it('citizen envelope carries the irrevocability claim', () => {
    const credential = buildPassportCredential(
      participantRecord({ passport_class: 'citizen', participant_status: null, citizen_status: 'active' }),
      HOST,
    ) as Record<string, any>;
    expect(credential.type).toContain('PolityCitizenPassport');
    expect(credential.credentialSubject.citizenPassportIrrevocable).toBe(true);
  });

  it('T0 canary: envelope never serialises server-internal identifiers', () => {
    const serialized = JSON.stringify(buildPassportCredential(participantRecord(), HOST));
    for (const forbidden of [
      'persona_id',
      'personaId"',
      'kybe_identity_id',
      'root_identity_id',
      'rootDid',
      'authProfileId',
      'vault_content',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
