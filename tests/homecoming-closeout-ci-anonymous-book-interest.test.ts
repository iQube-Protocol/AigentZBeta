/**
 * Homecoming Closeout — CI (Constitutional Internet) anonymous book-interest
 * fix (operator brief 2026-08-17).
 *
 * POST /api/journey/constitutional-internet-bridge/choose/book-interest
 * previously returned `{ok:true, persisted:false}` for anonymous submitters
 * and silently discarded the email. This exercises the REAL route handler
 * against the GENERIC CRM contact substrate (services/crm/
 * genericContactResolver.ts) — never the KNYTS-specific evidence table or
 * resolveCampaignContact()'s investor/tag logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetActivePersona = vi.fn();
const mockResolveGenericContact = vi.fn();
const mockCreateEngagementEvent = vi.fn(async () => ({ id: 'evt-1' }));
const mockRecordCampaignEvent = vi.fn(async () => ({ eventId: 'ce-1', stateView: null }));

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: unknown[]) => mockGetActivePersona(...args),
}));
vi.mock('@/services/crm/genericContactResolver', () => ({
  resolveGenericContact: (...args: unknown[]) => mockResolveGenericContact(...args),
}));
vi.mock('@/services/crm/crmDataAccess', () => ({
  createEngagementEvent: (...args: unknown[]) => mockCreateEngagementEvent(...args),
}));
vi.mock('@/services/campaign/campaignService', () => ({
  recordCampaignEvent: (...args: unknown[]) => mockRecordCampaignEvent(...args),
}));

function fakeReq(body: Record<string, unknown>) {
  return { json: async () => body } as any;
}

let POST: typeof import('@/app/api/journey/constitutional-internet-bridge/choose/book-interest/route').POST;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ POST } = await import(
    '@/app/api/journey/constitutional-internet-bridge/choose/book-interest/route'
  ));
});

describe('CI anonymous book-interest — generic CRM contact substrate, not KNYTS evidence', () => {
  it('anonymous new email -> persisted CRM prospect (the exact gap this fix closes)', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    mockResolveGenericContact.mockResolvedValue({ crmPersonaId: 'crm-1', isNewProspect: true });

    const res = await POST(fakeReq({ email: 'newvisitor@example.com' }));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.persisted).toBe(true);
    expect(json.isNewSubmission).toBe(true);
    expect(mockResolveGenericContact).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedEmail: 'newvisitor@example.com', activePersonaId: null }),
    );
    expect(mockCreateEngagementEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 'crm-1',
        eventType: 'constitutional_internet_book_interest',
        weight: 0,
        pokwDelta: 0,
      }),
    );
    // No authenticated persona -> the identity-persona-scoped campaign event
    // must NOT fire (it requires a personaId and none exists here).
    expect(mockRecordCampaignEvent).not.toHaveBeenCalled();
  });

  it('anonymous existing email -> deduped existing contact, not a new prospect', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    mockResolveGenericContact.mockResolvedValue({ crmPersonaId: 'crm-existing', isNewProspect: false });

    const res = await POST(fakeReq({ email: 'Returning@Example.com' }));
    const json = await res.json();

    expect(json.persisted).toBe(true);
    expect(json.isNewSubmission).toBe(false);
    // Email normalization happens before resolution (trim + lowercase).
    expect(mockResolveGenericContact).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedEmail: 'returning@example.com' }),
    );
  });

  it('authenticated CI email -> CRM contact + book_interest campaign event both fire', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-auth-1' });
    mockResolveGenericContact.mockResolvedValue({ crmPersonaId: 'crm-2', isNewProspect: true });

    const res = await POST(fakeReq({ email: 'authed@example.com' }));
    const json = await res.json();

    expect(json.persisted).toBe(true);
    expect(mockCreateEngagementEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'constitutional-internet-bridge',
        eventType: 'book_interest',
        personaId: 'persona-auth-1',
      }),
    );
  });

  it('repeated submission -> resolver is the dedupe point; route never bypasses it', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    mockResolveGenericContact.mockResolvedValue({ crmPersonaId: 'crm-1', isNewProspect: false });

    await POST(fakeReq({ email: 'repeat@example.com' }));
    await POST(fakeReq({ email: 'repeat@example.com' }));

    expect(mockResolveGenericContact).toHaveBeenCalledTimes(2);
    // Both calls resolve to the SAME crmPersonaId (the resolver's job) —
    // the route itself never mints a second contact id independently.
    expect(mockCreateEngagementEvent.mock.calls[0][0]).toMatchObject({ personaId: 'crm-1' });
    expect(mockCreateEngagementEvent.mock.calls[1][0]).toMatchObject({ personaId: 'crm-1' });
  });

  it('no KNYTS campaign evidence/reward path is ever imported or invoked', async () => {
    const routeSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(
        new URL(
          '../app/api/journey/constitutional-internet-bridge/choose/book-interest/route.ts',
          import.meta.url,
        ),
        'utf-8',
      ),
    );
    // Check only executable import statements, not prose in doc comments
    // (which legitimately names these modules to explain what is NOT used).
    const importLines = routeSource
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line))
      .join('\n');
    expect(importLines).not.toMatch(
      /knytsBridgeCampaignEvidence|knytsBridgeCampaignProjector|campaignContactResolver['"].*resolveCampaignContact|projectKnytsBridgeEvidenceOutputs|recordKnytsBridgeEvidence/,
    );
    expect(importLines).not.toContain('resolveCampaignContact');
  });

  it('no paid-preorder claim — response never carries a preorder/payment field', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    mockResolveGenericContact.mockResolvedValue({ crmPersonaId: 'crm-3', isNewProspect: true });

    const res = await POST(fakeReq({ email: 'interest-only@example.com' }));
    const json = await res.json();

    expect(json).not.toHaveProperty('preorderId');
    expect(json).not.toHaveProperty('paymentUrl');
    expect(json).not.toHaveProperty('checkoutUrl');
  });

  it('invalid email is still rejected before any contact resolution runs', async () => {
    const res = await POST(fakeReq({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(mockResolveGenericContact).not.toHaveBeenCalled();
  });
});
