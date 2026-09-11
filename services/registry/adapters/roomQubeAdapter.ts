/**
 * RoomQube → ClusterQube adapter.
 *
 * A RoomQube is a governed manifest, not copied storage. Its member iQubes are
 * resolved from room placements while membership remains the canonical access
 * boundary.
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

export const roomQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ClusterQube',
  sources: ['roomqube'],

  async hydrate(entry: IQubeIdMapEntry, opts: AdapterHydrateOpts = {}): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'roomqube') return null;
    const sb = client();
    const { data } = await sb
      .from('roomqubes')
      .select('id, title, purpose, room_type, owner_persona_id, status, venture_id, created_at, updated_at')
      .eq('id', entry.source_id)
      .maybeSingle();
    if (!data) return null;
    const row = data as {
      id: string; title: string; purpose: string; room_type: string;
      owner_persona_id: string; status: string; venture_id: string | null;
      created_at: string; updated_at: string;
    };
    // RoomQubes are private surfaces. The authenticated resolver calls this
    // adapter with allowPrivate=true and then evaluates owner/member access.
    if (!opts.allowPrivate) return null;

    const { data: placements } = await sb
      .from('roomqube_placements')
      .select('asset_id')
      .eq('roomqube_id', row.id)
      .order('display_order', { ascending: true });
    const assetIds = (placements ?? []).map((p: any) => p.asset_id as string);
    const { data: mapped } = assetIds.length
      ? await sb.from('iqube_id_map').select('iqube_id, source_id').eq('source', 'locker_asset').in('source_id', assetIds)
      : { data: [] as Array<{ iqube_id: string; source_id: string }> };
    const byAsset = new Map((mapped ?? []).map((m: any) => [m.source_id as string, m.iqube_id as string]));
    const memberIds = assetIds.map((id) => byAsset.get(id)).filter((id): id is string => Boolean(id));
    const archived = row.status === 'archived';

    return {
      iqube_id: entry.iqube_id,
      primitive_type: 'ClusterQube',
      instance_type: 'instance',
      display_name: row.title,
      display_description: row.purpose || undefined,
      source_resource_id: row.id,
      source_system: 'roomqube',
      meta_qube_id: '',
      creator_persona_id: row.owner_persona_id,
      creator_identity_state: 'pseudonymous',
      origin: 'native',
      internal_lifecycle: archived ? 'deprecated' : row.status === 'draft' ? 'draft' : 'published',
      surface_lifecycle: archived ? 'archived' : row.status === 'draft' ? 'draft' : 'canonized',
      canonicalization_status: row.status === 'draft' ? 'wip' : 'finalized',
      wip_supabase_only: row.status === 'draft',
      visibility_state: 'private',
      gating: ['persona'],
      access_policy_id: 'persona-ownership-or-room-membership',
      mint_status: 'unminted',
      instance_model: 'singleton',
      cluster: {
        member_iqubes: memberIds.map((iqube_id) => ({ iqube_id, role: 'primary' as const })),
        dependency_graph: { nodes: memberIds, edges: [] },
        policy_aggregation: 'explicit',
        receipt_aggregation: 'cluster_only',
        version_compatibility_strategy: 'pin',
        access_propagation: 'cluster_grants_members',
        revocation_propagation: 'cluster_only',
      },
      dvn_receipt_index: { receipt_count: 0 },
      cartridge_bindings: ['locker', 'roomqube', row.room_type, ...(row.venture_id ? [row.venture_id] : [])],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,
      version: '1',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },

  async list(filter: AdapterListFilter = {}): Promise<AdapterListResult> {
    let query = client().from('iqube_id_map').select('*').eq('source', 'roomqube');
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
