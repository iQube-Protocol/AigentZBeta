/**
 * gatewaySession.ts — the Constitutional Handshake session store (PRD-THR-001 §6).
 *
 * A gateway session is the scoped bearer the Threshold Companion receives after
 * the human crosses. It is bound to an AUTHORIZED Constitutional Agreement and
 * carries only the capability scope the human authorized. This module owns the
 * lifecycle; the authority itself lives in the referenced agreement, and
 * `requireAuthorizedAgreement` remains the enforcement switch (increment 3/4).
 *
 * Guarantees:
 *  - Raw bearers are NEVER stored — only their sha256 hash.
 *  - Only T2 references are stored (principalPublicRef, agentAlias) — no T0 ids.
 *  - resolveBearer is DEFENSIVE: any error (incl. an unmigrated table) degrades
 *    to `null` (unauthenticated), never a 500 — the gateway then serves only the
 *    read-only surface.
 *  - Service-role only (deny-all RLS on the table).
 */

import { createHash, randomBytes } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const TABLE = 'agent_gateway_sessions';
const CLIENTS_TABLE = 'agent_gateway_clients';

export interface ScopedSession {
  id: string;
  principalPublicRef: string;
  agentAlias: string;
  agreementId: string | null;
  scope: string[];
  initiatingService: string;
  expiresAt: string | null;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** base64url(sha256(x)) — the PKCE S256 transform (RFC 7636). */
function sha256b64url(s: string): string {
  return createHash('sha256').update(s).digest('base64url');
}

/** A url-safe opaque token. */
function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** begin_handshake / OAuth /authorize: create a `pending` row keyed by a one-time
 *  handshake code. When the crossing is driven by the OAuth authorization-code
 *  flow, the client_id / redirect_uri / PKCE challenge / state are bound here so
 *  the eventual code + token exchange is pinned to this exact request. */
export async function createPendingHandshake(input: {
  initiatingService: string;
  requestedScope: string[];
  ttlMinutes?: number;
  clientId?: string;
  redirectUri?: string;
  pkceChallenge?: string;
  oauthState?: string;
}): Promise<{ handshakeCode: string; expiresAt: string } | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const handshakeCode = `thc_${newToken(18)}`;
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 30) * 60_000).toISOString();
  const { error } = await admin.from(TABLE).insert({
    handshake_code: handshakeCode,
    status: 'pending',
    initiating_service: input.initiatingService,
    requested_scope: input.requestedScope,
    client_id: input.clientId ?? null,
    redirect_uri: input.redirectUri ?? null,
    pkce_challenge: input.pkceChallenge ?? null,
    oauth_state: input.oauthState ?? null,
    expires_at: expiresAt,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[threshold] createPendingHandshake failed:', error.message);
    return null;
  }
  return { handshakeCode, expiresAt };
}

export interface PendingHandshake {
  handshakeCode: string;
  status: string;
  initiatingService: string;
  requestedScope: string[];
  expiresAt: string | null;
}

/** The authorize page reads the pending handshake to show the human what's asked. */
export async function getHandshake(handshakeCode: string): Promise<PendingHandshake | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data, error } = await admin
    .from(TABLE)
    .select('handshake_code, status, initiating_service, requested_scope, expires_at')
    .eq('handshake_code', handshakeCode)
    .maybeSingle();
  if (error || !data) return null;
  return {
    handshakeCode: data.handshake_code,
    status: data.status,
    initiatingService: data.initiating_service,
    requestedScope: data.requested_scope ?? [],
    expiresAt: data.expires_at,
  };
}

/**
 * Activate a pending handshake once the human has crossed (Passport + authorized
 * delegation). Mints a bearer, stores only its hash, records the T2 principal +
 * agent + agreement + granted scope, flips to `active`, and returns the raw
 * bearer ONCE. Caller must pass the AUTHORIZED agreement's id + the scope the
 * human actually authorized (never more than requested).
 */
export async function activateHandshake(input: {
  handshakeCode: string;
  principalPublicRef: string;
  agentAlias: string;
  agreementId: string;
  grantedScope: string[];
  sessionTtlDays?: number;
}): Promise<{ bearer: string; expiresAt: string } | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const bearer = `ths_${newToken(32)}`;
  const expiresAt = new Date(Date.now() + (input.sessionTtlDays ?? 30) * 86_400_000).toISOString();
  const { error } = await admin
    .from(TABLE)
    .update({
      token_hash: sha256(bearer),
      status: 'active',
      principal_public_ref: input.principalPublicRef,
      agent_alias: input.agentAlias,
      agreement_id: input.agreementId,
      granted_scope: input.grantedScope,
      expires_at: expiresAt,
    })
    .eq('handshake_code', input.handshakeCode)
    .eq('status', 'pending'); // only a pending handshake can be activated (idempotency guard)
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[threshold] activateHandshake failed:', error.message);
    return null;
  }
  return { bearer, expiresAt };
}

/**
 * The HUMAN crossing act (OAuth authorization step). Called from the browser
 * completion endpoint AFTER the signed-in principal has authorized the
 * Constitutional Agreement. Flips a `pending` handshake to `authorized`, binds
 * the T2 principal + agent + agreement + granted scope, and mints a one-time
 * AUTHORIZATION CODE (returned once). The bearer is NOT minted here — the client
 * exchanges this code (with its PKCE verifier) at the token endpoint. Returns
 * the redirect target so the browser can hand the code back to the Companion.
 */
export async function issueAuthorizationCode(input: {
  handshakeCode: string;
  principalPublicRef: string;
  agentAlias: string;
  agreementId: string;
  grantedScope: string[];
  codeTtlMinutes?: number;
}): Promise<{ code: string; redirectUri: string; oauthState: string | null } | { error: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { error: 'session store unavailable' };
  const { data: row, error: readErr } = await admin
    .from(TABLE)
    .select('status, redirect_uri, oauth_state')
    .eq('handshake_code', input.handshakeCode)
    .maybeSingle();
  if (readErr) return { error: `handshake read failed: ${readErr.message}` };
  if (!row) return { error: 'handshake not found' };
  if (row.status !== 'pending') return { error: `handshake is '${row.status}', not pending` };
  if (!row.redirect_uri) return { error: 'handshake has no bound redirect_uri' };
  const code = `thac_${newToken(32)}`;
  const codeExpiresAt = new Date(Date.now() + (input.codeTtlMinutes ?? 5) * 60_000).toISOString();
  const { data: updated, error } = await admin
    .from(TABLE)
    .update({
      status: 'authorized',
      auth_code_hash: sha256(code),
      code_expires_at: codeExpiresAt,
      principal_public_ref: input.principalPublicRef,
      agent_alias: input.agentAlias,
      agreement_id: input.agreementId,
      granted_scope: input.grantedScope,
    })
    .eq('handshake_code', input.handshakeCode)
    .eq('status', 'pending') // idempotency guard — only a pending row issues a code
    .select('handshake_code');
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[threshold] issueAuthorizationCode update failed:', error.message);
    // Surface the DB reason (e.g. a stale status CHECK constraint that rejects
    // 'authorized') so the crossing is debuggable rather than a blank failure.
    return { error: `code issue update rejected: ${error.message}` };
  }
  if (!updated || updated.length === 0) return { error: 'handshake was no longer pending at update time' };
  return { code, redirectUri: row.redirect_uri, oauthState: row.oauth_state };
}

/**
 * The token endpoint (OAuth authorization-code + PKCE exchange). The Companion
 * presents the authorization code + its PKCE code_verifier + redirect_uri. We
 * verify: code exists, is `authorized`, not expired, redirect_uri matches, and
 * S256(verifier) === stored challenge. Only then do we mint the scoped bearer,
 * store ONLY its hash, flip to `active`, and return the raw bearer ONCE.
 */
export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  sessionTtlDays?: number;
}): Promise<{ bearer: string; scope: string[]; expiresAt: string } | { error: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { error: 'server_error' };
  if (!input.code || !input.codeVerifier) return { error: 'invalid_request' };
  const { data, error } = await admin
    .from(TABLE)
    .select('id, status, redirect_uri, pkce_challenge, code_expires_at, granted_scope')
    .eq('auth_code_hash', sha256(input.code))
    .maybeSingle();
  // Distinct internal reasons are logged (Amplify/CloudWatch) while the client
  // still receives the spec-standard 'invalid_grant' — so a failed exchange is
  // debuggable without leaking which check failed to the caller.
  const reject = (why: string) => {
    // eslint-disable-next-line no-console
    console.error('[threshold] token exchange invalid_grant:', why);
    return { error: 'invalid_grant' as const };
  };
  if (error) return reject(`code read failed: ${error.message}`);
  if (!data) return reject('no row for auth_code');
  if (data.status !== 'authorized') return reject(`status is '${data.status}', not authorized`);
  if (data.code_expires_at && new Date(data.code_expires_at).getTime() < Date.now()) return reject('code expired');
  // redirect_uri must match the one bound at /authorize (trailing slash tolerant).
  const norm = (u: string | null | undefined) => (u ?? '').replace(/\/+$/, '');
  if (norm(data.redirect_uri) !== norm(input.redirectUri)) {
    return reject(`redirect_uri mismatch: bound='${data.redirect_uri}' presented='${input.redirectUri}'`);
  }
  // PKCE S256 proof — the whole point: the code is useless without the verifier.
  if (!data.pkce_challenge || sha256b64url(input.codeVerifier) !== data.pkce_challenge) {
    return reject('PKCE verifier does not match challenge');
  }

  const bearer = `ths_${newToken(32)}`;
  const expiresAt = new Date(Date.now() + (input.sessionTtlDays ?? 30) * 86_400_000).toISOString();
  const { data: updated, error: upErr } = await admin
    .from(TABLE)
    .update({
      token_hash: sha256(bearer),
      status: 'active',
      auth_code_hash: null, // one-time: burn the code on exchange
      code_expires_at: null,
      expires_at: expiresAt,
    })
    .eq('id', data.id)
    .eq('status', 'authorized') // guard against code replay / double-exchange
    .select('id');
  if (upErr) {
    // eslint-disable-next-line no-console
    console.error('[threshold] exchangeAuthorizationCode failed:', upErr.message);
    return { error: 'server_error' };
  }
  // The conditional update matched zero rows → another exchange already claimed
  // this code (a replay / race). Do NOT return a bearer that was never stored.
  if (!updated || updated.length === 0) return { error: 'invalid_grant' };
  return { bearer, scope: data.granted_scope ?? [], expiresAt };
}

/** OAuth Dynamic Client Registration (RFC 7591) — public PKCE client, no secret. */
export async function registerClient(input: {
  clientName?: string;
  redirectUris: string[];
}): Promise<{ clientId: string; redirectUris: string[] } | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const redirectUris = (input.redirectUris ?? []).filter((u) => typeof u === 'string' && u.length > 0);
  if (redirectUris.length === 0) return null;
  const clientId = `thc_client_${newToken(16)}`;
  const { error } = await admin.from(CLIENTS_TABLE).insert({
    client_id: clientId,
    client_name: input.clientName ?? null,
    redirect_uris: redirectUris,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[threshold] registerClient failed:', error.message);
    return null;
  }
  return { clientId, redirectUris };
}

/** Resolve a registered client's redirect allowlist (or null). Defensive. */
export async function getClient(clientId: string | null | undefined): Promise<{ clientId: string; redirectUris: string[] } | null> {
  if (!clientId) return null;
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from(CLIENTS_TABLE)
      .select('client_id, redirect_uris')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) return null;
    return { clientId: data.client_id, redirectUris: data.redirect_uris ?? [] };
  } catch {
    return null;
  }
}

/** Resolve a presented bearer to its scoped session (or null). Defensive. */
export async function resolveBearer(bearer: string | null | undefined): Promise<ScopedSession | null> {
  if (!bearer) return null;
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from(TABLE)
      .select('id, status, principal_public_ref, agent_alias, agreement_id, granted_scope, initiating_service, expires_at')
      .eq('token_hash', sha256(bearer))
      .maybeSingle();
    if (error || !data) return null;
    if (data.status !== 'active') return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
    // best-effort touch (never blocks resolution)
    void admin.from(TABLE).update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
    return {
      id: data.id,
      principalPublicRef: data.principal_public_ref,
      agentAlias: data.agent_alias,
      agreementId: data.agreement_id,
      scope: data.granted_scope ?? [],
      initiatingService: data.initiating_service,
      expiresAt: data.expires_at,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[threshold] resolveBearer degraded to unauthenticated:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function revokeByHandshake(handshakeCode: string): Promise<boolean> {
  const admin = getSupabaseServer();
  if (!admin) return false;
  const { error } = await admin
    .from(TABLE)
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('handshake_code', handshakeCode);
  return !error;
}

/** Pure scope check — a session may perform an action iff its granted scope
 *  contains the capability (exact or a `prefix.*` wildcard grant). */
export function hasScope(session: ScopedSession | null, capability: string): boolean {
  if (!session) return false;
  return session.scope.some((s) => s === capability || (s.endsWith('.*') && capability.startsWith(s.slice(0, -1))));
}
