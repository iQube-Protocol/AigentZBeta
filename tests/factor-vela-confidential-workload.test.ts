/**
 * Factor's Vela confidential-projection workload (Factor + Aegis PRD
 * tranche: "integrate the existing Vela SDK test TEE and prepare Factor for
 * a controlled end-to-end Horizen Journey Spine rehearsal").
 *
 * Exercises services/factor/factorConfidentialWorkload.ts against the REAL
 * VelaConfidentialProjectionProvider + VelaTestTransport (never a second,
 * parallel simulator) and the REAL services/constitutionalCommerce/
 * unifiedConsequenceProjection.ts composition seam for the live-only-policy
 * proof. No live Supabase/Vela credentials are exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

import { createOrResumeCase } from '@/services/factor/factorCaseService';
import {
  runAdmissionPacketPolicyEvaluation,
  resumeAdmissionPacketPolicyEvaluation,
} from '@/services/factor/factorConfidentialWorkload';
import {
  createFactorConfidentialProjectionProvider,
  resetFactorConfidentialProjectionProviderForTests,
} from '@/services/vela/velaFactorProvider';
import { composeConfidentialComponent, type ConfidentialEvidenceInput } from '@/services/constitutionalCommerce/unifiedConsequenceProjection';

async function seedCase(admin: any, candidateKey: string) {
  const { case: c } = await createOrResumeCase(admin, {
    ownerPersonaId: 'persona-1',
    createdByPersonaId: 'persona-1',
    candidateIdentityKey: candidateKey,
    candidateDisplayName: `Candidate ${candidateKey}`,
  });
  return c;
}

beforeEach(() => {
  resetFactorConfidentialProjectionProviderForTests();
});

describe('runAdmissionPacketPolicyEvaluation — a real, successful simulated Vela workload', () => {
  it('drives the real provider end to end and persists honest, receipt-safe evidence (never the confidential inputs)', async () => {
    const admin = makeFakeAdmin();
    const c = await seedCase(admin, 'candidate-vela-1');
    const provider = createFactorConfidentialProjectionProvider({ applicationId: 'test-app-1' });

    const result = await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: c.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 80,
      policyThreshold: 60,
      provider,
    });

    expect(result.disposition).toBe('ACCEPTABLE');
    expect(result.attestationMode).toBe('NO_ATTESTATION_LOCAL'); // honestly simulated — no live Vela deployment exists
    expect(result.protocolExecutionVerified).toBe(true);
    expect(result.teeAttestationVerified).toBe(false); // simulation never proves hardware attestation
    expect(result.requestRef).toBeTruthy();
    expect(result.evidenceItemId).toBeTruthy();

    const { data: evidenceRows } = await admin.from('factor_evidence_items').select('*').eq('case_id', c.case_id);
    expect(evidenceRows).toHaveLength(1);
    const payload = evidenceRows[0].payload;
    expect(payload.disposition).toBe('ACCEPTABLE');
    expect(payload.attestationMode).toBe('NO_ATTESTATION_LOCAL');
    expect(payload.journeyStageId).toBe('register');
    // Never the confidential values themselves — check every persisted field
    // individually (a substring search over the whole payload is unsound:
    // the hex commitments/proof refs can incidentally contain "80"/"60" as a
    // substring with no relation to the actual confidential scores).
    for (const value of Object.values(payload)) {
      if (typeof value === 'number') {
        expect(value).not.toBe(80);
        expect(value).not.toBe(60);
      }
    }
    expect(payload).not.toHaveProperty('readinessScore');
    expect(payload).not.toHaveProperty('policyThreshold');

    const { data: eventRows } = await admin.from('factor_case_events').select('*').eq('case_id', c.case_id);
    expect(eventRows.some((e: any) => e.event_type === 'confidential_projection_evaluated')).toBe(true);
  });

  it('reports UNACCEPTABLE honestly when the confidential comparison fails, still never revealing the scores', async () => {
    const admin = makeFakeAdmin();
    const c = await seedCase(admin, 'candidate-vela-2');
    const provider = createFactorConfidentialProjectionProvider({ applicationId: 'test-app-2' });

    const result = await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: c.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 20,
      policyThreshold: 60,
      provider,
    });
    expect(result.disposition).toBe('UNACCEPTABLE');
  });
});

describe('tampered attestation — a result signed by an unexpected TEE identity', () => {
  it('protocolExecutionVerified is false, and the evidence is still persisted honestly (never silently upgraded to verified)', async () => {
    const admin = makeFakeAdmin();
    const c = await seedCase(admin, 'candidate-vela-tamper');
    const provider = createFactorConfidentialProjectionProvider({
      applicationId: 'test-app-tamper',
      registeredTeeSigner: '0x0000000000000000000000000000000000000001',
      signingTeeSigner: '0x000000000000000000000000000000000000baad', // an unrelated signer
    });

    const result = await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: c.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 90,
      policyThreshold: 10,
      provider,
    });

    expect(result.protocolExecutionVerified).toBe(false);
    const { data: evidenceRows } = await admin.from('factor_evidence_items').select('*').eq('case_id', c.case_id);
    expect(evidenceRows[0].payload.protocolExecutionVerified).toBe(false);
  });
});

describe('live-only policy rejects the simulated attestation (reuses the EXISTING composeConfidentialComponent, no new policy layer)', () => {
  it('composing Factor\'s real simulated evidence under attestationRequirement REQUIRED yields UNRESOLVED — never falsely ACCEPTABLE/UNACCEPTABLE', async () => {
    const admin = makeFakeAdmin();
    const c = await seedCase(admin, 'candidate-vela-live-only');
    const provider = createFactorConfidentialProjectionProvider({ applicationId: 'test-app-live-only' });

    const result = await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: c.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 95,
      policyThreshold: 10,
      provider,
    });
    expect(result.disposition).toBe('ACCEPTABLE'); // the confidential app itself says yes

    const evidenceInput: ConfidentialEvidenceInput = {
      provider: 'vela',
      requestRef: result.requestRef,
      disposition: result.disposition,
      resultCommitment: 'result-commitment-placeholder',
      payloadCommitment: 'payload-commitment-placeholder',
      protocolExecutionVerified: result.protocolExecutionVerified,
      teeAttestationVerified: result.teeAttestationVerified,
      attestationMode: result.attestationMode,
    };

    const component = composeConfidentialComponent('REQUIRED', evidenceInput, { attestationRequirement: 'REQUIRED' });
    // A live-only policy REJECTS the simulated attestation — disposition
    // becomes UNRESOLVED, independent of the confidential app's own
    // ACCEPTABLE verdict, and never silently ACCEPTABLE.
    expect(component.disposition).toBe('UNRESOLVED');
    expect(component.reason).toMatch(/NO_ATTESTATION_LOCAL/);
  });

  it('the SAME evidence composes as ACCEPTABLE when the policy explicitly does not require attestation (NOT_REQUIRED)', async () => {
    const admin = makeFakeAdmin();
    const c = await seedCase(admin, 'candidate-vela-not-required');
    const provider = createFactorConfidentialProjectionProvider({ applicationId: 'test-app-not-required' });

    const result = await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: c.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 95,
      policyThreshold: 10,
      provider,
    });

    const evidenceInput: ConfidentialEvidenceInput = {
      provider: 'vela',
      requestRef: result.requestRef,
      disposition: result.disposition,
      resultCommitment: 'x',
      payloadCommitment: 'y',
      protocolExecutionVerified: result.protocolExecutionVerified,
      teeAttestationVerified: result.teeAttestationVerified,
      attestationMode: result.attestationMode,
    };
    const component = composeConfidentialComponent('REQUIRED', evidenceInput, { attestationRequirement: 'NOT_REQUIRED' });
    expect(component.disposition).toBe('ACCEPTABLE');
  });
});

describe('cross-agent isolation — two cases under different agents never bleed evidence', () => {
  it('each case\'s evidence item names only its own case and workload — never the other', async () => {
    const admin = makeFakeAdmin();
    const caseA = await seedCase(admin, 'candidate-agent-a');
    const caseB = await seedCase(admin, 'candidate-agent-b');
    const provider = createFactorConfidentialProjectionProvider({ applicationId: 'test-app-cross-agent' });

    await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: caseA.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 90,
      policyThreshold: 10,
      provider,
    });
    await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: caseB.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-other-tokenized-agent',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 5,
      policyThreshold: 10,
      provider,
    });

    const { data: evidenceA } = await admin.from('factor_evidence_items').select('*').eq('case_id', caseA.case_id);
    const { data: evidenceB } = await admin.from('factor_evidence_items').select('*').eq('case_id', caseB.case_id);
    expect(evidenceA).toHaveLength(1);
    expect(evidenceB).toHaveLength(1);
    expect(evidenceA[0].payload.disposition).toBe('ACCEPTABLE');
    expect(evidenceB[0].payload.disposition).toBe('UNACCEPTABLE');
    expect(evidenceA[0].evidence_item_id).not.toBe(evidenceB[0].evidence_item_id);
  });
});

describe('idempotent-resume — resuming never re-submits, and an unknown request fails honestly rather than fabricating evidence', () => {
  it('resuming an already-terminal request returns the SAME evidence without a second submission', async () => {
    const admin = makeFakeAdmin();
    const c = await seedCase(admin, 'candidate-resume-ok');
    const provider = createFactorConfidentialProjectionProvider({ applicationId: 'test-app-resume' });
    const submitSpy = vi.spyOn(provider, 'submitProjection');

    const first = await runAdmissionPacketPolicyEvaluation(admin, {
      caseId: c.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      readinessScore: 90,
      policyThreshold: 10,
      provider,
    });
    expect(submitSpy).toHaveBeenCalledTimes(1);

    const resumed = await resumeAdmissionPacketPolicyEvaluation(admin, {
      caseId: c.case_id,
      tenantId: 'default',
      actorPersonaId: 'persona-operator-1',
      requestedByAgentRef: 'aigent-factor',
      policyVersion: 'v1',
      journeyStageId: 'register',
      requestRef: first.requestRef,
      provider,
    });

    // Resuming must NEVER call submitProjection again.
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(resumed.requestRef).toBe(first.requestRef);
    expect(resumed.disposition).toBe(first.disposition);
  });

  it('resuming an unknown/garbage requestRef fails honestly rather than fabricating evidence', async () => {
    const admin = makeFakeAdmin();
    const c = await seedCase(admin, 'candidate-resume-unknown');
    const provider = createFactorConfidentialProjectionProvider({ applicationId: 'test-app-resume-unknown' });

    await expect(
      resumeAdmissionPacketPolicyEvaluation(admin, {
        caseId: c.case_id,
        tenantId: 'default',
        actorPersonaId: 'persona-operator-1',
        requestedByAgentRef: 'aigent-factor',
        policyVersion: 'v1',
        journeyStageId: 'register',
        requestRef: '0xdoes-not-exist',
        provider,
        maxPollAttempts: 1,
      }),
    ).rejects.toThrow();

    const { data: evidenceRows } = await admin.from('factor_evidence_items').select('*').eq('case_id', c.case_id);
    expect(evidenceRows).toHaveLength(0); // no fabricated evidence on failure
  });
});
