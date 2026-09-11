/**
 * POST /api/research/exchanges/[exchangeId]/actions — route-level proof for
 * the OCSGA completion path fix (2026-08-30). See tests/ocsga-exchange-
 * principal-gate.test.ts for the unit-level proof of
 * resolveExchangeActingPrincipal itself and the full defect writeup; this
 * file is kept separate because it mocks the whole reciprocalExchange
 * module (vi.mock hoists file-wide, which would shadow the real function
 * the other file tests).
 *
 * Proves: personaId/actorType resolved by resolveExchangeActingPrincipal
 * flow through unmodified to declareFreeze/signInstrument/
 * confirmOperatorAssistedArtifact (never re-derived or re-guessed in the
 * route), a non-party caller is refused before any canonical primitive is
 * ever called, and the route no longer reads currentAigentMe at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const EXCHANGE_ID = 'exchange-ian-ocsga';
const AUTH_PROFILE = 'auth-profile-ian';
const IAN_PRINCIPAL = 'persona-ian-principal';
const IAN_AIGENTME = 'persona-ian-aigentme';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

// A minimal `.from().insert()` stub (2026-08-31 addition) — every OTHER
// reciprocalExchange.ts function this route calls is mocked out above, so
// `admin` was never actually invoked before the 'confirm' action started
// dispatching through the Constitutional Runtime, whose OWN evidence writer
// (services/ctp/evidence.ts) calls `admin.from(...)` directly and is NOT
// mocked (evidence persistence is exactly what's under test elsewhere —
// tests/ctp-constitutional-runtime.test.ts). This stub only needs to not
// throw; the write's outcome is irrelevant to every test in this file.
const fakeAdminForRoute = {
  from: () => ({ insert: async () => ({ error: null }) }),
} as never;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdminForRoute,
}));

const mockResolveExchangeActingPrincipal = vi.fn();
const mockInviteCounterparty = vi.fn();
const mockDepositArtifact = vi.fn();
const mockConfirmOperatorAssistedArtifact = vi.fn();
const mockDeclareFreeze = vi.fn();
const mockSignInstrument = vi.fn();
const mockAcknowledgeReceipt = vi.fn();
const mockWithdrawPreExchange = vi.fn();
const mockRevokeAccessPostExchange = vi.fn();
const mockOpenComparison = vi.fn();
const mockCreateDerivative = vi.fn();
const mockGetExchangeView = vi.fn();
// The three additional exports `ctp.exchange.artifact.confirm`
// (services/ctp/primitives/exchangeArtifactConfirm.ts) reads for its own
// prior-state resolution (2026-08-31, "CTP foundation") — the 'confirm'
// action now dispatches through constitutionalRuntime.execute, which calls
// this primitive, which calls these SAME reciprocalExchange.ts exports the
// module already uses elsewhere (never a second, independently-derived
// resolution). Defaulted in beforeEach to a state where confirm succeeds,
// mirroring mockConfirmOperatorAssistedArtifact's own default.
const mockLoadExchange = vi.fn();
const mockResolveMembership = vi.fn();
const mockCurrentArtifact = vi.fn();

vi.mock('@/services/research/reciprocalExchange', () => ({
  resolveExchangeActingPrincipal: (...args: unknown[]) => mockResolveExchangeActingPrincipal(...args),
  inviteCounterparty: (...args: unknown[]) => mockInviteCounterparty(...args),
  depositArtifact: (...args: unknown[]) => mockDepositArtifact(...args),
  confirmOperatorAssistedArtifact: (...args: unknown[]) => mockConfirmOperatorAssistedArtifact(...args),
  declareFreeze: (...args: unknown[]) => mockDeclareFreeze(...args),
  signInstrument: (...args: unknown[]) => mockSignInstrument(...args),
  acknowledgeReceipt: (...args: unknown[]) => mockAcknowledgeReceipt(...args),
  withdrawPreExchange: (...args: unknown[]) => mockWithdrawPreExchange(...args),
  revokeAccessPostExchange: (...args: unknown[]) => mockRevokeAccessPostExchange(...args),
  openComparison: (...args: unknown[]) => mockOpenComparison(...args),
  createDerivative: (...args: unknown[]) => mockCreateDerivative(...args),
  getExchangeView: (...args: unknown[]) => mockGetExchangeView(...args),
  loadExchange: (...args: unknown[]) => mockLoadExchange(...args),
  resolveMembership: (...args: unknown[]) => mockResolveMembership(...args),
  currentArtifact: (...args: unknown[]) => mockCurrentArtifact(...args),
}));

function makeActionRequest(action: string, extra: Record<string, unknown> = {}) {
  return new (require('next/server').NextRequest)(
    `https://dev-beta.aigentz.me/api/research/exchanges/${EXCHANGE_ID}/actions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    },
  );
}

const params = () => Promise.resolve({ exchangeId: EXCHANGE_ID });

beforeEach(() => {
  mockGetActivePersona.mockReset().mockResolvedValue({ personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
  mockResolveExchangeActingPrincipal.mockReset();
  mockDeclareFreeze.mockReset().mockResolvedValue({ ok: true, attestation: {} });
  mockSignInstrument.mockReset().mockResolvedValue({ ok: true, attestation: {}, exchange: {} });
  mockConfirmOperatorAssistedArtifact.mockReset().mockResolvedValue({ ok: true, artifact: {} });
  // ctp.exchange.artifact.confirm's own prior-state read — defaulted to a
  // confirmable artifact so the 'confirm' tests below reach
  // confirmOperatorAssistedArtifact exactly as they did before the CTP
  // dispatch existed.
  mockLoadExchange.mockReset().mockResolvedValue({ ok: true, exchange: { id: EXCHANGE_ID } });
  mockResolveMembership.mockReset().mockReturnValue('B');
  mockCurrentArtifact.mockReset().mockResolvedValue({ id: 'artifact-1', pendingPrincipalAttestation: true, version: 1 });
});

describe('POST /api/research/exchanges/[exchangeId]/actions — principal resolution, route level', () => {
  it("aigentMe is the active session persona, sibling resolution finds Ian's principal → freeze proceeds with actorType 'principal', not refused", async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: true, personaId: IAN_PRINCIPAL, actorType: 'principal' });
    const { POST } = await import('@/app/api/research/exchanges/[exchangeId]/actions/route');
    const res = await POST(makeActionRequest('freeze'), { params: params() });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockDeclareFreeze).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ exchangeId: EXCHANGE_ID, personaId: IAN_PRINCIPAL, actorType: 'principal' }),
    );
  });

  it("the SAME resolution lets sign proceed too — 'aigentMe may remain the active assisting agent/session context' (operator directive)", async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: true, personaId: IAN_PRINCIPAL, actorType: 'principal' });
    const { POST } = await import('@/app/api/research/exchanges/[exchangeId]/actions/route');
    const res = await POST(makeActionRequest('sign'), { params: params() });
    expect(res.status).toBe(200);
    expect(mockSignInstrument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ personaId: IAN_PRINCIPAL, actorType: 'principal' }),
    );
  });

  it('confirm dispatches with the resolved personaId and NO agentRef — a direct bridge POST is never "transmitted through" an agent', async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: true, personaId: IAN_PRINCIPAL, actorType: 'principal' });
    const { POST } = await import('@/app/api/research/exchanges/[exchangeId]/actions/route');
    const res = await POST(makeActionRequest('confirm'), { params: params() });
    expect(res.status).toBe(200);
    const call = mockConfirmOperatorAssistedArtifact.mock.calls[0][1] as Record<string, unknown>;
    expect(call.personaId).toBe(IAN_PRINCIPAL);
    expect(call.agentRef).toBeUndefined();
  });

  it('actorType delegated_agent still refuses freeze/sign — the ritual requires the resolved party to itself be principal-type', async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: true, personaId: 'persona-agent-bound', actorType: 'delegated_agent' });
    mockDeclareFreeze.mockResolvedValue({ ok: false, error: 'freeze-declaration-requires-principal' });
    const { POST } = await import('@/app/api/research/exchanges/[exchangeId]/actions/route');
    const res = await POST(makeActionRequest('freeze'), { params: params() });
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
  });

  it('a caller who owns no persona bound to this exchange → 403 not-a-party, and NO canonical primitive is ever called', async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: false, error: 'not-a-party' });
    const { POST } = await import('@/app/api/research/exchanges/[exchangeId]/actions/route');
    const res = await POST(makeActionRequest('sign'), { params: params() });
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe('not-a-party');
    expect(mockSignInstrument).not.toHaveBeenCalled();
    expect(mockDeclareFreeze).not.toHaveBeenCalled();
    expect(mockConfirmOperatorAssistedArtifact).not.toHaveBeenCalled();
  });

  it('unauthenticated → 401, resolveExchangeActingPrincipal never called', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const { POST } = await import('@/app/api/research/exchanges/[exchangeId]/actions/route');
    const res = await POST(makeActionRequest('freeze'), { params: params() });
    expect(res.status).toBe(401);
    expect(mockResolveExchangeActingPrincipal).not.toHaveBeenCalled();
  });

  it("the resolver is called with the exchangeId from the URL, the caller's ACTIVE personaId, and their authProfileId — never a client-supplied personaId", async () => {
    mockResolveExchangeActingPrincipal.mockResolvedValue({ ok: true, personaId: IAN_PRINCIPAL, actorType: 'principal' });
    const { POST } = await import('@/app/api/research/exchanges/[exchangeId]/actions/route');
    await POST(makeActionRequest('freeze', { personaId: 'attacker-supplied-persona' }), { params: params() });
    expect(mockResolveExchangeActingPrincipal).toHaveBeenCalledWith(
      expect.anything(),
      { exchangeId: EXCHANGE_ID, activePersonaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE },
    );
  });

  it('source canary: the route no longer imports resolveConstitutionalContext, and imports resolveExchangeActingPrincipal from the canonical service', () => {
    const fs = require('fs') as typeof import('fs');
    const src = fs.readFileSync(
      `${process.cwd()}/app/api/research/exchanges/[exchangeId]/actions/route.ts`,
      'utf8',
    );
    expect(src).not.toMatch(/import\s*\{[^}]*resolveConstitutionalContext/);
    expect(src).not.toMatch(/from ['"]@\/services\/identity\/constitutionalContext['"]/);
    expect(src).toMatch(/import\s*\{[^}]*resolveExchangeActingPrincipal[^}]*\}\s*from\s*['"]@\/services\/research\/reciprocalExchange['"]/);
  });
});
