/**
 * Turn F (2026-09-02) — operator directive: "/api/moneypenny/learn-content
 * must report configuration, authorization or database failures
 * accurately. Do not silently fall back to an anonymous client and
 * translate unreadable rows into 'not published.'" and "Reuse the
 * established published-content projection for public bridge readers.
 * Keep drafts protected; do not broaden placement-table access merely to
 * make the page render."
 *
 * Root cause this closes: `getCommunityContentSupabase()` falls back to
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` when `SUPABASE_SERVICE_ROLE_KEY` is
 * absent. `bridge_content_placements` RLS grants service_role only (zero
 * anon/authenticated policies — verified live against the real project),
 * so an anon-key client's SELECT there returns zero rows silently (RLS
 * row-filtering, never a query error) — indistinguishable from "genuinely
 * nothing published." The fix has two independent parts: (1) the public
 * MoneyPenny reader no longer depends on that protected table at all —
 * it reads knyts_bridge_editorial_config directly, same as every CI/KNYTS
 * public reader; (2) any caller that DOES need bridge_content_placements
 * (the admin route) now affirmatively checks for SUPABASE_SERVICE_ROLE_KEY
 * before querying, and refuses with a named, distinguishable error instead
 * of silently substituting anon.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('getServiceRoleSupabaseOrThrow — never returns a degraded client silently', () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    process.env.SUPABASE_URL = savedUrl;
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedPublicUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  it('throws SupabaseConfigurationError, naming the missing URL var, when no URL is configured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
    const { getServiceRoleSupabaseOrThrow, SupabaseConfigurationError } = await import('@/services/supabase/requireServiceRoleClient');
    expect(() => getServiceRoleSupabaseOrThrow('test context')).toThrow(SupabaseConfigurationError);
    try {
      getServiceRoleSupabaseOrThrow('test context');
    } catch (err) {
      expect((err as Error).message).toMatch(/test context/);
      expect((err as Error).message).toMatch(/SUPABASE_URL/);
    }
  });

  it('throws SupabaseServiceRoleMissingError, distinct from the URL error, when URL is present but the service-role key is not', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getServiceRoleSupabaseOrThrow, SupabaseServiceRoleMissingError, SupabaseConfigurationError } = await import('@/services/supabase/requireServiceRoleClient');
    expect(() => getServiceRoleSupabaseOrThrow('bridge_content_placements read')).toThrow(SupabaseServiceRoleMissingError);
    try {
      getServiceRoleSupabaseOrThrow('bridge_content_placements read');
    } catch (err) {
      expect(err).not.toBeInstanceOf(SupabaseConfigurationError);
      expect((err as Error).message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect((err as Error).message).toMatch(/bridge_content_placements read/);
    }
  });

  it('returns a real client (no throw) when both URL and service-role key are present', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
    const { getServiceRoleSupabaseOrThrow } = await import('@/services/supabase/requireServiceRoleClient');
    const client = getServiceRoleSupabaseOrThrow('test context');
    expect(client).toBeTruthy();
    expect(typeof client.from).toBe('function');
  });
});

describe('bridge_content_placements RLS — confirmed service_role-only, never broadened for this fix', () => {
  it('the migration file grants only service_role, no anon/authenticated policy was added', () => {
    const src = readSource('supabase/migrations/20260901000000_bridge_content_placements.sql');
    expect(src).toMatch(/CREATE POLICY bridge_content_placements_service_role_all[\s\S]*?TO service_role/);
    expect(src).not.toMatch(/TO anon/);
    expect(src).not.toMatch(/TO authenticated/);
  });
});

describe('moneyPennyEducationalMedia.ts no longer depends on bridge_content_placements for public reads', () => {
  const src = stripComments(readSource('services/journey/moneyPennyEducationalMedia.ts'));

  it('imports only getKnytsBridgeEditorialSection — the established public-bridge-reader projection', () => {
    expect(src).toMatch(/import \{ getKnytsBridgeEditorialSection \} from '@\/services\/journey\/knytsBridgeEditorialConfig'/);
    expect(src).not.toMatch(/bridgeContentPlacements|getPlacementsForSection/);
  });
});

describe('GET /api/moneypenny/learn-content — reports config/auth failures distinctly, never folds them into "not published"', () => {
  const src = stripComments(readSource('app/api/moneypenny/learn-content/route.ts'));

  it('uses getServiceRoleSupabaseOrThrow, never getCommunityContentSupabase\'s anon fallback', () => {
    expect(src).toMatch(/import \{\s*getServiceRoleSupabaseOrThrow,/);
    expect(src).not.toMatch(/getCommunityContentSupabase/);
  });

  it('catches SupabaseServiceRoleMissingError and SupabaseConfigurationError as distinct, named 503s', () => {
    expect(src).toMatch(/if \(err instanceof SupabaseServiceRoleMissingError\)/);
    expect(src).toMatch(/error: 'service-role-not-configured'/);
    expect(src).toMatch(/if \(err instanceof SupabaseConfigurationError\)/);
    expect(src).toMatch(/error: 'supabase-not-configured'/);
    expect(src).toMatch(/status: 503 \}/);
  });

  it('a genuine query failure still surfaces as a distinguishable database-error, not silently swallowed', () => {
    expect(src).toMatch(/error: 'database-error'/);
  });
});

describe('/api/journey/knyts-bridge/placements — the admin route gets the SAME honesty guard (GET and POST)', () => {
  const src = stripComments(readSource('app/api/journey/knyts-bridge/placements/route.ts'));

  it('both handlers use getServiceRoleSupabaseOrThrow, never the anon-fallback getCommunityContentSupabase', () => {
    expect(src).toMatch(/import \{\s*getServiceRoleSupabaseOrThrow,/);
    expect(src).not.toMatch(/getCommunityContentSupabase/);
    const readCall = src.match(/getServiceRoleSupabaseOrThrow\('bridge_content_placements read'\)/g) ?? [];
    const writeCall = src.match(/getServiceRoleSupabaseOrThrow\('bridge_content_placements write'\)/g) ?? [];
    expect(readCall.length).toBe(1);
    expect(writeCall.length).toBe(1);
  });

  it('GET catches the service-role/config errors distinctly from a generic 500', () => {
    const getStart = src.indexOf('export async function GET');
    const getEnd = src.indexOf('export async function POST');
    const getBody = src.slice(getStart, getEnd);
    expect(getBody).toMatch(/if \(err instanceof SupabaseServiceRoleMissingError\)/);
    expect(getBody).toMatch(/error: 'service-role-not-configured'/);
  });

  it('POST catches the service-role/config errors distinctly from a generic 500', () => {
    const postStart = src.indexOf('export async function POST');
    const postBody = src.slice(postStart);
    expect(postBody).toMatch(/if \(err instanceof SupabaseServiceRoleMissingError\)/);
    expect(postBody).toMatch(/error: 'service-role-not-configured'/);
  });
});
