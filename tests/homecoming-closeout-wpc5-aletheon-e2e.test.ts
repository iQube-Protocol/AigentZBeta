/**
 * WP-C5 — end-to-end behavioral tests for Aletheon delegated execution
 * (Homecoming Closeout, operator brief 2026-08-17).
 *
 * Exercises the REAL /api/connectors/execute route handler (not just the
 * gate module in isolation — that's tests/homecoming-closeout-wpc2-...).
 * Aletheon is the acceptance case; the code under test (the route, the
 * gate, the vocabulary) contains no branch that names her — every check
 * here would behave identically for any other assigned Agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const PERSONA_ID = 'persona-mansa-meta';
const ALETHEON_ROOT_ID = 'root-aletheon';
const ALETHEON_DID = 'did:polity:aletheon';
const GRANT_ID = 'grant-aletheon-1';

const mockResolveConstitutionalContext = vi.fn();
const mockReadActiveGrant = vi.fn();
const mockIncrementActionsTaken = vi.fn(async () => undefined);
const mockGetActivePersona = vi.fn();
const mockCreateActivityReceipt = vi.fn(async (input: unknown) => { receiptsWritten.push(input); return { id: 'receipt-1' }; });
const mockVerifyApprovalToken = vi.fn();
const mockIsApprovalTokenSigningConfigured = vi.fn(() => true);
const mockGetOAuthConfig = vi.fn(() => ({ configured: true }));

let receiptsWritten: unknown[] = [];

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: unknown[]) => mockGetActivePersona(...args),
}));
vi.mock('@/services/identity/constitutionalContext', () => ({
  resolveConstitutionalContext: (...args: unknown[]) => mockResolveConstitutionalContext(...args),
}));
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  readActiveGrant: (...args: unknown[]) => mockReadActiveGrant(...args),
  incrementActionsTaken: (...args: unknown[]) => mockIncrementActionsTaken(...args),
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
}));
vi.mock('@/services/google/oauth', () => ({
  getOAuthConfig: () => mockGetOAuthConfig(),
}));
vi.mock('@/services/access/approvalToken', () => ({
  verifyApprovalToken: (...args: unknown[]) => mockVerifyApprovalToken(...args),
  isApprovalTokenSigningConfigured: () => mockIsApprovalTokenSigningConfigured(),
}));

// Two real connectors, minimally stubbed: one draft-tier (no approval), one
// send-tier (requires approval) — matching the real registry's own split.
const DRAFT_EMAIL_CONNECTOR = { id: 'google.gmail.draft', label: 'Draft Gmail message', requiresApproval: false, execute: vi.fn(async () => ({ ok: true, output: { draftId: 'd1' } })) };
const SEND_EMAIL_CONNECTOR = { id: 'google.gmail.send', label: 'Send Gmail message', requiresApproval: true, execute: vi.fn(async () => ({ ok: true, output: { messageId: 'm1' } })) };
const CREATE_DOC_CONNECTOR = { id: 'google.drive.create-doc', label: 'Create Google Doc', requiresApproval: false, execute: vi.fn(async () => ({ ok: true, output: { docId: 'doc1' } })) };
const CREATE_EVENT_CONNECTOR = { id: 'google.calendar.create-event', label: 'Create calendar event', requiresApproval: false, execute: vi.fn(async () => ({ ok: true, output: { eventId: 'ev1' } })) };

const CONNECTORS: Record<string, typeof DRAFT_EMAIL_CONNECTOR> = {
  'google.gmail.draft': DRAFT_EMAIL_CONNECTOR,
  'google.gmail.send': SEND_EMAIL_CONNECTOR,
  'google.drive.create-doc': CREATE_DOC_CONNECTOR,
  'google.calendar.create-event': CREATE_EVENT_CONNECTOR,
};

vi.mock('@/services/google/connectors', () => ({
  getGoogleConnector: (id: string) => CONNECTORS[id] ?? null,
}));
vi.mock('@/services/marketa/marketaConnector', () => ({
  getMarketaConnector: () => null,
}));

const { POST } = await import('@/app/api/connectors/execute/route');

function fakeReq(body: Record<string, unknown>) {
  return { json: async () => body } as any;
}

function aletheonCtx(overrides: { grantAgentDid?: string } = {}) {
  return {
    persona: { personaId: PERSONA_ID, displayLabel: 'Mansa Meta' },
    boundAgents: [{ agentId: ALETHEON_ROOT_ID, agentDid: ALETHEON_DID, displayName: 'Aletheon', agentClass: 'polity_bound', passportBound: true, relationship: 'binding' as const }],
    currentAigentMe: ALETHEON_ROOT_ID,
  };
}

function defaultAigentMeCtx() {
  return { persona: { personaId: PERSONA_ID, displayLabel: 'Mansa Meta' }, boundAgents: [], currentAigentMe: null };
}

function activeGrant(overrides: Partial<{ allowed_actions: string[]; allowed_surfaces: string[]; max_actions: number; actions_taken: number; agent_root_did: string }> = {}) {
  return {
    grant_id: GRANT_ID,
    agent_root_did: ALETHEON_DID,
    allowed_actions: ['draft_email', 'create_google_doc', 'create_calendar_event'],
    allowed_surfaces: ['metame'],
    max_actions: 20,
    actions_taken: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_ID });
  mockGetOAuthConfig.mockReturnValue({ configured: true });
  mockIsApprovalTokenSigningConfigured.mockReturnValue(true);
  receiptsWritten = [];
});

describe('WP-C5 — Aletheon delegated execution, end to end', () => {
  it('1+2. Aletheon selected as aigentMe with a valid grant drafts an email successfully', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(activeGrant());
    const res = await POST(fakeReq({ connectorId: 'google.gmail.draft', input: { to: 'x@example.com' } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it('4. Aletheon prepares a Doc', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(activeGrant());
    const res = await POST(fakeReq({ connectorId: 'google.drive.create-doc', input: {} }));
    expect((await res.json()).ok).toBe(true);
  });

  it('5. Aletheon prepares a Calendar event', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(activeGrant());
    const res = await POST(fakeReq({ connectorId: 'google.calendar.create-event', input: {} }));
    expect((await res.json()).ok).toBe(true);
  });

  it('6. External execution refuses when the action is absent from the grant', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(activeGrant({ allowed_actions: ['draft_email'] })); // no send_email
    const res = await POST(fakeReq({ connectorId: 'google.gmail.send', input: {}, approvalToken: 'tok' }));
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.code).toBe('action-not-granted');
    expect(SEND_EMAIL_CONNECTOR.execute).not.toHaveBeenCalled();
  });

  it('7. External execution succeeds through the existing approved path when the grant covers it AND approval is present', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(activeGrant({ allowed_actions: ['send_email'] }));
    mockVerifyApprovalToken.mockReturnValue({ ok: true });
    const res = await POST(fakeReq({ connectorId: 'google.gmail.send', input: {}, approvalToken: 'valid-token' }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(SEND_EMAIL_CONNECTOR.execute).toHaveBeenCalled();
  });

  it('7b. External execution WITHOUT approval token still refuses (the grant never bypasses the existing approval gate)', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(activeGrant({ allowed_actions: ['send_email'] }));
    const res = await POST(fakeReq({ connectorId: 'google.gmail.send', input: {} })); // no approvalToken
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.code).toBe('requires-approval');
  });

  it('8. The receipt attributes the act to Aletheon + the principal + the grant', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(activeGrant());
    await POST(fakeReq({ connectorId: 'google.drive.create-doc', input: {} }));
    const receipt = receiptsWritten[0] as any;
    expect(receipt.summary).toContain('Aletheon acted as aigentMe for the principal under bounded delegation');
    expect(receipt.actionInput).toMatchObject({
      principalPersonaId: PERSONA_ID,
      actingAgentRootId: ALETHEON_ROOT_ID,
      actingAgentDid: ALETHEON_DID,
      actingAgentDisplayName: 'Aletheon',
      actingRole: 'aigentMe',
      delegationGrantId: GRANT_ID,
      delegatedAction: 'create_google_doc',
      executionSurface: 'metame',
      executionMode: 'autonomous',
      connectorId: 'google.drive.create-doc',
      outcome: 'executed',
    });
  });

  it('9. An expired/revoked grant (readActiveGrant returns null) refuses', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(aletheonCtx());
    mockReadActiveGrant.mockResolvedValue(null); // expired/revoked rows never come back as active
    const res = await POST(fakeReq({ connectorId: 'google.drive.create-doc', input: {} }));
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.code).toBe('no-active-grant');
  });

  it('10. Default aigentMe (no Agent assigned) does NOT inherit Aletheon\'s grant, even though one is active for the persona', async () => {
    mockResolveConstitutionalContext.mockResolvedValue(defaultAigentMeCtx());
    // A grant for Aletheon DOES exist and covers send_email, but no Agent is
    // currently assigned to the aigentMe role for this persona.
    mockReadActiveGrant.mockResolvedValue(activeGrant({ allowed_actions: ['send_email'] }));
    mockVerifyApprovalToken.mockReturnValue({ ok: true });
    const res = await POST(fakeReq({ connectorId: 'google.gmail.send', input: {}, approvalToken: 'valid-token' }));
    const json = await res.json();
    // Executes via the pre-existing (non-delegated) path — the approval
    // token alone is sufficient, exactly as before this closeout existed.
    // The point being proven: readActiveGrant is never even consulted for
    // gating purposes when there's no assigned delegate.
    expect(json.ok).toBe(true);
    const receipt = receiptsWritten[0] as any;
    expect(receipt.actionInput).toBeUndefined();
    expect(receipt.agentsInvoked).toEqual(['aigent-me']);
  });
});
