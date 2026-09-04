/**
 * Aegis assessment engine (PRD Journey B / §6.2) — unit tests against the
 * in-memory fakeSupabase fixture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

import { createAssessment, beginRunning, requireReview, ratifyAssessment, failAssessment, addFinding, AegisAssessmentError } from '@/services/aegis/aegisAssessmentService';

async function runToReview(admin: any, subjectRef: string, requestedByAgentRef = 'aigent-factor') {
  const created = await createAssessment(admin, {
    subjectType: 'factor_case',
    subjectRef,
    policyVersion: 'aegis-policy-v1',
    evidenceSnapshot: { b: 2, a: 1 },
    requestedByAgentRef,
    actorPersonaId: 'persona-1',
  });
  await beginRunning(admin, created.assessment_id);
  await requireReview(admin, created.assessment_id);
  return created;
}

describe('aegisAssessmentService', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('refuses to assess a candidate that is the requester itself (Factor cannot assess itself)', async () => {
    await expect(
      createAssessment(admin, {
        subjectType: 'agent',
        subjectRef: 'aigent-factor',
        policyVersion: 'v1',
        evidenceSnapshot: {},
        requestedByAgentRef: 'aigent-factor',
        actorPersonaId: 'persona-1',
      }),
    ).rejects.toMatchObject({ code: 'self-assessment-refused' });
  });

  it('computes a deterministic, key-order-independent evidence-set hash', async () => {
    const admin2 = makeFakeAdmin();
    const a = await createAssessment(admin, {
      subjectType: 'factor_case',
      subjectRef: 'case-x',
      policyVersion: 'v1',
      evidenceSnapshot: { a: 1, b: 2 },
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    const b = await createAssessment(admin2, {
      subjectType: 'factor_case',
      subjectRef: 'case-x',
      policyVersion: 'v1',
      evidenceSnapshot: { b: 2, a: 1 }, // same content, different key order
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    expect(a.evidence_snapshot_hash).toBe(b.evidence_snapshot_hash);
  });

  it('a critical failed finding blocks an admissible decision even with otherwise-passing findings', async () => {
    const created = await runToReview(admin, 'case-critical');
    await addFinding(admin, {
      assessmentId: created.assessment_id,
      dimension: 'capability',
      claim: 'declared capability matches observed behavior',
      method: 'static-review',
      result: 'pass',
      confidence: 0.9,
      falsificationCondition: 'observed capability diverges from declaration',
    });
    await addFinding(admin, {
      assessmentId: created.assessment_id,
      dimension: 'security',
      claim: 'no critical vulnerabilities in declared endpoints',
      method: 'scan',
      result: 'fail',
      confidence: 0.95,
      falsificationCondition: 'a critical CVE is patched',
      isCritical: true,
    });
    await expect(
      ratifyAssessment(admin, { assessmentId: created.assessment_id, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' }),
    ).rejects.toMatchObject({ code: 'critical-failure-blocks-admission' });
  });

  it('a critical failed finding does NOT block a not_admissible decision', async () => {
    const created = await runToReview(admin, 'case-critical-2');
    await addFinding(admin, {
      assessmentId: created.assessment_id,
      dimension: 'security',
      claim: 'no critical vulnerabilities',
      method: 'scan',
      result: 'fail',
      confidence: 0.95,
      falsificationCondition: 'patched',
      isCritical: true,
    });
    const ratified = await ratifyAssessment(admin, { assessmentId: created.assessment_id, decision: 'not_admissible', ratifiedByPersonaId: 'persona-moneypenny' });
    expect(ratified.state).toBe('ratified');
    expect(ratified.decision).toBe('not_admissible');
  });

  it('ratifies cleanly with a stable assessment hash and marks the row immutable in state', async () => {
    const created = await runToReview(admin, 'case-clean');
    await addFinding(admin, {
      assessmentId: created.assessment_id,
      dimension: 'provenance',
      claim: 'code provenance is traceable',
      method: 'review',
      result: 'pass',
      confidence: 0.8,
      falsificationCondition: 'an unattributed dependency is found',
    });
    const ratified = await ratifyAssessment(admin, { assessmentId: created.assessment_id, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' });
    expect(ratified.state).toBe('ratified');
    expect(ratified.assessment_hash).toBeTruthy();
    expect(ratified.ratified_at).toBeTruthy();
  });

  it('refuses to ratify from a state other than review_required', async () => {
    const created = await createAssessment(admin, {
      subjectType: 'factor_case',
      subjectRef: 'case-wrong-state',
      policyVersion: 'v1',
      evidenceSnapshot: {},
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    await expect(ratifyAssessment(admin, { assessmentId: created.assessment_id, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' })).rejects.toMatchObject({
      code: 'invalid-transition',
    });
  });

  it('refuses to add a finding once the assessment is closed (ratified/failed)', async () => {
    const created = await runToReview(admin, 'case-closed');
    await ratifyAssessment(admin, { assessmentId: created.assessment_id, decision: 'not_admissible', ratifiedByPersonaId: 'persona-moneypenny' });
    await expect(
      addFinding(admin, {
        assessmentId: created.assessment_id,
        dimension: 'late',
        claim: 'too late',
        method: 'n/a',
        result: 'pass',
        confidence: 0.5,
        falsificationCondition: 'n/a',
      }),
    ).rejects.toMatchObject({ code: 'assessment-closed' });
  });

  it('a new assessment for the same subject supersedes the prior one without mutating it', async () => {
    const first = await runToReview(admin, 'case-versioned');
    await ratifyAssessment(admin, { assessmentId: first.assessment_id, decision: 'insufficient_evidence', ratifiedByPersonaId: 'persona-moneypenny' });

    const second = await createAssessment(admin, {
      subjectType: 'factor_case',
      subjectRef: 'case-versioned',
      policyVersion: 'v1',
      evidenceSnapshot: { newEvidence: true },
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });

    const firstRow = admin.table('aegis_assessments').find((r: any) => r.assessment_id === first.assessment_id);
    expect(firstRow.superseded_by).toBe(second.assessment_id);
    expect(firstRow.decision).toBe('insufficient_evidence'); // untouched
    expect(second.supersedes_assessment_id).toBe(first.assessment_id);
  });
});
