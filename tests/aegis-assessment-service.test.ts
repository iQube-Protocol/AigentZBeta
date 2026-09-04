/**
 * aegisAssessmentService — self-assessment refusal, critical-failure gate,
 * immutability, and versioning (PRD Journey B, acceptance criteria 3-7,
 * failure-path tests "Factor attempts self-assessment" / "assessment
 * critical failure" / "Factor attempts to participate in its own Aegis
 * assessment").
 */
import { describe, it, expect } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';
import {
  createAssessment,
  beginRunning,
  requireReview,
  ratifyAssessment,
  addFinding,
  AegisAssessmentError,
} from '../services/aegis/aegisAssessmentService';

const CASE_ID = 'case-1';
const FACTOR_REF = 'agent-ref-factor';
const CANDIDATE_REF = 'agent-ref-candidate';
const REVIEWER_REF = 'persona-ref-reviewer';

async function makeReadyAssessment(admin: ReturnType<typeof makeFakeAdmin>) {
  const a = await createAssessment(admin, {
    caseId: CASE_ID,
    policyId: 'aegis-policy-fs-agent',
    policyVersion: '0.1.0',
    evidenceSnapshot: { capability: 'trading', wallet: 'proof-ref-1' },
    subjectAgentRef: CANDIDATE_REF,
    requestedByAgentRef: FACTOR_REF,
  });
  await beginRunning(admin, a.assessment_id);
  await requireReview(admin, a.assessment_id);
  return a;
}

describe('aegisAssessmentService', () => {
  it('refuses to create an assessment where the requester is the subject (self-assessment)', async () => {
    const admin = makeFakeAdmin();
    await expect(
      createAssessment(admin, {
        caseId: CASE_ID,
        policyId: 'p',
        policyVersion: '1',
        evidenceSnapshot: {},
        subjectAgentRef: FACTOR_REF,
        requestedByAgentRef: FACTOR_REF,
      }),
    ).rejects.toMatchObject({ code: 'self-assessment-refused' });
  });

  it('computes a deterministic evidence-set hash for identical canonical input', async () => {
    const admin1 = makeFakeAdmin();
    const admin2 = makeFakeAdmin();
    const a1 = await createAssessment(admin1, {
      caseId: CASE_ID,
      policyId: 'p',
      policyVersion: '1',
      evidenceSnapshot: { b: 2, a: 1 },
      subjectAgentRef: CANDIDATE_REF,
      requestedByAgentRef: FACTOR_REF,
    });
    const a2 = await createAssessment(admin2, {
      caseId: CASE_ID,
      policyId: 'p',
      policyVersion: '1',
      evidenceSnapshot: { a: 1, b: 2 }, // same content, different key order
      subjectAgentRef: CANDIDATE_REF,
      requestedByAgentRef: FACTOR_REF,
    });
    expect(a1.evidence_set_hash).toBe(a2.evidence_set_hash);
  });

  it('a critical failed finding blocks an admissible decision regardless of other findings', async () => {
    const admin = makeFakeAdmin();
    const a = await makeReadyAssessment(admin);
    await addFinding(admin, {
      assessmentId: a.assessment_id,
      dimension: 'security_posture',
      claim: 'candidate exposes an unauthenticated admin endpoint',
      method: 'automated-scan',
      result: 'fail',
      confidence: 'high',
      falsificationCondition: 'endpoint requires auth in a re-scan',
      isCritical: true,
    });
    await addFinding(admin, {
      assessmentId: a.assessment_id,
      dimension: 'capability_evidence',
      claim: 'candidate demonstrates the declared trading capability',
      method: 'manual-review',
      result: 'pass',
      confidence: 'high',
      falsificationCondition: 'a repeat demo fails',
    });

    await expect(
      ratifyAssessment(admin, { assessmentId: a.assessment_id, decision: 'admissible', ratifiedByPersonaRef: REVIEWER_REF }),
    ).rejects.toMatchObject({ code: 'critical-failure-blocks-admission' });

    // But 'not_admissible' with the same findings is a legitimate ratification.
    const ratified = await ratifyAssessment(admin, {
      assessmentId: a.assessment_id,
      decision: 'not_admissible',
      ratifiedByPersonaRef: REVIEWER_REF,
    });
    expect(ratified.state).toBe('ratified');
    expect(ratified.decision).toBe('not_admissible');
  });

  it('ratifies cleanly when there is no critical failure, and the hash is stable', async () => {
    const admin = makeFakeAdmin();
    const a = await makeReadyAssessment(admin);
    await addFinding(admin, {
      assessmentId: a.assessment_id,
      dimension: 'capability_evidence',
      claim: 'candidate demonstrates the declared capability',
      method: 'manual-review',
      result: 'pass',
      confidence: 'high',
      falsificationCondition: 'a repeat demo fails',
    });
    const ratified = await ratifyAssessment(admin, {
      assessmentId: a.assessment_id,
      decision: 'admissible',
      ratifiedByPersonaRef: REVIEWER_REF,
    });
    expect(ratified.state).toBe('ratified');
    expect(ratified.immutable).toBe(true);
    expect(typeof ratified.assessment_hash).toBe('string');
    expect(ratified.assessment_hash!.length).toBeGreaterThan(0);
  });

  it('refuses to ratify from a state other than review_required', async () => {
    const admin = makeFakeAdmin();
    const a = await createAssessment(admin, {
      caseId: CASE_ID,
      policyId: 'p',
      policyVersion: '1',
      evidenceSnapshot: {},
      subjectAgentRef: CANDIDATE_REF,
      requestedByAgentRef: FACTOR_REF,
    });
    await expect(
      ratifyAssessment(admin, { assessmentId: a.assessment_id, decision: 'admissible', ratifiedByPersonaRef: REVIEWER_REF }),
    ).rejects.toMatchObject({ code: 'invalid-transition' });
  });

  it('cannot add findings once ratified (assessment-closed)', async () => {
    const admin = makeFakeAdmin();
    const a = await makeReadyAssessment(admin);
    await ratifyAssessment(admin, { assessmentId: a.assessment_id, decision: 'not_admissible', ratifiedByPersonaRef: REVIEWER_REF });
    await expect(
      addFinding(admin, {
        assessmentId: a.assessment_id,
        dimension: 'capability_evidence',
        claim: 'late finding',
        method: 'manual-review',
        result: 'pass',
        confidence: 'low',
        falsificationCondition: 'n/a',
      }),
    ).rejects.toMatchObject({ code: 'assessment-closed' });
  });

  it('a new version links to the prior via supersedes_assessment_id and never edits it', async () => {
    const admin = makeFakeAdmin();
    const v1 = await makeReadyAssessment(admin);
    await ratifyAssessment(admin, { assessmentId: v1.assessment_id, decision: 'insufficient_evidence', ratifiedByPersonaRef: REVIEWER_REF });

    const v2 = await createAssessment(admin, {
      caseId: CASE_ID,
      policyId: 'aegis-policy-fs-agent',
      policyVersion: '0.1.0',
      evidenceSnapshot: { capability: 'trading', wallet: 'proof-ref-1', extra: 'now-supplied' },
      subjectAgentRef: CANDIDATE_REF,
      requestedByAgentRef: FACTOR_REF,
    });
    expect(v2.version).toBe(2);
    expect(v2.supersedes_assessment_id).toBe(v1.assessment_id);

    const priorRow = admin.table('aegis_assessments').find((r: any) => r.assessment_id === v1.assessment_id);
    expect(priorRow.state).toBe('ratified');
    expect(priorRow.decision).toBe('insufficient_evidence');
  });
});
