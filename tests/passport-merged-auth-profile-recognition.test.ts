/**
 * Presence/Passport recognition across MERGED auth profiles (2026-08-29,
 * OCSGA Presence evidence-resolution fix).
 *
 * ROOT CAUSE THIS CLOSES: `services/identity/getActivePersona.ts`'s OWN
 * persona enumeration (`listOwnedPersonas`) already widens across every auth
 * profile merged to the caller's own (`getMergedLinkedAuthProfileIds`,
 * `crm_auth_profile_links` with `relationship_mode: 'merged'`).
 * `services/identity/passportPrincipal.ts`'s `listOwnedPersonaIds` — the
 * shared scope `loadUsableCitizenPassportForAuthProfile` (and therefore the
 * Establish Presence stage's `citizenPassportUsable` evidence) depends on —
 * did NOT, and scoped to the single currently-resolved auth profile only. A
 * Citizen Passport issued to a persona under a MERGED sibling auth profile
 * therefore read as absent, even though `getActivePersona` already
 * recognizes that persona as owned by the SAME holder. This is a
 * projection/evidence-resolution defect, not a missing prerequisite: the
 * holder's Passport is real; the query scope was too narrow to find it.
 *
 * The fix reuses the SAME merge resolver `getActivePersona.ts` already calls
 * (inv.engineering.036/037) — never a second, independently derived notion
 * of "the holder's" auth profiles.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

function makeFakeAdmin(tables: { personas: Row[]; polity_passport_records: Row[] }) {
  function builder(table: 'personas' | 'polity_passport_records') {
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
      in(col: string, values: unknown[]) {
        filters.push((r) => values.includes(r[col]));
        return api;
      },
      order() {
        return api;
      },
      limit(n: number) {
        limitN = n;
        return api;
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown, reject: (e: unknown) => unknown) {
        let result = tables[table].filter((r) => filters.every((f) => f(r)));
        if (limitN !== null) result = result.slice(0, limitN);
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      },
    };
    return api;
  }
  return { from: (table: string) => builder(table as 'personas' | 'polity_passport_records') } as never;
}

const AUTH_PROFILE_ACTIVE = 'auth-profile-ian-active-session';
const AUTH_PROFILE_LINKED = 'auth-profile-ian-linked-legacy';
const AUTH_PROFILE_UNRELATED = 'auth-profile-someone-else';
const IAN_PRINCIPAL_ON_LINKED_PROFILE = 'persona-ian-principal-under-linked-profile';
const PERSONA_UNDER_ACTIVE_PROFILE = 'persona-ian-aigentme-under-active-profile';

const mockGetMergedLinkedAuthProfileIds = vi.fn(async (_authProfileId: string) => [] as string[]);
vi.mock('@/services/wallet/multiEmailIdentity', () => ({
  getMergedLinkedAuthProfileIds: (authProfileId: string) => mockGetMergedLinkedAuthProfileIds(authProfileId),
}));

beforeEach(() => {
  mockGetMergedLinkedAuthProfileIds.mockReset().mockResolvedValue([]);
});

describe('listOwnedPersonaIds — widens across merged auth profiles', () => {
  it('with no merge link, scope stays exactly the active auth profile (unchanged behavior)', async () => {
    const { listOwnedPersonaIds } = await import('@/services/identity/passportPrincipal');
    const admin = makeFakeAdmin({
      personas: [
        { id: PERSONA_UNDER_ACTIVE_PROFILE, auth_profile_id: AUTH_PROFILE_ACTIVE, status: 'active' },
        { id: IAN_PRINCIPAL_ON_LINKED_PROFILE, auth_profile_id: AUTH_PROFILE_LINKED, status: 'active' },
      ],
      polity_passport_records: [],
    });
    const result = await listOwnedPersonaIds(admin, AUTH_PROFILE_ACTIVE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personaIds).toEqual([PERSONA_UNDER_ACTIVE_PROFILE]);
      expect(result.personaIds).not.toContain(IAN_PRINCIPAL_ON_LINKED_PROFILE);
    }
  });

  it('with a merged link, scope widens to include the linked auth profile\'s personas too', async () => {
    mockGetMergedLinkedAuthProfileIds.mockResolvedValue([AUTH_PROFILE_LINKED]);
    const { listOwnedPersonaIds } = await import('@/services/identity/passportPrincipal');
    const admin = makeFakeAdmin({
      personas: [
        { id: PERSONA_UNDER_ACTIVE_PROFILE, auth_profile_id: AUTH_PROFILE_ACTIVE, status: 'active' },
        { id: IAN_PRINCIPAL_ON_LINKED_PROFILE, auth_profile_id: AUTH_PROFILE_LINKED, status: 'active' },
        { id: 'persona-unrelated', auth_profile_id: AUTH_PROFILE_UNRELATED, status: 'active' },
      ],
      polity_passport_records: [],
    });
    const result = await listOwnedPersonaIds(admin, AUTH_PROFILE_ACTIVE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personaIds.sort()).toEqual(
        [PERSONA_UNDER_ACTIVE_PROFILE, IAN_PRINCIPAL_ON_LINKED_PROFILE].sort(),
      );
      expect(result.personaIds).not.toContain('persona-unrelated');
    }
  });

  it('a merge-lookup failure fails OPEN to single-profile scope, never a hard error', async () => {
    mockGetMergedLinkedAuthProfileIds.mockRejectedValue(new Error('merge table unavailable'));
    const { listOwnedPersonaIds } = await import('@/services/identity/passportPrincipal');
    const admin = makeFakeAdmin({
      personas: [{ id: PERSONA_UNDER_ACTIVE_PROFILE, auth_profile_id: AUTH_PROFILE_ACTIVE, status: 'active' }],
      polity_passport_records: [],
    });
    const result = await listOwnedPersonaIds(admin, AUTH_PROFILE_ACTIVE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.personaIds).toEqual([PERSONA_UNDER_ACTIVE_PROFILE]);
  });
});

describe('loadUsableCitizenPassportForAuthProfile — recognizes a Passport issued under a merged sibling auth profile', () => {
  it('Presence recognizes an ALREADY-established Citizen Passport held under a merged auth profile — no new Passport, no receipt, the existing fact is simply found', async () => {
    mockGetMergedLinkedAuthProfileIds.mockResolvedValue([AUTH_PROFILE_LINKED]);
    const { loadUsableCitizenPassportForAuthProfile, isPassportUsable } = await import(
      '@/services/identity/passportPrincipal'
    );
    const admin = makeFakeAdmin({
      personas: [
        { id: PERSONA_UNDER_ACTIVE_PROFILE, auth_profile_id: AUTH_PROFILE_ACTIVE, status: 'active' },
        { id: IAN_PRINCIPAL_ON_LINKED_PROFILE, auth_profile_id: AUTH_PROFILE_LINKED, status: 'active' },
      ],
      polity_passport_records: [
        {
          persona_id: IAN_PRINCIPAL_ON_LINKED_PROFILE,
          passport_class: 'citizen',
          citizen_status: 'active',
          participant_status: null,
          passport_grade: null,
          revoked: false,
          expires_at: null,
          persona_public_ref: 'ref-abc123',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const result = await loadUsableCitizenPassportForAuthProfile(admin, AUTH_PROFILE_ACTIVE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isPassportUsable(result.passport)).toBe(true);
      expect(result.passport.passportClass).toBe('citizen');
    }
  });

  it('without the merge (baseline), the SAME Passport under the linked profile reads as absent — proving the fix, not a tautology', async () => {
    mockGetMergedLinkedAuthProfileIds.mockResolvedValue([]); // no merge recognized
    const { loadUsableCitizenPassportForAuthProfile } = await import('@/services/identity/passportPrincipal');
    const admin = makeFakeAdmin({
      personas: [
        { id: PERSONA_UNDER_ACTIVE_PROFILE, auth_profile_id: AUTH_PROFILE_ACTIVE, status: 'active' },
        { id: IAN_PRINCIPAL_ON_LINKED_PROFILE, auth_profile_id: AUTH_PROFILE_LINKED, status: 'active' },
      ],
      polity_passport_records: [
        {
          persona_id: IAN_PRINCIPAL_ON_LINKED_PROFILE,
          passport_class: 'citizen',
          citizen_status: 'active',
          participant_status: null,
          passport_grade: null,
          revoked: false,
          expires_at: null,
          persona_public_ref: 'ref-abc123',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const result = await loadUsableCitizenPassportForAuthProfile(admin, AUTH_PROFILE_ACTIVE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_passport');
  });

  it('never recognizes a Passport under a genuinely unrelated (non-merged) auth profile', async () => {
    mockGetMergedLinkedAuthProfileIds.mockResolvedValue([AUTH_PROFILE_LINKED]); // merged to LINKED only, not UNRELATED
    const { loadUsableCitizenPassportForAuthProfile } = await import('@/services/identity/passportPrincipal');
    const admin = makeFakeAdmin({
      personas: [
        { id: PERSONA_UNDER_ACTIVE_PROFILE, auth_profile_id: AUTH_PROFILE_ACTIVE, status: 'active' },
        { id: IAN_PRINCIPAL_ON_LINKED_PROFILE, auth_profile_id: AUTH_PROFILE_LINKED, status: 'active' },
        { id: 'persona-unrelated', auth_profile_id: AUTH_PROFILE_UNRELATED, status: 'active' },
      ],
      polity_passport_records: [
        {
          persona_id: 'persona-unrelated',
          passport_class: 'citizen',
          citizen_status: 'active',
          participant_status: null,
          passport_grade: null,
          revoked: false,
          expires_at: null,
          persona_public_ref: 'ref-unrelated',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const result = await loadUsableCitizenPassportForAuthProfile(admin, AUTH_PROFILE_ACTIVE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_passport');
  });
});
