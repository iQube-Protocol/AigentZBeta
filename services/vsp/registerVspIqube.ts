/**
 * registerVspIqube — mint a Verified Standing Asset as a citizen-owned sovereign
 * iQube in the registry SoT (Standing PRD Tier 2: "verification creates sovereign
 * assets, citizen-owned permanently").
 *
 * Mirrors registerPersonaIqube: a Verified Standing Asset is a DataQube. This
 * writes the public meta record (T2-safe — commitment + public refs only, NO
 * raw persona id, NO BlakQube facts), the canonical iqube_id_map row, and the
 * per-persona ownership record. The compiled VSP content stays server-side; only
 * a one-way commitment + the passport anchor's public ref travel in the meta.
 *
 * Best-effort + idempotent: returns the existing iqube_id when the profile
 * already carries one; never throws into the caller.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMetaQube } from '@/server/services/iqRegistryService';

export interface RegisterVspIqubeInput {
  admin: SupabaseClient;
  /** vsp_profiles.id (server-internal row id). */
  vspProfileId: string;
  /** T0 — owner persona id. Recorded in ownership only; never in the meta. */
  ownerPersonaId: string;
  vspLabel: string;
  profileType: string;
  /** T2-safe passport anchor public ref (already a commitment), if available. */
  kybeDidPublicRef?: string | null;
}

export interface RegisterVspIqubeResult {
  iqubeId: string;
  vspPublicRef: string;
  created: boolean;
}

/** Deterministic, one-way T2-safe commitment over the VSP profile id. */
export function deriveVspPublicRef(vspProfileId: string): string {
  return createHash('sha256').update('vsp:' + vspProfileId).digest('hex').slice(0, 16);
}

export async function registerVspIqube(
  input: RegisterVspIqubeInput,
): Promise<RegisterVspIqubeResult | null> {
  const { admin, vspProfileId, ownerPersonaId, vspLabel, profileType } = input;
  const vspPublicRef = deriveVspPublicRef(vspProfileId);
  try {
    // Idempotency — reuse the asset already linked to this profile.
    const { data: existing } = await admin
      .from('vsp_profiles')
      .select('iqube_id')
      .eq('id', vspProfileId)
      .maybeSingle();
    if (existing?.iqube_id) {
      return { iqubeId: String(existing.iqube_id), vspPublicRef, created: false };
    }

    // 1. Public meta record (T2-safe — commitment + public refs only).
    const metaQubeId = await createMetaQube({
      name: `Verified Standing ${vspPublicRef}`,
      slug: `standing-asset-${vspPublicRef}`,
      qubeType: 'DataQube',
      tags: ['standing', 'verified-standing', 'standing-asset'],
      description:
        'Verified Standing Asset — public meta only; the verified facts (BlakQube) stay in the citizen Standing vault.',
      metadata: {
        kind: 'verified-standing',
        vsp_public_ref: vspPublicRef,
        profile_type: profileType,
        kybe_did_public_ref: input.kybeDidPublicRef ?? null,
        visibility: 'public_meta_private_payload',
      },
    });

    // 2. Canonical id-map row (the registry SoT join).
    const { data: mapRow, error: mapErr } = await admin
      .from('iqube_id_map')
      .insert({
        source: 'triad_meta',
        source_id: metaQubeId,
        primitive_type: 'DataQube',
        notes: `Verified Standing ${vspPublicRef} (${profileType})`,
      })
      .select('iqube_id')
      .single();
    if (mapErr || !mapRow?.iqube_id) {
      return null;
    }
    const iqubeId = String(mapRow.iqube_id);

    // 3. Per-persona ownership — persona_id is T0. The asset is citizen-owned.
    await admin
      .from('persona_token_qube_ownership')
      .insert({
        persona_id: ownerPersonaId,
        token_qube_id: `standing:${vspPublicRef}`,
        iqube_id: iqubeId,
        chain_anchor: { kind: 'verified-standing', vsp_public_ref: vspPublicRef },
        source: 'mint',
      })
      .select('ownership_id')
      .maybeSingle();

    // 4. Backlink the canonical UUID onto the VSP profile row.
    await admin.from('vsp_profiles').update({ iqube_id: iqubeId }).eq('id', vspProfileId);

    return { iqubeId, vspPublicRef, created: true };
  } catch {
    return null;
  }
}
