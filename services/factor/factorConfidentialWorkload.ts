/**
 * Factor's first real Vela confidential-projection workload (Factor + Aegis
 * PRD tranche: "integrate the existing Vela SDK test TEE and prepare Factor
 * for a controlled end-to-end Horizen Journey Spine rehearsal").
 *
 * Workload chosen: ADMISSION-PACKET POLICY EVALUATION — confidentially
 * compares a case's computed readiness score against a policy threshold
 * without either value ever leaving the confidential environment in the
 * clear. This is a real, constitutionally relevant Factor act (Journey A/B:
 * assessing whether a candidate's packet clears an admission bar) — not a
 * synthetic demo payload.
 *
 * This file is the ONLY caller of `ConfidentialProjectionProvider` outside
 * `services/vela/velaProjectionProvider.ts` itself and test/script fixtures
 * — it invents no new confidential-compute mechanism, no new provider, no
 * new state machine. It drives the EXISTING seam
 * (types/confidentialProjection.ts) exactly as specified: prepare → submit →
 * observe → evidence → verify.
 *
 * Persists, per the PRD's own list, onto the EXISTING durable homes rather
 * than a new table:
 *   - Vela job ID              -> evidence payload `requestRef`
 *   - workload + policy id/ver -> evidence payload `workload`/`policyVersion`
 *   - canonical input commit   -> evidence payload `payloadCommitment`
 *   - output commitment        -> evidence payload `resultCommitment`
 *   - simulated measurement    -> evidence payload `attestationMode`/`provenStates`
 *   - start/end timestamps     -> evidence payload `startedAt`/`completedAt`
 *   - result state             -> evidence payload `disposition`
 *   - attestation mode         -> evidence payload `attestationMode`
 *   - verifier result          -> evidence payload `protocolExecutionVerified`/`teeAttestationVerified`
 * ... as a `factor_evidence_items` row (bound to the Factor CASE via
 * `upsertEvidenceItem`), an `appendCaseEvent` (bound to the case's own
 * timeline), and a `confidential_projection_evaluated` activity receipt
 * (bound to the caller's persona + `agentsInvoked`). `journeyStageId` is
 * caller-supplied — this module never re-derives or guesses Factor's current
 * Horizen Journey Spine stage; the caller already resolved it (e.g. via
 * `/api/journey/moneypenny-horizen/state?agentSlug=factor`) and passes it
 * through, same discipline `services/factor/authorityChain.ts`'s
 * `agentRootDid` threading already establishes elsewhere in this codebase.
 *
 * NEVER put confidential inputs (`readinessScore`, `policyThreshold`) in any
 * persisted payload, log, or receipt — only commitments and the confidential
 * app's own coarse ACCEPTABLE/UNACCEPTABLE/UNRESOLVED verdict ever leave this
 * function.
 *
 * Server-side only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AttestationMode,
  ConfidentialProjectionDisposition,
  ConfidentialProjectionProvider,
  ConfidentialProofState,
} from '@/types/confidentialProjection';
import { createFactorConfidentialProjectionProvider } from '@/services/vela/velaFactorProvider';
import { upsertEvidenceItem, appendCaseEvent } from '@/services/factor/factorCaseService';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND = 'confidential_admission_projection';

export interface AdmissionPacketPolicyEvaluationInput {
  caseId: string;
  tenantId: string;
  /** The accountable human/operator persona — never Factor's own agent ref. */
  actorPersonaId: string;
  /** The agent driving this workload — normally 'aigent-factor'. */
  requestedByAgentRef: string;
  policyVersion: string;
  /** The Horizen Journey Spine stage this evaluation is bound to — resolved
   *  by the CALLER (e.g. via GET /api/journey/moneypenny-horizen/state),
   *  never re-derived here. */
  journeyStageId: string;
  /** Confidential — never persisted, logged, or returned in the clear. */
  readinessScore: number;
  /** Confidential — never persisted, logged, or returned in the clear. */
  policyThreshold: number;
  /** Injectable for tests/rehearsal; defaults to Factor's memoized Vela
   *  test-TEE provider (see velaFactorProvider.ts — no live Vela deployment
   *  exists for this codebase to default to instead). */
  provider?: ConfidentialProjectionProvider;
  /** Bounded poll attempts before giving up honestly rather than blocking
   *  forever — the deterministic test transport resolves immediately absent
   *  `pendingPolls`, so this only matters for a transport modeling latency. */
  maxPollAttempts?: number;
}

export interface ConfidentialAdmissionProjectionResult {
  evidenceItemId: string;
  requestRef: string;
  applicationRef: string;
  disposition: ConfidentialProjectionDisposition;
  attestationMode: AttestationMode;
  provenStates: ConfidentialProofState[];
  protocolExecutionVerified: boolean;
  teeAttestationVerified: boolean;
  startedAt: string;
  completedAt: string;
}

async function pollToTerminal(
  provider: ConfidentialProjectionProvider,
  requestRef: string,
  maxAttempts: number,
): Promise<void> {
  let attempts = 0;
  let status = await provider.getProjectionStatus(requestRef);
  while (status.state === 'OBSERVING') {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `Confidential projection ${requestRef} did not leave OBSERVING within ${maxAttempts} poll attempts — refusing to block forever.`,
      );
    }
    status = await provider.getProjectionStatus(requestRef);
  }
}

/** Persists the same evidence/event/receipt triple both the fresh-run and
 *  resume paths below produce, so the two can never silently diverge in
 *  what they record. */
async function persistEvidence(
  admin: SupabaseClient,
  input: Pick<AdmissionPacketPolicyEvaluationInput, 'caseId' | 'tenantId' | 'actorPersonaId' | 'requestedByAgentRef' | 'policyVersion' | 'journeyStageId'>,
  provider: ConfidentialProjectionProvider,
  requestRef: string,
  startedAt: string,
): Promise<ConfidentialAdmissionProjectionResult> {
  const evidence = await provider.getProjectionEvidence(requestRef);
  const verification = await provider.verifyProjectionEvidence(evidence);
  const capabilities = await provider.getCapabilities();
  const completedAt = new Date().toISOString();

  const { evidence_item_id: evidenceItemId } = await upsertEvidenceItem(
    admin,
    {
      caseId: input.caseId,
      tenantId: input.tenantId,
      kind: FACTOR_CONFIDENTIAL_ADMISSION_EVIDENCE_KIND,
      status: 'supplied',
      payload: {
        provider: capabilities.provider,
        applicationRef: evidence.applicationRef,
        requestRef: evidence.requestRef,
        workload: 'admission_packet_policy_evaluation',
        policyVersion: input.policyVersion,
        journeyStageId: input.journeyStageId,
        disposition: evidence.disposition,
        resultCommitment: evidence.resultCommitment,
        payloadCommitment: evidence.payloadCommitment,
        executionProofRefs: evidence.executionProofRefs,
        attestationMode: evidence.attestationMode,
        protocolExecutionVerified: verification.protocolExecutionVerified,
        teeAttestationVerified: verification.teeAttestationVerified,
        provenStates: verification.provenStates,
        startedAt,
        completedAt,
      },
      sourceRef: `vela:${evidence.requestRef}`,
      suppliedByPersonaId: input.actorPersonaId,
    },
    false,
  );

  await appendCaseEvent(admin, {
    caseId: input.caseId,
    eventType: 'confidential_projection_evaluated',
    actorPersonaId: input.actorPersonaId,
    payload: {
      journeyStageId: input.journeyStageId,
      requestRef: evidence.requestRef,
      disposition: evidence.disposition,
      evidenceItemId,
    },
  });

  await createActivityReceipt({
    personaId: input.actorPersonaId,
    activeCartridge: 'moneypenny',
    actionType: 'confidential_projection_evaluated',
    summary:
      `Confidential admission-packet policy evaluation for case ${input.caseId}: ${evidence.disposition} ` +
      `(${evidence.attestationMode})`,
    agentsInvoked: [input.requestedByAgentRef],
    actionInput: {
      caseId: input.caseId,
      requestRef: evidence.requestRef,
      journeyStageId: input.journeyStageId,
      attestationMode: evidence.attestationMode,
    },
  });

  return {
    evidenceItemId,
    requestRef: evidence.requestRef,
    applicationRef: evidence.applicationRef,
    disposition: evidence.disposition,
    attestationMode: evidence.attestationMode,
    provenStates: verification.provenStates,
    protocolExecutionVerified: verification.protocolExecutionVerified,
    teeAttestationVerified: verification.teeAttestationVerified,
    startedAt,
    completedAt,
  };
}

/**
 * Runs a FRESH admission-packet policy evaluation end to end: prepare →
 * submit → observe → evidence → verify → persist. Every call submits a NEW
 * Vela request — there is no caller-suppliable idempotency key in the
 * confidential-projection seam (unlike Bankr's write path), so a caller that
 * wants to resume an in-flight or already-completed request must use
 * `resumeAdmissionPacketPolicyEvaluation` below instead of calling this again.
 */
export async function runAdmissionPacketPolicyEvaluation(
  admin: SupabaseClient,
  input: AdmissionPacketPolicyEvaluationInput,
): Promise<ConfidentialAdmissionProjectionResult> {
  const provider = input.provider ?? createFactorConfidentialProjectionProvider();
  const startedAt = new Date().toISOString();

  const prepared = await provider.prepareProjection({
    actionRef: `factor-case:${input.caseId}:admission-packet-policy-evaluation`,
    mandateRef: `factor-case:${input.caseId}`,
    identities: {
      authorityPrincipal: input.actorPersonaId,
      mandateSigner: input.actorPersonaId,
      confidentialRequester: input.requestedByAgentRef,
      confidentialPrivacyIdentity: input.requestedByAgentRef,
      executionSigner: input.requestedByAgentRef,
    },
    confidentialInputs: {
      readinessScore: input.readinessScore,
      policyThreshold: input.policyThreshold,
    },
    publicContext: {
      policyVersion: input.policyVersion,
      actionType: 'admission_packet_policy_evaluation',
    },
  });

  const submission = await provider.submitProjection(prepared);
  await pollToTerminal(provider, submission.requestRef, input.maxPollAttempts ?? 10);
  return persistEvidence(admin, input, provider, submission.requestRef, startedAt);
}

/**
 * Resumes an EXISTING request (already submitted, by this process or an
 * earlier one sharing the same memoized provider) — never re-submits.
 * Fails honestly (throws) rather than fabricating evidence when the request
 * is still pending past the poll budget, or when the provider has no record
 * of it at all (an unknown/garbage requestRef) — this is the idempotent-
 * resume path's own negative case.
 */
export async function resumeAdmissionPacketPolicyEvaluation(
  admin: SupabaseClient,
  input: Pick<AdmissionPacketPolicyEvaluationInput, 'caseId' | 'tenantId' | 'actorPersonaId' | 'requestedByAgentRef' | 'policyVersion' | 'journeyStageId' | 'provider' | 'maxPollAttempts'> & {
    requestRef: string;
    /** The original submission's own start time, if known — carried through
     *  so a resumed record still reports an honest start, not "now". Falls
     *  back to "now" only when genuinely unknown (never fabricated as the
     *  ORIGINAL start when it isn't). */
    startedAt?: string;
  },
): Promise<ConfidentialAdmissionProjectionResult> {
  const provider = input.provider ?? createFactorConfidentialProjectionProvider();
  await pollToTerminal(provider, input.requestRef, input.maxPollAttempts ?? 10);
  return persistEvidence(admin, input, provider, input.requestRef, input.startedAt ?? new Date().toISOString());
}
