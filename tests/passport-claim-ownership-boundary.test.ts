/**
 * T0/T1 ruling behavioral proof (2026-09-07, ratified after two corrections
 * in the same tranche): passport_id is holder-visible, privacy-sensitive
 * credential metadata — never authentication or authority on its own. Every
 * API that accepts a passportId parameter MUST independently authenticate
 * the caller and check ownership/authority server-side; mere possession of
 * a real, valid passport_id must never be sufficient to act on it.
 *
 * This file proves that behaviorally against the two mutating routes that
 * accept passportId in their request (claim + World-ID verify), and proves
 * the two positive/negative shape assertions the ruling also requires:
 * the owner-scoped wallet route DOES carry passportId (holder-visible),
 * the PUBLIC registry projection does NOT (never a public correlation
 * handle). See codexes/packs/agentiq/resolution-records/records/
 * RES-2026-09-07-DIDQUBE-PHASE-3-PASSPORT-ID-PRIVACY-CLASSIFICATION-001.json.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

vi.mock('@/utils/publicOrigin', () => ({
  publicOrigin: () => 'https://dev-beta.aigentz.me',
}));

const mockGetCallerIdentityContext = vi.fn();
vi.mock('@/services/wallet/personaRepo', () => ({
  getCallerIdentityContext: (req: unknown) => mockGetCallerIdentityContext(req),
}));

const mockListOwnedPersonaIds = vi.fn();
vi.mock('@/services/identity/passportPrincipal', () => ({
  listOwnedPersonaIds: (...args: unknown[]) => mockListOwnedPersonaIds(...args),
}));

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
}));

import { POST as claimPOST } from '@/app/api/polity-passport/credential/[passportId]/route';
import { POST as verifyWorldIdPOST } from '@/app/api/polity-passport/verify-worldid/route';
import { GET as walletGET } from '@/app/api/polity-passport/wallet/route';
import { GET as registryGET } from '@/app/api/polity-passport/registry/route';

function makeRequest(body: unknown = {}): NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    nextUrl: { origin: 'https://dev-beta.aigentz.me' },
    url: 'https://dev-beta.aigentz.me/api/test',
  } as unknown as NextRequest;
}

/**
 * A single-record admin: .select(...).eq(...).maybeSingle() resolves to
 * `row`; .update(...).eq(...) (the claim/verify write-back) is a no-op that
 * resolves cleanly, since these tests only assert on the auth/ownership gate
 * and the response the route builds from the already-loaded record.
 */
function makeSingleRecordAdmin(row: Record<string, unknown> | null) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    update: () => chain,
    is: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  (chain as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) =>
    resolve({ data: null, error: null });
  return { from: () => chain };
}

/** A list-query admin: awaiting the built chain resolves to `{data: rows}`. */
function makeListAdmin(rowsByTable: Record<string, unknown[]>) {
  function chainFor(table: string) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
    };
    (chain as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) =>
      resolve({ data: rowsByTable[table] ?? [], error: null });
    return chain;
  }
  return { from: (table: string) => chainFor(table) };
}

const OWNER_PERSONA_ID = 'persona-owner-0001';
const ATTACKER_PERSONA_ID = 'persona-attacker-0002';
const REAL_PASSPORT_ID = 'ppp-real-0001-0001-0001';

function citizenRecord(overrides: Record<string, unknown> = {}) {
  return {
    passport_id: REAL_PASSPORT_ID,
    passport_class: 'citizen',
    citizen_status: 'active',
    participant_status: null,
    passport_grade: 'citizen',
    kybe_did_public_ref: 'kybe-commit-abc',
    root_did_public_ref: null,
    persona_public_ref: 'persona-commit-abc',
    registry_record_id: 'reg-1',
    issuer_id: 'polity-passport-bureau',
    issued_at: '2026-01-01T00:00:00Z',
    expires_at: '2027-01-01T00:00:00Z',
    revoked: false,
    credential_claimed_at: null,
    persona_id: OWNER_PERSONA_ID,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetSupabaseServer.mockReset();
  mockGetCallerIdentityContext.mockReset();
  mockListOwnedPersonaIds.mockReset();
  mockCreateActivityReceipt.mockReset();
  mockCreateActivityReceipt.mockResolvedValue({ id: 'receipt-1' });
});

describe('POST /api/polity-passport/credential/[passportId] (claim) — T0-only control cannot authorize a T1-governed operation', () => {
  it('401s when the caller is not authenticated at all, even with a real passportId', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    mockGetSupabaseServer.mockReturnValue(makeSingleRecordAdmin(citizenRecord()));
    const res = await claimPOST(makeRequest({}), { params: Promise.resolve({ passportId: REAL_PASSPORT_ID }) });
    expect(res.status).toBe(401);
  });

  it('403s a real, valid, claimable passportId when the authenticated caller is a DIFFERENT persona than the one it belongs to', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: ATTACKER_PERSONA_ID });
    mockGetSupabaseServer.mockReturnValue(makeSingleRecordAdmin(citizenRecord({ persona_id: OWNER_PERSONA_ID })));
    const res = await claimPOST(makeRequest({}), { params: Promise.resolve({ passportId: REAL_PASSPORT_ID }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/not held by the active persona/i);
  });

  it('succeeds for the actual owning persona with the same real passportId — proves the 403 above is an ownership check, not a blanket refusal', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: OWNER_PERSONA_ID });
    mockGetSupabaseServer.mockReturnValue(makeSingleRecordAdmin(citizenRecord({ persona_id: OWNER_PERSONA_ID })));
    const res = await claimPOST(makeRequest({}), { params: Promise.resolve({ passportId: REAL_PASSPORT_ID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.claimed).toBe(true);
  });
});

describe('POST /api/polity-passport/verify-worldid — T0-only control cannot authorize a T1-governed operation', () => {
  it('401s when the caller is not authenticated at all, even with a real passportId', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await verifyWorldIdPOST(
      makeRequest({ passportId: REAL_PASSPORT_ID, proof: { nullifier_hash: 'n-1', proof: 'p', merkle_root: 'm', verification_level: 'orb' } }),
    );
    expect(res.status).toBe(401);
  });

  it('403s a real passportId when the authenticated caller does not own it', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: ATTACKER_PERSONA_ID });
    mockGetSupabaseServer.mockReturnValue(
      makeSingleRecordAdmin({
        passport_id: REAL_PASSPORT_ID,
        persona_id: OWNER_PERSONA_ID,
        passport_class: 'citizen',
        passport_grade: 'citizen',
        world_id_verified_at: null,
      }),
    );
    const res = await verifyWorldIdPOST(
      makeRequest({ passportId: REAL_PASSPORT_ID, proof: { nullifier_hash: 'n-1', proof: 'p', merkle_root: 'm', verification_level: 'orb' } }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/does not own/i);
  });
});

describe('GET /api/polity-passport/wallet — passportId IS present (holder-visible, owner-scoped)', () => {
  it("the caller's own passport row carries its real passportId", async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: OWNER_PERSONA_ID });
    mockGetCallerIdentityContext.mockResolvedValue({ authProfileId: 'auth-1' });
    mockListOwnedPersonaIds.mockResolvedValue({ ok: true, personaIds: [OWNER_PERSONA_ID] });
    mockGetSupabaseServer.mockReturnValue(
      makeListAdmin({
        polity_passport_records: [citizenRecord({ persona_id: OWNER_PERSONA_ID })],
        polity_passport_applications: [],
      }),
    );
    const res = await walletGET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.passportQubes).toHaveLength(1);
    expect(json.passportQubes[0].passportId).toBe(REAL_PASSPORT_ID);
  });
});

describe('GET /api/polity-passport/registry — passportId is NEVER present (public, unauthenticated projection)', () => {
  it('a fully public listing never serializes any row\'s raw passportId', async () => {
    mockGetSupabaseServer.mockReturnValue(
      makeListAdmin({ polity_passport_records: [citizenRecord({ persona_id: OWNER_PERSONA_ID })] }),
    );
    const res = await registryGET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.passports).toHaveLength(1);
    expect(json.passports[0]).not.toHaveProperty('passportId');
    expect(JSON.stringify(json.passports)).not.toContain(REAL_PASSPORT_ID);
  });
});
