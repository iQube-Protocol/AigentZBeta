/**
 * DiDQube Phase 3 item 3 (2026-09-07): successor-credential reconciliation,
 * WITHOUT MUTATION. `issueSuccessorPassport` issues a NEW
 * `polity_passport_records` row (carrying `renewal_of_passport_id` back to
 * the prior one — the schema's existing renewal/supersession column, reused
 * rather than a parallel concept) when a Passport's subject anchors need to
 * change as a result of reconciliation. The prior row is READ ONLY: this
 * proves no UPDATE is ever issued against it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateCalls: Array<{ table: string; payload: any }> = [];
const insertCalls: Array<{ table: string; payload: any }> = [];

const PRIOR_ROW = {
  passport_id: 'ppp-prior-0001',
  passport_class: 'agent_participant',
  citizen_status: null,
  participant_status: 'approved',
  passport_grade: 'agent_participant',
  persona_id: 'persona-sponsor-1',
  did_persona_id: null,
  kybe_identity_id: null,
  root_identity_id: null,
  persona_public_ref: 'persona-commit-old',
  kybe_did_public_ref: null,
  root_did_public_ref: 'rootdid-commit-OLD-wrong-value',
  vault_content_id: null,
  vault_content_hash: null,
  application_id: 'app-1',
  revoked: false,
};

function fakeAdmin() {
  return {
    from: (table: string) => {
      if (table === 'polity_passport_records') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { ...PRIOR_ROW }, error: null }) }),
          }),
          insert: (payload: any) => {
            insertCalls.push({ table, payload });
            return {
              select: () => ({
                single: async () => ({ data: { id: 'record-successor-1' }, error: null }),
              }),
            };
          },
          update: (payload: any) => {
            updateCalls.push({ table, payload });
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === 'passport_status_transitions') {
        return {
          insert: (payload: any) => {
            insertCalls.push({ table, payload });
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table in this test: ${table}`);
    },
  } as any;
}

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdmin(),
}));

import { issueSuccessorPassport } from '@/services/passport/issuanceService';

beforeEach(() => {
  updateCalls.length = 0;
  insertCalls.length = 0;
});

describe('issueSuccessorPassport — successor-credential reconciliation without mutation', () => {
  it('issues a NEW passport record carrying renewal_of_passport_id back to the prior one', async () => {
    const result = await issueSuccessorPassport({
      priorPassportId: 'ppp-prior-0001',
      updates: { root_did_public_ref: 'rootdid-commit-CORRECTED' },
      reason: 'class-sensitive subject reconciliation',
      stewardPersonaId: 'steward-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.priorPassportId).toBe('ppp-prior-0001');
    expect(result.passportId).not.toBe('ppp-prior-0001');

    const recordInsert = insertCalls.find((c) => c.table === 'polity_passport_records');
    expect(recordInsert).toBeDefined();
    expect(recordInsert!.payload.renewal_of_passport_id).toBe('ppp-prior-0001');
    expect(recordInsert!.payload.root_did_public_ref).toBe('rootdid-commit-CORRECTED');
  });

  it('NEVER issues an UPDATE against polity_passport_records — the prior row is read-only', async () => {
    await issueSuccessorPassport({
      priorPassportId: 'ppp-prior-0001',
      updates: { root_did_public_ref: 'rootdid-commit-CORRECTED' },
      reason: 'class-sensitive subject reconciliation',
      stewardPersonaId: 'steward-1',
    });

    expect(updateCalls.filter((c) => c.table === 'polity_passport_records')).toHaveLength(0);
  });

  it('carries forward every field NOT explicitly reconciled, unchanged from the prior row', async () => {
    await issueSuccessorPassport({
      priorPassportId: 'ppp-prior-0001',
      updates: { root_did_public_ref: 'rootdid-commit-CORRECTED' },
      reason: 'class-sensitive subject reconciliation',
      stewardPersonaId: 'steward-1',
    });

    const recordInsert = insertCalls.find((c) => c.table === 'polity_passport_records');
    expect(recordInsert!.payload).toMatchObject({
      passport_class: PRIOR_ROW.passport_class,
      participant_status: PRIOR_ROW.participant_status,
      persona_id: PRIOR_ROW.persona_id,
      persona_public_ref: PRIOR_ROW.persona_public_ref,
      application_id: PRIOR_ROW.application_id,
    });
  });

  it('records a passport_status_transitions audit row naming the reconciliation reason', async () => {
    await issueSuccessorPassport({
      priorPassportId: 'ppp-prior-0001',
      reason: 'agent_card_url resolved to a different agent_root_identity on reconciliation',
      stewardPersonaId: 'steward-1',
    });

    const transitionInsert = insertCalls.find((c) => c.table === 'passport_status_transitions');
    expect(transitionInsert).toBeDefined();
    expect(transitionInsert!.payload).toMatchObject({
      evidence_type: 'successor_credential_reconciliation',
      reason: 'agent_card_url resolved to a different agent_root_identity on reconciliation',
      actor_id: 'steward-1',
    });
  });

  it('REFUSES to issue a successor to an already-revoked passport', async () => {
    const admin = fakeAdmin();
    const revokedRow = { ...PRIOR_ROW, revoked: true };
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({
      getSupabaseServer: () => ({
        ...admin,
        from: (table: string) => {
          if (table === 'polity_passport_records') {
            return {
              select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: revokedRow, error: null }) }) }),
            };
          }
          return admin.from(table);
        },
      }),
    }));
    vi.resetModules();
    const { issueSuccessorPassport: issueWithRevoked } = await import('@/services/passport/issuanceService');

    const result = await issueWithRevoked({
      priorPassportId: 'ppp-prior-0001',
      reason: 'test',
      stewardPersonaId: 'steward-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('revoked');
  });

  it('errors when the prior passport does not exist, rather than silently issuing an orphan successor', async () => {
    vi.resetModules();
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({
      getSupabaseServer: () => ({
        from: (table: string) => {
          if (table === 'polity_passport_records') {
            return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
          }
          throw new Error(`unexpected table: ${table}`);
        },
      }),
    }));
    const { issueSuccessorPassport: issueMissing } = await import('@/services/passport/issuanceService');

    const result = await issueMissing({
      priorPassportId: 'ppp-does-not-exist',
      reason: 'test',
      stewardPersonaId: 'steward-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not found');
  });
});
