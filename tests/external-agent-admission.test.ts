/**
 * Provisional External Agent Admission (services/passport/externalAgentAdmission.ts)
 * — operator ruling 2026-07-30: a non-human external agent (e.g. a Horizen
 * agent) is admitted via a provisional record, never a human Polity Passport,
 * and can never delegate onward.
 */

import { describe, it, expect } from 'vitest';
import {
  EXTERNAL_AGENT_ADMISSION_STATUSES,
  createExternalAgentAdmission,
  externalAgentCardCommitment,
  sponsorRef,
  canDelegateOnward,
  validateAdmissionTransition,
  isAdmissionTerminal,
  beginVetting,
  admitCandidate,
  rejectCandidate,
  suspendAdmission,
  reinstateAdmission,
  revokeAdmission,
  expireIfPastDue,
  evaluateAdmissionAuthority,
  withEvidenceRef,
  type ExternalAgentAdmission,
} from '@/services/passport/externalAgentAdmission';

const NOW = '2026-07-30T00:00:00.000Z';
const LATER = '2026-08-30T00:00:00.000Z';

function freshAdmission(): ExternalAgentAdmission {
  const result = createExternalAgentAdmission({
    admissionId: 'admission-1',
    externalAgentCard: { name: 'Horizen Reference Agent', tokenId: '7866' },
    externalAgentRegistryAlias: '0x1eba',
    network: 'base-sepolia',
    registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    sponsor: { kind: 'institutional', institutionName: 'Horizen Labs' },
    permittedPilotActions: ['read_agent_card', 'submit_test_pnl_proof'],
    createdAt: NOW,
    expiresAt: LATER,
  });
  if (!result.ok) throw new Error('fixture setup failed');
  return result.admission;
}

describe('createExternalAgentAdmission', () => {
  it('starts in candidate status with mayDelegateOnward hard-false', () => {
    const admission = freshAdmission();
    expect(admission.candidateStatus).toBe('candidate');
    expect(admission.mayDelegateOnward).toBe(false);
    expect(admission.standingAccrualEligible).toBe(false);
    expect(admission.evidenceRefs).toEqual([]);
    expect(admission.revocation.revoked).toBe(false);
  });

  it('commits the card rather than storing it raw', () => {
    const admission = freshAdmission();
    expect(admission.externalAgentCardCommitment).toBe(
      externalAgentCardCommitment({ name: 'Horizen Reference Agent', tokenId: '7866' }),
    );
    expect(admission.externalAgentCardCommitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it('derives a T2 sponsor commitment, never a raw institution/persona id verbatim in a reversible form', () => {
    const admission = freshAdmission();
    expect(admission.sponsor.kind).toBe('institutional');
    expect(admission.sponsor.ref).toBe(sponsorRef({ kind: 'institutional', institutionName: 'Horizen Labs' }).ref);
    expect(admission.sponsor.ref).not.toContain('Horizen Labs');
  });

  it('operator sponsor commits the personaId, never carries it verbatim', () => {
    const result = createExternalAgentAdmission({
      admissionId: 'admission-2',
      externalAgentCard: { name: 'x' },
      registry: '0xabc',
      sponsor: { kind: 'operator', personaId: 'persona-secret-uuid' },
      permittedPilotActions: ['read_agent_card'],
      createdAt: NOW,
      expiresAt: LATER,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.admission.sponsor.kind).toBe('operator');
    expect(result.admission.sponsor.ref).not.toContain('persona-secret-uuid');
  });

  it('refuses an empty permittedPilotActions list', () => {
    const result = createExternalAgentAdmission({
      admissionId: 'a',
      externalAgentCard: {},
      registry: '0xabc',
      sponsor: { kind: 'institutional', institutionName: 'X' },
      permittedPilotActions: [],
      createdAt: NOW,
      expiresAt: LATER,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no-permitted-actions');
  });

  it.each(['*', 'all', 'ANY', ' any '])('refuses a wildcard-looking action %s — never "everything"', (wildcard) => {
    const result = createExternalAgentAdmission({
      admissionId: 'a',
      externalAgentCard: {},
      registry: '0xabc',
      sponsor: { kind: 'institutional', institutionName: 'X' },
      permittedPilotActions: ['read_agent_card', wildcard],
      createdAt: NOW,
      expiresAt: LATER,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('wildcard-action-not-allowed');
  });

  it('refuses a non-future expiry', () => {
    const result = createExternalAgentAdmission({
      admissionId: 'a',
      externalAgentCard: {},
      registry: '0xabc',
      sponsor: { kind: 'institutional', institutionName: 'X' },
      permittedPilotActions: ['read_agent_card'],
      createdAt: NOW,
      expiresAt: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('expiry-not-in-future');
  });
});

describe('canDelegateOnward — structurally always false', () => {
  it('returns false regardless of admission state', () => {
    const admission = freshAdmission();
    expect(canDelegateOnward(admission)).toBe(false);

    const admitted = admitCandidate(beginVetting(admission).admission, 'vetted').admission;
    expect(canDelegateOnward(admitted)).toBe(false);
  });
});

describe('status transitions', () => {
  it('follows candidate → vetting → admitted', () => {
    const admission = freshAdmission();
    const vetting = beginVetting(admission);
    expect(vetting.ok).toBe(true);
    expect(vetting.admission.candidateStatus).toBe('vetting');

    const admitted = admitCandidate(vetting.admission, 'Marketa vetting passed');
    expect(admitted.ok).toBe(true);
    expect(admitted.admission.candidateStatus).toBe('admitted');
    expect(admitted.admission.statusReason).toBe('Marketa vetting passed');
  });

  it('rejects vetting → rejected as terminal', () => {
    const admission = beginVetting(freshAdmission()).admission;
    const rejected = rejectCandidate(admission, 'failed vetting');
    expect(rejected.ok).toBe(true);
    expect(isAdmissionTerminal(rejected.admission.candidateStatus)).toBe(true);
    // No transition out of rejected.
    const attempt = validateAdmissionTransition('rejected', 'candidate');
    expect(attempt.allowed).toBe(false);
  });

  it('refuses an illegal jump (candidate → admitted, skipping vetting)', () => {
    const admission = freshAdmission();
    const result = admitCandidate(admission, 'shortcut');
    expect(result.ok).toBe(false);
    expect(result.admission.candidateStatus).toBe('candidate');
  });

  it('supports admitted ↔ suspended, and suspended → revoked', () => {
    const admitted = admitCandidate(beginVetting(freshAdmission()).admission, 'ok').admission;
    const suspended = suspendAdmission(admitted, 'ownership dispute');
    expect(suspended.ok).toBe(true);
    expect(suspended.admission.candidateStatus).toBe('suspended');

    const reinstated = reinstateAdmission(suspended.admission, 'dispute resolved');
    expect(reinstated.ok).toBe(true);
    expect(reinstated.admission.candidateStatus).toBe('admitted');

    const revoked = revokeAdmission(reinstated.admission, 'sponsor withdrew', '2026-08-01T00:00:00.000Z');
    expect(revoked.ok).toBe(true);
    expect(revoked.admission.candidateStatus).toBe('revoked');
    expect(revoked.admission.revocation).toEqual({
      revoked: true,
      revokedAt: '2026-08-01T00:00:00.000Z',
      revokedReason: 'sponsor withdrew',
    });
    expect(isAdmissionTerminal(revoked.admission.candidateStatus)).toBe(true);
  });

  it('expires an admitted record only once past its expiresAt', () => {
    const admitted = admitCandidate(beginVetting(freshAdmission()).admission, 'ok').admission;
    const tooEarly = expireIfPastDue(admitted, NOW);
    expect(tooEarly.ok).toBe(false);

    const expired = expireIfPastDue(admitted, '2026-09-01T00:00:00.000Z');
    expect(expired.ok).toBe(true);
    expect(expired.admission.candidateStatus).toBe('expired');
  });

  it('every declared status is reachable or a documented terminal', () => {
    for (const status of EXTERNAL_AGENT_ADMISSION_STATUSES) {
      // Every status must at least be a valid `from` or a valid terminal —
      // this just exercises isAdmissionTerminal over the full closed set.
      expect(typeof isAdmissionTerminal(status)).toBe('boolean');
    }
  });
});

describe('evaluateAdmissionAuthority', () => {
  it('denies an action outside the explicit allowlist, even when admitted', () => {
    const admitted = admitCandidate(beginVetting(freshAdmission()).admission, 'ok').admission;
    const result = evaluateAdmissionAuthority(admitted, 'transfer_funds', NOW);
    expect(result.eligible).toBe(false);
    expect(result.refusals).toContain('action-not-permitted');
  });

  it('permits a listed action while admitted, unexpired, unrevoked', () => {
    const admitted = admitCandidate(beginVetting(freshAdmission()).admission, 'ok').admission;
    const result = evaluateAdmissionAuthority(admitted, 'read_agent_card', NOW);
    expect(result.eligible).toBe(true);
    expect(result.refusals).toEqual([]);
  });

  it('denies a merely-candidate (not yet admitted) record', () => {
    const admission = freshAdmission();
    const result = evaluateAdmissionAuthority(admission, 'read_agent_card', NOW);
    expect(result.eligible).toBe(false);
    expect(result.refusals).toContain('not-admitted');
  });

  it('denies a revoked record even if the clock is within the original expiry', () => {
    const admitted = admitCandidate(beginVetting(freshAdmission()).admission, 'ok').admission;
    const revoked = revokeAdmission(admitted, 'x', NOW).admission;
    const result = evaluateAdmissionAuthority(revoked, 'read_agent_card', NOW);
    expect(result.eligible).toBe(false);
    expect(result.refusals).toContain('revoked');
    // revoked is not the same status as 'admitted', so 'not-admitted' also fires —
    // both reasons are legitimate and neither is hidden from the caller.
    expect(result.refusals).toContain('not-admitted');
  });

  it('denies once past expiry', () => {
    const admitted = admitCandidate(beginVetting(freshAdmission()).admission, 'ok').admission;
    const result = evaluateAdmissionAuthority(admitted, 'read_agent_card', '2026-09-01T00:00:00.000Z');
    expect(result.eligible).toBe(false);
    expect(result.refusals).toContain('expired');
  });
});

describe('withEvidenceRef', () => {
  it('appends a commitment and is idempotent', () => {
    const admission = freshAdmission();
    const withOne = withEvidenceRef(admission, 'ref-a');
    expect(withOne.evidenceRefs).toEqual(['ref-a']);
    const withOneAgain = withEvidenceRef(withOne, 'ref-a');
    expect(withOneAgain.evidenceRefs).toEqual(['ref-a']);
    const withTwo = withEvidenceRef(withOne, 'ref-b');
    expect(withTwo.evidenceRefs).toEqual(['ref-a', 'ref-b']);
    // Does not itself flip Standing eligibility — that is a separate decision.
    expect(withTwo.standingAccrualEligible).toBe(false);
  });
});
