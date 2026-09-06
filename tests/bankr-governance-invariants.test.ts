/**
 * Factor + Aegis Bankr PRD, Phase 8 — governance invariants not already
 * exercised by tests/bankr-capability-handlers.test.ts, tests/token-launch-
 * service.test.ts or tests/bankr-provider-adapter.test.ts. Each test here
 * maps to one specific Phase 8 acceptance criterion named in the PRD.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
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
  prepareLaunchProposal,
  preflightLaunch,
  requestAegisAssessment,
  requestApproval,
  submitApprovedLaunch,
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
  feeRecipient: '0xFeeRecipientAddress0000000000000000000',
};

describe('"Factor never calls Bankr\'s write API directly" — structural isolation of the write adapter', () => {
  it('createBankrProviderAdapter/submitTokenLaunch is imported/called from exactly one call site outside the adapter\'s own definition', () => {
    const servicesDir = join(__dirname, '..', 'services');
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          if (full.endsWith(join('bankr', 'bankrProviderAdapter.ts'))) continue; // the adapter's own definition
          const src = readFileSync(full, 'utf8');
          if (src.includes('createBankrProviderAdapter(')) offenders.push(full);
        }
      }
    }
    walk(servicesDir);
    expect(offenders).toEqual([join(servicesDir, 'factor', 'bankrCapabilityHandlers.ts')]);
  });
});

describe('"Factor cannot approve its own token" — approval has exactly one entry point, never reachable from Factor\'s own action dispatch', () => {
  it('bankrCapabilityHandlers.ts never CALLS approveTokenLaunch (it may only mention it in documentation)', () => {
    const src = readFileSync(join(__dirname, '..', 'services', 'factor', 'bankrCapabilityHandlers.ts'), 'utf8');
    expect(src.includes('approveTokenLaunch(')).toBe(false);
  });

  it('requestAegisAssessment never lets a caller name who assesses — assessedByAgentRef is always Aegis, never Factor', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    await preflightLaunch(admin, draft.id, 'default', 'persona-1');
    await requestAegisAssessment(admin, {
      launchId: draft.id,
      tenantId: 'default',
      policyVersion: 'v1',
      evidenceSnapshot: { ok: true },
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    const assessment = await getCurrentAssessment(admin, 'token_launch', draft.id);
    expect(assessment!.assessed_by_agent_ref).toBe('aigent-aegis');
  });
});

describe('"a critical Aegis finding blocks approval" — token-launch subject', () => {
  it('refuses approveTokenLaunch when the ratified assessment carries a critical failed finding', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    await preflightLaunch(admin, draft.id, 'default', 'persona-1');
    await requestAegisAssessment(admin, {
      launchId: draft.id,
      tenantId: 'default',
      policyVersion: 'v1',
      evidenceSnapshot: { ok: true },
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    const current = await getCurrentAssessment(admin, 'token_launch', draft.id);
    const assessmentId = current!.assessment_id;
    await beginRunning(admin, assessmentId);
    await requireReview(admin, assessmentId);
    await addFinding(admin, {
      assessmentId,
      dimension: 'provenance',
      claim: 'issuer identity is verifiable',
      method: 'review',
      result: 'fail',
      confidence: 0.95,
      falsificationCondition: 'n/a',
      isCritical: true,
    });

    await expect(
      ratifyAssessment(admin, { assessmentId, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' }),
    ).rejects.toMatchObject({ code: 'critical-failure-blocks-admission' });

    await requestApproval(admin, draft.id, 'default', 'persona-1');
    await expect(
      approveTokenLaunch(admin, { id: draft.id, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: new Date().toISOString() }),
    ).rejects.toMatchObject({ code: 'no-ratified-assessment' });
  });
});

describe('"fee recipient matches the approved address" — submission never diverges from the frozen, approved spec', () => {
  it('submits to Bankr using exactly the fee_recipient frozen at approval time', async () => {
    const admin = makeFakeAdmin();
    const draft = await prepareLaunchProposal(admin, DRAFT_INPUT);
    await preflightLaunch(admin, draft.id, 'default', 'persona-1');
    await requestAegisAssessment(admin, {
      launchId: draft.id,
      tenantId: 'default',
      policyVersion: 'v1',
      evidenceSnapshot: { ok: true },
      requestedByAgentRef: 'aigent-factor',
      actorPersonaId: 'persona-1',
    });
    const current = await getCurrentAssessment(admin, 'token_launch', draft.id);
    const assessmentId = current!.assessment_id;
    await beginRunning(admin, assessmentId);
    await requireReview(admin, assessmentId);
    await addFinding(admin, { assessmentId, dimension: 'utility', claim: 'ok', method: 'review', result: 'pass', confidence: 0.9, falsificationCondition: 'n/a' });
    await ratifyAssessment(admin, { assessmentId, decision: 'admissible', ratifiedByPersonaId: 'persona-moneypenny' });
    await requestApproval(admin, draft.id, 'default', 'persona-1');
    const approved = await approveTokenLaunch(admin, { id: draft.id, tenantId: 'default', approvedByPersonaId: 'persona-moneypenny', approvedAt: new Date().toISOString() });
    expect(approved.fee_recipient).toBe(DRAFT_INPUT.feeRecipient);

    // submitApprovedLaunch takes no caller-suppliable feeRecipient
    // parameter at all — it can only ever read whatever is frozen on the
    // approved row, so the fee address actually sent to Bankr is
    // structurally guaranteed to be the approved one.
    const submitted = await submitApprovedLaunch(admin, { id: draft.id, tenantId: 'default', actorPersonaId: 'persona-1', idempotencyKey: 'idem-fee-check' });
    expect(submitted.state).toBe('submitting');
    const { data: row } = await admin.from('token_launches').select('*').eq('id', draft.id).maybeSingle();
    expect(row.fee_recipient).toBe(approved.fee_recipient);
  });
});
