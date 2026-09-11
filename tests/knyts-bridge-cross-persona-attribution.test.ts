/**
 * Cross-persona Reputation attribution — pre-push audit fix (2026-08-16).
 *
 * The pre-push constitutional audit found that `resolveCampaignContact()`
 * could hand Persona B the SAME `crm_personas` row already bound (via
 * `identity_persona_id`) to Persona A whenever B supplied the same email —
 * silently accruing B's Reputation onto A's record. `crmPersonaId` is the
 * Reputation-partition key consumed by
 * `services/campaign/knytsBridgeCampaignProjector.ts::createReputationEvent`,
 * so this is a direct Canon II violation ("Reputation accrues to the
 * persona"), not a cosmetic dedupe nuance.
 *
 * These canaries drive the REAL `resolveCampaignContact` against a fake
 * in-memory `crm_personas`/`nakamoto_knyt_personas` store (same pattern as
 * tests/dvn-local-receipts-reconciler.test.ts's `fakeSupabase()`) — never a
 * mock of the resolver itself — so the fix is exercised for real, not
 * merely asserted about.
 *
 * Deliberately out of scope (named, not fixed, here): person-grade Standing
 * unification across two personas of one person still does not exist — see
 * `services/crm/campaignContactResolver.ts`'s header comment and the
 * amended launch-readiness report.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface CrmPersonaRow {
  id: string;
  email: string | null;
  identity_persona_id: string | null;
  tenant_id?: string;
  persona_state?: string;
}

interface NakamotoRow {
  id: string;
  Email: string;
  'First-Name': string;
  'Last-Name': string;
  campaign_tags: string[];
}

let crmPersonas: CrmPersonaRow[];
let nakamotoPersonas: NakamotoRow[];
let nextId: number;

function freshId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

/** A minimal chainable query-builder emulator, generic over the backing array. */
function makeTable<T extends Record<string, unknown>>(rows: T[], onInsert?: (payload: Record<string, unknown>) => T) {
  return {
    select(_cols: string) {
      const eqFilters: Array<[string, unknown]> = [];
      const ilikeFilters: Array<[string, string]> = [];
      const builder = {
        eq(col: string, val: unknown) {
          eqFilters.push([col, val]);
          return builder;
        },
        ilike(col: string, val: string) {
          ilikeFilters.push([col, val]);
          return builder;
        },
        limit(_n: number) {
          return builder;
        },
        async maybeSingle() {
          const match =
            rows.find(
              (r) =>
                eqFilters.every(([c, v]) => (r as Record<string, unknown>)[c] === v) &&
                ilikeFilters.every(
                  ([c, v]) => String((r as Record<string, unknown>)[c] ?? '').toLowerCase() === v.toLowerCase(),
                ),
            ) ?? null;
          return { data: match, error: null };
        },
      };
      return builder;
    },
    update(patch: Record<string, unknown>) {
      return {
        eq(col: string, val: unknown) {
          const find = () => rows.find((r) => (r as Record<string, unknown>)[col] === val);
          return {
            // Awaited directly (no further chaining) — the 2-link update
            // path used by steps 3/4's identity_persona_id linking and the
            // investor tag append.
            then(resolve: (v: { data: null; error: null }) => void) {
              const row = find();
              if (row) Object.assign(row, patch);
              resolve({ data: null, error: null });
            },
            // The 3-link conditional path — step 2's "never overwrite an
            // existing linkage" guard.
            async is(col2: string, _nullVal: null) {
              const row = find();
              if (row && (row as Record<string, unknown>)[col2] == null) Object.assign(row, patch);
              return { data: null, error: null };
            },
          };
        },
      };
    },
    insert(payload: Record<string, unknown>) {
      return {
        select() {
          return {
            async single() {
              const row = onInsert ? onInsert(payload) : ((payload as unknown) as T);
              rows.push(row);
              return { data: row, error: null };
            },
          };
        },
      };
    },
  };
}

function fakeCrmClient() {
  return {
    from(table: string) {
      if (table === 'crm_personas') return makeTable(crmPersonas);
      if (table === 'nakamoto_knyt_personas') return makeTable(nakamotoPersonas);
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

vi.mock('@/services/crm/crmDataAccess', () => ({
  getCrmClient: () => fakeCrmClient(),
  createPersona: async (data: { tenantId: string; personaState?: string; email?: string; displayName?: string }) => {
    const row: CrmPersonaRow = {
      id: freshId('crm'),
      email: data.email ?? null,
      identity_persona_id: null,
      tenant_id: data.tenantId,
      persona_state: data.personaState,
    };
    crmPersonas.push(row);
    return row as unknown as { id: string };
  },
}));

import { resolveCampaignContact, normalizeEmail } from '@/services/crm/campaignContactResolver';

beforeEach(() => {
  crmPersonas = [];
  nakamotoPersonas = [];
  nextId = 1;
});

describe('normalizeEmail', () => {
  it('trims and lowercases (regression pin)', () => {
    expect(normalizeEmail('  Shared@Example.COM ')).toBe('shared@example.com');
  });
});

describe('Cross-persona Reputation guard — the audit-found defect, fixed', () => {
  const SHARED_EMAIL = 'shared@example.com';
  const PERSONA_A = 'persona-a';
  const PERSONA_B = 'persona-b';

  it("Persona A's first action creates and binds a crm_personas row to A", async () => {
    const a = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    expect(a.isNewProspect).toBe(true);
    const row = crmPersonas.find((r) => r.id === a.crmPersonaId);
    expect(row?.identity_persona_id).toBe(PERSONA_A);
  });

  it("Persona B supplying the SAME email as A does NOT receive A's crmPersonaId", async () => {
    const a = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    const b = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_B });
    expect(b.crmPersonaId).not.toBe(a.crmPersonaId);
  });

  it("B's own crm_personas row is bound to B, not to A — the Reputation partitions are genuinely distinct", async () => {
    const a = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    const b = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_B });
    const rowA = crmPersonas.find((r) => r.id === a.crmPersonaId);
    const rowB = crmPersonas.find((r) => r.id === b.crmPersonaId);
    expect(rowA?.identity_persona_id).toBe(PERSONA_A);
    expect(rowB?.identity_persona_id).toBe(PERSONA_B);
    // A's row is never mutated by B's action (no cross-contamination of the
    // existing binding).
    expect(rowA?.identity_persona_id).not.toBe(PERSONA_B);
  });

  it('A never loses her own row to a later B action (A queried again still resolves to her own crmPersonaId)', async () => {
    const a1 = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_B });
    const a2 = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    expect(a2.crmPersonaId).toBe(a1.crmPersonaId);
  });

  it('repeating the SAME persona + email resolves to the SAME row every time (idempotent identity, no drift or duplication)', async () => {
    const first = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    const second = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    const third = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    expect(second.crmPersonaId).toBe(first.crmPersonaId);
    expect(third.crmPersonaId).toBe(first.crmPersonaId);
    expect(crmPersonas.filter((r) => r.identity_persona_id === PERSONA_A)).toHaveLength(1);
  });

  it('exactly two crm_personas rows exist for two personas sharing one email — never one, never more', async () => {
    await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_B });
    await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_B });
    const rowsForEmail = crmPersonas.filter((r) => r.email === SHARED_EMAIL);
    expect(rowsForEmail).toHaveLength(2);
  });

  it('CRM/investor recognition is shared as context — an investor match tags the SAME nakamoto_knyt_personas row for both personas', async () => {
    nakamotoPersonas.push({
      id: 'investor-1',
      Email: SHARED_EMAIL,
      'First-Name': 'Known',
      'Last-Name': 'Investor',
      campaign_tags: [],
    });
    const a = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_A });
    const b = await resolveCampaignContact({ normalizedEmail: SHARED_EMAIL, activePersonaId: PERSONA_B });
    expect(a.investorKnown).toBe(true);
    expect(b.investorKnown).toBe(true);
    expect(a.nakamotoPersonaId).toBe('investor-1');
    expect(b.nakamotoPersonaId).toBe('investor-1');
    // One investor row, tagged once (deduped), regardless of how many
    // distinct personas discovered it via the same email.
    const investorRow = nakamotoPersonas.find((r) => r.id === 'investor-1');
    expect(investorRow?.campaign_tags).toEqual(
      expect.arrayContaining(['knyt_bridge_2026', 'kickstarter_prelaunch', 'prelaunch_registered']),
    );
    // Both personas still get their OWN, distinct crm_personas row.
    expect(a.crmPersonaId).not.toBe(b.crmPersonaId);
  });
});

describe('Preserved behavior — the four cases the fix must not disturb', () => {
  it('anonymous email-only prospect: no activePersonaId, resolves/creates by email alone', async () => {
    const first = await resolveCampaignContact({ normalizedEmail: 'anon@example.com', activePersonaId: null });
    expect(first.isNewProspect).toBe(true);
    const second = await resolveCampaignContact({ normalizedEmail: 'anon@example.com', activePersonaId: null });
    expect(second.crmPersonaId).toBe(first.crmPersonaId);
    expect(crmPersonas).toHaveLength(1);
  });

  it('an email match whose crm_personas row is UNBOUND gets linked to the acting persona (not treated as a cross-persona conflict)', async () => {
    const anon = await resolveCampaignContact({ normalizedEmail: 'unbound@example.com', activePersonaId: null });
    const row = crmPersonas.find((r) => r.id === anon.crmPersonaId);
    expect(row?.identity_persona_id).toBeNull();

    const signedIn = await resolveCampaignContact({ normalizedEmail: 'unbound@example.com', activePersonaId: 'persona-x' });
    expect(signedIn.crmPersonaId).toBe(anon.crmPersonaId);
    expect(row?.identity_persona_id).toBe('persona-x');
  });

  it('the SAME persona returning with the SAME email resolves to its own already-linked row (no re-creation)', async () => {
    const first = await resolveCampaignContact({ normalizedEmail: 'same@example.com', activePersonaId: 'persona-y' });
    const second = await resolveCampaignContact({ normalizedEmail: 'same@example.com', activePersonaId: 'persona-y' });
    expect(second.crmPersonaId).toBe(first.crmPersonaId);
    expect(crmPersonas).toHaveLength(1);
  });

  it('a known metaKnyt investor is recognized and tagged without creating a duplicate CRM identity on repeat submission', async () => {
    nakamotoPersonas.push({
      id: 'investor-2',
      Email: 'investor@example.com',
      'First-Name': 'Legacy',
      'Last-Name': 'Backer',
      campaign_tags: ['owns_13_prints'],
    });
    const first = await resolveCampaignContact({ normalizedEmail: 'investor@example.com', activePersonaId: 'persona-z' });
    expect(first.investorKnown).toBe(true);
    const second = await resolveCampaignContact({ normalizedEmail: 'investor@example.com', activePersonaId: 'persona-z' });
    expect(second.crmPersonaId).toBe(first.crmPersonaId);
    expect(crmPersonas).toHaveLength(1);
    const investorRow = nakamotoPersonas.find((r) => r.id === 'investor-2');
    // Pre-existing, unrelated investor tag is preserved (never overwritten).
    expect(investorRow?.campaign_tags).toContain('owns_13_prints');
  });
});
