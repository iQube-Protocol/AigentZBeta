/**
 * Factor's Bankr capability handlers — behavioral tests (Factor + Aegis
 * Bankr PRD, Phase 5/8). Each handler in services/factor/
 * bankrCapabilityHandlers.ts is a thin wrapper over the already-tested
 * Phase 2-4 services; these tests exercise the WRAPPER wiring itself (does
 * it call the right service with the right shape, does it stay honest about
 * simulated/unconfigured state) rather than re-deriving coverage that
 * already exists in tests/bankr-provider-adapter.test.ts,
 * tests/provider-wallet-binding.test.ts and tests/token-launch-service.test.ts.
 *
 * No live Supabase/Bankr credentials are exercised — the fake Bankr
 * transport (deterministic, simulated:true) and the in-memory fakeSupabase
 * fixture are used throughout, mirroring every other Phase 2-4 test file.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

const FACTOR_OWNER_ADDRESS = '0xF67299Ad3CB85f3A788CE38012C99Df7213E2734';
const FACTOR_SETTLEMENT_ADDRESS = '0xE478E454b8c97682CACabe0345bb01AF30900ac1';

vi.mock('@/services/wallet/agentPurposeWalletService', () => ({
  AgentPurposeWalletService: vi.fn().mockImplementation(() => ({
    getOwnerWalletAddress: vi.fn(async () => FACTOR_OWNER_ADDRESS),
    getBinding: vi.fn(async () => ({ address: FACTOR_SETTLEMENT_ADDRESS })),
  })),
}));

import {
  assessIssuerReadiness,
  inspectOrProvisionProviderBinding,
  prepareLaunchProposal,
  preflightLaunch,
  requestAegisAssessment,
  requestApproval,
  submitApprovedLaunch,
  inspectDeploymentStatus,
  inspectFeeClaims,
} from '@/services/factor/bankrCapabilityHandlers';
import { approveTokenLaunch } from '@/services/factor/tokenLaunchService';
import { beginRunning, requireReview, addFinding, ratifyAssessment, getCurrentAssessment } from '@/services/aegis/aegisAssessmentService';

const DRAFT_INPUT = {
  tenantId: 'default',
  beneficiaryAgentRuntimeId: 'aigent-factor',
  requestingPrincipalPersonaId: 'persona-1',
  preparingAgentRuntimeId: 'aigent-factor',
  chain: 'base',
  tokenName: 'Factor Token',
  tokenSymbol: 'FCTR',
};

async function ratifyAdmissibleFor(admin: any, launchId: string) {
  const assessment = await requestAegisAssessment(admin, {
    launchId,
    tenantId: 'default',
    policyVersion: 'v1',
    evidenceSnapshot: { ok: true },
    requestedByAgentRef: 'aigent-factor',
    actorPersonaId: 'persona-1',
  });
  const current = await getCurrentAssessment(admin, 'token_launch', launchId);
  const assessmentId = current!.assessment_id;
  await beginRunning(admin, assessmentId);
  await requireReview(admin, assessmentId);
  await addFinding(admin, { assessmentId, dimension: 'utility', claim: 'ok', method: 'review', result: 'pass', confidence: 0.9, falsificationCondition: 'n/a' });
  await ratifyAssessment(admin, { assessmentId, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' });
  return assessment;
}

async function walkToApproved(admin: any) {
  const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
  await preflightLaunch(admin, draft.id, 'default', 'persona-1');
  await ratifyAdmissibleFor(admin, draft.id);
  await requestApproval(admin, draft.id, 'default', 'persona-1');
  return approveTokenLaunch(admin, { id: draft.id, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: '2026-09-05T00:00:00.000Z' });
}

describe('assessIssuerReadiness — honest composition, never fabricates a live connection', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('reports blockers for both unconfigured Bankr and a missing binding', async () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    const admin = makeFakeAdmin();
    const readiness = await assessIssuerReadiness(admin, 'default', 'aigent-factor');
    expect(readiness.bankrConfigured).toBe(false);
    expect(readiness.bankrMode).toBe('fake');
    expect(readiness.hasProviderWalletBinding).toBe(false);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.length).toBe(2);
  });

  it('drops the binding blocker once a binding is provisioned, but stays not-ready on unconfigured Bankr', async () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    const admin = makeFakeAdmin();
    await inspectOrProvisionProviderBinding(admin, 'default', 'aigent-factor');
    const readiness = await assessIssuerReadiness(admin, 'default', 'aigent-factor');
    expect(readiness.hasProviderWalletBinding).toBe(true);
    expect(readiness.blockers).toHaveLength(1);
    expect(readiness.blockers[0]).toMatch(/not configured/i);
    expect(readiness.ready).toBe(false);
  });
});

describe('inspectOrProvisionProviderBinding — idempotent, never invents Factor\'s canonical addresses', () => {
  it('provisions using the real owner/settlement addresses from the (mocked) wallet service', async () => {
    const admin = makeFakeAdmin();
    const binding = await inspectOrProvisionProviderBinding(admin, 'default', 'aigent-factor');
    expect(binding.metame_owner_wallet_address).toBe(FACTOR_OWNER_ADDRESS);
    expect(binding.metame_settlement_wallet_address).toBe(FACTOR_SETTLEMENT_ADDRESS);
    expect(binding.status).toBe('active');
  });

  it('a second call returns the same binding, never a duplicate', async () => {
    const admin = makeFakeAdmin();
    const first = await inspectOrProvisionProviderBinding(admin, 'default', 'aigent-factor');
    const second = await inspectOrProvisionProviderBinding(admin, 'default', 'aigent-factor');
    expect(second.id).toBe(first.id);
  });
});

describe('prepareLaunchProposal — never invents token metadata, only ever uses caller-supplied fields', () => {
  it('creates a draft and immediately advances it to preparing', async () => {
    const admin = makeFakeAdmin();
    const launch = await prepareLaunchProposal(admin, DRAFT_INPUT);
    expect(launch.state).toBe('preparing');
    expect(launch.token_name).toBe(DRAFT_INPUT.tokenName);
    expect(launch.token_symbol).toBe(DRAFT_INPUT.tokenSymbol);
  });
});

describe('preflightLaunch — quotes REAL (deterministic fake) Bankr terms, never hardcoded economics', () => {
  it('records bankr terms marked simulated:true and advances to preflighted', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    const result = await preflightLaunch(admin, draft.id, 'default', 'persona-1');
    expect(result.launch.state).toBe('preflighted');
    expect(result.bankrTerms.raw.simulated).toBe(true);
    expect(result.launch.bankr_terms).toBeTruthy();
  });
});

describe('requestAegisAssessment — opens independent assessment, never self-assessed', () => {
  it('creates a token_launch-subject assessment and moves the launch to aegis_review_pending', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    await preflightLaunch(admin, draft.id, 'default', 'persona-1');
    const launch = await requestAegisAssessment(admin, {
      launchId: draft.id,
      tenantId: 'default',
      policyVersion: 'v1',
      evidenceSnapshot: { ok: true },
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    expect(launch.state).toBe('aegis_review_pending');
    expect(launch.aegis_assessment_id).toBeTruthy();
    const assessment = await getCurrentAssessment(admin, 'token_launch', draft.id);
    expect(assessment!.subject_type).toBe('token_launch');
    expect(assessment!.requested_by_agent_ref).toBe('aigent-factor');
  });
});

describe('requestApproval — moves into the human-approval queue, never approves itself', () => {
  it('transitions to approval_pending only; approveTokenLaunch is a separate, never-implicit call', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    await preflightLaunch(admin, draft.id, 'default', 'persona-1');
    await ratifyAdmissibleFor(admin, draft.id);
    const launch = await requestApproval(admin, draft.id, 'default', 'persona-1');
    expect(launch.state).toBe('approval_pending');
    expect(launch.approval_hash).toBeNull();
  });
});

describe('submitApprovedLaunch — the ONE function that calls Bankr\'s write API; refuses pre-approval', () => {
  it('refuses to submit a launch that is not yet approved', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    await expect(
      submitApprovedLaunch(admin, { id: draft.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-1' }),
    ).rejects.toMatchObject({ code: 'not-approved' });
  });

  it('submits an approved launch via the fake Bankr transport, recording a real (simulated) job id', async () => {
    const admin = makeFakeAdmin();
    const approved = await walkToApproved(admin);
    const submitted = await submitApprovedLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-submit-1' });
    expect(submitted.state).toBe('submitting');
    expect(submitted.bankr_job_id).toMatch(/^sim-job-/);
  });

  it('a replayed submission with the same idempotency key returns the same job — never re-submits', async () => {
    const admin = makeFakeAdmin();
    const approved = await walkToApproved(admin);
    const first = await submitApprovedLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-dup' });
    const second = await submitApprovedLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-dup' });
    expect(second.bankr_job_id).toBe(first.bankr_job_id);
  });
});

describe('inspectDeploymentStatus — read-only against Bankr; never fabricates a confirmation', () => {
  it('returns the launch unchanged when nothing has been submitted yet', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    const result = await inspectDeploymentStatus(admin, { id: draft.id, tenantId: 'default', actorPersonaId: 'persona-1' });
    expect(result.state).toBe('preparing');
    expect(result.bankr_job_id).toBeNull();
  });

  it('stays in "submitting" — the fake transport never reports a confirmed tx/token, so this never silently confirms', async () => {
    const admin = makeFakeAdmin();
    const approved = await walkToApproved(admin);
    await submitApprovedLaunch(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-status-1' });
    const result = await inspectDeploymentStatus(admin, { id: approved.id, tenantId: 'default', actorPersonaId: 'persona-1' });
    expect(result.state).toBe('submitting');
    expect(result.token_address).toBeNull();
  });
});

describe('inspectFeeClaims — honestly limited (no documented Bankr fee-claim endpoint)', () => {
  it('reports no claimable amount and explains the gap when no token address exists yet', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    const result = await inspectFeeClaims(admin, draft.id);
    expect(result.claimableAmountKnown).toBe(false);
    expect(result.tokenAddress).toBeNull();
    expect(result.note).toMatch(/has not confirmed a token address/i);
  });

  it('once a token address exists, still reports claimableAmountKnown:false but points at the confirmed address', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    await admin.from('token_launches').update({ token_address: '0xtoken-confirmed' }).eq('id', draft.id);
    const result = await inspectFeeClaims(admin, draft.id);
    expect(result.claimableAmountKnown).toBe(false);
    expect(result.tokenAddress).toBe('0xtoken-confirmed');
    expect(result.note).toMatch(/no publicly documented fee-claim endpoint/i);
  });
});
