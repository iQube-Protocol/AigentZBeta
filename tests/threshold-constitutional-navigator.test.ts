/**
 * services/threshold/constitutionalNavigator.ts + the get_navigator_state
 * MCP tool (2026-08-26, first slice of the "invitation-aware constitutional
 * guide" brief).
 *
 * Covers:
 *  1. The T0->T2 reverse-lookup seam this module exists to close: a
 *     ScopedSession carries ONLY principalPublicRef; resolveConstitutionalNavigatorState
 *     must turn that into a real personaId via resolvePersonaIdByPublicRef
 *     before calling any personaId-parameterized resolver.
 *  2. Fails HONESTLY (resolvable:false, a named reason) when the public ref
 *     does not resolve — never guesses, never silently returns empty-but-ok.
 *  3. Composes Passport / sponsorship+delegation / CAS grant / RAX exchange
 *     from their real, already-canonical resolvers — proven by mocking each
 *     one and asserting the composed NavigatorState reflects exactly what
 *     each mock returned (i.e. this file does not re-derive any of those
 *     facts itself).
 *  4. T2 safety on the way OUT: the composed NavigatorState never contains
 *     the resolved personaId/authProfileId anywhere, even though both were
 *     used internally.
 *  5. The journey adapter map is pluggable and honest: an unwired bridge id
 *     returns journey:null + nextAct:null + a named evidence gap, never a
 *     guess.
 *  6. The gateway wiring: get_navigator_state is HANDSHAKE-gated (401/"handshake
 *     required" without a session), advertised with a real inputSchema, and
 *     its dispatch calls ctx.resolveNavigatorState and surfaces an honest
 *     error when the resolver reports resolvable:false or is unavailable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above ordinary top-level const declarations,
// so the mock functions they reference must be created via vi.hoisted (which
// itself hoists to the very top of the file) rather than a plain `const`.
const {
  mockResolvePersonaIdByPublicRef,
  mockResolveOwnerAuthProfileId,
  mockLoadUsableCitizenPassportForAuthProfile,
  mockIsPassportUsable,
  mockResolveConstitutionalContextForPersona,
  mockGetGrantedExperiments,
  mockListMyExchanges,
  mockFetchIanAuthoritativePlatformState,
} = vi.hoisted(() => ({
  mockResolvePersonaIdByPublicRef: vi.fn(),
  mockResolveOwnerAuthProfileId: vi.fn(),
  mockLoadUsableCitizenPassportForAuthProfile: vi.fn(),
  mockIsPassportUsable: vi.fn(),
  mockResolveConstitutionalContextForPersona: vi.fn(),
  mockGetGrantedExperiments: vi.fn(),
  mockListMyExchanges: vi.fn(),
  mockFetchIanAuthoritativePlatformState: vi.fn(),
}));

vi.mock('@/services/identity/personaReferences', () => ({
  resolvePersonaIdByPublicRef: mockResolvePersonaIdByPublicRef,
}));
vi.mock('@/services/contactGraph/ownerResolution', () => ({
  resolveOwnerAuthProfileId: mockResolveOwnerAuthProfileId,
}));
vi.mock('@/services/identity/passportPrincipal', () => ({
  loadUsableCitizenPassportForAuthProfile: mockLoadUsableCitizenPassportForAuthProfile,
  isPassportUsable: mockIsPassportUsable,
}));
vi.mock('@/services/identity/constitutionalContext', () => ({
  resolveConstitutionalContextForPersona: mockResolveConstitutionalContextForPersona,
}));
vi.mock('@/services/passport/participationAccess', () => ({
  getGrantedExperiments: mockGetGrantedExperiments,
}));
vi.mock('@/services/research/reciprocalExchange', () => ({
  listMyExchanges: mockListMyExchanges,
}));
vi.mock('@/services/journey/ianJourneyState', () => ({
  fetchIanAuthoritativePlatformState: mockFetchIanAuthoritativePlatformState,
}));
// services/journey/boundaryResearchExchangeAdmission.ts (imported below via
// constitutionalNavigator.ts, real/unmocked — ensureBoundaryResearchExchange
// Membership itself is exercised for real by this file's own tests) picked
// up a SIBLING export (2026-08-28's operator-assisted admission wrapper)
// that imports services/access/requireCartridgeAdmin, whose OTHER export
// (requireCartridgeAdmin) drags in services/identity/getActivePersona ->
// services/wallet/multiEmailIdentity, which creates a Supabase client at
// MODULE-EVALUATION time and throws without real env vars — same failure
// class this file's own vi.mock('@/services/identity/constitutionalContext')
// above already exists to prevent. Mocking this one module short-circuits
// that new edge without touching ensureBoundaryResearchExchangeMembership,
// which stays real and unmocked for this file's own assertions.
vi.mock('@/services/access/requireCartridgeAdmin', () => ({ isCartridgeAdmin: vi.fn() }));

import { resolveConstitutionalNavigatorState, supportedBridgeIds } from '@/services/threshold/constitutionalNavigator';
import type { ScopedSession } from '@/services/threshold/gatewaySession';

const FAKE_PERSONA_ID = '11111111-1111-1111-1111-111111111111';
const FAKE_AUTH_PROFILE_ID = '22222222-2222-2222-2222-222222222222';
const FAKE_PUBLIC_REF = 'abcdef0123456789';

function fakeSession(overrides: Partial<ScopedSession> = {}): ScopedSession {
  return {
    id: 'session-1',
    principalPublicRef: FAKE_PUBLIC_REF,
    agentAlias: 'ian-copilot',
    agreementId: 'agreement-1',
    scope: ['research.read'],
    initiatingService: 'ocsga',
    expiresAt: null,
    serviceAgreements: {},
    ...overrides,
  };
}

const NOOP_ADMIN = {} as never;

function primeHappyDefaults() {
  mockResolvePersonaIdByPublicRef.mockResolvedValue(FAKE_PERSONA_ID);
  mockResolveOwnerAuthProfileId.mockResolvedValue({ ok: true, value: FAKE_AUTH_PROFILE_ID });
  mockLoadUsableCitizenPassportForAuthProfile.mockResolvedValue({
    ok: true,
    passport: { passportClass: 'citizen', citizenStatus: 'active', participantStatus: null, passportGrade: 'standard', revoked: false, expiresAt: null },
  });
  mockIsPassportUsable.mockReturnValue(true);
  mockResolveConstitutionalContextForPersona.mockResolvedValue({
    citizen: { personId: FAKE_AUTH_PROFILE_ID },
    passport: { passportId: 'p1', grade: 'standard' },
    persona: { personaId: FAKE_PERSONA_ID, displayLabel: 'Ian' },
    boundAgents: [{ agentId: 'a1', agentDid: 'did:example:1', displayName: 'Ian Copilot', agentClass: 'polity_bound', passportBound: true, relationship: 'binding' }],
    assignedAgents: [{ personaId: FAKE_PERSONA_ID, agentId: 'a1', role: 'aigentMe', delegatedAuthority: ['research.read'], active: true, validFrom: null, validUntil: null, relationship: 'assignment' }],
    currentAigentMe: 'a1',
  });
  mockGetGrantedExperiments.mockResolvedValue({ hasGrant: true, allowed: new Set(['ocsga-boundary-research']) });
  mockListMyExchanges.mockResolvedValue({ ok: true, exchanges: [{ id: 'exchange-1', status: 'B_JOINED' }] });
  mockFetchIanAuthoritativePlatformState.mockResolvedValue({
    state: {
      stages: {
        orient: { orientation_ritual_completed: true },
        passport: { passport_issued: true },
        'delegation-establish': { delegation_active: true },
        'create-deposit': { iqube_created: false, content_deposited: false },
        'freeze-attestation-ready': { attestation_ready_acknowledged: false },
        'freeze-attestation': { artifact_freeze_initiated: false, freeze_signatures_collected: false },
        'exchange-ready': { exchange_instrument_signed: false },
        'exchange-complete': { reciprocal_exchange_completed: false },
        'research-active': { boundary_research_access_active: false },
      },
      receiptRefs: {},
    },
    evidenceGaps: [],
    activeExchangeId: 'exchange-1',
    citizenPassportUsable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  primeHappyDefaults();
});

describe('resolveConstitutionalNavigatorState — the T0->T2 reverse-lookup seam', () => {
  it('resolves personaId from the session\'s T2-safe principalPublicRef before calling any personaId-parameterized resolver', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(mockResolvePersonaIdByPublicRef).toHaveBeenCalledWith(NOOP_ADMIN, FAKE_PUBLIC_REF);
    expect(mockResolveOwnerAuthProfileId).toHaveBeenCalledWith(FAKE_PERSONA_ID);
    expect(mockLoadUsableCitizenPassportForAuthProfile).toHaveBeenCalledWith(NOOP_ADMIN, FAKE_AUTH_PROFILE_ID);
    expect(mockGetGrantedExperiments).toHaveBeenCalledWith(NOOP_ADMIN, FAKE_PERSONA_ID);
    expect(mockListMyExchanges).toHaveBeenCalledWith(NOOP_ADMIN, FAKE_PERSONA_ID);
    expect(mockFetchIanAuthoritativePlatformState).toHaveBeenCalledWith(FAKE_PERSONA_ID, FAKE_AUTH_PROFILE_ID);
    expect(state.resolvable).toBe(true);
  });

  it('fails HONESTLY (resolvable:false, a named reason) when the public ref does not resolve to a real persona', async () => {
    mockResolvePersonaIdByPublicRef.mockResolvedValue(null);
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), {});
    expect(state.resolvable).toBe(false);
    expect(state.reason).toMatch(/could not resolve/i);
    expect(state.journey).toBeNull();
    expect(state.nextAct).toBeNull();
    // Nothing downstream is even attempted once the principal can't be resolved.
    expect(mockResolveOwnerAuthProfileId).not.toHaveBeenCalled();
    expect(mockGetGrantedExperiments).not.toHaveBeenCalled();
  });

  it('T2 SAFETY: the composed NavigatorState never leaks personaId/authProfileId anywhere in its output', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    const json = JSON.stringify(state);
    expect(json).not.toContain(FAKE_PERSONA_ID);
    expect(json).not.toContain(FAKE_AUTH_PROFILE_ID);
  });
});

describe('resolveConstitutionalNavigatorState — composition, not re-derivation', () => {
  it('Passport status is read verbatim from isPassportUsable\'s own boolean, never re-computed', async () => {
    mockIsPassportUsable.mockReturnValue(false);
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.principal.passportStatus).toBe('not-usable');
  });

  it('sponsorship + delegation come from resolveConstitutionalContextForPersona\'s own rosters', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.agent.sponsoredAgentCount).toBe(1);
    expect(state.agent.delegationActive).toBe(true);
  });

  it('delegationActive is false when no assignment is active, even with bound agents present', async () => {
    mockResolveConstitutionalContextForPersona.mockResolvedValue({
      citizen: { personId: FAKE_AUTH_PROFILE_ID },
      passport: { passportId: null, grade: null },
      persona: { personaId: FAKE_PERSONA_ID, displayLabel: null },
      boundAgents: [{ agentId: 'a1', agentDid: 'did:example:1', displayName: 'x', agentClass: 'polity_bound', passportBound: false, relationship: 'binding' }],
      assignedAgents: [],
      currentAigentMe: null,
    });
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.agent.sponsoredAgentCount).toBe(1);
    expect(state.agent.delegationActive).toBe(false);
  });

  it('CAS research-lab grant scopes are read verbatim from getGrantedExperiments', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.grants.researchLab.hasGrant).toBe(true);
    expect(state.grants.researchLab.scopes).toEqual(['ocsga-boundary-research']);
  });

  it('an "all"-scoped grant reports scopes:["all"] rather than enumerating', async () => {
    mockGetGrantedExperiments.mockResolvedValue({ hasGrant: true, allowed: 'all' });
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.grants.researchLab.scopes).toEqual(['all']);
  });

  it('Reciprocal Artifact Exchange membership and status are read verbatim from listMyExchanges', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.grants.reciprocalExchange.hasActiveExchange).toBe(true);
    expect(state.grants.reciprocalExchange.status).toBe('B_JOINED');
  });

  it('a resolver failure is reported as an honest evidenceGap, never silently swallowed into a false negative', async () => {
    mockGetGrantedExperiments.mockRejectedValue(new Error('db down'));
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.grants.researchLab.hasGrant).toBe(false);
    expect(state.evidenceGaps.some((g) => /CAS research-lab grant read failed/.test(g))).toBe(true);
  });
});

describe('resolveConstitutionalNavigatorState — journey composition (ocsga)', () => {
  it('derives currentStageId/label and nextAct from the SAME resolveJourneyState + IAN_BOUNDARY_RESEARCH_JOURNEY the route itself uses', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.journey).not.toBeNull();
    expect(state.journey?.id).toBe('ian-boundary-research');
    expect(state.journey?.complete).toBe(false);
    // orient+passport+delegation are satisfied by the fixture; deposit is not.
    expect(state.journey?.currentStageId).toBe('create-deposit');
    expect(state.nextAct?.stageId).toBe('create-deposit');
    expect(state.nextAct?.actor).toBe('principal');
    expect(typeof state.nextAct?.because).toBe('string');
    expect(state.nextAct?.because.length).toBeGreaterThan(0);
  });

  it('reports complete:true and nextAct:null once every stage is satisfied', async () => {
    mockFetchIanAuthoritativePlatformState.mockResolvedValue({
      state: {
        stages: {
          orient: { orientation_ritual_completed: true },
          passport: { passport_issued: true },
          'delegation-establish': { delegation_active: true },
          'create-deposit': { iqube_created: true, content_deposited: true },
          'freeze-attestation-ready': { attestation_ready_acknowledged: true },
          'freeze-attestation': { artifact_freeze_initiated: true, freeze_signatures_collected: true },
          'exchange-ready': { exchange_instrument_signed: true },
          'exchange-complete': { reciprocal_exchange_completed: true },
          'research-active': { boundary_research_access_active: true },
        },
        receiptRefs: {},
      },
      evidenceGaps: [],
      activeExchangeId: 'exchange-1',
      citizenPassportUsable: true,
    });
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'ocsga' });
    expect(state.journey?.complete).toBe(true);
    expect(state.nextAct).toBeNull();
  });

  it('defaults `bridge` to the session\'s own initiatingService when opts.bridge is omitted', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession({ initiatingService: 'ocsga' }), {});
    expect(state.context.bridge).toBe('ocsga');
    expect(state.journey).not.toBeNull();
  });

  it('an unwired bridge id returns journey:null + nextAct:null + a named evidence gap — never a guess', async () => {
    const state = await resolveConstitutionalNavigatorState(NOOP_ADMIN, fakeSession(), { bridge: 'knyts' });
    expect(state.resolvable).toBe(true);
    expect(state.journey).toBeNull();
    expect(state.nextAct).toBeNull();
    expect(state.evidenceGaps.some((g) => /No journey adapter is wired for bridge 'knyts'/.test(g))).toBe(true);
  });
});

describe('supportedBridgeIds', () => {
  it('reports exactly what is wired today — ocsga only (the acceptance case)', () => {
    expect(supportedBridgeIds()).toEqual(['ocsga']);
  });
});

// ── Gateway wiring — get_navigator_state ─────────────────────────────────────

describe('gateway.ts — get_navigator_state tool', () => {
  it('is advertised with a real inputSchema and is handshake-gated', async () => {
    const { listTools, HANDSHAKE_TOOLS } = await import('@/services/threshold/gateway');
    const tools = listTools();
    const tool = tools.find((t) => t.name === 'get_navigator_state');
    expect(tool).toBeTruthy();
    expect(tool?.inputSchema.type).toBe('object');
    expect(HANDSHAKE_TOOLS.has('get_navigator_state')).toBe(true);
  });

  it('without a session, returns the honest "handshake required" result, never a partial answer', async () => {
    const { callTool } = await import('@/services/threshold/gateway');
    const res = await callTool('get_navigator_state', {}, { origin: 'https://example.test', gatewayUrl: 'https://example.test/api/threshold/mcp' });
    expect(res.isError).toBe(true);
    expect(String(res.content[0].text)).toMatch(/Constitutional Handshake/);
  });

  it('with a session but no injected resolveNavigatorState, reports the gateway feature as unavailable rather than crashing', async () => {
    const { callTool } = await import('@/services/threshold/gateway');
    const res = await callTool(
      'get_navigator_state',
      {},
      { origin: 'https://example.test', gatewayUrl: 'https://example.test/api/threshold/mcp', session: fakeSession() },
    );
    expect(res.isError).toBe(true);
    expect(String(res.content[0].text)).toMatch(/navigator is unavailable/i);
  });

  it('surfaces state.reason as an honest error when the navigator reports resolvable:false', async () => {
    const { callTool } = await import('@/services/threshold/gateway');
    const res = await callTool(
      'get_navigator_state',
      {},
      {
        origin: 'https://example.test',
        gatewayUrl: 'https://example.test/api/threshold/mcp',
        session: fakeSession(),
        resolveNavigatorState: async () => ({
          resolvable: false,
          reason: 'principal not found',
          context: { bridge: 'ocsga', initiatingService: 'ocsga' },
          principal: { passportStatus: 'unresolved' },
          agent: { sponsoredAgentCount: 0, delegationActive: false },
          grants: { researchLab: { hasGrant: false, scopes: [] }, reciprocalExchange: { hasActiveExchange: false, status: null } },
          journey: null,
          nextAct: null,
          evidenceGaps: ['principal not found'],
        }),
      },
    );
    expect(res.isError).toBe(true);
    expect(String(res.content[0].text)).toContain('principal not found');
  });

  it('on success, returns the composed state plus supportedBridges and the navigator-not-the-journey note', async () => {
    const { callTool } = await import('@/services/threshold/gateway');
    const res = await callTool(
      'get_navigator_state',
      { bridge: 'ocsga' },
      {
        origin: 'https://example.test',
        gatewayUrl: 'https://example.test/api/threshold/mcp',
        session: fakeSession(),
        resolveNavigatorState: async (opts) => ({
          resolvable: true,
          context: { bridge: opts?.bridge ?? 'ocsga', initiatingService: 'ocsga' },
          principal: { passportStatus: 'usable' },
          agent: { sponsoredAgentCount: 1, delegationActive: true },
          grants: { researchLab: { hasGrant: true, scopes: ['ocsga-boundary-research'] }, reciprocalExchange: { hasActiveExchange: true, status: 'B_JOINED' } },
          journey: { id: 'ian-boundary-research', label: 'Boundary Research Crossing', currentStageId: 'create-deposit', currentStageLabel: 'Create Research Artifact', complete: false, evidenceMissing: ['iqube_created', 'content_deposited'] },
          nextAct: { stageId: 'create-deposit', label: 'Create Research Artifact', because: 'Your research contribution becomes an iQube.', actor: 'principal' },
          evidenceGaps: [],
        }),
      },
    );
    expect(res.isError).toBeUndefined();
    const parsed = JSON.parse(String(res.content[0].text));
    expect(parsed.journey.currentStageId).toBe('create-deposit');
    expect(parsed.nextAct.actor).toBe('principal');
    expect(parsed.supportedBridges).toEqual(['ocsga']);
    expect(typeof parsed.note).toBe('string');
  });

  it('the MCP is not the journey — the tool description says so explicitly', async () => {
    const { listTools } = await import('@/services/threshold/gateway');
    const tool = listTools().find((t) => t.name === 'get_navigator_state');
    expect(tool?.description).toMatch(/never advances or mutates/i);
  });
});
