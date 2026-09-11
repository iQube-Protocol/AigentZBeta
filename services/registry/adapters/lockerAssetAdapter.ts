/**
 * Locker federated asset → ContentQube adapter.
 *
 * asset_records is the curation/navigation record; bytes remain in the native
 * rendition provider. The adapter exposes metadata only. Access and delivery
 * are decided later by the Persona Spine and canonical access evaluator.
 */

import { createClient } from '@supabase/supabase-js';
import type { CanonicalIQubeInternalRecord, IQubeIdMapEntry } from '@/types/registry-canonical';
import type {
  AdapterHydrateOpts,
  AdapterListFilter,
  AdapterListResult,
  RegistryPrimitiveAdapter,
} from './types';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function lifecycle(row: { lifecycle_status: string }) {
  switch (row.lifecycle_status) {
    case 'draft':
      return { internal: 'draft' as const, surface: 'draft' as const, canon: 'wip' as const };
    case 'review':
      return { internal: 'review_pending' as const, surface: 'wip' as const, canon: 'wip' as const };
    case 'superseded':
      return { internal: 'deprecated' as const, surface: 'deprecated' as const, canon: 'finalized' as const };
    case 'archived':
      return { internal: 'deprecated' as const, surface: 'archived' as const, canon: 'finalized' as const };
    default:
      return { internal: 'published' as const, surface: 'canonized' as const, canon: 'finalized' as const };
  }
}

export const lockerAssetAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ContentQube',
  sources: ['locker_asset'],

  async hydrate(entry: IQubeIdMapEntry, opts: AdapterHydrateOpts = {}): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'locker_asset') return null;
    const { data } = await client()
      .from('asset_records')
      .select('id, title, description, asset_class, native_system, owner_persona_id, lifecycle_status, sharing_status, version_number, tags, created_at, updated_at')
      .eq('id', entry.source_id)
      .maybeSingle();
    if (!data) return null;
    const row = data as {
      id: string; title: string; description: string | null; asset_class: string;
      native_system: string; owner_persona_id: string; lifecycle_status: string;
      sharing_status: string; version_number: number; tags: string[] | null;
      created_at: string; updated_at: string;
    };
    const isPublic = row.sharing_status === 'public';
    if (!isPublic && !opts.allowPrivate) return null;
    const state = lifecycle(row);

    return {
      iqube_id: entry.iqube_id,
      primitive_type: 'ContentQube',
      instance_type: 'instance',
      display_name: row.title,
      display_description: row.description ?? undefined,
      source_resource_id: row.id,
      source_system: 'locker_asset',
      meta_qube_id: '',
      creator_persona_id: row.owner_persona_id,
      creator_identity_state: 'pseudonymous',
      origin: row.native_system === 'locker' ? 'native' : 'imported',
      internal_lifecycle: state.internal,
      surface_lifecycle: state.surface,
      canonicalization_status: state.canon,
      wip_supabase_only: state.internal === 'draft' || state.internal === 'review_pending',
      visibility_state: isPublic ? 'public' : 'private',
      gating: isPublic ? ['open'] : ['persona'],
      access_policy_id: isPublic ? 'locker-public' : 'persona-ownership-or-room-membership',
      mint_status: 'unminted',
      instance_model: 'singleton',
      content_qube_id: undefined,
      dvn_receipt_index: { receipt_count: 0 },
      cartridge_bindings: ['locker', row.native_system, row.asset_class, ...(row.tags ?? [])],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,
      version: String(row.version_number || 1),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },

  async list(filter: AdapterListFilter = {}): Promise<AdapterListResult> {
    let query = client().from('iqube_id_map').select('*').eq('source', 'locker_asset');
    if (filter.limit) query = query.limit(filter.limit);
    const { data } = await query;
    return {
      entries: (data ?? []).map((row: any) => ({
        iqube_id: row.iqube_id,
        source: row.source,
        source_id: row.source_id,
        primitive_type: row.primitive_type,
        synthetic: row.synthetic,
        notes: row.notes ?? undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    };
  },
};
