/**
 * ContentQube score derivation (v1).
 *
 * Per the 2026-05-31 backlog item rules:
 *   - sensitivity from gating_kind: open→1, payment→5, token→7,
 *     persona/did/allowlist/role→8, custom→8
 *   - risk: free+public→1, token-gated+private→7, private creative→6
 *   - accuracy: canonized→9, semi_minted/draft→5
 *   - verifiability: chain_minted→10, canonized→9, draft→4
 *
 * Reads from content_qubes + content_qube_access_policies. Returns
 * results for every content_qube row.
 */

import { createClient } from '@supabase/supabase-js';
import type { DerivationResult } from './types';
import { clampAxis } from './types';

const STRATEGY = 'content_qube_v1';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function sensitivityFromGating(gating_kind: string | null): number {
  switch (gating_kind) {
    case 'open': case 'free':              return 1;
    case 'payment':                        return 5;
    case 'token':                          return 7;
    case 'persona': case 'did': case 'allowlist': case 'role': return 8;
    case 'custom':                         return 8;
    default:                               return 5;
  }
}

function riskFromGatingAndLifecycle(
  gating_kind: string | null,
  lifecycle_state: string,
): number {
  const isCanonized = lifecycle_state === 'canonized' || lifecycle_state === 'chain_minted';
  const isOpen = gating_kind === 'open' || gating_kind === 'free' || !gating_kind;
  if (isOpen && isCanonized) return 1;
  if (gating_kind === 'token' && !isCanonized) return 7;
  if (gating_kind === 'persona' || gating_kind === 'did') return 6;
  return 4;
}

function accuracyFromLifecycle(lifecycle_state: string): number {
  switch (lifecycle_state) {
    case 'canonized':
    case 'chain_minted':
      return 9;
    case 'semi_minted':
    case 'review_ready':
    case 'canon_pending':
      return 5;
    case 'draft':
      return 3;
    case 'superseded':
    case 'archived':
      return 7;
    default:
      return 5;
  }
}

function verifiabilityFromLifecycle(lifecycle_state: string): number {
  switch (lifecycle_state) {
    case 'chain_minted': return 10;
    case 'canonized':    return 9;
    case 'semi_minted': case 'review_ready': case 'canon_pending': return 6;
    case 'draft':        return 4;
    default:             return 5;
  }
}

export async function deriveContentQubeScores(): Promise<DerivationResult[]> {
  const sb = client();

  // Get content_qubes rows that have iqube_id_map entries (Stage 2 backfill
  // populated these; content_qubes.id === iqube_id_map.iqube_id for this source).
  const { data: cqs } = await sb
    .from('content_qubes')
    .select('id, lifecycle_state, content_kind');
  if (!cqs || cqs.length === 0) return [];

  // Pull access policies in bulk for gating_kind
  const ids = cqs.map((r) => (r as { id: string }).id);
  const { data: policies } = await sb
    .from('content_qube_access_policies')
    .select('qube_id, gating_kind')
    .in('qube_id', ids);
  const gatingByQube = new Map<string, string | null>();
  for (const p of policies ?? []) {
    const pr = p as { qube_id: string; gating_kind: string | null };
    gatingByQube.set(pr.qube_id, pr.gating_kind);
  }

  // Build results. Iqube_id == content_qubes.id for this primitive.
  return cqs.map((row) => {
    const r = row as { id: string; lifecycle_state: string; content_kind: string };
    const gating = gatingByQube.get(r.id) ?? null;
    return {
      iqube_id: r.id,
      strategy: STRATEGY,
      scores: {
        sensitivity: clampAxis(sensitivityFromGating(gating)),
        accuracy: clampAxis(accuracyFromLifecycle(r.lifecycle_state)),
        verifiability: clampAxis(verifiabilityFromLifecycle(r.lifecycle_state)),
        risk: clampAxis(riskFromGatingAndLifecycle(gating, r.lifecycle_state)),
      },
    };
  });
}
