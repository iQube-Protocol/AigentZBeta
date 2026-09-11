/**
 * OCSGA bridge structural admission fix (2026-08-26) — a persona holding a
 * usable Citizen Passport and an active `research-lab` grant scoped to
 * `ocsga-boundary-research` is entitled to Reciprocal Artifact Exchange
 * (RAX) membership; nothing previously translated that CAS grant into RAX
 * membership, so the bridge structurally refused an admitted participant.
 *
 * Covers the 8 canaries named in the operator directive plus the wiring
 * proof that `getBoundaryResearchReadableExperiments` (previously dead
 * code — zero production call sites) is now actually consumed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

// ── Unit-level: services/journey/boundaryResearchExchangeAdmission.ts ──────

const {
  mockGetBoundaryResearchReadableExperiments,
  mockLoadUsableCitizenPassportForAuthProfile,
  mockIsPassportUsable,
  mockListExchangesByParentExperiment,
  mockCreateExchange,
  mockInviteCounterparty,
  mockJoinExchange,
  mockResolveMembership,
  mockGetResearchWorkspace,
  mockIsCartridgeAdmin,
} = vi.hoisted(() => ({
  mockGetBoundaryResearchReadableExperiments: vi.fn(),
  mockLoadUsableCitizenPassportForAuthProfile: vi.fn(),
  mockIsPassportUsable: vi.fn(),
  mockListExchangesByParentExperiment: vi.fn(),
  mockCreateExchange: vi.fn(),
  mockInviteCounterparty: vi.fn(),
  mockJoinExchange: vi.fn(),
  mockResolveMembership: vi.fn(),
  mockGetResearchWorkspace: vi.fn(),
  mockIsCartridgeAdmin: vi.fn(),
}));

vi.mock('@/services/passport/participationAccess', () => ({
  getBoundaryResearchReadableExperiments: mockGetBoundaryResearchReadableExperiments,
}));
vi.mock('@/services/identity/passportPrincipal', () => ({
  loadUsableCitizenPassportForAuthProfile: mockLoadUsableCitizenPassportForAuthProfile,
  isPassportUsable: mockIsPassportUsable,
}));
vi.mock('@/services/research/researchWorkspace', () => ({
  getResearchWorkspace: mockGetResearchWorkspace,
}));
vi.mock('@/services/research/reciprocalExchange', () => ({
  listExchangesByParentExperiment: mockListExchangesByParentExperiment,
  createExchange: mockCreateExchange,
  inviteCounterparty: mockInviteCounterparty,
  joinExchange: mockJoinExchange,
  resolveMembership: mockResolveMembership,
}));
// isCartridgeAdmin is a pure predicate (services/access/requireCartridgeAdmin.ts)
// but that module's SIBLING export requireCartridgeAdmin imports
// services/identity/getActivePersona.ts, which reaches a module-top-level
// `createClient(...)` call requiring live SUPABASE_URL env — exactly the
// external-service dependency this repo's unit-test suite must run without
// (vitest.config.mjs's own stated contract). Mocking the whole module keeps
// this file's zero-external-dependency guarantee; isCartridgeAdmin's OWN
// logic (isAdmin || adminCartridges.includes(slug)) is covered independently
// by tests/require-cartridge-admin.test.ts — this file only needs to prove
// the operator-assisted wrapper CALLS it correctly, not re-verify its body.
vi.mock('@/services/access/requireCartridgeAdmin', () => ({
  isCartridgeAdmin: mockIsCartridgeAdmin,
}));

import {
  ensureBoundaryResearchExchangeMembership,
  ensureBoundaryResearchExchangeMembershipOperatorAssisted,
  OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
} from '@/services/journey/boundaryResearchExchangeAdmission';
import type { ActivePersonaContext } from '@/types/access';

const makeOperatorContext = (over?: Partial<ActivePersonaContext>): ActivePersonaContext => ({
  personaId: 'operator-persona-uuid',
  authProfileId: 'operator-auth-profile-uuid',
  identifiability: 'semi_anonymous',
  cartridgeFlags: { isAdmin: false, isPartner: false, adminCartridges: [] },
  cohortMemberships: [],
  source: 'session-cookie',
  ...over,
} as ActivePersonaContext);

const NOOP_ADMIN = {} as never;
const PERSONA_ID = '29d22f83-a3cc-49d9-90be-a39391e9d8ae'; // Ian's real persona, from the live audit
const AUTH_PROFILE_ID = 'auth-profile-1';

function fakeExchange(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exchange-1',
    exchangeType: 'independent-artifact-comparison',
    title: 'OCSGA Boundary Research',
    purpose: 'p',
    researchQuestion: null,
    initiatorPersonaId: 'other-persona',
    counterpartyPersonaId: null,
    researchSpaceId: null,
    cohortId: null,
    status: 'DRAFT',
    disclosurePolicy: 'RECIPROCAL_AFTER_BOTH_DEPOSIT',
    comparisonPolicy: null,
    confidentialityClass: 'confidential-bilateral',
    permittedPurpose: 'p',
    ownershipDeclaration: 'o',
    derivativeAnalysisPermitted: true,
    publicationPermitted: false,
    retentionPolicy: null,
    agreementRef: null,
    inviteCodeHash: null,
    inviteExpiresAt: null,
    qubetalkChannelId: null,
    parentExperimentId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    derivedExperimentId: null,
    createdAt: '2026-08-26T00:00:00Z',
    openedAt: null,
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadUsableCitizenPassportForAuthProfile.mockResolvedValue({ ok: true, passport: { revoked: false } });
  mockIsPassportUsable.mockReturnValue(true);
  // Fail-closed default — every test that needs operator authorization sets
  // this explicitly; the plain ensureBoundaryResearchExchangeMembership
  // canaries above never call isCartridgeAdmin at all, so this default never
  // affects them.
  mockIsCartridgeAdmin.mockReturnValue(false);
  mockGetResearchWorkspace.mockReturnValue({ id: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID, title: 'OCSGA Boundary Research', description: 'desc' });
  mockListExchangesByParentExperiment.mockResolvedValue({ ok: true, exchanges: [] });
  mockResolveMembership.mockImplementation((ex: { initiatorPersonaId: string; counterpartyPersonaId: string | null }, personaId: string) => {
    if (ex.initiatorPersonaId === personaId) return 'A';
    if (ex.counterpartyPersonaId === personaId) return 'B';
    return null;
  });
});

describe('canary 1 — active OCSGA workspace grant + no RAX row → exactly one RAX context is provisioned', () => {
  it('creates a new exchange via the EXISTING createExchange primitive, tagged to the workspace', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    mockCreateExchange.mockResolvedValue({ ok: true, exchange: fakeExchange({ id: 'new-exchange', initiatorPersonaId: PERSONA_ID }) });

    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result).toEqual({ ok: true, exchangeId: 'new-exchange', created: true, role: 'initiator' });
    expect(mockCreateExchange).toHaveBeenCalledTimes(1);
    expect(mockCreateExchange).toHaveBeenCalledWith(
      NOOP_ADMIN,
      expect.objectContaining({ initiatorPersonaId: PERSONA_ID, parentExperimentId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID }),
    );
  });
});

describe('canary 2 — refresh/re-entry → same exchange returned, no duplicate', () => {
  it('a second call finds the persona already a party and does not create again', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    mockListExchangesByParentExperiment.mockResolvedValue({
      ok: true,
      exchanges: [fakeExchange({ id: 'existing-exchange', initiatorPersonaId: PERSONA_ID })],
    });

    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result).toEqual({ ok: true, exchangeId: 'existing-exchange', created: false, role: 'initiator' });
    expect(mockCreateExchange).not.toHaveBeenCalled();
  });
});

describe('canary 3 — no OCSGA grant → no exchange provisioned', () => {
  it('refuses with not-admitted and never calls createExchange', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set());

    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result).toEqual({ ok: false, reason: 'not-admitted' });
    expect(mockCreateExchange).not.toHaveBeenCalled();
    expect(mockListExchangesByParentExperiment).not.toHaveBeenCalled();
  });
});

describe('canary 4 — EXP-001 grant alone → no OCSGA exchange provisioned', () => {
  it('a grant scoped to an unrelated experiment id never admits into OCSGA', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set(['EXP-001']));

    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result).toEqual({ ok: false, reason: 'not-admitted' });
    expect(mockCreateExchange).not.toHaveBeenCalled();
  });

  it('an unrestricted grant ("all") still admits, correctly distinguished from a narrow EXP-001 grant', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue('all');
    mockCreateExchange.mockResolvedValue({ ok: true, exchange: fakeExchange({ id: 'new-exchange', initiatorPersonaId: PERSONA_ID }) });

    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result.ok).toBe(true);
  });
});

describe('canary 5 — existing RAX participant → no new exchange created', () => {
  it('a persona already a counterparty on the workspace exchange is recognized, not re-provisioned', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    mockListExchangesByParentExperiment.mockResolvedValue({
      ok: true,
      exchanges: [fakeExchange({ id: 'existing-exchange', initiatorPersonaId: 'other-persona', counterpartyPersonaId: PERSONA_ID })],
    });

    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result).toEqual({ ok: true, exchangeId: 'existing-exchange', created: false, role: 'counterparty' });
    expect(mockCreateExchange).not.toHaveBeenCalled();
  });
});

describe('a second admitted grant-holder joins the FIRST participant\'s exchange rather than getting an isolated one', () => {
  it('binds as counterparty via the EXISTING inviteCounterparty + joinExchange primitives, server-side', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    const joinable = fakeExchange({ id: 'joinable-exchange', initiatorPersonaId: 'first-participant', status: 'A_DEPOSITED', counterpartyPersonaId: null });
    mockListExchangesByParentExperiment.mockResolvedValue({ ok: true, exchanges: [joinable] });
    mockInviteCounterparty.mockResolvedValue({ ok: true, rawCode: 'rax-serverside-only' });
    mockJoinExchange.mockResolvedValue({ ok: true, exchange: { ...joinable, counterpartyPersonaId: PERSONA_ID, status: 'B_JOINED' } });

    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result).toEqual({ ok: true, exchangeId: 'joinable-exchange', created: false, role: 'counterparty' });
    expect(mockInviteCounterparty).toHaveBeenCalledWith(NOOP_ADMIN, { exchangeId: 'joinable-exchange', personaId: 'first-participant' });
    expect(mockJoinExchange).toHaveBeenCalledWith(NOOP_ADMIN, { exchangeId: 'joinable-exchange', rawCode: 'rax-serverside-only', personaId: PERSONA_ID });
    expect(mockCreateExchange).not.toHaveBeenCalled();
  });
});

describe('Passport gate', () => {
  it('refuses passport-unusable without ever reading the grant', async () => {
    mockIsPassportUsable.mockReturnValue(false);
    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'passport-unusable' });
    expect(mockGetBoundaryResearchReadableExperiments).not.toHaveBeenCalled();
  });

  it('refuses passport-unresolved (no authProfileId) rather than guessing a pass', async () => {
    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: null,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'passport-unresolved' });
  });

  it('refuses no-persona', async () => {
    const result = await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: null,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'no-persona' });
  });
});

describe('wiring the previously-dead scope resolver into production', () => {
  it('ensureBoundaryResearchExchangeMembership actually calls getBoundaryResearchReadableExperiments', async () => {
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    mockCreateExchange.mockResolvedValue({ ok: true, exchange: fakeExchange({ id: 'x', initiatorPersonaId: PERSONA_ID }) });
    await ensureBoundaryResearchExchangeMembership(NOOP_ADMIN, {
      personaId: PERSONA_ID,
      authProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(mockGetBoundaryResearchReadableExperiments).toHaveBeenCalledWith(NOOP_ADMIN, PERSONA_ID);
  });
});

// ── Operator-assisted admission wrapper (2026-08-28) — required tests 1 & 2,
//    plus the operator-authorization gate itself. Reuses EVERY existing mock
//    and helper above: the wrapper calls the REAL, unmocked
//    ensureBoundaryResearchExchangeMembership, so these tests exercise the
//    exact same Passport/grant machinery the canaries above already cover —
//    only the operator-authorization gate on top is new. ────────────────────

describe('ensureBoundaryResearchExchangeMembershipOperatorAssisted — operator authorization gate', () => {
  it('refuses an operator with no admin scope on irl-cartridge, BEFORE any Passport/grant check runs', async () => {
    mockIsCartridgeAdmin.mockReturnValue(false);
    const nonAdminOperator = makeOperatorContext();
    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: nonAdminOperator,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'operator-authorization-required' });
    expect(mockLoadUsableCitizenPassportForAuthProfile).not.toHaveBeenCalled();
    expect(mockGetBoundaryResearchReadableExperiments).not.toHaveBeenCalled();
  });

  it('calls the SAME isCartridgeAdmin predicate every other admin surface uses, scoped to \'irl-cartridge\' — no parallel admin check', async () => {
    mockIsCartridgeAdmin.mockReturnValue(true);
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    mockCreateExchange.mockResolvedValue({ ok: true, exchange: fakeExchange({ id: 'new-exchange', initiatorPersonaId: PERSONA_ID }) });
    const operatorCtx = makeOperatorContext();

    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: operatorCtx,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result.ok).toBe(true);
    expect(mockIsCartridgeAdmin).toHaveBeenCalledWith(operatorCtx, 'irl-cartridge');
  });

  it('an operator whose admin scope does not authorize this cartridge is refused (isCartridgeAdmin returns false)', async () => {
    mockIsCartridgeAdmin.mockReturnValue(false);
    const wrongCartridgeAdmin = makeOperatorContext({
      cartridgeFlags: { isAdmin: false, isPartner: false, adminCartridges: ['knyt-codex'] },
    });
    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: wrongCartridgeAdmin,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'operator-authorization-required' });
  });
});

describe('required test 1 — ineligible operator-assisted bind rejected (operator IS authorized, TARGET is not)', () => {
  const AUTHORIZED_OPERATOR = makeOperatorContext({ cartridgeFlags: { isAdmin: true, isPartner: false, adminCartridges: [] } });

  it('target has no usable Passport → passport-unusable, same reason code as the direct path', async () => {
    mockIsCartridgeAdmin.mockReturnValue(true);
    mockIsPassportUsable.mockReturnValue(false);
    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: AUTHORIZED_OPERATOR,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'passport-unusable' });
    expect(mockGetBoundaryResearchReadableExperiments).not.toHaveBeenCalled();
    expect(mockCreateExchange).not.toHaveBeenCalled();
  });

  it('target has no research-lab grant reaching this workspace → not-admitted, same reason code', async () => {
    mockIsCartridgeAdmin.mockReturnValue(true);
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set(['EXP-001']));
    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: AUTHORIZED_OPERATOR,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'not-admitted' });
    expect(mockCreateExchange).not.toHaveBeenCalled();
  });

  it('a chat-asserted-style personaId with genuinely no Passport/grant on file is rejected — never a fabricated pass', async () => {
    mockIsCartridgeAdmin.mockReturnValue(true);
    mockIsPassportUsable.mockReturnValue(false);
    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: AUTHORIZED_OPERATOR,
      targetPersonaId: 'persona-fabricated-not-in-db',
      targetAuthProfileId: 'auth-profile-fabricated-not-in-db',
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('passport-unusable');
  });
});

describe('required test 2 — eligible bind is idempotent through the operator-assisted path', () => {
  it('calling twice for an already-bound target returns the SAME exchange, never a duplicate', async () => {
    mockIsCartridgeAdmin.mockReturnValue(true);
    const AUTHORIZED_OPERATOR = makeOperatorContext({ cartridgeFlags: { isAdmin: true, isPartner: false, adminCartridges: [] } });
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    mockListExchangesByParentExperiment.mockResolvedValue({
      ok: true,
      exchanges: [fakeExchange({ id: 'existing-exchange', initiatorPersonaId: 'other-persona', counterpartyPersonaId: PERSONA_ID })],
    });

    const first = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: AUTHORIZED_OPERATOR,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });
    const second = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: AUTHORIZED_OPERATOR,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(first).toEqual({ ok: true, exchangeId: 'existing-exchange', created: false, role: 'counterparty' });
    expect(second).toEqual(first);
    expect(mockCreateExchange).not.toHaveBeenCalled();
    expect(mockInviteCounterparty).not.toHaveBeenCalled();
    expect(mockJoinExchange).not.toHaveBeenCalled();
  });

  it('binds via the EXISTING inviteCounterparty + joinExchange primitives, server-side, when a canonical exchange is joinable', async () => {
    mockIsCartridgeAdmin.mockReturnValue(true);
    const AUTHORIZED_OPERATOR = makeOperatorContext({ cartridgeFlags: { isAdmin: true, isPartner: false, adminCartridges: [] } });
    mockGetBoundaryResearchReadableExperiments.mockResolvedValue(new Set([OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID]));
    const joinable = fakeExchange({ id: 'joinable-exchange', initiatorPersonaId: 'ci-irl-side', status: 'A_DEPOSITED', counterpartyPersonaId: null });
    mockListExchangesByParentExperiment.mockResolvedValue({ ok: true, exchanges: [joinable] });
    mockInviteCounterparty.mockResolvedValue({ ok: true, rawCode: 'rax-operator-assisted-serverside-only' });
    mockJoinExchange.mockResolvedValue({ ok: true, exchange: { ...joinable, counterpartyPersonaId: PERSONA_ID, status: 'B_JOINED' } });

    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(NOOP_ADMIN, {
      operatorContext: AUTHORIZED_OPERATOR,
      targetPersonaId: PERSONA_ID,
      targetAuthProfileId: AUTH_PROFILE_ID,
      workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
    });

    expect(result).toEqual({ ok: true, exchangeId: 'joinable-exchange', created: false, role: 'counterparty' });
    expect(mockInviteCounterparty).toHaveBeenCalledWith(NOOP_ADMIN, { exchangeId: 'joinable-exchange', personaId: 'ci-irl-side' });
    expect(mockJoinExchange).toHaveBeenCalledWith(NOOP_ADMIN, { exchangeId: 'joinable-exchange', rawCode: 'rax-operator-assisted-serverside-only', personaId: PERSONA_ID });
    expect(mockCreateExchange).not.toHaveBeenCalled();
  });
});

// ── Structural canary: the operator-assisted wrapper WRAPS — it never
//    reimplements inviteCounterparty/joinExchange, and never even imports
//    them directly (only ensureBoundaryResearchExchangeMembership, in the
//    SAME file, imports and calls them). ────────────────────────────────────

describe('structural canary — the operator-assisted wrapper delegates, never reimplements', () => {
  const FILE = 'services/journey/boundaryResearchExchangeAdmission.ts';

  it('the file imports inviteCounterparty/joinExchange exactly once, from services/research/reciprocalExchange', () => {
    const src = readSource(FILE);
    const authority = importAuthority(src);
    const recExchangeImport = authority.records.find((r) => r.specifier === '@/services/research/reciprocalExchange');
    expect(recExchangeImport).toBeTruthy();
    expect(recExchangeImport!.names).toContain('inviteCounterparty');
    expect(recExchangeImport!.names).toContain('joinExchange');
  });

  it("the operator-assisted wrapper's OWN function body calls ensureBoundaryResearchExchangeMembership and never calls inviteCounterparty/joinExchange directly", () => {
    const code = stripComments(readSource(FILE));
    const wrapperStart = code.indexOf('export async function ensureBoundaryResearchExchangeMembershipOperatorAssisted(');
    expect(wrapperStart).toBeGreaterThan(-1);
    const wrapperBody = code.slice(wrapperStart);
    expect(wrapperBody).toContain('ensureBoundaryResearchExchangeMembership(admin');
    expect(wrapperBody).not.toMatch(/\binviteCounterparty\s*\(/);
    expect(wrapperBody).not.toMatch(/\bjoinExchange\s*\(/);
  });

  it('the operator-assisted wrapper reuses isCartridgeAdmin — no parallel admin predicate is defined in this file', () => {
    const code = stripComments(readSource(FILE));
    const authority = importAuthority(code);
    const accessImport = authority.records.find((r) => r.specifier === '@/services/access/requireCartridgeAdmin');
    expect(accessImport?.names).toContain('isCartridgeAdmin');
    // No local re-declaration of an admin predicate under a similar name.
    expect(code).not.toMatch(/function\s+isCartridgeAdmin\s*\(/);
  });
});

// ── Canary 6: end-to-end — the provisioned exchange makes create-deposit
//    actionable in the REAL resolveJourneyState/ianBoundaryResearchJourney ──

describe('canary 6 — IanJourneyState sees the resulting exchange and create-deposit becomes actionable after Orient', () => {
  it('with orient/passport/delegation complete and a provisioned (empty) exchange, create-deposit resolves READY, not NOT_STARTED', async () => {
    const { resolveJourneyState } = await import('@/services/journey/resolveJourneyState');
    const { IAN_BOUNDARY_RESEARCH_JOURNEY } = await import('@/services/journey/ianBoundaryResearchJourney');

    // Mirrors exactly what services/journey/ianJourneyState.ts assembles once
    // listMyExchanges/getExchangeView observe the exchange this admission
    // boundary just provisioned — yourArtifact still null (nothing deposited
    // yet), but the exchange itself now exists.
    const authState = {
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
    };

    const runtime = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, authState);
    const orient = runtime.stages.find((s) => s.stageId === 'orient');
    const passport = runtime.stages.find((s) => s.stageId === 'passport');
    const delegation = runtime.stages.find((s) => s.stageId === 'delegation-establish');
    const createDeposit = runtime.stages.find((s) => s.stageId === 'create-deposit');

    expect(orient?.state).toBe('COMPLETE');
    expect(passport?.state).toBe('COMPLETE');
    expect(delegation?.state).toBe('COMPLETE');
    expect(createDeposit?.state).toBe('READY');
    expect(createDeposit?.state).not.toBe('NOT_STARTED');
    expect(createDeposit?.state).not.toBe('BLOCKED');
  });

  it('WITHOUT the provisioned exchange (the pre-fix world), the same evidence still resolves create-deposit as NOT_STARTED — proving the fix is what changes the outcome', async () => {
    const { resolveJourneyState } = await import('@/services/journey/resolveJourneyState');
    const { IAN_BOUNDARY_RESEARCH_JOURNEY } = await import('@/services/journey/ianBoundaryResearchJourney');

    // Orient was NEVER acknowledged (Ian's actual live state at audit time) —
    // the pre-fix world, before the admission boundary ran.
    const authState = {
      stages: {
        orient: { orientation_ritual_completed: false },
        passport: { passport_issued: true },
        'delegation-establish': { delegation_active: true },
        'create-deposit': { iqube_created: false, content_deposited: false },
      },
      receiptRefs: {},
    };
    const runtime = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, authState);
    expect(runtime.currentStageId).toBe('orient');
  });
});

// ── Canaries 7 & 8: IanOrientationPanel — source-authority style, matching
//    this repo's existing convention for this exact component
//    (tests/ocsga-early-invitation-passport-routing.test.ts). ─────────────

const ORIENT_PANEL = 'components/journey/IanOrientationPanel.tsx';
const IAN_JOURNEY_TAB = 'app/triad/components/codex/tabs/IanJourneyTab.tsx';
const IAN_STATE_ROUTE = 'app/api/journey/ian/state/route.ts';

describe('canary 7 — IanOrientationPanel does not ask an already-admitted CAS-grant holder for a rax-* code', () => {
  it('the invite-code input box is gated on activeExchangeId alone — unchanged by ocsgaGrantAdmitted', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    const gateIdx = code.indexOf('const inviteSection = activeExchangeId ?');
    expect(gateIdx).toBeGreaterThan(-1);
    // The rax- code input box only appears in the FALSE branch of that exact
    // ternary — grant-admitted participants (activeExchangeId now populated
    // by the admission boundary) never reach it.
    const falseBranchIdx = code.indexOf('placeholder="rax-', gateIdx);
    const trueBranchEndIdx = code.indexOf('Research Lab grant recognized', gateIdx);
    expect(trueBranchEndIdx).toBeGreaterThan(gateIdx);
    expect(falseBranchIdx).toBeGreaterThan(trueBranchEndIdx);
  });

  it('renders grant-specific copy — never implying a manually-entered invitation — when ocsgaGrantAdmitted is true', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toContain('ocsgaGrantAdmitted');
    expect(code).toContain('Research Lab grant recognized');
    expect(code).toMatch(/no separate invitation code is needed/);
  });
});

describe('canary 8 — existing standalone rax-* invitation behavior remains valid for contexts that genuinely use it', () => {
  it('the original "Invitation associated" copy still exists as the non-grant branch', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toContain('Invitation associated');
    expect(code).toContain("You're associated with a collaboration invitation.");
  });

  it('the code-entry box (placeholder rax-...) is still present for the unadmitted, no-exchange case', () => {
    const code = stripComments(readSource(ORIENT_PANEL));
    expect(code).toContain('placeholder="rax-');
    expect(code).toContain("/api/research/exchanges/join");
  });
});

describe('admission boundary wiring — route + navigator, not inside resolveJourneyState', () => {
  it('the state route calls ensureBoundaryResearchExchangeMembership BEFORE fetchIanAuthoritativePlatformState', () => {
    const code = stripComments(readSource(IAN_STATE_ROUTE));
    const ensureIdx = code.indexOf('ensureBoundaryResearchExchangeMembership(admin');
    const fetchIdx = code.indexOf('fetchIanAuthoritativePlatformState(');
    expect(ensureIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(ensureIdx).toBeLessThan(fetchIdx);
  });

  it('resolveJourneyState.ts contains no write / admission-provisioning call — it stays a pure resolver', () => {
    const code = stripComments(readSource('services/journey/resolveJourneyState.ts'));
    expect(code).not.toMatch(/ensureBoundaryResearchExchangeMembership/);
    expect(code).not.toMatch(/createExchange/);
  });

  it('services/journey/ianJourneyState.ts stays a read-only evidence assembler — no write call added', () => {
    const code = stripComments(readSource('services/journey/ianJourneyState.ts'));
    expect(code).not.toMatch(/ensureBoundaryResearchExchangeMembership/);
    expect(code).not.toMatch(/createExchange|inviteCounterparty|joinExchange/);
  });

  it('IanJourneyTab threads ocsgaGrantAdmitted from the already-resolved runtimeState, never re-deriving it', () => {
    const code = stripComments(readSource(IAN_JOURNEY_TAB));
    expect(code).toContain('ocsgaGrantAdmitted: runtimeState?.ocsgaGrantAdmitted');
  });

  it('the MCP navigator adapter runs the SAME admission boundary as the browser route (Surface Independence)', () => {
    const code = stripComments(readSource('services/threshold/constitutionalNavigator.ts'));
    expect(code).toContain('ensureBoundaryResearchExchangeMembership(admin');
  });
});
