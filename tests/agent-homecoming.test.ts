/**
 * Agent Homecoming — stand-up spec canaries (CFS-023, Workstream 2).
 *
 * Pins the PURE stand-up specs: Aletheon (the archetype/first-mover) is present,
 * grounded in its card, slug-valid, and a BOUNDED delegate (never autonomous —
 * its charter forbids independent authority). Only carded delegates are standable
 * (No-Guessing: MoneyPenny/Nakamoto have no invented spec). The genesis call
 * itself is impure and not exercised here.
 *
 * The two describe blocks below (added for the Aletheon Homecoming Stage 1
 * preflight, operator-directed 2026-08-15) exercise the IMPURE route itself
 * (POST/GET /api/homecoming/agent/stand-up), mocking its dependencies at the
 * function-call boundary rather than faking the full Supabase query chain —
 * standUpDelegate/provisionAgentPersona/assessDelegate are covered by their
 * own suites; what's new here is the route's own receipt-emission decision
 * and the read-only preflight.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HOMECOMING_DELEGATE_SPECS, getDelegateSpec } from '@/services/homecoming/agentHomecoming';
import type { HomecomingDelegateId } from '@/types/homecoming';
import { SLUG_RE } from '@/services/agents/sponsorPolityAgent';
import { buildParticipantApplication } from '@/services/homecoming/issueDelegatePassport';
import { validateParticipantApplication } from '@/services/passport/participantApplicationValidator';

// ---------------------------------------------------------------------------
// Mocks for the route-level describe blocks below (POST/GET stand-up route).
// Only standUpDelegate is overridden on agentHomecoming — HOMECOMING_DELEGATE_SPECS
// and getDelegateSpec stay REAL (vi.importActual) so the pure-spec tests above
// are unaffected by this mock.
// ---------------------------------------------------------------------------

const mockStandUpDelegate = vi.fn();
vi.mock('@/services/homecoming/agentHomecoming', async () => {
  const actual = await vi.importActual<typeof import('@/services/homecoming/agentHomecoming')>(
    '@/services/homecoming/agentHomecoming',
  );
  return { ...actual, standUpDelegate: (...args: unknown[]) => mockStandUpDelegate(...args) };
});

const mockProvisionAgentPersona = vi.fn();
vi.mock('@/services/agents/provisionAgentPersona', () => ({
  provisionAgentPersona: (...args: unknown[]) => mockProvisionAgentPersona(...args),
}));

const mockAssessDelegate = vi.fn();
vi.mock('@/services/homecoming/constitutionalPresence', () => ({
  assessDelegate: (...args: unknown[]) => mockAssessDelegate(...args),
}));

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
}));

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: unknown[]) => mockGetActivePersona(...args),
}));

// A generic read-only fake admin client: every maybeSingle() resolves to
// `{ data: null, error: null }` and every directly-awaited chain (the
// count-query shape) resolves to `{ data: null, count: 0, error: null }`,
// regardless of table. Sufficient for the GET preflight describe block below,
// which asserts non-leakage rather than exact business-value branching (that
// branching is exercised by tests/homecoming.test.ts / delegate-standing-gate
// against the real, non-mocked resolvers). The POST describe block above
// never touches this — every POST test passes an explicit sponsorPassportId,
// so resolveSponsorForCaller short-circuits before any admin.from() call.
function makeGenericReadOnlyAdmin() {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  (chain as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) =>
    resolve({ data: null, count: 0, error: null });
  return { from: () => chain };
}

const mockGetSupabaseServer = vi.fn(() => makeGenericReadOnlyAdmin());
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://dev-beta.aigentz.me',
}));

const mockGetPersonaPlan = vi.fn();
vi.mock('@/services/billing/personaPlan', () => ({
  getPersonaPlan: (...args: unknown[]) => mockGetPersonaPlan(...args),
}));

function makeStandUpRequest(body: Record<string, unknown>) {
  return new (require('next/server').NextRequest)('https://dev-beta.aigentz.me/api/homecoming/agent/stand-up', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  } as any);
}

function makePreflightRequest(qs: string) {
  return new (require('next/server').NextRequest)(`https://dev-beta.aigentz.me/api/homecoming/agent/stand-up${qs}`, {
    method: 'GET',
  } as any);
}

const ADMIN_PERSONA = { personaId: 'admin-persona-1', authProfileId: null, cartridgeFlags: { isAdmin: true } };
const ALETHEON_AGENT = {
  agentRootId: 'root-aletheon-1',
  agentId: 'polity-bound:aletheon',
  didUri: 'did:agent:root:aletheon',
  agentClass: 'polity_bound',
  displayName: 'Aletheon',
  description: getDelegateSpec('aletheon')!.description,
  agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json',
  agentCardSlug: 'aletheon',
};

describe('Agent Homecoming — stand-up specs', () => {
  it('Aletheon is standable, slug-valid, and a bounded (non-autonomous) delegate', () => {
    const spec = getDelegateSpec('aletheon');
    expect(spec).not.toBeNull();
    expect(spec!.slug).toBe('aletheon');
    expect(SLUG_RE.test(spec!.slug)).toBe(true);
    expect(spec!.autonomous).toBe(false); // bounded companion, per its charter
    expect(spec!.description.length).toBeGreaterThan(40);
  });

  it('every authored spec has a valid slug and a non-empty description', () => {
    for (const spec of Object.values(HOMECOMING_DELEGATE_SPECS)) {
      expect(SLUG_RE.test(spec!.slug)).toBe(true);
      expect(spec!.displayName.trim().length).toBeGreaterThan(0);
      expect(spec!.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('un-authored delegates are not standable (no invented spec)', () => {
    // The SUBJECT must be genuinely un-authored, not merely un-authored on the
    // day the test was written. 'moneypenny' was the original example and has
    // since been authored (MoneyPenny now has a real card), which turned a
    // correct implementation into a red build. A deliberately fictitious slug
    // keeps the invariant under test instead of a moving example.
    // Every delegate on the roster (aletheon, moneypenny, nakamoto) is now
    // AUTHORED, so no real id exercises this branch any more -- the original
    // subjects were authored after the test was written. The fixture id is
    // asserted to be genuinely absent from the spec map, so this cannot
    // silently become vacuous if the roster grows.
    const FIXTURE = 'no-such-delegate-fixture' as HomecomingDelegateId;
    expect(Object.keys(HOMECOMING_DELEGATE_SPECS)).not.toContain(FIXTURE);
    expect(getDelegateSpec(FIXTURE)).toBeNull();
  });
});

describe('Passport issuance — the built application passes the Bureau validator', () => {
  it('buildParticipantApplication yields a VALID agent_participant application', () => {
    const spec = getDelegateSpec('aletheon')!;
    const app = buildParticipantApplication(spec, 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json');
    const result = validateParticipantApplication(app);
    expect(result.valid).toBe(true);
    expect(result.passportClass).toBe('agent_participant');
  });

  it('rejects a broken card URL (guards the payload builder contract)', () => {
    const spec = getDelegateSpec('aletheon')!;
    const app = buildParticipantApplication(spec, 'not-a-url');
    expect(validateParticipantApplication(app).valid).toBe(false);
  });
});

describe('POST /api/homecoming/agent/stand-up — positive stand-up receipt (Aletheon Homecoming Stage 1)', () => {
  beforeEach(() => {
    mockStandUpDelegate.mockReset();
    mockProvisionAgentPersona.mockReset();
    mockAssessDelegate.mockReset().mockResolvedValue(null);
    mockCreateActivityReceipt.mockReset().mockResolvedValue({ id: 'receipt-1' });
    mockGetActivePersona.mockReset().mockResolvedValue(ADMIN_PERSONA);
  });

  it('a fresh (first) stand-up emits exactly one agent_delegate_stood_up receipt', async () => {
    mockStandUpDelegate.mockResolvedValue({
      spec: getDelegateSpec('aletheon'),
      agent: ALETHEON_AGENT,
      alreadySeeded: false,
      capacityOverride: null,
    });
    mockProvisionAgentPersona.mockResolvedValue({
      ok: true,
      status: 200,
      alreadyExists: false,
      agentPersona: { agentPersonaId: 'persona-1', didUri: 'did:agent:persona:aletheon:production', agentRootId: 'root-aletheon-1', personaRole: 'polity_bound_delegate', maxIdentifiability: 'anonymous', createdAt: '2026-08-15T00:00:00Z' },
      delegationAnchored: { sponsorRootResolved: true, sponsorDidPersonaResolved: true },
    });

    const { POST } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await POST(makeStandUpRequest({ delegate: 'aletheon', sponsorPassportId: 'passport-fixture' }));
    expect(res.status).toBe(200);

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionType).toBe('agent_delegate_stood_up');
    expect(receiptInput.actionInput.agent_root_id).toBe('root-aletheon-1');
    expect(receiptInput.actionInput.root_freshly_created).toBe(true);
    expect(receiptInput.actionInput.persona_freshly_created).toBe(true);
  });

  it('an idempotent re-run (both root and persona already existed) emits NO second receipt', async () => {
    mockStandUpDelegate.mockResolvedValue({
      spec: getDelegateSpec('aletheon'),
      agent: ALETHEON_AGENT,
      alreadySeeded: true, // root already existed
      capacityOverride: null,
    });
    mockProvisionAgentPersona.mockResolvedValue({
      ok: true,
      status: 200,
      alreadyExists: true, // persona already existed too
      agentPersona: { agentPersonaId: 'persona-1', didUri: 'did:agent:persona:aletheon:production', agentRootId: 'root-aletheon-1', personaRole: 'polity_bound_delegate', maxIdentifiability: 'anonymous', createdAt: '2026-08-15T00:00:00Z' },
    });

    const { POST } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await POST(makeStandUpRequest({ delegate: 'aletheon', sponsorPassportId: 'passport-fixture' }));
    expect(res.status).toBe(200);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('a re-run that newly provisions the persona onto an already-seeded root STILL emits a receipt (real progress, not a duplicate)', async () => {
    mockStandUpDelegate.mockResolvedValue({
      spec: getDelegateSpec('aletheon'),
      agent: ALETHEON_AGENT,
      alreadySeeded: true, // root pre-existed
      capacityOverride: null,
    });
    mockProvisionAgentPersona.mockResolvedValue({
      ok: true,
      status: 200,
      alreadyExists: false, // persona is genuinely new THIS call
      agentPersona: { agentPersonaId: 'persona-1', didUri: 'did:agent:persona:aletheon:production', agentRootId: 'root-aletheon-1', personaRole: 'polity_bound_delegate', maxIdentifiability: 'anonymous', createdAt: '2026-08-15T00:00:00Z' },
    });

    const { POST } = await import('@/app/api/homecoming/agent/stand-up/route');
    await POST(makeStandUpRequest({ delegate: 'aletheon', sponsorPassportId: 'passport-fixture' }));
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    expect(mockCreateActivityReceipt.mock.calls[0][0].actionInput.persona_freshly_created).toBe(true);
    expect(mockCreateActivityReceipt.mock.calls[0][0].actionInput.root_freshly_created).toBe(false);
  });

  it('a receipt-write failure does NOT roll back, retry, or fail the already-committed stand-up', async () => {
    mockStandUpDelegate.mockResolvedValue({
      spec: getDelegateSpec('aletheon'),
      agent: ALETHEON_AGENT,
      alreadySeeded: false,
      capacityOverride: null,
    });
    mockProvisionAgentPersona.mockResolvedValue({
      ok: true,
      status: 200,
      alreadyExists: false,
      agentPersona: { agentPersonaId: 'persona-1', didUri: 'did:agent:persona:aletheon:production', agentRootId: 'root-aletheon-1', personaRole: 'polity_bound_delegate', maxIdentifiability: 'anonymous', createdAt: '2026-08-15T00:00:00Z' },
    });
    mockCreateActivityReceipt.mockRejectedValue(new Error('activity_receipts insert failed'));

    const { POST } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await POST(makeStandUpRequest({ delegate: 'aletheon', sponsorPassportId: 'passport-fixture' }));
    // The route must still report success — a receipt failure is best-effort
    // and must never unwind or retry the already-committed identity state.
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.agent.agentRootId).toBe('root-aletheon-1');
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1); // attempted once, never retried
  });

  it('T0 identifiers (sponsor persona/passport id) never appear in the receipt summary or actionInput', async () => {
    mockStandUpDelegate.mockResolvedValue({
      spec: getDelegateSpec('aletheon'),
      agent: ALETHEON_AGENT,
      alreadySeeded: false,
      capacityOverride: { authority: 'administrator', basis: 'canonical admin authority', ordinaryCapacityAtOverride: { base: 3, earned: 0, used: 3, remaining: 0 } },
    });
    mockProvisionAgentPersona.mockResolvedValue({
      ok: true,
      status: 200,
      alreadyExists: false,
      agentPersona: { agentPersonaId: 'persona-1', didUri: 'did:agent:persona:aletheon:production', agentRootId: 'root-aletheon-1', personaRole: 'polity_bound_delegate', maxIdentifiability: 'anonymous', createdAt: '2026-08-15T00:00:00Z' },
    });

    const SPONSOR_PASSPORT_FIXTURE = 'passport-fixture-should-not-leak';
    const { POST } = await import('@/app/api/homecoming/agent/stand-up/route');
    await POST(makeStandUpRequest({ delegate: 'aletheon', sponsorPassportId: SPONSOR_PASSPORT_FIXTURE }));

    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    // personaId IS a required top-level field on CreateActivityReceiptInput
    // (the ACTING admin's own persona — self-view, same convention as the
    // agent-revocation receipt) — that field is expected, not a leak. What
    // must be absent is the SPONSOR's identifiers: the sponsor passport id
    // (a different citizen's passport in the general case) and any field
    // literally named a sponsor persona/passport identifier.
    const serialized = JSON.stringify(receiptInput);
    expect(serialized).not.toContain(SPONSOR_PASSPORT_FIXTURE);
    expect(receiptInput.actionInput).not.toHaveProperty('sponsor_persona_id');
    expect(receiptInput.actionInput).not.toHaveProperty('sponsor_passport_id');
  });
});

describe('GET /api/homecoming/agent/stand-up — read-only sponsor preflight (Aletheon Homecoming Stage 1)', () => {
  beforeEach(() => {
    mockGetActivePersona.mockReset().mockResolvedValue(ADMIN_PERSONA);
    mockGetPersonaPlan.mockReset().mockResolvedValue({ boundedDelegateLimit: 3 });
  });

  it('requires admin — a non-admin caller is refused before any read', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'citizen-1', authProfileId: null, cartridgeFlags: { isAdmin: false } });
    const { GET } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await GET(makePreflightRequest('?delegate=aletheon&preflight=true'));
    expect(res.status).toBe(403);
  });

  it('an unrecognised delegate falls through to the static GET note, not the preflight branch', async () => {
    const { GET } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await GET(makePreflightRequest('?delegate=not-a-real-delegate&preflight=true'));
    const json = await res.json();
    expect(json.preflight).toBeUndefined();
    expect(json.standable).toBeDefined();
  });

  it('never returns a raw sponsor persona id, even in the preflight payload', async () => {
    // resolveSponsorForCaller short-circuits on the explicit sponsorPassportId
    // (no polity_passport_records lookup needed); the generic read-only admin
    // fake resolves every remaining read to "not found" — sponsorRootResolvable:
    // false, capacity: base 3 / used 0. The specific values aren't the point
    // of this canary; the absence of the caller's raw persona id is.
    const { GET } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await GET(
      makePreflightRequest('?delegate=aletheon&preflight=true&sponsorPassportId=passport-fixture-should-not-leak'),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preflight).toBe(true);
    expect(json.sponsorResolved).toBe(true);
    expect(json.sponsorPassportId).toBe('passport-fixture-should-not-leak'); // caller's own resolved sponsor — self-view, fine
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain(ADMIN_PERSONA.personaId); // the T0 field — never
  });

  it('a revoked/suspended citizen passport is reported as NOT valid, even though passport_class is citizen', async () => {
    mockGetSupabaseServer.mockReturnValueOnce({
      from: (table: string) => {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          maybeSingle: async () => {
            if (table === 'polity_passport_records') {
              return { data: { passport_id: 'passport-fixture', passport_class: 'citizen', citizen_status: 'revoked' }, error: null };
            }
            return { data: null, error: null };
          },
        };
        (chain as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) =>
          resolve({ data: null, count: 0, error: null });
        return chain;
      },
    });

    const { GET } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await GET(
      makePreflightRequest('?delegate=aletheon&preflight=true&sponsorPassportId=passport-fixture'),
    );
    const json = await res.json();
    expect(json.sponsorResolved).toBe(true);
    expect(json.citizenStatus).toBe('revoked');
    expect(json.passportValid).toBe(false); // revoked must never read as a valid sponsor
  });

  it('reports whether the resolved sponsor is the caller\'s own authenticated persona (relational, not the raw id)', async () => {
    const { GET } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await GET(
      makePreflightRequest('?delegate=aletheon&preflight=true&sponsorPassportId=some-other-citizens-passport'),
    );
    const json = await res.json();
    // No explicit sponsorPersonaId override was given via personas lookup here
    // (resolveSponsorForCaller only widens the SEARCH when no explicit passport
    // is supplied) — an explicit sponsorPassportId keeps sponsorPersonaId as the
    // caller's own active persona, so this should read true.
    expect(json.sponsorIsCallersAuthenticatedPersona).toBe(true);
  });

  it('the exact Aletheon-approval-gate negative case: a valid ACTIVE citizen sponsor resolves on the SAME auth profile but a DIFFERENT persona id than the caller', async () => {
    // No explicit sponsorPassportId — forces resolveSponsorForCaller's
    // auto-widen path: query personas by auth_profile_id, then the citizen
    // passports among those persona ids. This is the exact shape the
    // Aletheon approval gate depends on (sponsorIsCallersAuthenticatedPersona
    // must be false here, not merely true-by-construction of the other
    // tests), so it gets its own explicit canary per operator instruction
    // rather than being inferred from the equality expression alone.
    const OTHER_PERSONA_ID = 'other-persona-same-auth-profile-2';
    mockGetActivePersona.mockResolvedValue({
      personaId: ADMIN_PERSONA.personaId,
      authProfileId: 'auth-profile-shared-1',
      cartridgeFlags: { isAdmin: true },
    });
    mockGetSupabaseServer.mockReturnValueOnce({
      from: (table: string) => {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          maybeSingle: async () => {
            if (table === 'polity_passport_records') {
              // GET_preflight's own validity re-check of the resolved passport.
              return { data: { passport_id: 'passport-other-2', passport_class: 'citizen', citizen_status: 'active' }, error: null };
            }
            if (table === 'personas') {
              // root_did / capacity lookups for the resolved sponsor — kept
              // minimal (no root) since root resolution isn't this canary's
              // subject; the relational identity + non-leakage assertions are.
              return { data: { root_did: null, sponsorship_capacity_base: 0, sponsorship_capacity_earned: 0 }, error: null };
            }
            return { data: null, error: null }; // agent_root_identity existingRoot check
          },
        };
        (chain as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) => {
          if (table === 'personas') {
            // resolveSponsorForCaller's "every persona on this auth account" query.
            return resolve({ data: [{ id: OTHER_PERSONA_ID }], count: 0, error: null });
          }
          if (table === 'polity_passport_records') {
            // resolveSponsorForCaller's citizen-passport-among-those-personas query.
            return resolve({
              data: [{ passport_id: 'passport-other-2', persona_id: OTHER_PERSONA_ID, citizen_status: 'active' }],
              count: 0,
              error: null,
            });
          }
          return resolve({ data: null, count: 0, error: null }); // agent_root_identity used-count query
        };
        return chain;
      },
    });

    const { GET } = await import('@/app/api/homecoming/agent/stand-up/route');
    const res = await GET(makePreflightRequest('?delegate=aletheon&preflight=true'));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.sponsorResolved).toBe(true);
    expect(json.passportValid).toBe(true);
    expect(json.sponsorIsCallersAuthenticatedPersona).toBe(false);

    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain(OTHER_PERSONA_ID); // the resolved sponsor's raw persona UUID — never
    expect(serialized).not.toContain(ADMIN_PERSONA.personaId); // the caller's own raw persona UUID — never either
  });
});
