/**
 * humanSession.ts — the Polity Access Gateway HUMAN adapter over the shared
 * Threshold session substrate (PRD-PAG-001 §2.1, operator-ratified 2026-07-22,
 * Phase 1).
 *
 * GENERALIZE, NOT SIBLING: this module COMPOSES services/threshold/
 * gatewaySession.ts — same table (agent_gateway_sessions, human row shape per
 * migration 20260813000000), same handshake state machine (pending → authorized
 * → active → revoked), same PKCE-S256 + hashed-bearer + single-use-code
 * discipline (createPendingHandshake / exchangeAuthorizationCode are reused
 * verbatim; sha256/newToken are the substrate's own exports so hash encodings
 * are definitionally shared). What differs is the ROW SHAPE the PRD specifies:
 * a human session binds a persona directly — agent_alias and agreement_id stay
 * NULL (the human acts as themselves; no delegation) — and carries the T1/T2
 * claim snapshot the SessionQube projects.
 *
 * Constitutional guardrails carried over intact:
 *  - Only the HUMAN authorizes (Principal–Delegate Separation, CFS-043 §2) —
 *    issuance happens exclusively from the browser consent route where the
 *    spine resolved a signed-in persona. No agent-authenticate path exists.
 *  - No T0 identifier is ever stored on the row or returned to the browser:
 *    the subject is derivePairwiseRef (persona_external_refs-backed, audience =
 *    the registered client_id) with personaPublicRef as the first-party
 *    fallback; display_label/cartridge_flags are the T1 surface snapshot.
 *  - Raw bearers are never stored — sha256 only (substrate discipline).
 *  - Everything degrades to null (unauthenticated / unavailable) on any error,
 *    including the pre-migration window — never a 500, never a weaker gate.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  createPendingHandshake,
  sha256,
  newToken,
} from '@/services/threshold/gatewaySession';
import {
  personaPublicRef,
  pairwiseRefsEnabled,
  issueExternalRef,
} from '@/services/identity/personaReferences';
import {
  projectSessionQube,
  type ConsentRecord,
  type PassportStatusClaim,
  type SessionCartridgeFlags,
  type SessionQube,
  consentCommitment,
  isSessionExpired,
} from './sessionQube';

const TABLE = 'agent_gateway_sessions';
const CLIENTS_TABLE = 'agent_gateway_clients';

/** How the Access Gateway marks its rows in the shared substrate. */
export const ACCESS_GATEWAY_SERVICE = 'access-gateway';

/** Human sessions are SHORT-LIVED (PRD-PAG-001 §7 Phase 1: "short-lived
 *  session") — hours, not the agent substrate's 30 days. */
export const HUMAN_SESSION_TTL_HOURS = 12;

// ── Client registry (REUSED — Threshold DCR, agent_gateway_clients) ──────────

/** Client summary for the consent screen. Same registry the Threshold DCR
 *  (/api/threshold/oauth/register) writes — one client store, both adapters. */
export async function getRegisteredClientSummary(
  clientId: string | null | undefined,
): Promise<{ clientId: string; clientName: string | null; redirectUris: string[] } | null> {
  if (!clientId) return null;
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from(CLIENTS_TABLE)
      .select('client_id, client_name, redirect_uris')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      clientId: data.client_id,
      clientName: data.client_name ?? null,
      redirectUris: data.redirect_uris ?? [],
    };
  } catch {
    return null;
  }
}

// ── Handshake lifecycle (human rows) ─────────────────────────────────────────

/**
 * Begin a human crossing: reuse the substrate's createPendingHandshake (same
 * PKCE/client/redirect binding), then stamp the row `session_kind='human'`.
 * Inert pre-migration: the stamp fails → null → the route 503s and the orphan
 * pending row simply expires.
 */
export async function createHumanPendingHandshake(input: {
  clientId: string;
  redirectUri: string;
  pkceChallenge: string;
  oauthState?: string;
  requestedClaims: string[];
  ttlMinutes?: number;
}): Promise<{ handshakeCode: string; expiresAt: string } | null> {
  const created = await createPendingHandshake({
    initiatingService: ACCESS_GATEWAY_SERVICE,
    requestedScope: input.requestedClaims,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    pkceChallenge: input.pkceChallenge,
    oauthState: input.oauthState,
    ttlMinutes: input.ttlMinutes,
  });
  if (!created) return null;
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { error } = await admin
    .from(TABLE)
    .update({ session_kind: 'human' })
    .eq('handshake_code', created.handshakeCode)
    .eq('status', 'pending');
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[access-gateway] human handshake stamp failed (migration applied?):', error.message);
    return null;
  }
  return created;
}

export interface HumanHandshake {
  handshakeCode: string;
  status: string;
  clientId: string | null;
  requestedClaims: string[];
  expiresAt: string | null;
}

/** Read a pending HUMAN handshake (kind-checked — an agent handshake never
 *  resolves here, and vice versa). Defensive: any error → null. */
export async function getHumanHandshake(handshakeCode: string): Promise<HumanHandshake | null> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from(TABLE)
      .select('handshake_code, status, session_kind, client_id, requested_scope, expires_at')
      .eq('handshake_code', handshakeCode)
      .maybeSingle();
    if (error || !data) return null;
    if (data.session_kind !== 'human') return null;
    return {
      handshakeCode: data.handshake_code,
      status: data.status,
      clientId: data.client_id ?? null,
      requestedClaims: data.requested_scope ?? [],
      expiresAt: data.expires_at,
    };
  } catch {
    return null;
  }
}

/**
 * The HUMAN consent act — mirror of the substrate's issueAuthorizationCode
 * state transition (pending → authorized + one-time code), writing the human
 * row shape instead of the agent one: NO agent_alias, NO agreement_id; the T2
 * subject refs + T1 claim snapshot + consent record instead. The bearer is NOT
 * minted here — the client exchanges the code (with its PKCE verifier) at
 * /api/access-gateway/token, which reuses exchangeAuthorizationCode verbatim.
 */
export async function issueHumanAuthorizationCode(input: {
  handshakeCode: string;
  personaPublicRef: string;
  subjectPairwiseRef: string;
  displayLabel: string | null;
  cartridgeFlags: SessionCartridgeFlags | null;
  passportStatus: PassportStatusClaim | null;
  grantedClaims: string[];
  consentRecord: ConsentRecord;
  codeTtlMinutes?: number;
}): Promise<{ code: string; redirectUri: string; oauthState: string | null } | { error: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { error: 'session store unavailable' };
  const { data: row, error: readErr } = await admin
    .from(TABLE)
    .select('status, session_kind, redirect_uri, oauth_state')
    .eq('handshake_code', input.handshakeCode)
    .maybeSingle();
  if (readErr) return { error: `handshake read failed: ${readErr.message}` };
  if (!row) return { error: 'handshake not found' };
  if (row.session_kind !== 'human') return { error: 'not a human handshake' };
  if (row.status !== 'pending') return { error: `handshake is '${row.status}', not pending` };
  if (!row.redirect_uri) return { error: 'handshake has no bound redirect_uri' };

  const code = `agac_${newToken(32)}`;
  const codeExpiresAt = new Date(Date.now() + (input.codeTtlMinutes ?? 5) * 60_000).toISOString();
  const { data: updated, error } = await admin
    .from(TABLE)
    .update({
      status: 'authorized',
      auth_code_hash: sha256(code),
      code_expires_at: codeExpiresAt,
      principal_public_ref: input.personaPublicRef,
      subject_pairwise_ref: input.subjectPairwiseRef,
      display_label: input.displayLabel,
      cartridge_flags: input.cartridgeFlags,
      passport_status: input.passportStatus,
      granted_scope: input.grantedClaims,
      consent_record: input.consentRecord,
      consent_ref: consentCommitment(input.consentRecord),
      // Human sessions are short-lived — expires_at is finalized at token
      // exchange by the substrate; we pin the intended TTL there via the route.
    })
    .eq('handshake_code', input.handshakeCode)
    .eq('status', 'pending') // idempotency guard — only a pending row issues a code
    .eq('session_kind', 'human')
    .select('handshake_code');
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[access-gateway] issueHumanAuthorizationCode failed:', error.message);
    return { error: `code issue update rejected: ${error.message}` };
  }
  if (!updated || updated.length === 0) return { error: 'handshake was no longer pending at update time' };
  return { code, redirectUri: row.redirect_uri, oauthState: row.oauth_state };
}

// ── Bearer resolution / revocation (human rows) ──────────────────────────────

/** Resolve a presented human bearer to its SessionQube (or null). Defensive;
 *  kind-checked so an agent bearer never resolves as a human session. */
export async function resolveHumanBearer(bearer: string | null | undefined): Promise<SessionQube | null> {
  if (!bearer) return null;
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from(TABLE)
      .select(
        'id, status, session_kind, client_id, principal_public_ref, subject_pairwise_ref, display_label, cartridge_flags, passport_status, granted_scope, consent_ref, created_at, expires_at',
      )
      .eq('token_hash', sha256(bearer))
      .maybeSingle();
    if (error || !data) return null;
    if (data.session_kind !== 'human') return null;
    if (data.status !== 'active') return null;
    if (isSessionExpired(data.expires_at)) return null;
    // best-effort touch (never blocks resolution)
    void admin.from(TABLE).update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
    return projectSessionQube({
      sessionId: data.id,
      clientId: data.client_id ?? '',
      sub: data.subject_pairwise_ref ?? data.principal_public_ref ?? '',
      personaPublicRef: data.principal_public_ref ?? null,
      displayLabel: data.display_label ?? null,
      cartridgeFlags: (data.cartridge_flags as SessionCartridgeFlags | null) ?? null,
      passportStatus: (data.passport_status as PassportStatusClaim | null) ?? null,
      claims: data.granted_scope ?? [],
      consentRef: data.consent_ref ?? null,
      issuedAt: data.created_at ?? null,
      expiresAt: data.expires_at ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[access-gateway] resolveHumanBearer degraded to unauthenticated:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Revoke (logout) a human session by its bearer. Status flip only — the
 *  substrate's revocation semantics. Always safe to call; returns whether an
 *  active human session was actually revoked. */
export async function revokeHumanBearer(bearer: string | null | undefined): Promise<boolean> {
  if (!bearer) return false;
  try {
    const admin = getSupabaseServer();
    if (!admin) return false;
    const { data, error } = await admin
      .from(TABLE)
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('token_hash', sha256(bearer))
      .eq('session_kind', 'human')
      .eq('status', 'active')
      .select('id');
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ── Claim-source resolution (server-side only; consumes existing spine
//    primitives — never re-derives them) ─────────────────────────────────────

/**
 * The per-RP subject reference (PRD-PAG-001 §0.2): derivePairwiseRef via the
 * EXISTING issueExternalRef path (persona_external_refs-backed — revocable,
 * regenerable, recovery-listed in the wallet), audience = the registered
 * client_id. Falls back to the Polity Public Reference when pairwise refs are
 * disabled (PERSONA_PAIRWISE_REF_SECRET unset) — permitted for first-party
 * Phase 1 per §5 ("personaPublicRef ✅ for first-party / in-Polity RPs").
 * The personaId parameter is T0 and NEVER leaves this function.
 */
export async function resolveHumanSubjectRef(personaId: string, clientId: string): Promise<string> {
  if (pairwiseRefsEnabled()) {
    try {
      const admin = getSupabaseServer();
      if (admin) {
        const ref = await issueExternalRef(admin, personaId, clientId);
        return ref.ref;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[access-gateway] pairwise subject issuance failed — falling back to public ref:', e instanceof Error ? e.message : e);
    }
  }
  return personaPublicRef(personaId);
}

/** T1 display label snapshot — the persona row's display_name (browser-safe by
 *  definition; already surfaced on the T1 active-persona surface). */
export async function fetchDisplayLabel(personaId: string): Promise<string | null> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from('personas')
      .select('display_name')
      .eq('id', personaId)
      .maybeSingle();
    if (error || !data) return null;
    return (data.display_name as string | null) ?? null;
  } catch {
    return null;
  }
}

/** T2 public-safe passport status snapshot — the same field discipline as the
 *  passport wallet route / passportCredential.ts (class, statuses, grade,
 *  validity — never persona_id/kybe/root identifiers). Soft-fail null. */
export async function resolvePassportStatusClaim(personaId: string): Promise<PassportStatusClaim | null> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from('polity_passport_records')
      .select('passport_class, citizen_status, participant_status, passport_grade, revoked, expires_at')
      .eq('persona_id', personaId)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      passportClass: data.passport_class ?? null,
      citizenStatus: data.citizen_status ?? null,
      participantStatus: data.participant_status ?? null,
      passportGrade: data.passport_grade ?? null,
      revoked: Boolean(data.revoked),
      expiresAt: data.expires_at ?? null,
    };
  } catch {
    return null;
  }
}
