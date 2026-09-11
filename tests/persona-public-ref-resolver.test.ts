/**
 * PERSONA-PUBLIC-REF-001 (operator-ratified 2026-08-24) — the admin-gated
 * reverse lookup from a persisted `personas.public_ref` (the durable Persona
 * Public Reference, `supabase/migrations/20260930030000_persona_public_ref_column.sql`)
 * back to the internal `personas.id`.
 *
 * Two things must hold: (1) `resolvePersonaIdByPublicRef` is a plain indexed
 * lookup that refuses to even query on malformed input (never a hash
 * reversal, never a probe surface), and (2) the HTTP route wrapping it is
 * admin-gated and returns ONLY `{ personaId }` — no other row fields, no
 * fallback to display_name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolvePersonaIdByPublicRef } from '@/services/identity/personaReferences';

const REAL_REF = '42492981a27fc918';
const REAL_PERSONA_ID = 'dbaf6fac-62f8-4603-9888-bd4f3395c2ca';

function fakeSupabase(rows: Record<string, { id: string } | undefined>) {
  return {
    from: (table: string) => {
      if (table !== 'personas') throw new Error(`unexpected table ${table}`);
      return {
        select: (_cols: string) => ({
          eq: (col: string, value: string) => ({
            maybeSingle: async () => {
              if (col !== 'public_ref') throw new Error(`unexpected column ${col}`);
              return { data: rows[value] ?? null, error: null };
            },
          }),
        }),
      };
    },
  } as any;
}

describe('resolvePersonaIdByPublicRef — plain indexed lookup, never a hash reversal', () => {
  it('resolves a real, persisted public_ref to its persona id', async () => {
    const admin = fakeSupabase({ [REAL_REF]: { id: REAL_PERSONA_ID } });
    await expect(resolvePersonaIdByPublicRef(admin, REAL_REF)).resolves.toBe(REAL_PERSONA_ID);
  });

  it('is case- and whitespace-insensitive on input, matching the lowercase-hex persisted form', async () => {
    const admin = fakeSupabase({ [REAL_REF]: { id: REAL_PERSONA_ID } });
    await expect(resolvePersonaIdByPublicRef(admin, ` ${REAL_REF.toUpperCase()} `)).resolves.toBe(REAL_PERSONA_ID);
  });

  it('returns null for an unknown ref rather than throwing', async () => {
    const admin = fakeSupabase({});
    await expect(resolvePersonaIdByPublicRef(admin, 'ffffffffffffffff')).resolves.toBeNull();
  });

  it('rejects malformed input WITHOUT querying — not 16 hex chars', async () => {
    const admin = fakeSupabase({});
    const fromSpy = vi.spyOn(admin, 'from');
    await expect(resolvePersonaIdByPublicRef(admin, 'not-a-ref')).resolves.toBeNull();
    await expect(resolvePersonaIdByPublicRef(admin, '1234')).resolves.toBeNull();
    await expect(resolvePersonaIdByPublicRef(admin, `${REAL_REF}garbage`)).resolves.toBeNull();
    // A malformed ref never even reaches the table — no probing the schema.
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('returns null (never throws or leaks the error) on a query error', async () => {
    const admin = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'boom' } }) }) }),
      }),
    } as any;
    await expect(resolvePersonaIdByPublicRef(admin, REAL_REF)).resolves.toBeNull();
  });
});

// ── Route test — mocks declared at module top level (vitest hoists vi.mock
// calls above imports regardless of file position, but this repo's own
// convention, e.g. reconcile-provider-standing-attribution-route.test.ts,
// keeps them top-level for clarity, so this file matches it). ─────────────

let routeRows: Record<string, { id: string } | undefined> = {};

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table !== 'personas') throw new Error(`unexpected table ${table}`);
      return {
        select: (_cols: string) => ({
          eq: (_col: string, value: string) => ({
            maybeSingle: async () => ({ data: routeRows[value] ?? null, error: null }),
          }),
        }),
      };
    },
  }),
}));

describe('GET /api/admin/persona/resolve-public-ref — admin-gated, id-only response', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeRows = { [REAL_REF]: { id: REAL_PERSONA_ID } };
  });

  async function callRoute(url: string) {
    const { GET } = await import('@/app/api/admin/persona/resolve-public-ref/route');
    const { NextRequest } = await import('next/server');
    return GET(new NextRequest(url));
  }

  it('refuses a non-admin caller with 403 before ever touching the database', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await callRoute(`https://x.test/api/admin/persona/resolve-public-ref?ref=${REAL_REF}`);
    expect(res.status).toBe(403);
  });

  it('rejects a malformed ref with 400', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: true } });
    const res = await callRoute('https://x.test/api/admin/persona/resolve-public-ref?ref=not-hex');
    expect(res.status).toBe(400);
  });

  it('returns 404 when no persona matches', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: true } });
    const res = await callRoute('https://x.test/api/admin/persona/resolve-public-ref?ref=ffffffffffffffff');
    expect(res.status).toBe(404);
  });

  it('returns ONLY { ok, personaId } for an admin caller with a real ref — no other row fields', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: true } });
    const res = await callRoute(`https://x.test/api/admin/persona/resolve-public-ref?ref=${REAL_REF}`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, personaId: REAL_PERSONA_ID });
  });
});
