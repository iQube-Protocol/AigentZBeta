/**
 * Token-launch domain — behavioral tests (Factor + Aegis Bankr PRD,
 * Phase 4/8). fakeSupabase is an in-memory query-builder double, not a
 * Postgres emulator — it cannot execute the real DB trigger
 * (trg_token_launches_immutable). These tests therefore verify the
 * APPLICATION-LAYER guarantee: no function in this service ever attempts to
 * mutate a spec-bearing field on an approved+ row (recordBankrTerms
 * refuses; the only forward path is reviseWithNewVersion, which always
 * creates a NEW row). The DB trigger is defense-in-depth for a write that
 * bypasses this service entirely — not independently exercised here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

import {
  createDraft,
  transitionState,
  recordBankrTerms,
  approveTokenLaunch,
  submitTokenLaunch,
  confirmTokenLaunch,
  reviseWithNewVersion,
  checkBankrTermsDrift,
  computeSpecHash,
  TokenLaunchError,
} from '@/services/factor/tokenLaunchService';
import { createAssessment, beginRunning, requireReview, ratifyAssessment, addFinding } from '@/services/aegis/aegisAssessmentService';

const DRAFT_INPUT = {
  tenantId: 'default',
  beneficiaryAgentRuntimeId: 'aigent-factor',
  requestingPrincipalPersonaId: 'persona-1',
  preparingAgentRuntimeId: 'aigent-factor',
  chain: 'base',
  tokenName: 'Factor Token',
  tokenSymbol: 'FCTR',
};

const BANKR_TERMS = {
  chain: 'base',
  feeBps: 100,
  creatorVestingSupported: false,
  partnerKeySellsFullSupply: true,
  pairedAssetOptions: ['WETH'],
};

async function walkToApprovalPending(admin: any, overrides: Partial<typeof DRAFT_INPUT> = {}) {
  const draft = await createDraft(admin, { ...DRAFT_INPUT, ...overrides });
  await transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'preparing', actorPersonaId: 'persona-1' });
  await transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'preflighted', actorPersonaId: 'persona-1' });
  await recordBankrTerms(admin, draft.id, 'default', { raw: BANKR_TERMS, sourceUrl: 'https://docs.bankr.bot/token-launching/overview/', retrievedAt: '2026-09-05T00:00:00.000Z' });
  await transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'aegis_review_pending', actorPersonaId: 'persona-1' });
  return draft.id;
}

async function ratifyAdmissible(admin: any, launchId: string) {
  const assessment = await createAssessment(admin, {
    subjectType: 'token_launch',
    subjectRef: launchId,
    policyVersion: 'v1',
    evidenceSnapshot: { ok: true },
    requestedByAgentRef: 'aigent-factor',
    actorPersonaId: 'persona-1',
  });
  await beginRunning(admin, assessment.assessment_id);
  await requireReview(admin, assessment.assessment_id);
  await addFinding(admin, { assessmentId: assessment.assessment_id, dimension: 'utility', claim: 'ok', method: 'review', result: 'pass', confidence: 0.9, falsificationCondition: 'n/a' });
  await ratifyAssessment(admin, { assessmentId: assessment.assessment_id, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' });
  return assessment.assessment_id;
}

async function fullyApprove(admin: any) {
  const launchId = await walkToApprovalPending(admin);
  const assessmentId = await ratifyAdmissible(admin, launchId);
  await admin.from('token_launches').update({ aegis_assessment_id: assessmentId }).eq('id', launchId);
  await transitionState(admin, { id: launchId, tenantId: 'default', toState: 'approval_pending', actorPersonaId: 'persona-1' });
  const approved = await approveTokenLaunch(admin, { id: launchId, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: '2026-09-05T00:00:00.000Z' });
  return approved;
}

describe('createDraft / transitionState — the lifecycle state machine', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('creates a draft in state=draft', async () => {
    const draft = await createDraft(admin, DRAFT_INPUT);
    expect(draft.state).toBe('draft');
    expect(draft.provider).toBe('bankr');
    expect(draft.version).toBe(1);
  });

  it('refuses an invalid transition (draft -> approved directly)', async () => {
    const draft = await createDraft(admin, DRAFT_INPUT);
    await expect(transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'approved', actorPersonaId: 'persona-1' })).rejects.toMatchObject({ code: 'invalid-transition' });
  });

  it('refuses a transition once terminal (confirmed)', async () => {
    const approved = await fullyApprove(admin);
    await submitTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-1', bankrJobId: 'job-1' });
    await confirmTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', transactionHash: '0xabc', tokenAddress: '0xtoken', poolAddress: null, explorerUrl: null });
    await expect(transitionState(admin, { id: approved.id, tenantId: 'default', toState: 'cancelled', actorPersonaId: 'persona-1' })).rejects.toMatchObject({ code: 'terminal-state' });
  });

  it('refuses cross-tenant access', async () => {
    const draft = await createDraft(admin, DRAFT_INPUT);
    await expect(transitionState(admin, { id: draft.id, tenantId: 'tenant-b', toState: 'preparing', actorPersonaId: 'persona-1' })).rejects.toMatchObject({ code: 'cross-tenant-denied' });
  });
});

describe('no launch occurs without an approved exact-spec hash', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('submitTokenLaunch refuses a draft/preparing launch', async () => {
    const draft = await createDraft(admin, DRAFT_INPUT);
    await expect(submitTokenLaunch(admin, { id: draft.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-x', bankrJobId: 'job-x' })).rejects.toMatchObject({ code: 'not-approved' });
  });

  it('approveTokenLaunch refuses without a ratified Aegis assessment', async () => {
    const launchId = await walkToApprovalPending(admin);
    await transitionState(admin, { id: launchId, tenantId: 'default', toState: 'approval_pending', actorPersonaId: 'persona-1' });
    await expect(approveTokenLaunch(admin, { id: launchId, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: '2026-09-05T00:00:00.000Z' })).rejects.toMatchObject({ code: 'no-ratified-assessment' });
  });

  it('approveTokenLaunch refuses without recorded Bankr terms', async () => {
    const draft = await createDraft(admin, DRAFT_INPUT);
    await transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'preparing', actorPersonaId: 'persona-1' });
    await transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'preflighted', actorPersonaId: 'persona-1' });
    await transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'aegis_review_pending', actorPersonaId: 'persona-1' });
    const assessmentId = await ratifyAdmissible(admin, draft.id);
    await admin.from('token_launches').update({ aegis_assessment_id: assessmentId }).eq('id', draft.id);
    await transitionState(admin, { id: draft.id, tenantId: 'default', toState: 'approval_pending', actorPersonaId: 'persona-1' });
    await expect(approveTokenLaunch(admin, { id: draft.id, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: '2026-09-05T00:00:00.000Z' })).rejects.toMatchObject({ code: 'no-bankr-terms' });
  });

  it('a fully-approved launch carries a real spec_hash and approval_hash, both non-null', async () => {
    const approved = await fullyApprove(admin);
    expect(approved.spec_hash).toBeTruthy();
    expect(approved.approval_hash).toBeTruthy();
    expect(approved.spec_hash).toBe(computeSpecHash(approved));
  });
});

describe('a critical Aegis finding blocks approval', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('a not_admissible ratified decision refuses approval', async () => {
    const launchId = await walkToApprovalPending(admin);
    const assessment = await createAssessment(admin, {
      subjectType: 'token_launch', subjectRef: launchId, policyVersion: 'v1', evidenceSnapshot: { ok: true },
      requestedByAgentRef: 'aigent-factor', actorPersonaId: 'persona-1',
    });
    await beginRunning(admin, assessment.assessment_id);
    await requireReview(admin, assessment.assessment_id);
    await addFinding(admin, { assessmentId: assessment.assessment_id, dimension: 'utility', claim: 'overstated', method: 'review', result: 'fail', confidence: 0.95, falsificationCondition: 'n/a', isCritical: true } as any);
    await ratifyAssessment(admin, { assessmentId: assessment.assessment_id, decision: 'not_admissible', ratifiedByPersonaId: 'persona-moneypenny' });
    await admin.from('token_launches').update({ aegis_assessment_id: assessment.assessment_id }).eq('id', launchId);
    await transitionState(admin, { id: launchId, tenantId: 'default', toState: 'approval_pending', actorPersonaId: 'persona-1' });

    await expect(approveTokenLaunch(admin, { id: launchId, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: '2026-09-05T00:00:00.000Z' })).rejects.toMatchObject({ code: 'no-ratified-assessment' });
  });
});

describe('duplicate launch submission is impossible', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('a replayed submission with the SAME idempotency key returns the same row, never re-submits', async () => {
    const approved = await fullyApprove(admin);
    const first = await submitTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-dup', bankrJobId: 'job-dup' });
    const second = await submitTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-dup', bankrJobId: 'job-dup' });
    expect(second.id).toBe(first.id);
    expect(second.bankr_job_id).toBe(first.bankr_job_id);
  });

  it('a second submission attempt with a DIFFERENT idempotency key against an already-submitting launch is refused', async () => {
    const approved = await fullyApprove(admin);
    await submitTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-a', bankrJobId: 'job-a' });
    await expect(
      submitTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-b', bankrJobId: 'job-b' }),
    ).rejects.toMatchObject({ code: 'already-submitted' });
  });
});

describe('stale approvals are refused', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('approveTokenLaunch refuses a launch not in approval_pending (e.g. still draft)', async () => {
    const draft = await createDraft(admin, DRAFT_INPUT);
    await expect(approveTokenLaunch(admin, { id: draft.id, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: '2026-09-05T00:00:00.000Z' })).rejects.toMatchObject({ code: 'not-approval-pending' });
  });

  it('approveTokenLaunch refuses to re-approve an already-approved launch', async () => {
    const approved = await fullyApprove(admin);
    await expect(approveTokenLaunch(admin, { id: approved.id, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: '2026-09-06T00:00:00.000Z' })).rejects.toMatchObject({ code: 'not-approval-pending' });
  });
});

describe('changed Bankr economics force reapproval', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('checkBankrTermsDrift detects a change in fee terms against the approved row', async () => {
    const approved = await fullyApprove(admin);
    const noDrift = checkBankrTermsDrift(approved, BANKR_TERMS);
    expect(noDrift.driftDetected).toBe(false);

    const changedTerms = { ...BANKR_TERMS, feeBps: 250 };
    const drifted = checkBankrTermsDrift(approved, changedTerms);
    expect(drifted.driftDetected).toBe(true);
  });

  it('recordBankrTerms refuses on an already-approved row — the only forward path is a new version', async () => {
    const approved = await fullyApprove(admin);
    await expect(
      recordBankrTerms(admin, approved.id, 'default', { raw: { ...BANKR_TERMS, feeBps: 999 }, sourceUrl: 'https://docs.bankr.bot/', retrievedAt: '2026-09-06T00:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'already-approved' });
  });

  it('reviseWithNewVersion supersedes the approved row and creates a fresh draft carrying the drifted term', async () => {
    const approved = await fullyApprove(admin);
    const revised = await reviseWithNewVersion(admin, approved.id, 'default', { tokenName: 'Factor Token v2' });
    expect(revised.version).toBe(approved.version + 1);
    expect(revised.supersedes_id).toBe(approved.id);
    expect(revised.state).toBe('draft');
    expect(revised.spec_hash).toBeNull(); // a fresh draft is never pre-approved

    const oldRow = await admin.from('token_launches').select('*').eq('id', approved.id).maybeSingle();
    expect(oldRow.data.superseded_by).toBe(revised.id);
    expect(oldRow.data.state).toBe('superseded');
    // The OLD row's own spec/approval hash are UNTOUCHED — history is preserved, never edited.
    expect(oldRow.data.spec_hash).toBe(approved.spec_hash);
    expect(oldRow.data.approval_hash).toBe(approved.approval_hash);
  });
});

describe('confirmTokenLaunch — fill-once outcome fields', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('a replayed confirm is idempotent', async () => {
    const approved = await fullyApprove(admin);
    await submitTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-c', bankrJobId: 'job-c' });
    const first = await confirmTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', transactionHash: '0xabc', tokenAddress: '0xtoken', poolAddress: '0xpool', explorerUrl: 'https://basescan.org/tx/0xabc' });
    const second = await confirmTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', transactionHash: '0xabc', tokenAddress: '0xtoken', poolAddress: '0xpool', explorerUrl: 'https://basescan.org/tx/0xabc' });
    expect(second.transaction_hash).toBe(first.transaction_hash);
  });

  it('refuses to confirm before submission', async () => {
    const approved = await fullyApprove(admin);
    await expect(
      confirmTokenLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', transactionHash: '0xabc', tokenAddress: '0xtoken', poolAddress: null, explorerUrl: null }),
    ).rejects.toMatchObject({ code: 'not-submitted' });
  });
});
