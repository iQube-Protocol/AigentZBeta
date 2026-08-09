/**
 * classifyTrace — the five-way decision contract for "Close Nakamoto Pulse
 * Enrollment — Final Correlated Trace" (operator directive, 2026-08-06).
 *
 * Pure function, tested directly against the contract's own wording:
 *   ENROLLED                         — authoritative status explicitly reports Pulse enabled.
 *   PARTNER_REJECTED                 — submission response explicitly reports rejection/failure.
 *   PARTNER_ACCEPTED_NOT_PERSISTED   — submission explicitly reports success, but every reread reports not enrolled.
 *   PARTNER_RESPONSE_UNRESOLVED      — submission ambiguous, status remains not enrolled.
 *   LOCAL_CONTRACT_ERROR             — arguments/message/signature/chain resolution failed before submission.
 *
 * A missing submission reference is explicitly NOT a failure signal per the
 * directive ("Do not report a missing submission reference as failure. A
 * reference is optional metadata.") — classifyTrace never looks at a
 * reference at all, by construction; there is no test needed to prove an
 * absence of logic, but it's worth stating why no such field appears here.
 */
import { describe, it, expect } from 'vitest';
import { classifyTrace, type PulseStatusReadRecord } from '@/services/horizen/pulseEnrollmentTrace';

function read(atSeconds: 0 | 5 | 15 | 30, enrollmentState: PulseStatusReadRecord['enrollmentState']): PulseStatusReadRecord {
  return {
    atSeconds,
    timestamp: '2026-08-06T00:00:00.000Z',
    ok: enrollmentState !== null,
    refusalCode: null,
    rawStatusResult: { content: [{ type: 'text', text: 'stub' }] },
    statusArgsUsed: { agentId: '8798', chain: 'base-sepolia' },
    enrollmentState,
  };
}

describe('classifyTrace — LOCAL_CONTRACT_ERROR', () => {
  it('never reached the partner submission at all', () => {
    const { classification, reason } = classifyTrace({
      reachedPartnerSubmission: false,
      localContractError: 'PULSE_ARGUMENT_DRIFT: submit arguments differ from build',
      submissionRejected: false,
      submissionConfirmed: false,
      statusReads: [],
    });
    expect(classification).toBe('LOCAL_CONTRACT_ERROR');
    expect(reason).toContain('before enable_pulse_monitoring was ever called');
    expect(reason).toContain('PULSE_ARGUMENT_DRIFT');
  });

  it('takes priority over every other signal — a local failure never gets reinterpreted as a partner outcome', () => {
    const { classification } = classifyTrace({
      reachedPartnerSubmission: false,
      localContractError: 'SIGNATURE_INTEGRITY_FAILED',
      // Even if these were somehow true, reachedPartnerSubmission=false must win.
      submissionRejected: true,
      submissionConfirmed: true,
      statusReads: [read(0, 'CONFIRMED')],
    });
    expect(classification).toBe('LOCAL_CONTRACT_ERROR');
  });
});

describe('classifyTrace — PARTNER_REJECTED', () => {
  it('the submission response explicitly reported rejection', () => {
    const { classification, reason } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: true,
      submissionConfirmed: false,
      statusReads: [],
    });
    expect(classification).toBe('PARTNER_REJECTED');
    expect(reason).toContain('explicitly reported rejection or failure');
  });

  it('rejection outranks a later CONFIRMED status read — an explicit partner refusal is authoritative on its own', () => {
    const { classification } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: true,
      submissionConfirmed: false,
      statusReads: [read(0, 'CONFIRMED')],
    });
    expect(classification).toBe('PARTNER_REJECTED');
  });
});

describe('classifyTrace — ENROLLED', () => {
  it('any status reread reporting CONFIRMED is enough, even if earlier reads did not', () => {
    const { classification, reason } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: false,
      submissionConfirmed: false,
      statusReads: [read(0, 'NOT_ENROLLED'), read(5, 'PENDING_CONVERGENCE'), read(15, 'CONFIRMED'), read(30, 'CONFIRMED')],
    });
    expect(classification).toBe('ENROLLED');
    expect(reason).toContain('reported Pulse enabled');
  });

  it('the FIRST read alone confirming is enough — later reads need not agree', () => {
    const { classification } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: false,
      submissionConfirmed: true,
      statusReads: [read(0, 'CONFIRMED')],
    });
    expect(classification).toBe('ENROLLED');
  });
});

describe('classifyTrace — PARTNER_ACCEPTED_NOT_PERSISTED', () => {
  it('submission explicitly confirmed, but every reread reports NOT_ENROLLED', () => {
    const { classification, reason } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: false,
      submissionConfirmed: true,
      statusReads: [read(0, 'NOT_ENROLLED'), read(5, 'NOT_ENROLLED'), read(15, 'NOT_ENROLLED'), read(30, 'NOT_ENROLLED')],
    });
    expect(classification).toBe('PARTNER_ACCEPTED_NOT_PERSISTED');
    expect(reason).toContain('accepted the attempt but did not persist or expose it');
  });

  it('submission confirmed, rereads only ever PENDING_CONVERGENCE (never an explicit not-enrolled) — still not persisted', () => {
    const { classification } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: false,
      submissionConfirmed: true,
      statusReads: [read(0, 'PENDING_CONVERGENCE'), read(5, 'PENDING_CONVERGENCE'), read(15, 'PENDING_CONVERGENCE'), read(30, 'PENDING_CONVERGENCE')],
    });
    expect(classification).toBe('PARTNER_ACCEPTED_NOT_PERSISTED');
  });
});

describe('classifyTrace — PARTNER_RESPONSE_UNRESOLVED', () => {
  it('submission ambiguous (neither confirmed nor rejected), status never confirms', () => {
    const { classification, reason } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: false,
      submissionConfirmed: false,
      statusReads: [read(0, 'PENDING_CONVERGENCE'), read(5, 'NOT_ENROLLED'), read(15, 'NOT_ENROLLED'), read(30, 'NOT_ENROLLED')],
    });
    expect(classification).toBe('PARTNER_RESPONSE_UNRESOLVED');
    expect(reason).toContain('did not clearly state success or failure');
  });

  it('no status reads at all (a transport failure on every reread) still resolves to UNRESOLVED, not a fabricated verdict', () => {
    const { classification } = classifyTrace({
      reachedPartnerSubmission: true,
      localContractError: null,
      submissionRejected: false,
      submissionConfirmed: false,
      statusReads: [],
    });
    expect(classification).toBe('PARTNER_RESPONSE_UNRESOLVED');
  });
});

describe('classifyTrace — never collapses into "not enrolled" alone', () => {
  it('the five classifications are mutually exclusive and exhaustive over this input shape', () => {
    const ALL: Array<ReturnType<typeof classifyTrace>['classification']> = [
      'ENROLLED',
      'PARTNER_REJECTED',
      'PARTNER_ACCEPTED_NOT_PERSISTED',
      'PARTNER_RESPONSE_UNRESOLVED',
      'LOCAL_CONTRACT_ERROR',
    ];
    const seen = new Set<string>();
    seen.add(classifyTrace({ reachedPartnerSubmission: false, localContractError: 'x', submissionRejected: false, submissionConfirmed: false, statusReads: [] }).classification);
    seen.add(classifyTrace({ reachedPartnerSubmission: true, localContractError: null, submissionRejected: true, submissionConfirmed: false, statusReads: [] }).classification);
    seen.add(classifyTrace({ reachedPartnerSubmission: true, localContractError: null, submissionRejected: false, submissionConfirmed: false, statusReads: [read(0, 'CONFIRMED')] }).classification);
    seen.add(classifyTrace({ reachedPartnerSubmission: true, localContractError: null, submissionRejected: false, submissionConfirmed: true, statusReads: [read(0, 'NOT_ENROLLED')] }).classification);
    seen.add(classifyTrace({ reachedPartnerSubmission: true, localContractError: null, submissionRejected: false, submissionConfirmed: false, statusReads: [read(0, 'NOT_ENROLLED')] }).classification);
    expect([...seen].sort()).toEqual([...ALL].sort());
  });
});
