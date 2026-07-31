/**
 * registerVentureIqube — register a VentureQube in the iQube registry SoT as a
 * ClusterQube specialization (the global source of truth).
 *
 * A VentureQube is an iQube of primitive type ClusterQube — a venture is a
 * cluster of member iQubes (its associated content/data/agent qubes and, when
 * graduated, its cartridge trio). This writes the trinity meta record + the
 * canonical iqube_id_map row (primitive_type='ClusterQube') so the venture
 * shows up as a registered iQube, and records per-persona ownership.
 *
 * T0-T2 discipline (mirrors registerPersonaIqube):
 *   - The meta record (public) carries ONLY a T2-safe venture_public_ref
 *     commitment + member iQube ids. NO owner persona_id, NO BlakQube bytes.
 *   - persona_token_qube_ownership.persona_id is T0 (service-role RLS only).
 *
 * Best-effort + idempotent: returns the existing iqube_id when the venture row
 * already carries one, and never throws into the caller flow.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMetaQube } from '@/server/services/iqRegistryService';

export interface RegisterVentureIqubeInput {
  admin: SupabaseClient;
  /** venture_qubes.id (server-internal row id). */
  ventureRowId: string;
  /** T0 — owner persona id. Recorded in ownership only; never in the meta. */
  ownerPersonaId: string;
  ventureName: string;
  ventureSlug: string;
  /** Member iQube ids this venture clusters (T2-safe canonical UUIDs). */
  memberIqubeIds?: string[];
}

export interface RegisterVentureIqubeResult {
  iqubeId: string;
  venturePublicRef: string;
  created: boolean;
}

/** Deterministic, one-way T2-safe commitment over the venture row id. */
export function deriveVenturePublicRef(ventureRowId: string): string {
  return createHash('sha256').update('venture:' + ventureRowId).digest('hex').slice(0, 16);
}

export async function registerVentureIqube(
  input: RegisterVentureIqubeInput,
): Promise<RegisterVentureIqubeResult | null> {
  const { admin, ventureRowId, ownerPersonaId, ventureName, ventureSlug } = input;
  const venturePublicRef = deriveVenturePublicRef(ventureRowId);
  try {
    // Idempotency — reuse the registry entry already linked to this venture.
    const { data: existing } = await admin
      .from('venture_qubes')
      .select('iqube_id')
      .eq('id', ventureRowId)
      .maybeSingle();
    if (existing?.iqube_id) {
      return { iqubeId: String(existing.iqube_id), venturePublicRef, created: false };
    }

    // 1. Public meta record (T2-safe — commitment + member refs only).
    const metaQubeId = await createMetaQube({
      name: `VentureQube ${venturePublicRef}`,
      slug: `ventureqube-${venturePublicRef}`,
      qubeType: 'ClusterQube',
      tags: ['venture', 'ventureqube', 'founder-office'],
      description:
        'VentureQube — public meta only; the venture-formation payload (13 layers) lives in venture_qubes under service-role RLS.',
      metadata: {
        kind: 'venture',
        venture_public_ref: venturePublicRef,
        cluster: {
          member_iqubes: (input.memberIqubeIds ?? []).map((id) => ({
            iqube_id: id,
            role: 'dependency' as const,
          })),
          policy_aggregation: 'explicit',
          access_propagation: 'members_grant_cluster',
          revocation_propagation: 'cluster_only',
        },
        visibility: 'public_meta_private_payload',
      },
    });

    // 2. Canonical id-map row (the registry SoT join) — ClusterQube.
    const { data: mapRow, error: mapErr } = await admin
      .from('iqube_id_map')
      .insert({
        source: 'triad_meta',
        source_id: metaQubeId,
        primitive_type: 'ClusterQube',
        notes: `VentureQube ${venturePublicRef}`,
      })
      .select('iqube_id')
      .single();
    if (mapErr || !mapRow?.iqube_id) {
      return null;
    }
    const iqubeId = String(mapRow.iqube_id);

    // 3. Per-persona ownership (read substrate for userOwnsAsset). persona_id is T0.
    await admin
      .from('persona_token_qube_ownership')
      .insert({
        persona_id: ownerPersonaId,
        token_qube_id: `venture:${venturePublicRef}`,
        iqube_id: iqubeId,
        chain_anchor: { kind: 'venture', venture_public_ref: venturePublicRef },
        source: 'mint',
      })
      .select('ownership_id')
      .maybeSingle();

    // 4. Backlink the canonical UUID onto the venture row.
    await admin.from('venture_qubes').update({ iqube_id: iqubeId }).eq('id', ventureRowId);

    return { iqubeId, venturePublicRef, created: true };
  } catch {
    return null;
  }
}
