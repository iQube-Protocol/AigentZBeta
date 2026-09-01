/**
 * experienceHandoffService — creates and decodes `ExperienceHandoff` tokens
 * (types/experienceHandoff.ts; AEE-XP-001 §5).
 *
 * TERMINOLOGY, precisely (2026-09-01 correction): this is a VALIDATED,
 * NON-AUTHORITATIVE URL token — base64url-encoded JSON, shape-checked and
 * expiry-checked on decode. It is deliberately NOT cryptographically signed
 * or HMAC'd, and callers must not read it as tamper-evident (a base64url
 * blob is trivially editable by whoever holds the URL). That is fine, not a
 * gap to close later: the token carries no credential and grants no
 * authority — it is continuity/context only, and the receiving journey's
 * own canonical state owners (Passport, Standing, delegation) are what
 * actually gate anything consequential, never this token. Adding signing
 * here would be security theatre over a value that authorizes nothing; do
 * not add it merely for appearance.
 *
 * Deliberately NOT a new persistence engine (AEE-XP-001 §1.3, "no
 * global-state monolith" / "do not create a new generic observation
 * ledger") — a plain URL parameter needs no server-side lookup service tied
 * to one admin client, which also satisfies the spec's own "must be
 * surface/provider neutral... usable by web, native, MCP, agent and
 * external-harness interactions" requirement for free.
 *
 * `decodeExperienceHandoff` never throws — a malformed, shape-invalid, or
 * expired token decodes to `null`, and every caller treats `null` exactly
 * like "no handoff was supplied" (never a fabricated default).
 *
 * FUTURE CONSUMERS, required discipline: `returnJourneyId`/`targetJourneyId`
 * are caller-supplied strings from an unsigned token — any future "resume
 * the source journey" consumer MUST resolve them by looking up the id
 * against the actual Journey registry (the same way `JOURNEY_SURFACES`/each
 * journey's own definition is the source of truth today) and refuse an
 * id that doesn't resolve to a real, registered journey. Never treat the
 * value as, or use it to construct, a raw URL/redirect target directly —
 * that would let an unsigned token steer navigation to an arbitrary
 * destination.
 *
 * CLIENT-BUNDLE SAFETY (2026-09-01 correction — the same defect class that
 * broke this repo's build twice before, see journeyAeeOrchestrator.ts's own
 * header): both live callers of this module
 * (FinancialSovereigntyPrepareCrossStage.tsx, FinancialServicesBridgeFrontDoor.tsx)
 * are `'use client'`. The original encode/decode used `Buffer.from(...)` —
 * a Node global with no browser equivalent and no polyfill configured in
 * this repo's next.config.js (grep confirms `Buffer.from` appears nowhere
 * else outside `app/api/**` server routes). That silently threw
 * `ReferenceError: Buffer is not defined` in the actual browser: Cross's
 * onClick handler failed before its `window.location.href` navigation line
 * ever ran, and `/bridge/fs`'s decode effect failed silently into its own
 * catch block, treating every real handoff as if it were absent. Replaced
 * with `btoa`/`atob` + `TextEncoder`/`TextDecoder` — standard Web APIs,
 * global in both the browser and Node 18+ (this repo already targets Node
 * 20 — see CLAUDE.md's pdfjs-dist note), so no import, no polyfill, no
 * server/client split needed.
 */

import type { ExperienceHandoff } from '@/types/experienceHandoff';

const REQUIRED_FIELDS: Array<keyof ExperienceHandoff> = ['handoffId', 'sourceJourneyId', 'targetJourneyId', 'createdAt'];

function base64UrlEncode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(token: string): string | null {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
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
