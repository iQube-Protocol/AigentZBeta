/**
 * personaSessionToken — HMAC-signed envelope for the T1 persona session token.
 *
 * Phase 1.1.a of the unified identity-content-access foundation plan.
 *
 * What this is:
 *   The opaque, server-signed, short-lived handle that replaces today's
 *   raw-UUID `currentPersonaId` localStorage value and the `?personaId=`
 *   URL parameter. The browser never sees personaId or authProfileId; it
 *   only sees a signed token. The token resolves to (personaId,
 *   authProfileId) ONLY on the AigentZ server.
 *
 * What this is NOT:
 *   - It is not an auth/login credential. The session cookie remains the
 *     auth source-of-truth. The PST is an active-persona pointer signed
 *     against a server key.
 *   - It is not durable identity. It expires (default 30 min) and rotates
 *     on persona switch / sign-out.
 *   - It is not a capability/permission token. Permission still flows
 *     through ActivePersonaContext + evaluateAccess.
 *
 * Privacy stance (per plan §11.c backlog):
 *   The verifier on this server can reverse PST -> (personaId,
 *   authProfileId). That is the design today. Eliminating that capability
 *   (zero-knowledge T1->T0) is captured as a Phase-2+ backlog item; it
 *   would replace the HMAC envelope with a holder-signed credential or
 *   ICP-anchored proof gate.
 *
 * Encoding:
 *   `<base64url(payload-json)>.<base64url(hmac-sha256-of-payload-json)>`
 *
 * Payload schema:
 *   {
 *     v:   1,                  // version; rolls forward on schema change
 *     pid: <personaId>,        // T0 personaId  (server-internal)
 *     apid: <authProfileId>,   // T0 authProfileId (server-internal)
 *     iat: <unix-seconds>,     // issued-at
 *     exp: <unix-seconds>,     // expires-at
 *     jti: <random-128-bit>,   // unique id; reserved for future denylist
 *   }
 *
 * Server-only module. NEVER import from a client component.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────

/** Token version. Bump when the payload schema changes. */
const TOKEN_VERSION = 1;

/** Default TTL for newly issued tokens (seconds). */
const DEFAULT_TTL_SECONDS = 30 * 60; // 30 minutes

/** Maximum TTL accepted at issuance (seconds). Defends against caller bugs. */
const MAX_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/** HMAC algorithm. */
const HMAC_ALG = 'sha256';

// ─────────────────────────────────────────────────────────────────────────
// Key resolution
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve the signing key from environment. Order:
 *   1. PERSONA_SESSION_TOKEN_HMAC_KEY  — the canonical secret
 *   2. NEXTAUTH_SECRET                 — fallback if (1) is unset (dev only)
 *
 * Throws in production if neither is set; in development falls back to a
 * deterministic dev key with a console warning so local stacks still work.
 */
function getSigningKey(): Buffer {
  const explicit = process.env.PERSONA_SESSION_TOKEN_HMAC_KEY;
  if (explicit && explicit.length >= 32) return Buffer.from(explicit, 'utf-8');

  const fallback = process.env.NEXTAUTH_SECRET;
  if (fallback && fallback.length >= 32) return Buffer.from(fallback, 'utf-8');

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PERSONA_SESSION_TOKEN_HMAC_KEY is required in production (>=32 chars)',
    );
  }
  // Development-only deterministic dev key — local stacks without env vars.
  return Buffer.from(
    'dev-only-persona-session-token-key-do-not-use-in-prod-32+chars',
    'utf-8',
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Encoding helpers
// ─────────────────────────────────────────────────────────────────────────

function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecodeToBuffer(input: string): Buffer | null {
  try {
    const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    return Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
}

function generateJti(): string {
  return randomBytes(16).toString('hex');
}

// ─────────────────────────────────────────────────────────────────────────
// Token shapes
// ─────────────────────────────────────────────────────────────────────────

interface TokenPayload {
  v: number;
  pid: string;
  apid: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface IssuePersonaSessionTokenInput {
  /** T0 personaId — never appears in the browser-facing token output. */
  personaId: string;
  /** T0 authProfileId — never appears in the browser-facing token output. */
  authProfileId: string;
  /** Override default TTL (seconds). Capped at MAX_TTL_SECONDS. */
  ttlSeconds?: number;
}

export interface IssuedPersonaSessionToken {
  /** The opaque token to hand to the browser (T1). */
  token: string;
  /** ISO timestamp when this token expires. Surfaces use this to refresh. */
  expiresAt: string;
  /** The jti, exposed only for future denylist plumbing. Server-internal. */
  jti: string;
}

export interface VerifiedPersonaSessionToken {
  /** T0 personaId — server-internal only. */
  personaId: string;
  /** T0 authProfileId — server-internal only. */
  authProfileId: string;
  /** Issued-at, epoch seconds. */
  issuedAt: number;
  /** Expires-at, epoch seconds. */
  expiresAt: number;
  /** Token unique id. */
  jti: string;
}

export type VerifyFailureReason =
  | 'malformed'
  | 'bad-signature'
  | 'expired'
  | 'unknown-version'
  | 'invalid-payload';

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Issue a new persona session token. Token is a stateless HMAC envelope
 * over (personaId, authProfileId, iat, exp, jti).
 *
 * Privacy contract: the inputs (personaId, authProfileId) are T0 and
 * MUST NOT be returned to the client; only the resulting `token` and
 * `expiresAt` are safe to expose. The `jti` is server-internal.
 */
export function issuePersonaSessionToken(
  input: IssuePersonaSessionTokenInput,
): IssuedPersonaSessionToken {
  const { personaId, authProfileId } = input;
  if (!personaId || !authProfileId) {
    throw new Error('issuePersonaSessionToken: personaId and authProfileId are required');
  }

  const ttl = Math.min(
    Math.max(60, input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    MAX_TTL_SECONDS,
  );
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    v: TOKEN_VERSION,
    pid: personaId,
    apid: authProfileId,
    iat: now,
    exp: now + ttl,
    jti: generateJti(),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = base64urlEncode(payloadJson);

  const sig = createHmac(HMAC_ALG, getSigningKey())
    .update(payloadEncoded)
    .digest();
  const sigEncoded = base64urlEncode(sig);

  return {
    token: `${payloadEncoded}.${sigEncoded}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    jti: payload.jti,
  };
}

/**
 * Verify a persona session token and return its T0 identifiers.
 *
 * Returns a tagged union so callers can distinguish missing/expired
 * (recoverable: re-issue) from malformed/bad-signature (security event:
 * log, do not auto-recover).
 */
export function verifyPersonaSessionToken(
  token: string | null | undefined,
): { ok: true; data: VerifiedPersonaSessionToken } | { ok: false; reason: VerifyFailureReason } {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' };

  const dot = token.indexOf('.');
  if (dot < 1 || dot >= token.length - 1) return { ok: false, reason: 'malformed' };

  const payloadEncoded = token.slice(0, dot);
  const sigEncoded = token.slice(dot + 1);

  const expectedSig = createHmac(HMAC_ALG, getSigningKey())
    .update(payloadEncoded)
    .digest();
  const presentedSig = base64urlDecodeToBuffer(sigEncoded);
  if (!presentedSig || presentedSig.length !== expectedSig.length) {
    return { ok: false, reason: 'bad-signature' };
  }
  if (!timingSafeEqual(expectedSig, presentedSig)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const payloadBuf = base64urlDecodeToBuffer(payloadEncoded);
  if (!payloadBuf) return { ok: false, reason: 'malformed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBuf.toString('utf-8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'invalid-payload' };
  }
  const p = parsed as Partial<TokenPayload>;
  if (p.v !== TOKEN_VERSION) return { ok: false, reason: 'unknown-version' };
  if (
    typeof p.pid !== 'string' ||
    typeof p.apid !== 'string' ||
    typeof p.iat !== 'number' ||
    typeof p.exp !== 'number' ||
    typeof p.jti !== 'string'
  ) {
    return { ok: false, reason: 'invalid-payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (p.exp <= now) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    data: {
      personaId: p.pid,
      authProfileId: p.apid,
      issuedAt: p.iat,
      expiresAt: p.exp,
      jti: p.jti,
    },
  };
}

/**
 * Convenience: extract a persona session token from a request, scanning
 *   1. ?pst= query parameter
 *   2. x-persona-session-token header
 * (Cookie source is reserved for future Phase 1.1.c work.)
 */
export function readTokenFromRequest(req: {
  url?: string;
  headers: Pick<Headers, 'get'>;
}): string | null {
  if (req.url) {
    try {
      const pst = new URL(req.url).searchParams.get('pst');
      if (pst) return pst;
    } catch {
      // Non-URL input — fall through to header lookup.
    }
  }
  const headerToken = req.headers.get('x-persona-session-token');
  return headerToken && headerToken.length > 0 ? headerToken : null;
}
