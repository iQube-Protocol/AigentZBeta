/**
 * Principal-identity enforcement for Ian's orientation acknowledgment
 * (2026-08-29 — "harden principal-only orientation before asking Ian to
 * acknowledge"). Reproduces the exact live defect and proves the fix:
 *
 *   app/api/journey/ian/orient/acknowledge/route.ts used to write
 *   `orientation_ritual_completed` under whichever persona getActivePersona()
 *   returned, with no check that this persona could constitutionally be a
 *   principal. Live inspection found Ian's real receipt attributed to his
 *   own bound aigentMe agent persona (personas.type='AigentMe'), not his
 *   human "Ian Andrew McCoy" persona (personas.type='PersonaQube').
 *
 * Two layers of proof:
 *   1. UNIT — services/journey/ianJourneyState.ts's
 *      resolveOrientationPrincipalGate, driven directly against a small fake
 *      Supabase client (personas + reciprocal_exchanges tables only).
 *   2. ROUTE — the real acknowledge route POST handler, proving a refusal
 *      writes NO receipt (createActivityReceipt is never called), and a
 *      genuine principal's acknowledgment still writes exactly one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── A tiny fake Supabase client — exactly the four query shapes
//     resolveOrientationPrincipalGate issues, nothing more. ─────────────────

type Row = Record<string, unknown>;

function makeFakeAdmin(tables: { personas: Row[]; reciprocal_exchanges: Row[] }) {
  function builder(table: 'personas' | 'reciprocal_exchanges') {
    const filters: Array<(r: Row) => boolean> = [];
    let limitN: number | null = null;

    const api = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return api;
      },
      or(expr: string) {
        // e.g. "initiator_persona_id.in.(a,b),counterparty_persona_id.in.(a,b)"
        const clauses = expr.match(/[^,]+\.in\.\([^)]*\)/g) ?? [];
        const preds = clauses.map((clause) => {
          const m = clause.match(/^(\w+)\.in\.\(([^)]*)\)$/);
          if (!m) return () => false;
          const [, col, list] = m;
          const values = list.split(',').filter(Boolean);
          return (r: Row) => values.includes(String(r[col]));
        });
        filters.push((r) => preds.some((p) => p(r)));
        return api;
      },
      order() {
        return api;
      },
      limit(n: number) {
        limitN = n;
        return api;
      },
      async maybeSingle() {
        const result = tables[table].filter((r) => filters.every((f) => f(r)));
        return { data: result[0] ?? null, error: null };
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown, reject: (e: unknown) => unknown) {
        let result = tables[table].filter((r) => filters.every((f) => f(r)));
        if (limitN !== null) result = result.slice(0, limitN);
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      },
    };
    return api;
  }
  return { from: (table: string) => builder(table as 'personas' | 'reciprocal_exchanges') } as never;
}

const AUTH_PROFILE = 'auth-profile-ian';
const IAN_PRINCIPAL = 'persona-ian-principal';
const IAN_AIGENTME = 'persona-ian-aigentme';
const SIBLING_PERSONAQUBE_NOT_BOUND = 'persona-ian-sibling-personaqube';
const OTHER_AUTH_PROFILE = 'auth-profile-other';
const UNRELATED_AGENT_TYPE_PERSONA = 'persona-unrelated-agent-type';

function baseTables(): { personas: Row[]; reciprocal_exchanges: Row[] } {
  return {
    personas: [
      { id: IAN_PRINCIPAL, auth_profile_id: AUTH_PROFILE, type: 'PersonaQube', display_name: 'Ian Andrew McCoy' },
      { id: IAN_AIGENTME, auth_profile_id: AUTH_PROFILE, type: 'AigentMe', display_name: 'aigentMe' },
      { id: SIBLING_PERSONAQUBE_NOT_BOUND, auth_profile_id: AUTH_PROFILE, type: 'PersonaQube', display_name: 'Ian (second persona)' },
      { id: UNRELATED_AGENT_TYPE_PERSONA, auth_profile_id: OTHER_AUTH_PROFILE, type: 'AgentDelegate', display_name: 'Some Delegate' },
    ],
    reciprocal_exchanges: [
      { initiator_persona_id: 'persona-party-a', counterparty_persona_id: IAN_PRINCIPAL, created_at: '2026-08-24' },
    ],
  };
}

describe('resolveOrientationPrincipalGate — unit level', () => {
  it('Ian principal (bound exchange party, PersonaQube type) — permitted', async () => {
    const { resolveOrientationPrincipalGate } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationPrincipalGate(admin, { personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    expect(result.ok).toBe(true);
  });

  it("Ian's aigentMe persona (AigentMe type, sibling to the bound exchange party) — refused as wrong-principal, names Ian", async () => {
    const { resolveOrientationPrincipalGate } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationPrincipalGate(admin, { personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('wrong-principal');
      if (result.reason === 'wrong-principal') {
        expect(result.expectedPersonaId).toBe(IAN_PRINCIPAL);
        expect(result.expectedDisplayName).toBe('Ian Andrew McCoy');
      }
    }
  });

  it('a sibling PersonaQube persona under the SAME auth profile that is NOT the bound exchange party — refused as wrong-principal (unrelated persona, case 1)', async () => {
    const { resolveOrientationPrincipalGate } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationPrincipalGate(admin, {
      personaId: SIBLING_PERSONAQUBE_NOT_BOUND,
      authProfileId: AUTH_PROFILE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-principal');
  });

  it('an agent-type persona under a completely unrelated auth profile with no exchange bound at all — refused as not-principal-type (unrelated persona, case 2)', async () => {
    const { resolveOrientationPrincipalGate } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationPrincipalGate(admin, {
      personaId: UNRELATED_AGENT_TYPE_PERSONA,
      authProfileId: OTHER_AUTH_PROFILE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-principal-type');
  });

  it('a fresh PersonaQube persona with no exchange bound anywhere yet is permitted — orientation is not retroactively blocked for a genuine new participant', async () => {
    const { resolveOrientationPrincipalGate } = await import('@/services/journey/ianJourneyState');
    const tables = baseTables();
    tables.personas.push({ id: 'persona-fresh-visitor', auth_profile_id: 'auth-profile-fresh', type: 'PersonaQube', display_name: 'Fresh Visitor' });
    const admin = makeFakeAdmin(tables);
    const result = await resolveOrientationPrincipalGate(admin, {
      personaId: 'persona-fresh-visitor',
      authProfileId: 'auth-profile-fresh',
    });
    expect(result.ok).toBe(true);
  });
});

// ─── Route-level: proves a refusal writes NO receipt, and a genuine
//     principal's acknowledgment still writes exactly one. ────────────────

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

let fakeAdminForRoute: ReturnType<typeof makeFakeAdmin> | null = null;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeAdminForRoute,
}));

const mockCreateActivityReceipt = vi.fn(async (input: Record<string, unknown>) => ({ id: 'receipt-1', ...input }));
const mockListActivityReceiptsForPersona = vi.fn(async () => [] as unknown[]);
const mockListActivityReceiptsForPersonas = vi.fn(async () => [] as unknown[]);
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
  listActivityReceiptsForPersona: (...args: unknown[]) => mockListActivityReceiptsForPersona(...args),
  listActivityReceiptsForPersonas: (...args: unknown[]) => mockListActivityReceiptsForPersonas(...args),
}));

function makeRequest() {
  return new (require('next/server').NextRequest)('https://dev-beta.aigentz.me/api/journey/ian/orient/acknowledge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockCreateActivityReceipt.mockClear();
  mockListActivityReceiptsForPersona.mockReset().mockResolvedValue([]);
  mockListActivityReceiptsForPersonas.mockReset().mockResolvedValue([]);
  fakeAdminForRoute = makeFakeAdmin(baseTables());
});

describe('POST /api/journey/ian/orient/acknowledge — principal-identity enforcement, route level', () => {
  it('Ian principal → 200, receipt written exactly once, under his own personaId, no manufactured agentsInvoked', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, orientationComplete: true });
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0] as Record<string, unknown>;
    expect(receiptInput.personaId).toBe(IAN_PRINCIPAL);
    expect(receiptInput.actionType).toBe('orientation_ritual_completed');
    expect(receiptInput.agentsInvoked).toEqual([]);
  });

  it("Ian's aigentMe persona → 403 principal-required naming Ian, and writes NO receipt", async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error).toBe('principal-required');
    expect(json.reason).toBe('wrong-principal');
    expect(json.message).toMatch(/Ian Andrew McCoy/);
    expect(json.message).toMatch(/personally/);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('an unrelated persona (sibling PersonaQube, not the bound party) → 403, writes NO receipt', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: SIBLING_PERSONAQUBE_NOT_BOUND, authProfileId: AUTH_PROFILE });
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('an unrelated agent-type persona under a different auth profile with nothing bound → 403 not-principal-type, writes NO receipt', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: UNRELATED_AGENT_TYPE_PERSONA, authProfileId: OTHER_AUTH_PROFILE });
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.reason).toBe('not-principal-type');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('unauthenticated → 401, writes NO receipt', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('fails CLOSED (503), not open, when the principal cannot be verified at all (no database client) — writes NO receipt', async () => {
    fakeAdminForRoute = null;
    mockGetActivePersona.mockResolvedValue({ personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('is idempotent for the genuine principal: a second acknowledgment does not write a second receipt', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    mockListActivityReceiptsForPersona.mockResolvedValue([{ id: 'already-there' }]);
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });
});

// ─── resolveOrientationEvidence — the READ-side half of the 2026-08-29 fix.
//     Proves a bare persona-scoped receipt can no longer shadow Orient
//     COMPLETE unless its OWNING persona passes the exact same canonical
//     gate the write route enforces (2026-08-29, "smallest constitutionally
//     correct repair to the Orientation read path"). ───────────────────────

function receiptEntry(id: string, personaId: string, createdAt = '2026-08-20T00:00:00Z') {
  return {
    record: {
      id,
      sessionId: null,
      intentId: null,
      activeCartridge: 'irl-cartridge',
      actionType: 'orientation_ritual_completed' as const,
      summary: '',
      agentsInvoked: [],
      toolsUsed: [],
      iqubesUsed: [],
      invariantsUsed: [],
      contextShared: [],
      artifactsCreated: [],
      approvalsGranted: [],
      policyEnvelopeId: null,
      receiptStatus: 'local' as const,
      dvnReceiptId: null,
      commitmentHash: null,
      posStatus: null,
      dvnStatus: null,
      btcAnchorTxid: null,
      btcBatchRoot: null,
      specialistResponse: null,
      actionConnectorId: null,
      actionConnectorLabel: null,
      actionInput: null,
      createdAt,
    },
    personaId,
  };
}

describe('resolveOrientationEvidence — principal-aware Orientation read path', () => {
  it('an orientation receipt owned by the exchange-bound principal → Orientation COMPLETE, regardless of which sibling persona is currently active', async () => {
    mockListActivityReceiptsForPersonas.mockResolvedValue([receiptEntry('receipt-principal-1', IAN_PRINCIPAL)]);
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    // Active persona is Ian's aigentMe agent — the exact live shape of the
    // defect (browser's currentPersonaId still points at aigentMe).
    const result = await resolveOrientationEvidence(admin, { personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
    expect(result.complete).toBe(true);
    expect(result.receiptId).toBe('receipt-principal-1');
  });

  it("a receipt owned only by Ian's aigentMe persona (same auth profile, exchange bound to Ian's principal) → NOT COMPLETE", async () => {
    mockListActivityReceiptsForPersonas.mockResolvedValue([receiptEntry('receipt-aigentme-1', IAN_AIGENTME)]);
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationEvidence(admin, { personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
    expect(result.complete).toBe(false);
    expect(result.receiptId).toBeNull();
  });

  it('a receipt owned by an unrelated sibling persona (same auth profile, not the bound exchange party) → NOT COMPLETE', async () => {
    mockListActivityReceiptsForPersonas.mockResolvedValue([
      receiptEntry('receipt-sibling-1', SIBLING_PERSONAQUBE_NOT_BOUND),
    ]);
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationEvidence(admin, {
      personaId: SIBLING_PERSONAQUBE_NOT_BOUND,
      authProfileId: AUTH_PROFILE,
    });
    expect(result.complete).toBe(false);
    expect(result.receiptId).toBeNull();
  });

  it('no orientation receipt for any sibling persona → NOT COMPLETE', async () => {
    mockListActivityReceiptsForPersonas.mockResolvedValue([]);
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationEvidence(admin, { personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    expect(result.complete).toBe(false);
    expect(result.receiptId).toBeNull();
  });

  it('the malformed historical aigentMe receipt is read (evaluated) but never mutated — no create/update/delete call of any kind', async () => {
    mockListActivityReceiptsForPersonas.mockResolvedValue([receiptEntry('receipt-aigentme-historical', IAN_AIGENTME)]);
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationEvidence(admin, { personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
    expect(result.complete).toBe(false);
    // The receipt itself is untouched: resolveOrientationEvidence has no
    // write path at all — it never calls createActivityReceipt, and the
    // historical row is simply excluded from evidence, never deleted,
    // rewritten, reassigned, or superseded.
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('read and write resolve principal eligibility consistently: a write the route refuses produces no evidence the read path accepts, and a write the route permits is read back COMPLETE', async () => {
    const { POST } = await import('@/app/api/journey/ian/orient/acknowledge/route');
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');

    // 1. aigentMe attempts to acknowledge — the write gate refuses, no
    //    receipt is written.
    mockGetActivePersona.mockResolvedValue({ personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
    const refused = await POST(makeRequest());
    expect(refused.status).toBe(403);
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();

    // Read path sees no receipts at all (nothing was written) — honestly
    // incomplete, exactly matching the write path's refusal.
    mockListActivityReceiptsForPersonas.mockResolvedValue([]);
    const admin = makeFakeAdmin(baseTables());
    const afterRefusal = await resolveOrientationEvidence(admin, { personaId: IAN_AIGENTME, authProfileId: AUTH_PROFILE });
    expect(afterRefusal.complete).toBe(false);

    // 2. Ian's principal persona acknowledges — the write gate permits it,
    //    writing exactly one receipt under his own personaId.
    mockGetActivePersona.mockResolvedValue({ personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    const permitted = await POST(makeRequest());
    expect(permitted.status).toBe(200);
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
    const written = mockCreateActivityReceipt.mock.calls[0][0] as Record<string, unknown>;
    expect(written.personaId).toBe(IAN_PRINCIPAL);

    // Read path now sees exactly that receipt and resolves COMPLETE.
    mockListActivityReceiptsForPersonas.mockResolvedValue([receiptEntry('receipt-1', IAN_PRINCIPAL)]);
    const afterAcknowledge = await resolveOrientationEvidence(admin, { personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    expect(afterAcknowledge.complete).toBe(true);
    expect(afterAcknowledge.receiptId).toBe('receipt-1');
  });

  it('fails closed (incomplete, never trusted) with no database client available', async () => {
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');
    const result = await resolveOrientationEvidence(null, { personaId: IAN_PRINCIPAL, authProfileId: AUTH_PROFILE });
    expect(result.complete).toBe(false);
    expect(result.receiptId).toBeNull();
  });

  it('fails closed (incomplete) when authProfileId is not yet resolved', async () => {
    const { resolveOrientationEvidence } = await import('@/services/journey/ianJourneyState');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveOrientationEvidence(admin, { personaId: IAN_PRINCIPAL, authProfileId: null });
    expect(result.complete).toBe(false);
    expect(result.receiptId).toBeNull();
  });
});
