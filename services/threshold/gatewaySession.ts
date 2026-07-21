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

/** A url-safe opaque token. */
function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** begin_handshake: create a `pending` row keyed by a one-time handshake code. */
export async function createPendingHandshake(input: {
  initiatingService: string;
  requestedScope: string[];
  ttlMinutes?: number;
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
