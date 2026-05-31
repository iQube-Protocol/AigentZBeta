/**
 * ContentQube primitive adapter.
 *
 * Wraps the shipped legibility ContentQube source
 * (services/iqube/legibility/sources/contentQubeSource.ts) and joins
 * iqube_id_map + content_qubes' bridged-triad columns
 * (master_qube_id / media_asset_id) to assemble the
 * CanonicalIQubeInternalRecord.
 *
 * The legibility source remains the visibility / gating / identity-tier
 * decision authority for ContentQubes (per Phase 8 design). This adapter
 * adds the fields the legibility surface doesn't track: meta/blak/token
 * triad refs, internal_lifecycle (placeholder until Stage 3 maps),
 * mint_status, instance_model, edition_supply rollup, cartridge_bindings.
 *
 * Adapter authority rule: NEVER decides access; NEVER decides ownership;
 * NEVER writes receipts. The caller-aware fields (caller_owns /
 * caller_can_read) are added by the projection layer, not here.
 */

import { createClient } from '@supabase/supabase-js';

import {
  getContentQubeSource,
  listPublicContentQubeSources,
} from '@/services/iqube/legibility/sources/contentQubeSource';
import { mapLifecycleState } from '@/services/iqube/legibility/cardBuilder';
import { mapContentQubeInternalToUniversal, internalToSurface } from '@/services/registry/lifecycle';

import type {
  CanonicalIQubeInternalRecord,
  IQubeIdMapEntry,
  IQubeInstanceModel,
  EditionSupply,
} from '@/types/registry-canonical';

import type {
  RegistryPrimitiveAdapter,
  AdapterHydrateOpts,
  AdapterListFilter,
  AdapterListResult,
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────────

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Stage 2 inlined a minimal ContentQube → universal lifecycle mapper here;
 * Stage 3 codified it in services/registry/lifecycle.ts and this adapter
 * now delegates. The inline copy was removed in Stage 3 C16.
 */

/**
 * Roll up edition supply from content_qube_editions for a single qube.
 * Returns null when the qube has zero editions (e.g. activation_tab class
 * per Stage 0 Finding G).
 */
async function loadEditionSupply(qubeId: string): Promise<EditionSupply | undefined> {
  const sb = client();
  const { data, error } = await sb
    .from('content_qube_editions')
    .select('rarity, persona_id')
    .eq('content_qube_id', qubeId);
  if (error || !data || data.length === 0) return undefined;

  const total = data.length;
  const minted = data.filter((r) => (r as any).persona_id).length;
  const rarityDist: Record<string, number> = {};
  for (const row of data) {
    const r = (row as any).rarity as string;
    rarityDist[r] = (rarityDist[r] ?? 0) + 1;
  }
  return {
    total_planned: total,
    canonical_minted: minted,
    common_appended: 0, // Phase 7 design: commons are separate (appended past 1860 per qube)
    rarity_distribution: rarityDist,
  };
}

/**
 * Resolve a ContentQube row to its bridged triad references.
 * Returns null for any meta/blak/token that don't exist; this is normal
 * for activation_tab content_kind and other non-minted classes.
 */
async function loadTriadFromContentQube(qubeId: string): Promise<{
  meta_qube_id?: string;
  blak_qube_id?: string;
  token_qube_id?: string;
}> {
  const sb = client();

  // content_qubes bridges via master_qube_id → master_content_qubes
  // or media_asset_id → codex_media_assets. Both can carry triad refs.
  const { data: qube } = await sb
    .from('content_qubes')
    .select('master_qube_id, media_asset_id')
    .eq('id', qubeId)
    .maybeSingle();
  if (!qube) return {};

  const masterId = (qube as any).master_qube_id;
  const mediaId = (qube as any).media_asset_id;

  if (masterId) {
    const { data } = await sb
      .from('master_content_qubes')
      .select('meta_qube_id, blak_qube_id, token_qube_id')
      .eq('id', masterId)
      .maybeSingle();
    if (data) {
      return {
        meta_qube_id: (data as any).meta_qube_id ?? undefined,
        blak_qube_id: (data as any).blak_qube_id ?? undefined,
        token_qube_id: (data as any).token_qube_id ?? undefined,
      };
    }
  }

  if (mediaId) {
    const { data } = await sb
      .from('codex_media_assets')
      .select('meta_qube_id, blak_qube_id, token_qube_id')
      .eq('id', mediaId)
      .maybeSingle();
    if (data) {
      return {
        meta_qube_id: (data as any).meta_qube_id ?? undefined,
        blak_qube_id: (data as any).blak_qube_id ?? undefined,
        token_qube_id: (data as any).token_qube_id ?? undefined,
      };
    }
  }

  return {};
}

// ── Adapter ───────────────────────────────────────────────────────────────

export const contentQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ContentQube',
  sources: ['content_qube'],

  async hydrate(
    entry: IQubeIdMapEntry,
    opts: AdapterHydrateOpts = {},
  ): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'content_qube') return null;

    const src = await getContentQubeSource(entry.source_id, { allowPrivate: opts.allowPrivate });
    if (!src) return null;

    const triad = await loadTriadFromContentQube(entry.source_id);
    const editionSupply = await loadEditionSupply(entry.source_id);

    const internal_lifecycle = mapContentQubeInternalToUniversal(src.raw_lifecycle_state);
    // Surface uses the legibility mapper for parity with shipped cards;
    // internal lifecycle drives the state machine. Both should agree on
    // the surface value for canonized + chain_minted; an assertion below
    // catches drift if the two ever diverge.
    const surface_lifecycle = mapLifecycleState(src.raw_lifecycle_state);
    const surface_from_internal = internalToSurface(internal_lifecycle);
    if (surface_lifecycle !== surface_from_internal) {
      // Soft drift: prefer the canonical state-machine derivation, but
      // log loudly so the legibility mapper can be reconciled.
      console.warn(
        `[contentQubeAdapter] surface_lifecycle drift: legibility='${surface_lifecycle}' vs state-machine='${surface_from_internal}' (raw='${src.raw_lifecycle_state}')`,
      );
    }
    const canonicalization_status =
      internal_lifecycle === 'canonized' ? 'canonized'
        : internal_lifecycle === 'published' ? 'finalized'
        : 'wip';

    // Instance model: ContentQubes with edition_supply use multi_edition_1155
    // (canonical editions are ERC-1155 per Phase 7B baseTokenMint.ts).
    // Activation tabs and other non-editioned content default to singleton.
    const instance_model: IQubeInstanceModel =
      editionSupply && editionSupply.total_planned > 0
        ? 'multi_edition_1155'
        : 'singleton';

    return {
      iqube_id: entry.iqube_id,
      primitive_type: 'ContentQube',
      instance_type: 'instance',

      meta_qube_id: triad.meta_qube_id ?? '',
      blak_qube_id: triad.blak_qube_id,
      token_qube_id: triad.token_qube_id,

      // T0 — never populated from this adapter; the creator persona link
      // lives on master_content_qubes / codex_media_assets and is loaded
      // only by admin projection callers (and never serialised).
      creator_persona_id: undefined,
      steward_persona_id: undefined,
      creator_identity_state: src.creator_identity_state,
      // T2 — to be populated by Stage 9 cohort alias service integration
      creator_alias_commitment: undefined,
      origin: 'native',
      ingestion_intake_id: undefined,

      internal_lifecycle,
      surface_lifecycle,
      canonicalization_status,
      wip_supabase_only: internal_lifecycle === 'draft' || internal_lifecycle === 'wip',
      visibility_state: src.visibility_state,

      gating: src.gating,
      access_policy_id: undefined, // Populated when content_qube_access_policies row is joined
      required_credentials: undefined,

      // Stage 5 mint saga populates mint_status + chain_anchor. For now,
      // 'minted' is implied by lifecycle=canonized + edition rollup; the
      // saga writes the explicit state.
      mint_status:
        internal_lifecycle === 'canonized' && editionSupply && editionSupply.canonical_minted > 0
          ? 'minted'
          : 'unminted',
      chain_anchor: undefined,
      mint_saga_id: undefined,

      instance_model,
      edition_supply: editionSupply,
      shard: undefined,
      hierarchy: undefined, // Could be populated from tags (series/episode); deferred

      content_qube_id: entry.source_id,

      dvn_receipt_index: { receipt_count: 0 }, // Stage 6 wires from orchestration_events + content_qube_dvn_receipts
      cartridge_bindings: src.tags?.filter(Boolean) ?? [],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,

      version: '1.0',
      version_history_id: undefined,
      created_at: src.created_at ?? new Date().toISOString(),
      updated_at: src.updated_at ?? new Date().toISOString(),
    };
  },

  async list(_filter?: AdapterListFilter): Promise<AdapterListResult> {
    // Reuse the legibility-side enumeration which already applies
    // visibility filters and the 200-row cap.
    const sources = await listPublicContentQubeSources();
    const sb = client();

    // Bulk-load iqube_id_map rows for these content_qubes.
    const sourceIds = sources.map((s) => s.iqube_id);
    if (sourceIds.length === 0) return { entries: [] };

    const { data } = await sb
      .from('iqube_id_map')
      .select('*')
      .eq('source', 'content_qube')
      .in('source_id', sourceIds);

    return {
      entries: (data ?? []).map((row) => ({
        iqube_id: (row as any).iqube_id,
        source: (row as any).source,
        source_id: (row as any).source_id,
        primitive_type: (row as any).primitive_type,
        legacy_primitive_type: (row as any).legacy_primitive_type ?? undefined,
        synthetic: (row as any).synthetic,
        notes: (row as any).notes ?? undefined,
        created_at: (row as any).created_at,
        updated_at: (row as any).updated_at,
      })),
    };
  },
};
