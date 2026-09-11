/**
 * DiDQube Phase 5.1c (2026-09-11) — POST /api/polity-passport/verify-credential.
 *
 * Proves: a genuinely valid credential verifies with lifecycle facts folded
 * in (revoked / superseded / presentable); a tampered credential fails
 * closed; a credential signed during a suspected-compromise window comes
 * back UNRESOLVED (never hardcoded valid/invalid); rate-limiting is wired;
 * malformed requests 400 before touching the DB; and — the T1/T2-safety
 * requirement — the response NEVER echoes the full credential body, the
 * raw superseding passport_id, or any T0 identifier.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { generateKeyPairSync } from 'crypto';

const KEY_ID = 'endpoint-test-key';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUBLIC_KEY_B64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const PRIVATE_KEY_B64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
const TEST_ISSUER_DID = 'did:web:passport.example.test';
const HOST = 'https://dev-beta.aigentz.me';

const ORIGINAL_ENV = { ...process.env };

function setBaseSigningEnv(extraKeyFields: Record<string, unknown> = {}) {
  process.env.PASSPORT_BUREAU_ISSUER_DID = TEST_ISSUER_DID;
  process.env.PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID = KEY_ID;
  process.env.PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64 = PRIVATE_KEY_B64;
  process.env.PASSPORT_BUREAU_SIGNING_KEYS_JSON = JSON.stringify([
    { keyId: KEY_ID, publicKeyB64: PUBLIC_KEY_B64, ...extraKeyFields },
  ]);
}

const mockRateLimitAllowed = vi.fn();
vi.mock('@/services/rateLimit/rateLimitService', () => ({
  checkAndConsumeRateLimit: (...args: unknown[]) => mockRateLimitAllowed(...args),
  getClientIp: () => '203.0.113.5',
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

import { buildPassportCredential, type PassportRecordRow } from '@/services/passport/passportCredential';
import { POST } from '@/app/api/polity-passport/verify-credential/route';

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    nextUrl: { origin: HOST },
    url: `${HOST}/api/polity-passport/verify-credential`,
  } as unknown as NextRequest;
}

function participantRecord(overrides: Partial<PassportRecordRow> = {}): PassportRecordRow {
  return {
    passport_id: 'ppp-endpoint-test-0001',
    passport_class: 'agent_participant',
    citizen_status: null,
    participant_status: 'approved',
    passport_grade: 'agent_participant',
    kybe_did_public_ref: null,
    root_did_public_ref: 'rootdid-commit-xyz789',
    persona_public_ref: 'persona-commit-def456',
    registry_record_id: 'marketa-agent-xyz',
    issuer_id: 'polity-passport-bureau',
    issued_at: '2026-01-01T00:00:00Z',
    expires_at: '2027-01-01T00:00:00Z',
    revoked: false,
    ...overrides,
  };
}

/** .select(...).eq(col).maybeSingle() — dispatches on which column was queried, matching the route's two distinct lookups (revoked-by-passport_id, supersededBy-by-renewal_of_passport_id). */
function makeAdmin(opts: { revokedRow: Record<string, unknown> | null; successorRow: Record<string, unknown> | null }) {
  return {
    from: (table: string) => {
      if (table !== 'polity_passport_records') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (col: string) => ({
            maybeSingle: async () => {
              if (col === 'passport_id') return { data: opts.revokedRow, error: null };
              if (col === 'renewal_of_passport_id') return { data: opts.successorRow, error: null };
              throw new Error(`unexpected eq column: ${col}`);
            },
          }),
        }),
      };
    },
  };
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  mockRateLimitAllowed.mockReset();
  mockRateLimitAllowed.mockResolvedValue({ allowed: true });
  mockGetSupabaseServer.mockReset();
});

describe('POST /api/polity-passport/verify-credential', () => {
  it('a genuinely valid, unrevoked, non-superseded credential verifies as presentable', async () => {
    setBaseSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST);
    mockGetSupabaseServer.mockReturnValue(makeAdmin({ revokedRow: { revoked: false }, successorRow: null }));

    const res = await POST(makeRequest({ credential }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.valid).toBe(true);
    expect(json.suite).toBe('PolityBureauEd25519Signature2026');
    expect(json.keyId).toBe(KEY_ID);
    expect(json.revoked).toBe(false);
    expect(json.superseded).toBe(false);
    expect(json.presentable).toBe(true);
    expect(json.recordFound).toBe(true);
  });

  it('a revoked passport is NOT presentable even though the signature is valid', async () => {
    setBaseSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST);
    mockGetSupabaseServer.mockReturnValue(makeAdmin({ revokedRow: { revoked: true }, successorRow: null }));

    const res = await POST(makeRequest({ credential }));
    const json = await res.json();

    expect(json.valid).toBe(true);
    expect(json.revoked).toBe(true);
    expect(json.presentable).toBe(false);
  });

  it('a superseded-but-not-revoked passport IS still presentable, and the response carries only a BOOLEAN — never the successor raw passport_id', async () => {
    setBaseSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST);
    mockGetSupabaseServer.mockReturnValue(
      makeAdmin({ revokedRow: { revoked: false }, successorRow: { passport_id: 'ppp-successor-SECRET-0002' } }),
    );

    const res = await POST(makeRequest({ credential }));
    const json = await res.json();

    expect(json.superseded).toBe(true);
    expect(json.presentable).toBe(true);
    expect(JSON.stringify(json)).not.toContain('ppp-successor-SECRET-0002');
  });

  it('a tampered credential fails closed — invalid, not presentable', async () => {
    setBaseSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST) as Record<string, any>;
    credential.credentialSubject.passportGrade = 'tampered';
    mockGetSupabaseServer.mockReturnValue(makeAdmin({ revokedRow: { revoked: false }, successorRow: null }));

    const res = await POST(makeRequest({ credential }));
    const json = await res.json();

    expect(json.valid).toBe(false);
    expect(json.reason).toBe('signature_mismatch');
    expect(json.presentable).toBe(false);
    expect(json.suite).toBeUndefined();
    expect(json.keyId).toBeUndefined();
  });

  it('a credential signed during a suspected-compromise window comes back UNRESOLVED — never hardcoded valid or invalid', async () => {
    setBaseSigningEnv({ compromisedAt: '2020-01-01T00:00:00.000Z' }); // any issuance after this is in-window
    const credential = buildPassportCredential(participantRecord(), HOST);
    mockGetSupabaseServer.mockReturnValue(makeAdmin({ revokedRow: { revoked: false }, successorRow: null }));

    const res = await POST(makeRequest({ credential }));
    const json = await res.json();

    expect(json.valid).toBe('UNRESOLVED');
    expect(json.presentable).toBe(false);
  });

  it('no matching Passport row → recordFound: false, conservative (non-revoked) lifecycle defaults, signature still evaluated independently', async () => {
    setBaseSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST);
    mockGetSupabaseServer.mockReturnValue(makeAdmin({ revokedRow: null, successorRow: null }));

    const res = await POST(makeRequest({ credential }));
    const json = await res.json();

    expect(json.recordFound).toBe(false);
    expect(json.valid).toBe(true);
    expect(json.revoked).toBe(false);
  });

  it('rejects a missing credential body before touching the database', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockGetSupabaseServer).not.toHaveBeenCalled();
  });

  it('rejects a credential with a missing/malformed passportId before touching the database', async () => {
    const res = await POST(makeRequest({ credential: { credentialSubject: { passportId: '../not-an-id' } } }));
    expect(res.status).toBe(400);
    expect(mockGetSupabaseServer).not.toHaveBeenCalled();
  });

  it('honors the shared rate limiter — 429 with Retry-After when rate-limited', async () => {
    mockRateLimitAllowed.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const res = await POST(makeRequest({ credential: { credentialSubject: { passportId: 'ppp-whatever-0001' } } }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(mockGetSupabaseServer).not.toHaveBeenCalled();
  });

  it('NEVER echoes the full credential body or any T0 identifier — response is outcome-only', async () => {
    setBaseSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST);
    mockGetSupabaseServer.mockReturnValue(makeAdmin({ revokedRow: { revoked: false }, successorRow: null }));

    const res = await POST(makeRequest({ credential }));
    const json = await res.json();

    const allowedKeys = new Set(['ok', 'valid', 'reason', 'suite', 'keyId', 'revoked', 'superseded', 'presentable', 'recordFound']);
    for (const key of Object.keys(json)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
    expect(json.credentialSubject).toBeUndefined();
    expect(json.proof).toBeUndefined();
    expect(json.credential).toBeUndefined();
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain(PRIVATE_KEY_B64);
    expect(serialized).not.toContain('rootdid-commit-xyz789');
  });
});
