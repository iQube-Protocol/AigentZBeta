/**
 * Polity Passport status machine suite — pure-logic unit tests, no network.
 *
 * Canary intent (mirrors the access-spine canary pattern): these tests
 * encode the constitutional invariants from PRD Addendum D + the
 * identity-surface clarification, so any future edit that re-introduces a
 * citizen 'revoked'/'denied' state, lets the system declare death from
 * non-renewal, or drifts the enums away from the schema bundle breaks CI.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CITIZEN_PASSPORT_STATUSES,
  PARTICIPANT_PASSPORT_STATUSES,
  CITIZEN_TRANSITION_RULES,
  PARTICIPANT_TRANSITION_RULES,
  validateCitizenTransition,
  validateParticipantTransition,
  citizenTransitionRule,
  participantTransitionRule,
  isCitizenTerminal,
  isParticipantTerminal,
  allowedCitizenTransitionsFrom,
  isCitizenStatus,
  isParticipantStatus,
} from '@/services/passport/passportStatusMachine';

describe('citizen passport machine — irrevocability invariants (Addendum D)', () => {
  it('citizen status set contains no punitive states', () => {
    expect(CITIZEN_PASSPORT_STATUSES).not.toContain('revoked');
    expect(CITIZEN_PASSPORT_STATUSES).not.toContain('denied');
    expect(CITIZEN_PASSPORT_STATUSES).not.toContain('suspended');
    expect(CITIZEN_PASSPORT_STATUSES).not.toContain('delisted');
  });

  it('no citizen transition rule targets a punitive state', () => {
    for (const rule of CITIZEN_TRANSITION_RULES) {
      expect(['revoked', 'denied', 'suspended', 'delisted']).not.toContain(rule.to);
    }
  });

  it('death is never declared by the system or without death evidence', () => {
    const deathRules = CITIZEN_TRANSITION_RULES.filter(
      (r) => r.to === 'ceased_death_confirmed',
    );
    expect(deathRules.length).toBeGreaterThan(0);
    for (const rule of deathRules) {
      expect(rule.evidence).toBe('death_evidence');
      expect(rule.initiators).not.toContain('system');
      expect(rule.initiators).not.toContain('applicant');
    }
  });

  it('non-renewal degrades through the dormancy ladder, not to death', () => {
    // system-initiated edges out of the non-renewal ladder never reach
    // ceased_death_confirmed (Addendum D: expiry is a continuity check,
    // not punishment; death needs evidence)
    for (const from of ['renewal_due', 'expired_non_renewal', 'dormant'] as const) {
      for (const rule of CITIZEN_TRANSITION_RULES.filter((r) => r.from === from)) {
        if (rule.initiators.includes('system')) {
          expect(rule.to).not.toBe('ceased_death_confirmed');
        }
      }
    }
  });

  it('every dormancy rung can return to active with continuity proof', () => {
    for (const from of ['expired_non_renewal', 'dormant', 'inactive_presumed'] as const) {
      expect(validateCitizenTransition(from, 'active')).toEqual({ allowed: true });
      const rule = citizenTransitionRule(from, 'active');
      expect(rule?.evidence).toBe('continuity_proof');
    }
  });

  it('terminal states are exactly death-confirmed and superseded-by-reissue', () => {
    const terminals = CITIZEN_PASSPORT_STATUSES.filter(isCitizenTerminal);
    expect(terminals.sort()).toEqual(
      ['ceased_death_confirmed', 'superseded_by_reissue'].sort(),
    );
  });

  it('issuance path: draft → submitted → pending_approval → active', () => {
    expect(validateCitizenTransition('draft', 'submitted')).toEqual({ allowed: true });
    expect(validateCitizenTransition('submitted', 'pending_approval')).toEqual({ allowed: true });
    expect(validateCitizenTransition('pending_approval', 'active')).toEqual({ allowed: true });
    expect(citizenTransitionRule('pending_approval', 'active')?.receipt).toBe('passport_issued');
  });

  it('rejects illegal jumps', () => {
    expect(validateCitizenTransition('draft', 'active').allowed).toBe(false);
    expect(validateCitizenTransition('active', 'draft').allowed).toBe(false);
    expect(allowedCitizenTransitionsFrom('ceased_death_confirmed')).toEqual([]);
  });
});

describe('participant passport machine — conditional standing', () => {
  it('participant status set is revocable and delistable', () => {
    expect(PARTICIPANT_PASSPORT_STATUSES).toContain('revoked');
    expect(PARTICIPANT_PASSPORT_STATUSES).toContain('delisted');
  });

  it('every revocation edge requires a review decision, human initiator, and the revocation receipt', () => {
    const revocations = PARTICIPANT_TRANSITION_RULES.filter((r) => r.to === 'revoked');
    expect(revocations.length).toBeGreaterThan(0);
    for (const rule of revocations) {
      expect(rule.receipt).toBe('passport_revoked');
      expect(rule.evidence).toBe('review_decision');
      expect(rule.initiators).not.toContain('system');
      expect(rule.reversibility).toBe('one_way');
    }
  });

  it('revoked → delisted is the only path out of revoked (no v0.1 reinstatement edge)', () => {
    const fromRevoked = PARTICIPANT_TRANSITION_RULES.filter((r) => r.from === 'revoked');
    expect(fromRevoked.map((r) => r.to)).toEqual(['delisted']);
    expect(isParticipantTerminal('delisted')).toBe(true);
  });

  it('renewal loop: expired → renewed → approved', () => {
    expect(validateParticipantTransition('expired', 'renewed')).toEqual({ allowed: true });
    expect(validateParticipantTransition('renewed', 'approved')).toEqual({ allowed: true });
    expect(participantTransitionRule('expired', 'renewed')?.evidence).toBe(
      'renewal_proof_of_control',
    );
  });

  it('needs_more_information round-trips to pending_approval', () => {
    expect(validateParticipantTransition('pending_approval', 'needs_more_information')).toEqual({ allowed: true });
    expect(validateParticipantTransition('needs_more_information', 'pending_approval')).toEqual({ allowed: true });
  });

  it('rejects citizen-style lifecycle states', () => {
    expect(isParticipantStatus('dormant')).toBe(false);
    expect(isParticipantStatus('ceased_death_confirmed')).toBe(false);
    expect(isCitizenStatus('revoked')).toBe(false);
    expect(isCitizenStatus('delisted')).toBe(false);
  });
});

describe('schema bundle ↔ machine enum sync', () => {
  const common = JSON.parse(
    readFileSync(
      path.resolve(
        __dirname,
        '../polity-passport-bureau/schemas/polity-passport.common.schema.json',
      ),
      'utf-8',
    ),
  );

  it('citizen enum matches polity-passport.common.schema.json citizenPassportStatus', () => {
    expect([...CITIZEN_PASSPORT_STATUSES]).toEqual(common.$defs.citizenPassportStatus.enum);
  });

  it('participant enum matches polity-passport.common.schema.json participantPassportStatus', () => {
    expect([...PARTICIPANT_PASSPORT_STATUSES]).toEqual(
      common.$defs.participantPassportStatus.enum,
    );
  });
});
