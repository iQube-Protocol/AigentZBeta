/**
 * Polity Access Gateway — human session canary (PRD-PAG-001 Phase 1,
 * operator-ratified 2026-07-22).
 *
 * Pure-logic tests against services/accessGateway/sessionQube.ts — no DB, no
 * env. Mirrors the canary style of tests/persona-broadcast-handshake.test.ts:
 * what these lock is the TIER LAW of the session payload a relying party
 * receives (§5 five-forbidden-fields), the consent-before-issuance gate, the
 * claims vocabulary filter, and expiry semantics. The DB-backed lifecycle
 * (createHumanPendingHandshake / issueHumanAuthorizationCode /
 * resolveHumanBearer) composes the Supabase-backed Threshold substrate and is
 * covered by its integration checks; this suite guards the pure decision core
 * every issuance flows through.
 */

import { describe, it, expect } from 'vitest';
import {
  HUMAN_SESSION_CLAIMS,
  filterRequestedClaims,
  resolveGrantedClaims,
  isSessionExpired,
  consentCommitment,
  projectSessionQube,
  type ConsentRecord,
  type SessionQubeInput,
} from '../services/accessGateway/sessionQube';

const fullInput = (over: Partial<SessionQubeInput> = {}): SessionQubeInput => ({
  sessionId: 'a3f8d0f2-9a41-4a6e-8f77-1a2b3c4d5e6f',
  clientId: 'thc_client_abc123',
  sub: 'prf_0123456789abcdef0123',
  personaPublicRef: 'deadbeefdeadbeef',
  displayLabel: 'Knight',
  cartridgeFlags: { isAdmin: true, isPartner: false, adminCartridges: ['knyt-codex'] },
  passportStatus: {
    passportClass: 'citizen',
    citizenStatus: 'active',
    participantStatus: null,
    passportGrade: 'G2',
    revoked: false,
    expiresAt: '2027-01-01T00:00:00.000Z',
  },
  claims: [...HUMAN_SESSION_CLAIMS],
  consentRef: 'aabbccdd00112233',
  issuedAt: '2026-07-22T00:00:00.000Z',
  expiresAt: '2026-07-22T12:00:00.000Z',
  ...over,
});

describe('session payload tier law (five-forbidden-fields, PRD-PAG-001 §5)', () => {
  it('a fully-granted SessionQube contains NO T0 field names', () => {
    const blob = JSON.stringify(projectSessionQube(fullInput()));
    expect(blob).not.toContain('personaId');
    expect(blob).not.toContain('authProfileId');
    expect(blob).not.toContain('rootDid');
    expect(blob).not.toContain('kybeAttestation');
    expect(blob).not.toContain('fioHandle');
    expect(blob).not.toContain('did:fio:');
    expect(blob).not.toContain('did:iq:');
  });

  it('the SessionQube type has no channel for a raw persona UUID — sub and personaPublicRef are derived refs', () => {
    const qube = projectSessionQube(fullInput());
    // The subject is the pairwise ref; the public ref is the sha256/16-hex
    // commitment. Neither is a UUID shape.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(qube.sub).not.toMatch(uuidRe);
    expect(qube.personaPublicRef).not.toMatch(uuidRe);
    // sessionRef IS a row uuid — a session handle, not a persona identifier;
    // assert it is the only uuid-shaped value in the payload.
    const uuidLike = JSON.stringify(qube).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [];
    expect(uuidLike).toEqual([fullInput().sessionId]);
  });

  it('claim-gated fields are ABSENT (not null) when the claim was not granted', () => {
    const qube = projectSessionQube(fullInput({ claims: ['sub'] }));
    expect(qube.sub).toBe('prf_0123456789abcdef0123');
    expect(qube).not.toHaveProperty('personaPublicRef');
    expect(qube).not.toHaveProperty('displayLabel');
    expect(qube).not.toHaveProperty('cartridgeFlags');
    expect(qube).not.toHaveProperty('passportStatus');
  });

  it('granting persona_public_ref surfaces it; ungranted extras stay absent', () => {
    const qube = projectSessionQube(fullInput({ claims: ['sub', 'persona_public_ref'] }));
    expect(qube.personaPublicRef).toBe('deadbeefdeadbeef');
    expect(qube).not.toHaveProperty('passportStatus');
  });
});

describe('claims vocabulary filter', () => {
  it('drops unknown claims — they can never be granted by accident', () => {
    expect(filterRequestedClaims('sub display_label email profile personaId rootDid')).toEqual([
      'sub',
      'display_label',
    ]);
  });

  it('always includes sub, even when nothing was requested', () => {
    expect(filterRequestedClaims('')).toEqual(['sub']);
    expect(filterRequestedClaims(undefined)).toEqual(['sub']);
    expect(filterRequestedClaims([])).toEqual(['sub']);
  });

  it('accepts array input and normalizes to canonical vocabulary order', () => {
    expect(filterRequestedClaims(['passport_status', 'display_label'])).toEqual([
      'sub',
      'display_label',
      'passport_status',
    ]);
  });
});

describe('consent required before issuance', () => {
  it('no approval → null (the caller must refuse to issue)', () => {
    expect(resolveGrantedClaims(['sub', 'display_label'], false)).toBeNull();
  });

  it('approval grants exactly the filtered requested claims, never more', () => {
    expect(resolveGrantedClaims(['sub', 'display_label', 'made_up_claim'], true)).toEqual([
      'sub',
      'display_label',
    ]);
  });

  it('approval of an empty request still yields the minimal subject-only session', () => {
    expect(resolveGrantedClaims([], true)).toEqual(['sub']);
  });
});

describe('expiry semantics', () => {
  const now = Date.parse('2026-07-22T12:00:00.000Z');

  it('rejects an expired session', () => {
    expect(isSessionExpired('2026-07-22T11:59:59.000Z', now)).toBe(true);
  });

  it('accepts a live session', () => {
    expect(isSessionExpired('2026-07-22T12:00:01.000Z', now)).toBe(false);
  });

  it('null expiry never expires (substrate semantics)', () => {
    expect(isSessionExpired(null, now)).toBe(false);
  });

  it('malformed expiry fails CLOSED', () => {
    expect(isSessionExpired('not-a-date', now)).toBe(true);
  });
});

describe('consent commitment', () => {
  const record: ConsentRecord = {
    clientId: 'thc_client_abc123',
    grantedClaims: ['sub', 'display_label'],
    subjectRef: 'prf_0123456789abcdef0123',
    approvedAt: '2026-07-22T00:00:00.000Z',
  };

  it('is deterministic and claim-order independent (16-hex commitment)', () => {
    const a = consentCommitment(record);
    const b = consentCommitment({ ...record, grantedClaims: ['display_label', 'sub'] });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when any consent dimension changes', () => {
    const base = consentCommitment(record);
    expect(consentCommitment({ ...record, clientId: 'thc_client_other' })).not.toBe(base);
    expect(consentCommitment({ ...record, grantedClaims: ['sub'] })).not.toBe(base);
    expect(consentCommitment({ ...record, approvedAt: '2026-07-23T00:00:00.000Z' })).not.toBe(base);
  });

  it('does not embed the subject ref in cleartext-recoverable form (one-way commitment)', () => {
    expect(consentCommitment(record)).not.toContain('prf_');
  });
});
