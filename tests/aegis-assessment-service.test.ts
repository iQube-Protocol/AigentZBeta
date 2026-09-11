/**
 * Aegis assessment engine (PRD Journey B / §6.2) — unit tests against the
 * in-memory fakeSupabase fixture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

// DiDQube Phase 4 item 2 (2026-09-07): createAssessment's optional
// subjectIdentity path calls resolveDiDQube, which reads via its OWN
// getSupabaseServer() call — not the `admin` parameter passed to
// createAssessment. Mocking getSupabaseServer to return the SAME
// per-test fake admin instance (assigned in beforeEach below) is what lets
// resolveDiDQube see the agent_root_identity/agent_didqubes/didqubes rows
// a test seeds directly into that instance.
let currentAdmin: ReturnType<typeof makeFakeAdmin>;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => currentAdmin,
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
    currentAdmin = admin;
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

describe('DiDQube Phase 4 item 2 (2026-09-07) — optional subjectIdentity resolution, additive and never blocking', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
    currentAdmin = admin;
  });

  it('with no subjectIdentity supplied, every subject_didqube_*/identity_resolution_snapshot_hash field stays null — never fabricated', async () => {
    const created = await createAssessment(admin, {
      subjectType: 'factor_case',
      subjectRef: 'case-no-identity',
      policyVersion: 'v1',
      evidenceSnapshot: {},
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    expect(created.subject_didqube_id).toBeNull();
    expect(created.subject_didqube_class).toBeNull();
    expect(created.subject_resolution_commitment).toBeNull();
    expect(created.identity_resolution_snapshot_hash).toBeNull();
  });

  it('a subjectIdentity that resolves cleanly populates all four fields plus a stable identity-resolution snapshot hash', async () => {
    admin.table('agent_root_identity').push({
      id: 'root-1',
      agent_id: 'polity-bound:aletheon',
      did_uri: 'did:agent:root:aletheon',
      agent_class: 'polity_bound',
      display_name: 'Aletheon',
      description: 'A test agent',
      agent_card_url: 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json',
      agent_card_slug: 'aletheon',
      bound_passport_id: null,
    });
    admin.table('didqubes').push({ didqube_id: 'didqube-1', subject_class: 'agent', lifecycle_state: 'active', superseded_by: null });
    admin.table('agent_didqubes').push({ didqube_id: 'didqube-1', agent_root_identity_id: 'root-1', subject_class: 'agent' });

    const created = await createAssessment(admin, {
      subjectType: 'factor_case',
      subjectRef: 'case-with-identity',
      policyVersion: 'v1',
      evidenceSnapshot: {},
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
      subjectIdentity: { kind: 'agent_root_identity_id', agentRootIdentityId: 'root-1' },
    });
    expect(created.subject_didqube_id).toBe('didqube-1');
    expect(created.subject_didqube_class).toBe('agent');
    expect(created.subject_resolution_commitment).toBeTruthy();
    expect(created.subject_resolution_commitment_version).toBe('v1');
    expect(created.identity_resolution_snapshot_hash).toBeTruthy();
  });

  it('an unresolvable subjectIdentity (no anchor exists) leaves the fields null but still creates the assessment — additive evidence never blocks', async () => {
    const created = await createAssessment(admin, {
      subjectType: 'factor_case',
      subjectRef: 'case-unresolvable-identity',
      policyVersion: 'v1',
      evidenceSnapshot: {},
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
      subjectIdentity: { kind: 'agent_root_identity_id', agentRootIdentityId: 'root-does-not-exist' },
    });
    expect(created.state).toBe('evidence_locked');
    expect(created.subject_didqube_id).toBeNull();
    expect(created.identity_resolution_snapshot_hash).toBeNull();
  });

  it('the identity-resolution snapshot is written once at creation and is NEVER touched by ratification', async () => {
    admin.table('agent_root_identity').push({
      id: 'root-2',
      agent_id: 'polity-bound:knightfall',
      did_uri: 'did:agent:root:knightfall',
      agent_class: 'polity_bound',
      display_name: 'Knightfall',
      description: 'A test agent',
      agent_card_url: 'https://dev-beta.aigentz.me/api/agents/knightfall/agent-card.json',
      agent_card_slug: 'knightfall',
      bound_passport_id: null,
    });
    admin.table('didqubes').push({ didqube_id: 'didqube-2', subject_class: 'agent', lifecycle_state: 'active', superseded_by: null });
    admin.table('agent_didqubes').push({ didqube_id: 'didqube-2', agent_root_identity_id: 'root-2', subject_class: 'agent' });

    const created = await createAssessment(admin, {
      subjectType: 'factor_case',
      subjectRef: 'case-snapshot-immutable',
      policyVersion: 'v1',
      evidenceSnapshot: {},
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
      subjectIdentity: { kind: 'agent_root_identity_id', agentRootIdentityId: 'root-2' },
    });
    const snapshotHashAtCreation = created.identity_resolution_snapshot_hash;
    await beginRunning(admin, created.assessment_id);
    await requireReview(admin, created.assessment_id);
    const ratified = await ratifyAssessment(admin, { assessmentId: created.assessment_id, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' });
    expect(ratified.identity_resolution_snapshot_hash).toBe(snapshotHashAtCreation);
    expect(ratified.subject_didqube_id).toBe('didqube-2');
  });
});
