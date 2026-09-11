/**
 * POST /api/ops/journey/reconcile-provider-standing-attribution (2026-08-23
 * "Horizen Pilot — close Standing + MoneyPenny Runtime now" directive, P0-C).
 *
 * Reverses a requester-side Standing credit erroneously produced by the
 * pre-P0-A Financial Services orchestrator defect and credits the PROVIDER
 * once, genuinely, per explicitly-supplied original receipt id. Generic
 * fixture (Aigent Provider / Aigent Requester) per this session's convention
 * — the mechanism names no live agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';

const PROVIDER = 'aigent-provider';
const REQUESTER = 'aigent-requester';
const PROVIDER_IDENTITY_PERSONA = 'identity-persona-provider';
const REQUESTER_IDENTITY_PERSONA = 'identity-persona-requester';
const PROVIDER_CRM_PERSONA = 'crm-provider';
const REQUESTER_CRM_PERSONA = 'crm-requester';
const ORIGINAL_RECEIPT_ID = 'original-receipt-1';
const INVOCATION_RECEIPT_ID = 'invocation-receipt-1';

const mockResolveRegistrableAgentByRuntimeId = vi.fn();
vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgentByRuntimeId: (...args: any[]) => mockResolveRegistrableAgentByRuntimeId(...args),
}));

const mockResolveAgentAdmissionState = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: any[]) => mockResolveAgentAdmissionState(...args),
}));

const mockResolveAgentStandingPersonaId = vi.fn();
const mockResolveCanonicalAgentPersonaId = vi.fn();
vi.mock('@/services/standing/agentStandingPersona', () => ({
  resolveAgentStandingPersonaId: (...args: any[]) => mockResolveAgentStandingPersonaId(...args),
  resolveCanonicalAgentPersonaId: (...args: any[]) => mockResolveCanonicalAgentPersonaId(...args),
}));

const mockAccrueStanding = vi.fn();
vi.mock('@/services/crm/standingAccrualService', () => ({
  accrueStanding: (...args: any[]) => mockAccrueStanding(...args),
}));

// Mocking getActivePersona is sufficient to control BOTH the admin-persona
// auth path (requireAdminPersona's own `getActivePersona` call resolves
// through this same mock, since it imports the identical module specifier)
// and this route's own derivation of correctingPersonaId — no separate mock
// of requireAdmin.ts needed.
const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({
  id: `correction-${input.actionInput.originalReceiptId ?? input.actionInput.invocationReceiptId}`,
  ...input,
}));
let existingCorrections: Array<{ actionInput: Record<string, unknown> | null }>;
let ingestRows: Array<{ createdAt: string }>;
const mockFindAgentReceiptRefs = vi.fn(async (_agentId: string, actionTypes: string[]) =>
  actionTypes.includes('capability_registered') ? ingestRows : existingCorrections,
);
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  findAgentReceiptRefs: (...args: any[]) => mockFindAgentReceiptRefs(...args),
}));

// SERVICE_COMPLETION_CVS is a real constant re-exported from the orchestrator
// — importing the whole orchestrator module here would drag in its full
// (separately-tested) dependency graph, so this file asserts against the
// known literal value (1) instead, matching financial-services-runtime.test.ts's SERVICE_COMPLETION_CVS.
const SERVICE_COMPLETION_CVS = 1;

let originalRow: Record<string, unknown> | null;
let receiptRowsById: Record<string, Record<string, unknown> | null> = {};
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({ data: id in receiptRowsById ? receiptRowsById[id] : originalRow, error: null }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveRegistrableAgentByRuntimeId.mockImplementation((id: string) => ({ runtimeAgentId: id, slug: id, displayName: id }));
  mockResolveAgentAdmissionState.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
    Promise.resolve({ agentRootDid: `did:agent:root:${agent.runtimeAgentId}` }),
  );
  mockResolveCanonicalAgentPersonaId.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
    Promise.resolve(agent.runtimeAgentId === PROVIDER ? PROVIDER_IDENTITY_PERSONA : REQUESTER_IDENTITY_PERSONA),
  );
  mockResolveAgentStandingPersonaId.mockImplementation((_admin: unknown, agent: { runtimeAgentId: string }) =>
    Promise.resolve(agent.runtimeAgentId === PROVIDER ? PROVIDER_CRM_PERSONA : REQUESTER_CRM_PERSONA),
  );
  mockAccrueStanding.mockResolvedValue({ personal: 1, delegated: 0, stewardship: 0, overall: 1, bucket: 0, thresholdCrossed: false, sponsorCapacityCredited: false });
  // Default: no authenticated persona at all — tests that rely on the
  // CRON_TRIGGER_TOKEN path never call getActivePersona (isCronAuthorized
  // short-circuits before it), so this default is only observed by the
  // admin-persona-path tests that don't override it.
  mockGetActivePersona.mockResolvedValue(null);
  existingCorrections = [];
  ingestRows = [{ createdAt: '2026-08-01T00:00:00.000Z' }];
  receiptRowsById = {
    [INVOCATION_RECEIPT_ID]: {
      id: INVOCATION_RECEIPT_ID,
      action_type: 'capability_invocation_completed',
      agents_invoked: [REQUESTER, PROVIDER],
      action_input: { resolvedProviderId: PROVIDER, invocationId: 'inv-1' },
      created_at: '2026-08-10T00:00:00.000Z',
    },
  };
  originalRow = {
    id: ORIGINAL_RECEIPT_ID,
    action_type: 'standing_accrued',
    persona_id: REQUESTER_IDENTITY_PERSONA,
    agents_invoked: [REQUESTER],
    action_input: null,
    created_at: '2026-08-10T00:00:00.000Z',
  };
});

function request(body: unknown, token = 'test-cron-token') {
  return new Request('http://local/api/ops/journey/reconcile-provider-standing-attribution', {
    method: 'POST',
    headers: { 'x-cron-token': token },
    body: JSON.stringify(body),
  }) as any;
}

function correction(overrides: Partial<{ originalReceiptId: string; requestingAgentId: string; providerAgentId: string; correctingPersonaId: string }> = {}) {
  return {
    originalReceiptId: ORIGINAL_RECEIPT_ID,
    requestingAgentId: REQUESTER,
    providerAgentId: PROVIDER,
    correctingPersonaId: 'operator-1',
    ...overrides,
  };
}

describe('POST /api/ops/journey/reconcile-provider-standing-attribution', () => {
  it('refuses without a valid CRON_TRIGGER_TOKEN and without an authenticated admin persona', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }, 'wrong-token'));
    expect(res.status).toBe(403);
  });

  it('refuses an authenticated persona that is not an admin, even with a wrong cron token', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-non-admin', cartridgeFlags: { isAdmin: false } });
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }, 'wrong-token'));
    expect(res.status).toBe(403);
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('requires a non-empty corrections array', async () => {
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [] }));
    expect(res.status).toBe(400);
  });

  it('reverses the requester credit and credits the provider once, genuinely, for a verified receipt', async () => {
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].status).toBe('corrected');

    expect(mockAccrueStanding).toHaveBeenCalledTimes(2);
    // 1. reversal — exact inverse magnitude on the REQUESTER's own persona.
    expect(mockAccrueStanding).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ crmPersonaId: REQUESTER_CRM_PERSONA, cvs: -SERVICE_COMPLETION_CVS, subjectAgentRef: REQUESTER }),
    );
    // 2. genuine credit — the PROVIDER's own persona, positive magnitude.
    expect(mockAccrueStanding).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ crmPersonaId: PROVIDER_CRM_PERSONA, cvs: SERVICE_COMPLETION_CVS, subjectAgentRef: PROVIDER, requestingAgentRef: REQUESTER }),
    );

    // Additive audit receipt, never mutating the original.
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const auditCall = mockCreateActivityReceipt.mock.calls[0][0];
    expect(auditCall.actionType).toBe('standing_corrected');
    expect(auditCall.agentsInvoked).toEqual([PROVIDER]);
    expect(auditCall.actionInput).toMatchObject({
      correctionKind: 'service_completion_reattribution',
      originalReceiptId: ORIGINAL_RECEIPT_ID,
      requestingAgentId: REQUESTER,
      providerAgentId: PROVIDER,
    });
  });

  it('idempotent: re-running against an already-corrected receipt writes nothing new and never re-accrues', async () => {
    existingCorrections = [
      { actionInput: { correctionKind: 'service_completion_reattribution', originalReceiptId: ORIGINAL_RECEIPT_ID } },
    ];
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('skipped_already_corrected');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('No-Guessing: refuses when the named receipt does not genuinely credit the named requester\'s own identity persona', async () => {
    originalRow = { ...originalRow, persona_id: 'someone-elses-persona' };
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('RECEIPT_NOT_REQUESTER_CREDITED');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('refuses a receipt that is not a standing_accrued receipt at all', async () => {
    originalRow = { ...originalRow, action_type: 'capability_registered' };
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('NOT_A_STANDING_ACCRUAL');
  });

  it('refuses when the original receipt does not exist', async () => {
    originalRow = null;
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('ORIGINAL_RECEIPT_NOT_FOUND');
  });

  it('SEQUENCING_INVALID: refuses when the provider has no genuine capability_registered receipt preceding the interaction', async () => {
    ingestRows = [];
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('SEQUENCING_INVALID');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('SEQUENCING_INVALID: refuses when the interaction predates the provider\'s earliest genuine capability_registered receipt', async () => {
    ingestRows = [{ createdAt: '2026-09-01T00:00:00.000Z' }]; // AFTER the interaction
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('SEQUENCING_INVALID');
  });

  it('never resurrects a superseded nominal seed — only ever calls accrueStanding with a fresh contribution subjectAgentRef, never the seed writer', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const source = readFileSync(
      join(process.cwd(), 'app/api/ops/journey/reconcile-provider-standing-attribution/route.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/import[^;]*registrationStandingSeedAward/);
    expect(source).not.toMatch(/action_input:\s*{[^}]*'iqube_registry_registration'/);
  });

  it('processes multiple corrections independently, one refusal does not block another correction', async () => {
    const secondReceiptId = 'original-receipt-2';
    receiptRowsById = { [secondReceiptId]: null }; // second one not found
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(
      request({
        corrections: [correction(), correction({ originalReceiptId: secondReceiptId })],
      }),
    );
    const json = await res.json();
    expect(json.results).toHaveLength(2);
    expect(json.results[0].status).toBe('corrected');
    expect(json.results[1].status).toBe('refused');
    expect(json.results[1].refusalCode).toBe('ORIGINAL_RECEIPT_NOT_FOUND');
  });
});

function backfillCorrection(
  overrides: Partial<{ invocationReceiptId: string; requestingAgentId: string; providerAgentId: string; correctingPersonaId: string }> = {},
) {
  return {
    mode: 'BACKFILL_MISSING_PROVIDER_CREDIT' as const,
    invocationReceiptId: INVOCATION_RECEIPT_ID,
    requestingAgentId: REQUESTER,
    providerAgentId: PROVIDER,
    correctingPersonaId: 'operator-1',
    ...overrides,
  };
}

describe('POST /api/ops/journey/reconcile-provider-standing-attribution — mode BACKFILL_MISSING_PROVIDER_CREDIT', () => {
  it('requires invocationReceiptId for this mode', async () => {
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(
      request({ corrections: [{ mode: 'BACKFILL_MISSING_PROVIDER_CREDIT', requestingAgentId: REQUESTER, providerAgentId: PROVIDER, correctingPersonaId: 'op-1' }] }),
    );
    expect(res.status).toBe(400);
  });

  it('issues the missing provider credit ONCE — no reversal, since no requester credit exists to reverse', async () => {
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [backfillCorrection()] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results[0].status).toBe('corrected');
    expect(json.results[0].mode).toBe('BACKFILL_MISSING_PROVIDER_CREDIT');
    expect(json.results[0].invocationReceiptId).toBe(INVOCATION_RECEIPT_ID);

    // Exactly ONE accrual — the provider's positive credit — never a
    // reversal (there is no requester credit to reverse).
    expect(mockAccrueStanding).toHaveBeenCalledTimes(1);
    expect(mockAccrueStanding).toHaveBeenCalledWith(
      expect.objectContaining({ crmPersonaId: PROVIDER_CRM_PERSONA, cvs: SERVICE_COMPLETION_CVS, subjectAgentRef: PROVIDER, requestingAgentRef: REQUESTER }),
    );
    for (const call of mockAccrueStanding.mock.calls) {
      expect(call[0].cvs).toBeGreaterThan(0); // never negative in this mode
    }

    // Additive audit receipt naming the REAL invocation receipt — never a fabricated "original" standing receipt.
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const auditCall = mockCreateActivityReceipt.mock.calls[0][0];
    expect(auditCall.actionType).toBe('standing_corrected');
    expect(auditCall.agentsInvoked).toEqual([PROVIDER]);
    expect(auditCall.actionInput).toMatchObject({
      correctionKind: 'service_completion_provider_backfill',
      invocationReceiptId: INVOCATION_RECEIPT_ID,
      requestingAgentId: REQUESTER,
      providerAgentId: PROVIDER,
    });
    expect(auditCall.actionInput.originalReceiptId).toBeUndefined();
  });

  it('idempotent: re-running against an already-backfilled invocation writes nothing new and never re-accrues', async () => {
    existingCorrections = [
      { actionInput: { correctionKind: 'service_completion_provider_backfill', invocationReceiptId: INVOCATION_RECEIPT_ID } },
    ];
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [backfillCorrection()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('skipped_already_corrected');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses when the invocation receipt does not exist', async () => {
    receiptRowsById[INVOCATION_RECEIPT_ID] = null;
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [backfillCorrection()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('INVOCATION_RECEIPT_NOT_FOUND');
  });

  it('refuses a receipt that is not a capability_invocation_completed receipt at all — never fabricates one', async () => {
    receiptRowsById[INVOCATION_RECEIPT_ID] = { ...receiptRowsById[INVOCATION_RECEIPT_ID], action_type: 'standing_accrued' };
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [backfillCorrection()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('NOT_A_COMPLETED_INVOCATION');
  });

  it("No-Guessing: refuses when the named requester does not actually appear in the invocation's own evidence", async () => {
    receiptRowsById[INVOCATION_RECEIPT_ID] = { ...receiptRowsById[INVOCATION_RECEIPT_ID], agents_invoked: [PROVIDER] };
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [backfillCorrection()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('REQUESTER_NOT_IN_INVOCATION');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it("No-Guessing: refuses when the named provider does not match the invocation's own resolvedProviderId", async () => {
    receiptRowsById[INVOCATION_RECEIPT_ID] = {
      ...receiptRowsById[INVOCATION_RECEIPT_ID],
      action_input: { resolvedProviderId: 'aigent-someone-else' },
    };
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [backfillCorrection()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('PROVIDER_NOT_IN_INVOCATION');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('SEQUENCING_INVALID: refuses when the interaction predates the provider\'s earliest genuine capability_registered receipt', async () => {
    ingestRows = [{ createdAt: '2026-09-01T00:00:00.000Z' }]; // AFTER the interaction
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [backfillCorrection()] }));
    const json = await res.json();

    expect(json.results[0].status).toBe('refused');
    expect(json.results[0].refusalCode).toBe('SEQUENCING_INVALID');
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('provisions the provider\'s canonical Standing persona idempotently as part of the first real credit (never a separate provisioning step)', async () => {
    // Simulate "no aigent-canonical-standing persona exists yet" by having
    // the resolver itself perform the provisioning — this test just proves
    // the route calls the resolver (which owns provisioning) rather than
    // assuming a persona id already exists.
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    await POST(request({ corrections: [backfillCorrection()] }));
    expect(mockResolveAgentStandingPersonaId).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runtimeAgentId: PROVIDER }),
      expect.anything(),
    );
  });
});

describe('POST /api/ops/journey/reconcile-provider-standing-attribution — authenticated admin-persona path (operator directive: not cron-only)', () => {
  const ADMIN_PERSONA_ID = 'persona-admin-1';

  function adminRequest(body: unknown) {
    // No x-cron-token match at all — proves the admin-persona path is a
    // genuinely independent route to authorization, not merely a fallback
    // that still needs the cron secret.
    return request(body, 'not-the-cron-token');
  }

  it('an authenticated admin persona may run a correction with NO correctingPersonaId in the body — it is derived server-side', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: ADMIN_PERSONA_ID, cartridgeFlags: { isAdmin: true } });
    const { originalReceiptId, requestingAgentId, providerAgentId } = correction();
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(adminRequest({ corrections: [{ originalReceiptId, requestingAgentId, providerAgentId }] }));
    const resolved = await res.json();

    expect(res.status).toBe(200);
    expect(resolved.results[0].status).toBe('corrected');
    // The audit receipt's correctingPersonaId is the SERVER-RESOLVED admin
    // persona — never a raw JWT claim, never email, never client-supplied.
    const auditCall = mockCreateActivityReceipt.mock.calls[0][0];
    expect(auditCall.actionInput.correctingPersonaId).toBe(ADMIN_PERSONA_ID);
  });

  it('a body-supplied correctingPersonaId that matches the resolved admin persona is accepted', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: ADMIN_PERSONA_ID, cartridgeFlags: { isAdmin: true } });
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(adminRequest({ corrections: [correction({ correctingPersonaId: ADMIN_PERSONA_ID })] }));
    expect(res.status).toBe(200);
  });

  it('never trusts a body-supplied correctingPersonaId that does not match the resolved admin persona — refuses rather than silently overriding', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: ADMIN_PERSONA_ID, cartridgeFlags: { isAdmin: true } });
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(adminRequest({ corrections: [correction({ correctingPersonaId: 'someone-elses-persona-id' })] }));
    expect(res.status).toBe(400);
    expect(mockAccrueStanding).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('a non-admin authenticated persona is refused 403, never treated as an implicit correctingPersonaId source', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-regular-user', cartridgeFlags: { isAdmin: false } });
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(adminRequest({ corrections: [correction()] }));
    expect(res.status).toBe(403);
    expect(mockAccrueStanding).not.toHaveBeenCalled();
  });

  it('the CRON_TRIGGER_TOKEN path is unaffected — a valid cron token still works exactly as before, with a body-supplied correctingPersonaId', async () => {
    mockGetActivePersona.mockResolvedValue(null); // no persona at all — the cron path never needs one
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [correction({ correctingPersonaId: 'automation-caller' })] }));
    const resolved = await res.json();
    expect(res.status).toBe(200);
    expect(resolved.results[0].status).toBe('corrected');
    const auditCall = mockCreateActivityReceipt.mock.calls[0][0];
    expect(auditCall.actionInput.correctingPersonaId).toBe('automation-caller');
  });

  it('the CRON_TRIGGER_TOKEN path still refuses (400) a correction missing correctingPersonaId in the body', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const { originalReceiptId, requestingAgentId, providerAgentId } = correction();
    const { POST } = await import('@/app/api/ops/journey/reconcile-provider-standing-attribution/route');
    const res = await POST(request({ corrections: [{ originalReceiptId, requestingAgentId, providerAgentId }] }));
    expect(res.status).toBe(400);
  });
});
