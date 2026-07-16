/**
 * Node flip-state store (CFS-035 Observatory amendment).
 *
 * An Invariant Decision Node runs in SHADOW by default (observe-only; the
 * incumbent heuristic is served). Flipping a node to AUTHORITATIVE makes the
 * runtime serve the node's projection. This is the operator-gated ratification
 * step (CFS-035 §11) — never automatic.
 *
 * Discipline:
 *  - Default is FAITHFUL: absent row (or table absent) ⇒ NOT authoritative ⇒
 *    the incumbent is served. Every read is guarded so the hot path degrades to
 *    shadow, never to an error.
 *  - `flipped_by_persona` is a T0 audit field — stored server-side, NEVER
 *    returned to the browser. The client-safe projection excludes it.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const TABLE = 'invariant_node_flips';

/** Client-safe flip projection — no personaId (T0 audit stays server-side). */
export interface NodeFlipState {
  nodeId: string;
  authoritative: boolean;
  rationale: string | null;
  flippedAt: string | null;
}

/**
 * Whether a node is authoritative (its projection is served). Hot-path safe:
 * guarded, defaults to FALSE (faithful — incumbent served) on any failure or
 * absent table/row.
 */
export async function isNodeAuthoritative(nodeId: string): Promise<boolean> {
  try {
    const client = getSupabaseServer();
    if (!client) return false;
    const { data, error } = await client
      .from(TABLE)
      .select('authoritative')
      .eq('node_id', nodeId)
      .maybeSingle();
    if (error || !data) return false;
    return data.authoritative === true;
  } catch {
    return false;
  }
}

// Per-node authoritative cache — the capsules route reads this on the hot path,
// so a short TTL avoids a DB round-trip per request. A flip takes effect within
// the TTL. Defaults faithful (false) on any miss.
const _authCache = new Map<string, { at: number; value: boolean }>();

/** Cached `isNodeAuthoritative` for the hot path (default TTL 30s). */
export async function isNodeAuthoritativeCached(nodeId: string, ttlMs = 30_000): Promise<boolean> {
  const now = Date.now();
  const c = _authCache.get(nodeId);
  if (c && now - c.at < ttlMs) return c.value;
  const value = await isNodeAuthoritative(nodeId).catch(() => false);
  _authCache.set(nodeId, { at: now, value });
  return value;
}

/** The client-safe flip state for a node, or null when unset. */
export async function getNodeFlip(nodeId: string): Promise<NodeFlipState | null> {
  try {
    const client = getSupabaseServer();
    if (!client) return null;
    const { data, error } = await client
      .from(TABLE)
      .select('node_id,authoritative,rationale,flipped_at')
      .eq('node_id', nodeId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      nodeId: String(data.node_id),
      authoritative: data.authoritative === true,
      rationale: (data.rationale as string) ?? null,
      flippedAt: data.flipped_at ? String(data.flipped_at) : null,
    };
  } catch {
    return null;
  }
}

/** All flip states (client-safe projection). */
export async function listNodeFlips(): Promise<NodeFlipState[]> {
  try {
    const client = getSupabaseServer();
    if (!client) return [];
    const { data, error } = await client.from(TABLE).select('node_id,authoritative,rationale,flipped_at');
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((d) => ({
      nodeId: String(d.node_id),
      authoritative: d.authoritative === true,
      rationale: (d.rationale as string) ?? null,
      flippedAt: d.flipped_at ? String(d.flipped_at) : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Set a node's flip state (operator-gated — the caller MUST have verified admin).
 * `personaId` is recorded as server-internal audit only. Returns false on failure
 * (e.g. table absent) so the API can report honestly.
 */
export async function setNodeFlip(input: {
  nodeId: string;
  authoritative: boolean;
  rationale?: string | null;
  personaId: string;
}): Promise<boolean> {
  try {
    const client = getSupabaseServer();
    if (!client) return false;
    const { error } = await client.from(TABLE).upsert(
      {
        node_id: input.nodeId,
        authoritative: input.authoritative,
        rationale: input.rationale ?? null,
        flipped_by_persona: input.personaId,
        flipped_at: new Date().toISOString(),
      },
      { onConflict: 'node_id' },
    );
    return !error;
  } catch {
    return false;
  }
}
