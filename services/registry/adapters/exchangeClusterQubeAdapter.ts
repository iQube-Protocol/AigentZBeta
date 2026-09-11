/** Reciprocal exchanges projected as private ClusterQubes by reference. */
import { createClient } from '@supabase/supabase-js';
import type { CanonicalIQubeInternalRecord, IQubeIdMapEntry } from '@/types/registry-canonical';
import type { AdapterHydrateOpts, AdapterListFilter, AdapterListResult, RegistryPrimitiveAdapter } from './types';
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export const exchangeClusterQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ClusterQube', sources: ['reciprocal_exchange'],
  async hydrate(entry: IQubeIdMapEntry, opts: AdapterHydrateOpts = {}): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'reciprocal_exchange' || !opts.allowPrivate) return null;
    const sb = client();
    const { data: exchange } = await sb.from('reciprocal_exchanges')
      .select('id,title,purpose,status,parent_experiment_id,created_at,updated_at').eq('id', entry.source_id).maybeSingle();
    if (!exchange) return null;
    const { data: artifacts } = await sb.from('exchange_artifacts').select('id,party').eq('exchange_id', entry.source_id).order('party');
    const ids = (artifacts ?? []).map((r: any) => String(r.id));
    const { data: mapped } = ids.length
      ? await sb.from('iqube_id_map').select('iqube_id,source_id').eq('source', 'exchange_artifact').in('source_id', ids)
      : { data: [] as Array<{ iqube_id: string; source_id: string }> };
    const party = new Map((artifacts ?? []).map((r: any) => [String(r.id), String(r.party)]));
    const members = (mapped ?? []).map((r: any) => ({
      iqube_id: String(r.iqube_id), role: (party.get(String(r.source_id)) === 'A' ? 'primary' : 'dependency') as 'primary' | 'dependency', version_constraint: 'pin' as const,
    }));
    return {
      iqube_id: entry.iqube_id, primitive_type: 'ClusterQube', instance_type: 'instance', display_name: String(exchange.title),
      display_description: String(exchange.purpose ?? 'Governed reciprocal artifact exchange'), source_resource_id: String(exchange.id),
      source_system: 'reciprocal_exchange', meta_qube_id: '', creator_identity_state: 'pseudonymous', origin: 'native',
      internal_lifecycle: exchange.status === 'COMPARISON_OPEN' ? 'published' : 'review_pending', surface_lifecycle: 'wip',
      canonicalization_status: 'wip', wip_supabase_only: true, visibility_state: 'private', gating: ['persona', 'custom'],
      access_policy_id: `reciprocal-exchange:${exchange.id}`, required_credentials: ['exchange-party'], mint_status: 'unminted', instance_model: 'singleton',
      cluster: { member_iqubes: members, dependency_graph: { nodes: [entry.iqube_id, ...members.map((m) => m.iqube_id)], edges: [] },
        policy_aggregation: 'explicit', receipt_aggregation: 'nested', version_compatibility_strategy: 'pin', access_propagation: 'independent', revocation_propagation: 'cluster_only' },
      dvn_receipt_index: { receipt_count: 0 }, cartridge_bindings: ['irl', 'ocsga', String(exchange.parent_experiment_id ?? 'boundary-research')],
      card_url: `/api/iqubes/${entry.iqube_id}/card`, version: '1', created_at: String(exchange.created_at), updated_at: String(exchange.updated_at),
    };
  },
  async list(filter: AdapterListFilter = {}): Promise<AdapterListResult> { let q = client().from('iqube_id_map').select('*').eq('source', 'reciprocal_exchange'); if (filter.limit) q = q.limit(filter.limit); const { data } = await q; return { entries: (data ?? []) as IQubeIdMapEntry[] }; },
};
