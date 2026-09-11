/**
 * registerPersonaIqube — register a minted persona as a canonical iQube in the
 * registry SoT (the global source of truth).
 *
 * A PersonaQube is an iQube of primitive type DataQube. This writes the trinity
 * meta record + the canonical iqube_id_map row so the persona shows up as a
 * registered iQube, and records per-persona ownership. The Base ERC-721
 * tokenQube is the bearer token; the (Sui object, Walrus blob) refs travel in
 * the meta as T2-safe pointers to the encrypted locker.
 *
 * T0-T2 discipline:
 *   - The meta record (public) carries ONLY commitments / public refs
 *     (persona_public_ref, kybe_did_public_ref, token id, chain, Sui/Walrus
 *     refs). NO BlakQube bytes, NO display name, NO persona_id.
 *   - persona_token_qube_ownership.persona_id is T0 (service-role RLS only).
 *
 * Best-effort + idempotent: returns the existing iqube_id when already
 * registered, and never throws into the mint flow.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createMetaQube } from '@/server/services/iqRegistryService';
import type { MintChain } from '@/services/chain/mintChains';

export interface RegisterPersonaIqubeInput {
  admin: SupabaseClient;
  personaId: string;
  personaPublicRef: string;
  kybeDidPublicRef: string | null;
  /** Bearer tokenQube id (hex commitment). May be null when deferred/unminted. */
  tokenId: string | null;
  chain: MintChain;
  /** T2-safe pointers to the encrypted locker. */
  suiObjectId?: string | null;
  walrusBlobId?: string | null;
}

export interface RegisterPersonaIqubeResult {
  iqubeId: string;
  created: boolean;
}

export async function registerPersonaIqube(
  input: RegisterPersonaIqubeInput,
): Promise<RegisterPersonaIqubeResult | null> {
  const { admin, personaId, personaPublicRef, kybeDidPublicRef, tokenId, chain } = input;
  try {
    // Idempotency — reuse the registry entry already linked to this persona.
    const { data: existing } = await admin
      .from('persona_qube_mints')
      .select('iqube_id')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (existing?.iqube_id) {
      return { iqubeId: String(existing.iqube_id), created: false };
    }

    // 1. Public meta record (T2-safe — commitments + refs only).
    const metaQubeId = await createMetaQube({
      name: `PersonaQube ${personaPublicRef}`,
      slug: `personaqube-${personaPublicRef}`,
      qubeType: 'DataQube',
      tags: ['persona', 'identity', 'personaqube'],
      description: 'Identity PersonaQube — public meta only; payload (BlakQube) is encrypted in the holder locker.',
      metadata: {
        kind: 'persona',
        persona_public_ref: personaPublicRef,
        kybe_did_public_ref: kybeDidPublicRef,
        token_qube: tokenId ? { chain, token_id: tokenId } : { chain, status: 'deferred' },
        locker: {
          sui_object_id: input.suiObjectId ?? null,
          walrus_blob_id: input.walrusBlobId ?? null,
        },
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
        notes: `PersonaQube ${personaPublicRef}`,
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
        persona_id: personaId,
        token_qube_id: tokenId ?? `deferred:${chain}:${personaPublicRef}`,
        iqube_id: iqubeId,
        chain_anchor: {
          chain,
          token_id: tokenId,
          sui_object_id: input.suiObjectId ?? null,
          walrus_blob_id: input.walrusBlobId ?? null,
        },
        source: 'mint',
      })
      .select('ownership_id')
      .maybeSingle();

    return { iqubeId, created: true };
  } catch {
    return null;
  }
}
