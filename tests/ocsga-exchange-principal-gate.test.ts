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
import { describe, it, expect } from 'vitest';

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
      { id: IAN_PRINCIPAL, auth_profile_id: AUTH_PROFILE, type: 'PersonaQube' },
      { id: IAN_AIGENTME, auth_profile_id: AUTH_PROFILE, type: 'AigentMe' },
      { id: SIBLING_NOT_BOUND, auth_profile_id: AUTH_PROFILE, type: 'PersonaQube' },
      { id: PARTY_B, auth_profile_id: 'auth-profile-other', type: 'PersonaQube' },
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
