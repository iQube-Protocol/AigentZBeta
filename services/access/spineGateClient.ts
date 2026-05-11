/**
 * Client-side helper for calling the access spine from React components.
 *
 * Phase 1.4 of the unified IAM foundation plan. Migrated to PersonaSpine
 * 2026-05-12 (per docs/architecture/persona-spine-client-protocol.md
 * adoption sweep — first migration target).
 *
 * Used by:
 *   - SmartContentActionContext  (consult before 'buy' to avoid charging owners)
 *   - RemixDialog                (surface ownership state)
 *   - KnytTab                    (replace fetchOwnedEpisodes)
 *
 * Wraps the production-facing /api/access/evaluate endpoint with:
 *   - PersonaSpine-driven Bearer attach (no localStorage scan; no
 *     supabase-js getSession() AuthApiError on stale refresh)
 *   - Fail-open behaviour: any error returns null so callers can fall
 *     through to legacy paths rather than block the user
 *
 * Privacy contract: the request carries the JWT (T0 -> server-resolves
 * to T0 personaId server-side); the response carries only the decision
 * (no T0 leak).
 *
 * NOT a server-side helper. Do not import from API routes — those should
 * call evaluateAccess directly from `services/access/evaluateAccess.ts`.
 */

"use client";

import { personaFetch } from "@/utils/personaSpine";

export interface SpineDecision {
  allow: boolean;
  reason: string;
  deliveryMode: string;
  expiresAt?: string;
}

export type SpineAction =
  | 'read' | 'watch' | 'listen' | 'invoke' | 'connect' | 'remix'
  | 'mint' | 'transfer' | 'payment-settle' | 'policy-escalation' | 'disclosure';

/**
 * Fetch the spine's decision for the active persona against the given
 * asset. Returns null on any error (fail-open). Callers must treat null
 * as 'unknown — fall through to legacy behaviour' rather than as 'deny'.
 *
 * @param cidOrAssetId  Autonomys CID, Supabase URL, or canonical assetId.
 *                      The /api/access/evaluate route falls back between
 *                      lookup paths automatically.
 * @param action        Default 'read'.
 */
export async function checkSpineDecision(
  cidOrAssetId: string,
  action: SpineAction = 'read',
): Promise<SpineDecision | null> {
  if (!cidOrAssetId) return null;
  try {
    const url = `/api/access/evaluate?cid=${encodeURIComponent(cidOrAssetId)}&action=${encodeURIComponent(action)}`;
    const res = await personaFetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<SpineDecision>;
    if (typeof data?.allow !== 'boolean' || typeof data?.reason !== 'string') return null;
    return {
      allow: data.allow,
      reason: data.reason,
      deliveryMode: data.deliveryMode ?? 'plain-redirect',
      expiresAt: data.expiresAt,
    };
  } catch {
    return null;
  }
}

/** Convenience: returns true if the spine says the active persona owns the asset. */
export async function isSpineOwned(cidOrAssetId: string): Promise<boolean> {
  const decision = await checkSpineDecision(cidOrAssetId, 'read');
  return !!(decision?.allow && decision.reason === 'owned');
}
