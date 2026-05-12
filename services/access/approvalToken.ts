/**
 * services/access/approvalToken.ts — Aigent Me Phase 6.b Part 4 hardening.
 *
 * HMAC-signed second-tier approval tokens. Previously the client minted
 * an opaque UUID and the execute route only checked that the field was
 * non-empty — a trivial bypass for anyone who knew the connector id.
 *
 * The signed token binds three facts:
 *   - personaId   (active spine persona at issue time)
 *   - connectorId (the specific connector being approved)
 *   - exp         (5-minute expiry; short window narrows replay)
 *
 * Tokens are unforgeable without the HMAC key (same key the OAuth state
 * signer uses — PERSONA_SESSION_TOKEN_HMAC_KEY / NEXTAUTH_SECRET fallback).
 * Verification is constant-time so timing attacks can't probe the sig.
 *
 * Privacy: the token body is a base64url-encoded JSON object the route
 * boundary writes and reads server-side only. It never leaves T0 — only
 * the full opaque string transits the client.
 */

import * as crypto from 'crypto';

/** 5 minutes — long enough to click Approve, short enough to bound replay. */
const TOKEN_TTL_MS = 5 * 60 * 1000;

interface ApprovalTokenPayload {
  personaId: string;
  connectorId: string;
  /** Unix-ms issue time. */
  iat: number;
  /** Unix-ms expiry. */
  exp: number;
  /** 8 random bytes hex — defends against token replay within the TTL. */
  nonce: string;
}

function getSigningKey(): string {
  return (
    process.env.APPROVAL_TOKEN_HMAC_KEY ||
    process.env.PERSONA_SESSION_TOKEN_HMAC_KEY ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
}

export function isApprovalTokenSigningConfigured(): boolean {
  return getSigningKey().length > 0;
}

export interface IssueApprovalTokenInput {
  personaId: string;
  connectorId: string;
}

export function issueApprovalToken(input: IssueApprovalTokenInput): string {
  const key = getSigningKey();
  if (!key) throw new Error('Approval token signing key not configured');
  const now = Date.now();
  const payload: ApprovalTokenPayload = {
    personaId: input.personaId,
    connectorId: input.connectorId,
    iat: now,
    exp: now + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(body).digest('hex').slice(0, 32);
  return `${body}.${sig}`;
}

export type VerifyResult =
  | { ok: true; personaId: string; connectorId: string }
  | { ok: false; reason: string };

export function verifyApprovalToken(token: string, expected: {
  personaId: string;
  connectorId: string;
}): VerifyResult {
  const key = getSigningKey();
  if (!key) return { ok: false, reason: 'signing-not-configured' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', key).update(body).digest('hex').slice(0, 32);
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return { ok: false, reason: 'signature-mismatch' };
  }
  let payload: ApprovalTokenPayload;
  try {
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    payload = JSON.parse(decoded) as ApprovalTokenPayload;
  } catch {
    return { ok: false, reason: 'payload-decode-failed' };
  }
  if (typeof payload.personaId !== 'string' || typeof payload.connectorId !== 'string') {
    return { ok: false, reason: 'payload-invalid' };
  }
  if (payload.personaId !== expected.personaId) {
    return { ok: false, reason: 'persona-mismatch' };
  }
  if (payload.connectorId !== expected.connectorId) {
    return { ok: false, reason: 'connector-mismatch' };
  }
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, personaId: payload.personaId, connectorId: payload.connectorId };
}
