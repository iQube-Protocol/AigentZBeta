/**
 * OCSGA completion path — resolveExchangeActingPrincipal, unit level
 * (operator directive, 2026-08-30: "Ian must be able to exercise the
 * remaining principal-only Reciprocal Artifact Exchange acts through his
 * already-established Passport-backed principal, without switching
 * personas or re-proving holder status").
 *
 * THE DEFECT THIS CLOSES: `app/api/research/exchanges/[exchangeId]/actions/
 * route.ts` derived `actorType` from `resolveConstitutionalContext(req).
 * currentAigentMe` — a field that answers "does this persona have an
 * aigentMe ASSISTANT ASSIGNED to it", true for essentially every onboarded
 * principal, not "is the persona making this call itself an agent standing
 * in for its principal". Every principal with an assigned aigentMe (i.e.
 * every principal) was therefore refused `freeze`/`sign` as a "delegated
 * agent" regardless of who was actually acting.
 *
 * THE FIX: `resolveExchangeActingPrincipal` (services/research/
 * reciprocalExchange.ts) resolves personaId + actorType directly from the
 * exchange's own bound party — mirroring the sibling-lookup already proved
 * for orientation (`resolveOrientationPrincipalGate`,
 * services/journey/ianJourneyState.ts; see tests/ian-orientation-principal-
 * gate.test.ts) but scoped to ONE specific exchange. This closes the defect
 * for every principal (not merely for a persona that happens to be "wrong"),
 * and additionally lets a caller whose active session persona is their
 * aigentMe assistant still exercise their own already-bound principal
 * without switching.
 *
 * Route-level proof (personaId/actorType flow through to the canonical
 * primitives unmodified) lives in tests/ocsga-exchange-actions-route.test.ts
 * — kept in a SEPARATE file because that suite mocks the whole
 * reciprocalExchange module, which would shadow the real function this file
 * tests (vi.mock hoists file-wide).
 */
import { describe, it, expect, vi } from 'vitest';

// Merge-aware discovery (2026-08-30, "MCP navigator discovery" repair) —
// resolveExchangeActingPrincipal's sibling widening now goes through
// services/identity/passportPrincipal.ts's listOwnedPersonaIds, which unions
// in getMergedLinkedAuthProfileIds (services/wallet/multiEmailIdentity.ts) —
// a SEPARATE Supabase client (getDb()), not the fake `admin` passed into
// resolveExchangeActingPrincipal. Mocked here so the merge-scenario tests
// below can declare a real cross-auth-profile merge without needing a second
// fake DB implementation of crm_auth_profile_links.
vi.mock('@/services/wallet/multiEmailIdentity', () => ({
  getMergedLinkedAuthProfileIds: vi.fn(async (authProfileId: string) => {
    const MERGED = ['auth-profile-ian-google', 'auth-profile-ian-email'];
    return MERGED.includes(authProfileId) ? MERGED.filter((id) => id !== authProfileId) : [];
  }),
}));

type Row = Record<string, unknown>;

function makeFakeAdmin(tables: { personas: Row[]; reciprocal_exchanges: Row[] }) {
  function builder(table: 'personas' | 'reciprocal_exchanges') {
    const filters: Array<(r: Row) => boolean> = [];

    const api = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return api;
      },
      async maybeSingle() {
        const result = tables[table].filter((r) => filters.every((f) => f(r)));
        return { data: result[0] ?? null, error: null };
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown, reject: (e: unknown) => unknown) {
        const result = tables[table].filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      },
    };
    return api;
  }
  return { from: (table: string) => builder(table as 'personas' | 'reciprocal_exchanges') } as never;
}

const EXCHANGE_ID = 'exchange-ian-ocsga';
const AUTH_PROFILE = 'auth-profile-ian';
const IAN_PRINCIPAL = 'persona-ian-principal';
const IAN_AIGENTME = 'persona-ian-aigentme';
const SIBLING_NOT_BOUND = 'persona-ian-sibling-not-bound';
const PARTY_B = 'persona-party-b';

function baseTables(): { personas: Row[]; reciprocal_exchanges: Row[] } {
  return {
    personas: [
      { id: IAN_PRINCIPAL, auth_profile_id: AUTH_PROFILE, type: 'PersonaQube', status: 'active' },
      { id: IAN_AIGENTME, auth_profile_id: AUTH_PROFILE, type: 'AigentMe', status: 'active' },
      { id: SIBLING_NOT_BOUND, auth_profile_id: AUTH_PROFILE, type: 'PersonaQube', status: 'active' },
      { id: PARTY_B, auth_profile_id: 'auth-profile-other', type: 'PersonaQube', status: 'active' },
    ],
    reciprocal_exchanges: [
      {
        id: EXCHANGE_ID,
        initiator_persona_id: PARTY_B,
        counterparty_persona_id: IAN_PRINCIPAL,
        status: 'B_DEPOSITED',
        created_at: '2026-08-20T00:00:00Z',
      },
    ],
  };
}

describe('resolveExchangeActingPrincipal — unit level', () => {
  it("Ian's principal persona, already active and already the bound party → principal, unchanged personaId", async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: EXCHANGE_ID,
      activePersonaId: IAN_PRINCIPAL,
      authProfileId: AUTH_PROFILE,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personaId).toBe(IAN_PRINCIPAL);
      expect(result.actorType).toBe('principal');
    }
  });

  it("aigentMe is the active session persona (not itself a party) but Ian's sibling PRINCIPAL persona IS the bound party → resolves to Ian's principal, actorType 'principal' — aigentMe may remain the active assisting context", async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: EXCHANGE_ID,
      activePersonaId: IAN_AIGENTME,
      authProfileId: AUTH_PROFILE,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personaId).toBe(IAN_PRINCIPAL);
      expect(result.actorType).toBe('principal');
    }
  });

  it('a sibling persona under the same auth profile that is NOT itself the bound party still resolves to the auth profile\'s OWN bound sibling (Ian\'s principal) — any owned persona finds the exchange, never refused merely for being a different sibling than the one asked about', async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: EXCHANGE_ID,
      activePersonaId: SIBLING_NOT_BOUND,
      authProfileId: AUTH_PROFILE,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.personaId).toBe(IAN_PRINCIPAL);
  });

  it('a caller whose auth profile owns no persona bound to this exchange at all → not-a-party', async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: EXCHANGE_ID,
      activePersonaId: 'persona-unrelated',
      authProfileId: 'auth-profile-unrelated',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-a-party');
  });

  it('a nonexistent exchangeId → not-a-party, never throws', async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(baseTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: 'exchange-does-not-exist',
      activePersonaId: IAN_PRINCIPAL,
      authProfileId: AUTH_PROFILE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-a-party');
  });

  it('never derives actorType from whether the resolved persona has an aigentMe assistant assigned — reads no delegation-grant/assignment table at all (source canary)', () => {
    // resolveExchangeActingPrincipal must derive actorType SOLELY from the
    // resolved persona's own `personas.type` — never from whether it has an
    // aigentMe assigned (delegation_grants / agent_root_identity), which is
    // exactly the conflation the old resolveConstitutionalContext().
    // currentAigentMe check made.
    const fs = require('fs') as typeof import('fs');
    const src = fs.readFileSync(
      `${process.cwd()}/services/research/reciprocalExchange.ts`,
      'utf8',
    );
    const fnStart = src.indexOf('export async function resolveExchangeActingPrincipal');
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).not.toMatch(/delegation_grants|agent_root_identity|currentAigentMe/);
    expect(fnBody).toMatch(/personas\.type|'type'/);
  });
});

// ── MERGED auth-profile discovery (2026-08-30, "MCP navigator discovery" ──
// repair — the live defect reported on Ian's Claude MCP session).
//
// THE DEFECT THIS CLOSES: Ian's MCP OAuth crossing (app/api/threshold/oauth/
// complete/route.ts) binds session.principalPublicRef to whichever persona
// was ACTIVE in his browser at the moment he authorized the crossing — which
// may sit under a DIFFERENT (but multi-email-MERGED, crm_auth_profile_links)
// auth profile than the one his real bound Party B persona and orientation
// receipt live under. A raw same-auth_profile_id sibling query (the
// pre-2026-08-30 shape of this same lookup) never sees that sibling at all —
// exactly why Passport correctly read "usable" (loadUsableCitizenPassportFor
// AuthProfile already walked getMergedLinkedAuthProfileIds) while exchange
// discovery and orientation evidence both read "missing", for the exact same
// already-established holder.
const AUTH_PROFILE_GOOGLE = 'auth-profile-ian-google';
const AUTH_PROFILE_EMAIL = 'auth-profile-ian-email';
const IAN_GOOGLE_SESSION_PERSONA = 'persona-ian-google-session';
const IAN_EMAIL_BOUND_PRINCIPAL = 'persona-ian-email-bound-principal';
const MERGED_PARTY_A = 'persona-party-a-merged-case';
const MERGED_EXCHANGE_ID = 'exchange-ian-merged-profiles';

function mergedProfileTables(): { personas: Row[]; reciprocal_exchanges: Row[] } {
  return {
    personas: [
      // The MCP crossing's own resolved persona — a DIFFERENT auth profile
      // than the one Ian actually did his Reciprocal Artifact Exchange
      // onboarding under, but a real merged sibling of it.
      { id: IAN_GOOGLE_SESSION_PERSONA, auth_profile_id: AUTH_PROFILE_GOOGLE, type: 'PersonaQube', status: 'active' },
      // The genuine bound Party B principal, under his OTHER (merged) profile.
      { id: IAN_EMAIL_BOUND_PRINCIPAL, auth_profile_id: AUTH_PROFILE_EMAIL, type: 'PersonaQube', status: 'active' },
      { id: MERGED_PARTY_A, auth_profile_id: 'auth-profile-other-party', type: 'PersonaQube', status: 'active' },
    ],
    reciprocal_exchanges: [
      {
        id: MERGED_EXCHANGE_ID,
        initiator_persona_id: MERGED_PARTY_A,
        counterparty_persona_id: IAN_EMAIL_BOUND_PRINCIPAL,
        status: 'B_DEPOSITED',
        created_at: '2026-08-20T00:00:00Z',
      },
    ],
  };
}

describe('resolveExchangeActingPrincipal — MERGED auth-profile discovery (2026-08-30 live-reported defect)', () => {
  it("Ian's MCP session persona (a DIFFERENT, merge-linked auth profile) resolves to his real bound Party B principal — never refused merely because the session crossed under a different linked profile", async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(mergedProfileTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: MERGED_EXCHANGE_ID,
      activePersonaId: IAN_GOOGLE_SESSION_PERSONA,
      authProfileId: AUTH_PROFILE_GOOGLE,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personaId).toBe(IAN_EMAIL_BOUND_PRINCIPAL);
      expect(result.actorType).toBe('principal');
    }
  });

  it('an unrelated principal whose auth profile has no merge link at all still fails closed — not-a-party (merge-awareness never widens who counts, only whose siblings are searched)', async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(mergedProfileTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: MERGED_EXCHANGE_ID,
      activePersonaId: 'persona-genuinely-unrelated',
      authProfileId: 'auth-profile-genuinely-unrelated',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-a-party');
  });

  it('a null authProfileId (no owner resolved) still permits a DIRECT personaId match — merge/sibling widening is skipped, never the base membership check', async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(mergedProfileTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: MERGED_EXCHANGE_ID,
      activePersonaId: IAN_EMAIL_BOUND_PRINCIPAL,
      authProfileId: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.personaId).toBe(IAN_EMAIL_BOUND_PRINCIPAL);
  });

  it('a null authProfileId with a NON-matching activePersonaId fails closed rather than guessing a sibling', async () => {
    const { resolveExchangeActingPrincipal } = await import('@/services/research/reciprocalExchange');
    const admin = makeFakeAdmin(mergedProfileTables());
    const result = await resolveExchangeActingPrincipal(admin, {
      exchangeId: MERGED_EXCHANGE_ID,
      activePersonaId: IAN_GOOGLE_SESSION_PERSONA,
      authProfileId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-a-party');
  });
});
