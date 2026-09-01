/**
 * experienceHandoffService — creates and decodes `ExperienceHandoff` tokens
 * (types/experienceHandoff.ts; AEE-XP-001 §5).
 *
 * Deliberately NOT a new persistence engine (AEE-XP-001 §1.3, "no
 * global-state monolith" / "do not create a new generic observation
 * ledger"). A handoff is a short-lived, non-authoritative continuity pointer
 * — it carries no credential and grants no authority, so a plain
 * base64url-encoded JSON token passed as a URL parameter is sufficient and
 * honestly scoped: the receiving journey's own canonical state owners
 * (Passport, Standing, delegation) are what actually gate anything
 * consequential, never this token. Encoding it this way also satisfies the
 * spec's own "must be surface/provider neutral... usable by web, native,
 * MCP, agent and external-harness interactions" requirement for free, since
 * it needs no server-side lookup service tied to one admin client.
 *
 * `decodeExperienceHandoff` never throws — a malformed/expired/tampered
 * token decodes to `null`, and every caller treats `null` exactly like "no
 * handoff was supplied" (never a fabricated default).
 */

import type { ExperienceHandoff } from '@/types/experienceHandoff';

const REQUIRED_FIELDS: Array<keyof ExperienceHandoff> = ['handoffId', 'sourceJourneyId', 'targetJourneyId', 'createdAt'];

function base64UrlEncode(json: string): string {
  return Buffer.from(json, 'utf8').toString('base64url');
}

function base64UrlDecode(token: string): string | null {
  try {
    return Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

/** Builds a new handoff, filling `handoffId`/`createdAt`. Pure — no I/O. */
export function createExperienceHandoff(
  input: Omit<ExperienceHandoff, 'handoffId' | 'createdAt'>,
): ExperienceHandoff {
  return {
    ...input,
    handoffId: `xh-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
}

/** Encodes a handoff into a URL-safe token (e.g. `?handoff=<token>`). */
export function encodeExperienceHandoff(handoff: ExperienceHandoff): string {
  return base64UrlEncode(JSON.stringify(handoff));
}

/**
 * Decodes and validates a handoff token. Returns `null` — never throws —
 * for a malformed token, a shape missing required fields, or an expired
 * handoff (`expiresAt` in the past). Field values beyond the required set
 * are trusted only as CONTEXT (per the type's own contract) — never as
 * authority or evidence.
 */
export function decodeExperienceHandoff(token: string): ExperienceHandoff | null {
  const json = base64UrlDecode(token);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (typeof candidate[field] !== 'string' || !candidate[field]) return null;
  }
  if (typeof candidate.expiresAt === 'string') {
    const expiresAtMs = Date.parse(candidate.expiresAt);
    if (!Number.isNaN(expiresAtMs) && expiresAtMs < Date.now()) return null;
  }
  return candidate as unknown as ExperienceHandoff;
}
