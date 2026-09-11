/**
 * sessionQube.ts — the SessionQube: PRD-PAG-001 §4's formalization of the
 * Session level that CFS-024's constitutional identity hierarchy already names
 * (… → Sessions → Tasks). PURE module — no DB imports, no env reads beyond
 * node crypto — so the canary suite (tests/access-gateway-human-session.test.ts)
 * exercises it without a backend.
 *
 * The SessionQube is a PROJECTION of the shared gateway session substrate
 * (agent_gateway_sessions, human row shape — migration 20260813000000) into the
 * T1/T2-only payload a relying party receives. It composes what exists — it is
 * NOT a parallel session system (PRD-PAG-001 §4 rule).
 *
 * Tier law (PRD-PAG-001 §5, CLAUDE.md five-forbidden-fields): the projected
 * payload carries ONLY:
 *   - sub                — T2 pairwise ref (derivePairwiseRef) or personaPublicRef fallback
 *   - personaPublicRef   — T2 (claim-gated; first-party / in-Polity RPs)
 *   - displayLabel       — T1 (claim-gated)
 *   - cartridgeFlags     — T1 (claim-gated; optimistic UI only — server re-validates)
 *   - passportStatus     — T2 public-safe passport fields (claim-gated)
 *   - claims/scope, clientId, consentRef, issuedAt/expiresAt — T2
 * and NEVER personaId, authProfileId, rootDid, kybeAttestation, or any
 * fioHandle. A payload containing any of those is a critical identity
 * infraction, not a bug.
 *
 * SessionQube receipting (§4.1 "constitutional receipt hash") is NOT assigned
 * to Phase 1 by the PRD's §7 phase list — deliberately unbuilt here.
 */

import { createHash } from 'crypto';

/** The claim vocabulary a relying party may request in Phase 1. */
export const HUMAN_SESSION_CLAIMS = [
  'sub',
  'persona_public_ref',
  'display_label',
  'cartridge_flags',
  'passport_status',
] as const;

export type HumanSessionClaim = (typeof HUMAN_SESSION_CLAIMS)[number];

/** T1 cartridge-role snapshot — slugs + booleans only (mirrors the spine's
 *  cartridgeFlags surface; optimistic UI only, server re-validates every gate). */
export interface SessionCartridgeFlags {
  isAdmin: boolean;
  isPartner: boolean;
  adminCartridges: string[];
}

/** T2 public-safe passport status snapshot — the passportCredential.ts
 *  discipline: commitment/status/validity fields only, never the raw record. */
export interface PassportStatusClaim {
  passportClass: string | null;
  citizenStatus: string | null;
  participantStatus: string | null;
  passportGrade: string | null;
  revoked: boolean;
  expiresAt: string | null;
}

/** The human consent act, as recorded server-side. T2 refs only — the subject
 *  is referenced by its pairwise/public ref, NEVER a raw persona UUID. */
export interface ConsentRecord {
  clientId: string;
  grantedClaims: string[];
  /** T2 — the pairwise subject ref (or personaPublicRef fallback). */
  subjectRef: string;
  approvedAt: string;
}

/**
 * The SessionQube — the constitutional session object a relying party receives
 * from GET /api/access-gateway/session. T1/T2 only (see module header).
 */
export interface SessionQube {
  qube: 'session';
  /** The gateway session row id — a session handle, not a persona identifier. */
  sessionRef: string;
  /** Which presentation adapter issued it (PRD-PAG-001 §2.1). */
  channel: 'human-web';
  /** T2 pairwise subject ref for this client (or personaPublicRef fallback). */
  sub: string;
  /** T2 governed-Polity handle — present only when the claim was granted. */
  personaPublicRef?: string;
  /** T1 — present only when the claim was granted. */
  displayLabel?: string | null;
  /** T1 — present only when the claim was granted. */
  cartridgeFlags?: SessionCartridgeFlags | null;
  /** T2 public-safe — present only when the claim was granted. */
  passportStatus?: PassportStatusClaim | null;
  /** The claims the human actually consented to. */
  claims: string[];
  clientId: string;
  /** sha256/16-hex commitment of the consent record. */
  consentRef: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
}

/**
 * Normalize a requested-claims input (space-separated string, or array) to the
 * allowed vocabulary. Unknown claims are DROPPED (never granted by accident);
 * `sub` is always included — a session without a subject is meaningless.
 */
export function filterRequestedClaims(raw: unknown): HumanSessionClaim[] {
  const requested = new Set<string>(
    Array.isArray(raw)
      ? raw.filter((c): c is string => typeof c === 'string')
      : typeof raw === 'string'
        ? raw.split(/[\s,]+/).filter(Boolean)
        : [],
  );
  requested.add('sub');
  // Preserve canonical vocabulary order for a stable consent display.
  return HUMAN_SESSION_CLAIMS.filter((c) => requested.has(c));
}

/**
 * Consent gate — the pure core of "consent required before issuance".
 * Returns null when the human did NOT approve (the caller must refuse to issue
 * anything); otherwise the granted claims = the already-filtered requested
 * claims, never more (`sub` guaranteed).
 */
export function resolveGrantedClaims(
  requestedClaims: string[],
  approved: boolean,
): string[] | null {
  if (!approved) return null;
  const granted = filterRequestedClaims(requestedClaims);
  return granted.length > 0 ? granted : ['sub'];
}

/** Expiry check shared by resolution paths. A null expiry never expires
 *  (substrate semantics — TTL is always set on human rows in practice). */
export function isSessionExpired(expiresAt: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return true; // malformed expiry fails CLOSED
  return t < nowMs;
}

/** sha256/16-hex commitment of a consent record — deterministic, one-way,
 *  T2-safe (same derivation class as the platform's commitment refs). */
export function consentCommitment(record: ConsentRecord): string {
  const canonical = JSON.stringify({
    clientId: record.clientId,
    grantedClaims: [...record.grantedClaims].sort(),
    subjectRef: record.subjectRef,
    approvedAt: record.approvedAt,
  });
  return createHash('sha256').update('pag:consent:' + canonical).digest('hex').slice(0, 16);
}

export interface SessionQubeInput {
  sessionId: string;
  clientId: string;
  sub: string;
  personaPublicRef: string | null;
  displayLabel: string | null;
  cartridgeFlags: SessionCartridgeFlags | null;
  passportStatus: PassportStatusClaim | null;
  claims: string[];
  consentRef: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
}

/**
 * Project a human gateway session row into the SessionQube the RP receives.
 * Minimum disclosure: claim-gated fields are included ONLY when the human
 * granted that claim — an ungranted claim is absent, not null.
 */
export function projectSessionQube(input: SessionQubeInput): SessionQube {
  const granted = new Set(input.claims);
  const qube: SessionQube = {
    qube: 'session',
    sessionRef: input.sessionId,
    channel: 'human-web',
    sub: input.sub,
    claims: [...input.claims],
    clientId: input.clientId,
    consentRef: input.consentRef,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  };
  if (granted.has('persona_public_ref') && input.personaPublicRef) {
    qube.personaPublicRef = input.personaPublicRef;
  }
  if (granted.has('display_label')) qube.displayLabel = input.displayLabel;
  if (granted.has('cartridge_flags')) qube.cartridgeFlags = input.cartridgeFlags;
  if (granted.has('passport_status')) qube.passportStatus = input.passportStatus;
  return qube;
}
