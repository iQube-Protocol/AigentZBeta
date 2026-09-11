/**
 * `reachedPartnerSubmission` — the exact boolean that froze the correlated
 * trace (c565e58b-4ce8-4ccf-9f0f-ac611d1d526c, operator directive, 2026-08-07)
 * at LOCAL_CONTRACT_ERROR.
 *
 * `startPulseEnrollmentTrace` (services/horizen/pulseEnrollmentTrace.ts)
 * computed this inline as `result.rawSubmitResult !== undefined`. Two
 * failures of that formula, both pinned here:
 *
 *   1. `runHorizenTransparencyAuthorization` genuinely reached and succeeded
 *      at `enable_pulse_monitoring`, but its own subsequent reread refused
 *      (PARTNER_NOT_ENROLLED, PARTNER_STATE_UNRESOLVED, ...) — until fixed,
 *      that failure return dropped `rawSubmitResult`/`submittedArguments`
 *      entirely (services/horizen/authorizationClient.ts's
 *      `verifyHorizenTransparencyActivation` failure branch never carried
 *      them), so this formula read `false` even though submission happened.
 *   2. The pre-submit idempotency gate (same operator directive) can now
 *      return `ok: true` WITHOUT ever calling `enable_pulse_monitoring` at
 *      all, because the agent was already enrolled — a genuine success that
 *      the OLD formula (`rawSubmitResult !== undefined` alone) would have
 *      misread as `false` too.
 *
 * Consequence of either misreading: `classifyTrace` forces `LOCAL_CONTRACT_ERROR`
 * with the (false) reason "before enable_pulse_monitoring was ever called",
 * AND `computeComplete`'s very first line (`if (!reachedPartnerSubmission)
 * return true`) marks the trace `complete: true` — permanently blocking the
 * scheduled +5/+15/+30s continuation rereads that would otherwise have
 * discovered Horizen's later, genuine confirmation. This is the "before
 * enable_pulse_monitoring is called" framing the operator observed, and it
 * is a property of the TRACE's own bookkeeping, not of the partner's actual
 * response.
 */
import { describe, it, expect } from 'vitest';
import { reachedPartnerSubmission } from '@/services/horizen/pulseEnrollmentTrace';
import type { AuthorizationResult } from '@/services/horizen/authorizationClient';

describe('reachedPartnerSubmission', () => {
  it('true on an ordinary success (submit + confirm)', () => {
    const result: AuthorizationResult<{ authorizationId: string; receiptRef: string | null }> = {
      ok: true,
      value: { authorizationId: 'auth-1', receiptRef: 'r-1' },
      rawSubmitResult: { content: [{ type: 'text', text: 'ok' }] },
    };
    expect(reachedPartnerSubmission(result)).toBe(true);
  });

  it('true on the pre-submit idempotency shortcut — ok:true with NO rawSubmitResult at all, because enable_pulse_monitoring was correctly never called', () => {
    const result: AuthorizationResult<{ authorizationId: string; receiptRef: string | null }> = {
      ok: true,
      value: { authorizationId: 'auth-1', receiptRef: 'r-1' },
      // No rawSubmitResult — the agent was already enrolled; submission was
      // never attempted because it was unnecessary, not because it failed.
    };
    expect(reachedPartnerSubmission(result)).toBe(true);
  });

  it('true when submission genuinely succeeded but the SUBSEQUENT reread refused — rawSubmitResult is forwarded on this failure path (the 2026-08-07 fix)', () => {
    const result: AuthorizationResult<{ authorizationId: string; receiptRef: string | null }> = {
      ok: false,
      refusalCode: 'PARTNER_NOT_ENROLLED',
      detail: 'not enrolled (yet) per the immediate reread',
      submittedArguments: { agentId: '8798' },
      rawSubmitResult: { content: [{ type: 'text', text: '{"submissionRef":"0xsub"}' }] },
    };
    expect(reachedPartnerSubmission(result)).toBe(true);
  });

  it('false on a genuine local-contract failure that never reached the partner at all', () => {
    const result: AuthorizationResult<{ authorizationId: string; receiptRef: string | null }> = {
      ok: false,
      refusalCode: 'SIGNATURE_INTEGRITY_FAILED',
      detail: 'recovered signer does not match',
      // No rawSubmitResult — enable_pulse_monitoring was genuinely never called.
    };
    expect(reachedPartnerSubmission(result)).toBe(false);
  });
});
