/**
 * services/google/oauth.ts — Aigent Me Phase 6.b
 *
 * Google Workspace OAuth2 — per-source consent flow + token storage.
 * Per the locked decision Q3: Gmail / Calendar / Drive are opt-in per
 * source; each consent stores a separate row keyed by (persona, source).
 *
 * Privacy contract:
 *   - persona_id is T0; never serialised to a JSON response.
 *   - access_token + refresh_token live server-side only. The browser
 *     receives a status object (connected / not-connected / scopes).
 *   - Tokens stored as plain strings in alpha; Phase 6.b.2 wraps via
 *     services/content/encryption.ts (no schema change).
 *
 * Graceful degradation:
 *   - When GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET /
 *     GOOGLE_OAUTH_REDIRECT_URI are missing in env, every public function
 *     here returns a typed "not-configured" diagnostic without throwing.
 *     Routes surface a 503 with the operator action.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

// ─────────────────────────────────────────────────────────────────────────
// Public types.
// ─────────────────────────────────────────────────────────────────────────

export type GoogleSource = 'gmail' | 'calendar' | 'drive' | 'docs' | 'slides' | 'sheets';

export const GOOGLE_SOURCES: GoogleSource[] = ['gmail', 'calendar', 'drive', 'docs', 'slides', 'sheets'];

/** Per-source scope sets. Minimum-needed only. */
export const GOOGLE_SCOPES: Record<GoogleSource, string[]> = {
  gmail: ['https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.modify'],
  calendar: ['https://www.googleapis.com/auth/calendar.events'],
  drive: ['https://www.googleapis.com/auth/drive.file'],
  docs: ['https://www.googleapis.com/auth/documents'],
  slides: ['https://www.googleapis.com/auth/presentations'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
};

export interface GoogleConnectionStatus {
  source: GoogleSource;
  connected: boolean;
  scopes: string[];
  expiresAt: string | null;
  /** Informational email of the connected account; never used for auth. */
  accountEmail: string | null;
}

export interface GoogleTokenRecord {
  personaId: string;
  source: GoogleSource;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: string | null;
  accountEmail: string | null;
}

export type OAuthConfigStatus =
  | { configured: true; clientId: string; redirectUri: string }
  | { configured: false; reason: string; missing: string[] };

// ─────────────────────────────────────────────────────────────────────────
// Config gate.
// ─────────────────────────────────────────────────────────────────────────

export function getOAuthConfig(): OAuthConfigStatus {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_OAUTH_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!redirectUri) missing.push('GOOGLE_OAUTH_REDIRECT_URI');
  if (missing.length > 0) {
    return {
      configured: false,
      reason:
        `Google OAuth not configured. Set ${missing.join(', ')} in the ` +
        `Amplify env. Operator action — see Phase 6.b backlog doc.`,
      missing,
    };
  }
  return { configured: true, clientId, redirectUri };
}

// ─────────────────────────────────────────────────────────────────────────
// Consent URL.
// ─────────────────────────────────────────────────────────────────────────

export function buildConsentUrl(input: {
  source: GoogleSource;
  personaId: string;
  /** Opaque value the route generates + verifies on callback. */
  state: string;
}): { url: string } | OAuthConfigStatus {
  const cfg = getOAuthConfig();
  if (!cfg.configured) return cfg;
  const scopes = GOOGLE_SCOPES[input.source];
  if (!scopes) {
    return { configured: false, reason: `unknown source: ${input.source}`, missing: [] };
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', input.state);
  return { url: url.toString() };
}

// ─────────────────────────────────────────────────────────────────────────
// Token exchange.
// ─────────────────────────────────────────────────────────────────────────

interface TokenExchangeResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeCodeForTokens(input: {
  code: string;
  source: GoogleSource;
  personaId: string;
}): Promise<
  | { ok: true; record: GoogleTokenRecord }
  | { ok: false; reason: string }
> {
  const cfg = getOAuthConfig();
  if (!cfg.configured) return { ok: false, reason: cfg.reason };

  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

  const body = new URLSearchParams({
    code: input.code,
    client_id: cfg.clientId,
    client_secret: clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  });

  let tokenJson: TokenExchangeResponse;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reason: `token exchange failed (${res.status}): ${text.slice(0, 200)}` };
    }
    tokenJson = (await res.json()) as TokenExchangeResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `token exchange error: ${msg}` };
  }

  const grantedScopes = (tokenJson.scope || '').split(' ').filter(Boolean);
  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
    : null;

  // Read the connected account's email via the OIDC userinfo endpoint when
  // the granted scopes include it. Best-effort; failure is non-fatal.
  let accountEmail: string | null = null;
  try {
    const ui = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (ui.ok) {
      const userInfo = (await ui.json()) as { email?: string };
      accountEmail = typeof userInfo.email === 'string' ? userInfo.email : null;
    }
  } catch {
    /* non-fatal */
  }

  const record: GoogleTokenRecord = {
    personaId: input.personaId,
    source: input.source,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token ?? null,
    scopes: grantedScopes.length > 0 ? grantedScopes : GOOGLE_SCOPES[input.source],
    expiresAt,
    accountEmail,
  };

  await persistTokenRecord(record);
  return { ok: true, record };
}

// ─────────────────────────────────────────────────────────────────────────
// Storage.
// ─────────────────────────────────────────────────────────────────────────

function getAdminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for Google OAuth service');
  return client;
}

async function persistTokenRecord(record: GoogleTokenRecord): Promise<void> {
  const admin = getAdminClient();
  const row = {
    persona_id: record.personaId,
    source: record.source,
    access_token: record.accessToken,
    refresh_token: record.refreshToken,
    scopes: record.scopes,
    expires_at: record.expiresAt,
    google_account_email: record.accountEmail,
  };
  const { error } = await admin
    .from('persona_google_tokens')
    .upsert(row, { onConflict: 'persona_id,source' });
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn(
        '[google/oauth] persona_google_tokens table missing — token not persisted. ' +
          'Apply supabase/migrations/20260515000000_persona_google_tokens.sql.',
      );
      return;
    }
    throw new Error(`persistTokenRecord failed: ${error.message}`);
  }
}

/**
 * Load the active token record for (persona, source). Returns null when
 * not connected. Does NOT auto-refresh; callers should use
 * `getValidAccessToken()` which handles refresh.
 */
export async function loadTokenRecord(
  personaId: string,
  source: GoogleSource,
): Promise<GoogleTokenRecord | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('persona_google_tokens')
    .select('*')
    .eq('persona_id', personaId)
    .eq('source', source)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    persona_id: string;
    source: GoogleSource;
    access_token: string;
    refresh_token: string | null;
    scopes: string[];
    expires_at: string | null;
    google_account_email: string | null;
  };
  return {
    personaId: row.persona_id,
    source: row.source,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    scopes: row.scopes ?? [],
    expiresAt: row.expires_at,
    accountEmail: row.google_account_email,
  };
}

export async function disconnectSource(input: {
  personaId: string;
  source: GoogleSource;
}): Promise<{ ok: boolean }> {
  const admin = getAdminClient();
  const existing = await loadTokenRecord(input.personaId, input.source);
  if (existing?.refreshToken) {
    // Best-effort revoke at Google. Non-fatal on failure.
    try {
      const body = new URLSearchParams({ token: existing.refreshToken });
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch {
      /* non-fatal */
    }
  }
  const { error } = await admin
    .from('persona_google_tokens')
    .delete()
    .eq('persona_id', input.personaId)
    .eq('source', input.source);
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return { ok: true };
    throw new Error(`disconnectSource failed: ${error.message}`);
  }
  await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'metame',
    actionType: 'approval_rejected',
    summary: `Disconnected Google ${input.source}`,
    agentsInvoked: ['aigent-me'],
    toolsUsed: [`google.${input.source}`],
    iqubesUsed: ['PersonaQube'],
    contextShared: [],
  }).catch(() => undefined);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Token refresh + valid-token resolver.
// ─────────────────────────────────────────────────────────────────────────

export async function refreshAccessToken(record: GoogleTokenRecord): Promise<
  | { ok: true; record: GoogleTokenRecord }
  | { ok: false; reason: string }
> {
  if (!record.refreshToken) return { ok: false, reason: 'no refresh token on file' };
  const cfg = getOAuthConfig();
  if (!cfg.configured) return { ok: false, reason: cfg.reason };
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

  const body = new URLSearchParams({
    refresh_token: record.refreshToken,
    client_id: cfg.clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reason: `refresh failed (${res.status}): ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as TokenExchangeResponse;
    const next: GoogleTokenRecord = {
      ...record,
      accessToken: json.access_token,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
    };
    await persistTokenRecord(next);
    return { ok: true, record: next };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `refresh error: ${msg}` };
  }
}

/**
 * Resolve a valid access token for (persona, source). Auto-refreshes when
 * the stored token is within 60s of expiry. Returns null when not
 * connected or refresh fails — keep this signature stable for older
 * callers; new code should prefer `resolveAccessToken` which returns a
 * diagnostic discriminated union.
 */
export async function getValidAccessToken(
  personaId: string,
  source: GoogleSource,
): Promise<string | null> {
  const result = await resolveAccessToken(personaId, source);
  return result.ok ? result.token : null;
}

/**
 * Same lookup as `getValidAccessToken` but returns a diagnostic shape so
 * callers can distinguish "no token record" from "refresh failed" — the
 * status panel says "connected" as long as a record exists, but a stale
 * record whose refresh-token Google has revoked still fails at use time.
 * Connectors use this to surface the actual reason to the operator.
 */
export async function resolveAccessToken(
  personaId: string,
  source: GoogleSource,
): Promise<
  | { ok: true; token: string }
  | { ok: false; code: 'no-record' | 'no-refresh-token' | 'refresh-failed'; reason: string }
> {
  let record = await loadTokenRecord(personaId, source);
  // Cross-source fallback: when Google grants scopes additively via
  // include_granted_scopes=true, the user might have connected (say) the
  // 'drive' source and Google attached the 'documents' scope to that row
  // too. Rather than force the user to run a second OAuth round for the
  // 'docs' source, look across sibling rows for a token whose granted
  // scopes already include every required scope for the requested source.
  if (!record) {
    record = await findTokenWithScopes(personaId, GOOGLE_SCOPES[source] ?? []);
  }
  if (!record) {
    return {
      ok: false,
      code: 'no-record',
      reason: `No Google ${source} token row for this persona. Either the consent flow was never completed or the row was saved under a different persona.`,
    };
  }
  if (!record.expiresAt) return { ok: true, token: record.accessToken };
  const expiresMs = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs - Date.now() > 60_000) {
    return { ok: true, token: record.accessToken };
  }
  if (!record.refreshToken) {
    return {
      ok: false,
      code: 'no-refresh-token',
      reason: `Google ${source} token expired and no refresh token is on file. Reconnect from Aigent Me → Connections.`,
    };
  }
  const refreshed = await refreshAccessToken(record);
  if (!refreshed.ok) {
    return {
      ok: false,
      code: 'refresh-failed',
      reason: `Google ${source} refresh failed: ${refreshed.reason}. Reconnect from Aigent Me → Connections.`,
    };
  }
  return { ok: true, token: refreshed.record.accessToken };
}

/**
 * Scan every source row for this persona and return the first whose
 * granted scopes are a superset of `required`. Used by resolveAccessToken
 * to satisfy a requested source via a sibling row when Google's additive
 * scope grant has already attached the required scope elsewhere.
 */
async function findTokenWithScopes(
  personaId: string,
  required: string[],
): Promise<GoogleTokenRecord | null> {
  if (required.length === 0) return null;
  for (const candidate of GOOGLE_SOURCES) {
    const row = await loadTokenRecord(personaId, candidate).catch(() => null);
    if (!row) continue;
    const granted = new Set(row.scopes ?? []);
    if (required.every((s) => granted.has(s))) return row;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Status snapshot (for the welcome surface).
// ─────────────────────────────────────────────────────────────────────────

export async function getConnectionStatuses(
  personaId: string,
): Promise<GoogleConnectionStatus[]> {
  const out: GoogleConnectionStatus[] = [];
  for (const source of GOOGLE_SOURCES) {
    const record = await loadTokenRecord(personaId, source).catch(() => null);
    out.push({
      source,
      connected: !!record,
      scopes: record?.scopes ?? [],
      expiresAt: record?.expiresAt ?? null,
      accountEmail: record?.accountEmail ?? null,
    });
  }
  return out;
}
