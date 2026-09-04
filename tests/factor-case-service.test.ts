/**
 * Factor case pipeline (PRD Journey A / §6.1) — unit tests against the
 * in-memory fakeSupabase fixture (no live Supabase credentials available
 * in this environment; see codexes/packs/agentiq/updates/
 * 2026-09-04_factor-aegis-0.1-phase1-reconciliation.md for what remains
 * outstanding as LIVE verification).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeAdmin } from './fixtures/fakeSupabase';

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'receipt-stub' })),
}));

import { createOrResumeCase, transitionCaseState, pauseCase, resumeCase, FactorCaseTransitionError } from '@/services/factor/factorCaseService';

describe('factorCaseService', () => {
  let admin: ReturnType<typeof makeFakeAdmin>;
  beforeEach(() => {
    admin = makeFakeAdmin();
  });

  it('creates a new case on first call', async () => {
    const { case: c, created } = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-a',
      candidateDisplayName: 'Candidate A',
    });
    expect(created).toBe(true);
    expect(c.state).toBe('discovered');
  });

  it('resumes (never duplicates) a case for the same candidate in the same tenant', async () => {
    const first = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-a',
      candidateDisplayName: 'Candidate A',
    });
    const second = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-a',
      candidateDisplayName: 'Candidate A (retry)',
    });
    expect(second.created).toBe(false);
    expect(second.case.case_id).toBe(first.case.case_id);
    expect(admin.table('factor_cases').length).toBe(1);
  });

  it('an idempotency-key replay returns the same row without a second insert', async () => {
    const first = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-b',
      candidateDisplayName: 'Candidate B',
      idempotencyKey: 'idem-1',
    });
    const replay = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-c', // different candidate — key alone must still short-circuit
      candidateDisplayName: 'Candidate C',
      idempotencyKey: 'idem-1',
    });
    expect(replay.case.case_id).toBe(first.case.case_id);
    expect(admin.table('factor_cases').length).toBe(1);
  });

  it('allows a valid forward transition', async () => {
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-d',
      candidateDisplayName: 'Candidate D',
    });
    const updated = await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: 'persona-1' });
    expect(updated.state).toBe('preparing');
  });

  it('refuses an invalid (non-adjacent) transition', async () => {
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-e',
      candidateDisplayName: 'Candidate E',
    });
    await expect(transitionCaseState(admin, { caseId: c.case_id, toState: 'active', actorPersonaId: 'persona-1' })).rejects.toThrow(FactorCaseTransitionError);
  });

  it('structurally refuses to set an admission-decision state directly — Factor cannot admit itself', async () => {
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-f',
      candidateDisplayName: 'Candidate F',
    });
    await expect(transitionCaseState(admin, { caseId: c.case_id, toState: 'admitted', actorPersonaId: 'persona-1' })).rejects.toMatchObject({
      code: 'admission-requires-moneypenny-authority',
    });
  });

  it('pause/resume is lossless — resumes into the exact pre-pause state', async () => {
    const { case: c } = await createOrResumeCase(admin, {
      ownerPersonaId: 'persona-1',
      createdByPersonaId: 'persona-1',
      candidateIdentityKey: 'candidate-g',
      candidateDisplayName: 'Candidate G',
    });
    await transitionCaseState(admin, { caseId: c.case_id, toState: 'preparing', actorPersonaId: 'persona-1' });
    const paused = await pauseCase(admin, c.case_id, 'persona-1', 'operator stepped away');
    expect(paused.state).toBe('paused');
    expect(paused.paused_from_state).toBe('preparing');
    const resumed = await resumeCase(admin, c.case_id, 'persona-1');
    expect(resumed.state).toBe('preparing');
  });

  it('refuses to transition a terminal (rejected) case further', async () => {
    admin.table('factor_cases').push({
      case_id: 'case-terminal',
      tenant_id: 'default',
      candidate_identity_key: 'candidate-h',
      candidate_display_name: 'Candidate H',
      owner_persona_id: 'persona-1',
      created_by_persona_id: 'persona-1',
      state: 'rejected',
    });
    await expect(transitionCaseState(admin, { caseId: 'case-terminal', toState: 'preparing', actorPersonaId: 'persona-1' })).rejects.toMatchObject({ code: 'terminal-state' });
  });
});
