/** EXP-P* roots projected as compositional ClusterQubes. */

import { createClient } from '@supabase/supabase-js';
import type { CanonicalIQubeInternalRecord, IQubeIdMapEntry } from '@/types/registry-canonical';
import type { AdapterHydrateOpts, AdapterListFilter, AdapterListResult, RegistryPrimitiveAdapter } from './types';
import { researchExperiment } from '@/services/research/experimentIQubeSources';

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function memberEntries(experimentId: string): Promise<Array<{ iqube_id: string; source: string; source_id: string }>> {
  const sb = client();
  const { data: docs } = await sb.from('iqube_id_map')
    .select('iqube_id, source, source_id')
    .eq('source', 'research_document')
    .like('source_id', `${experimentId}|%`);

  const { data: objects } = await sb.from('research_objects')
    .select('id')
    .like('object_id', `${experimentId}/%`);
  const objectIds = (objects ?? []).map((row: any) => String(row.id));
  const { data: mappedObjects } = objectIds.length
    ? await sb.from('iqube_id_map').select('iqube_id, source, source_id')
      .eq('source', 'research_object').in('source_id', objectIds)
    : { data: [] as Array<{ iqube_id: string; source: string; source_id: string }> };

  const { data: results } = await sb.from('experiment_results').select('id').eq('experiment', experimentId);
  const resultIds = (results ?? []).map((row: any) => String(row.id));
  const { data: mappedResults } = resultIds.length
    ? await sb.from('iqube_id_map').select('iqube_id, source, source_id')
      .eq('source', 'experiment_result').in('source_id', resultIds)
    : { data: [] as Array<{ iqube_id: string; source: string; source_id: string }> };

  let children: Array<{ iqube_id: string; source: string; source_id: string }> = [];
  if (experimentId === 'EXP-P2') {
    const { data } = await sb.from('iqube_id_map').select('iqube_id, source, source_id')
      .eq('source', 'research_experiment').in('source_id', ['EXP-P2A', 'EXP-P2B']);
    children = (data ?? []) as typeof children;
  }

  return [...(docs ?? []), ...(mappedObjects ?? []), ...(mappedResults ?? []), ...children]
    .map((row: any) => ({ iqube_id: String(row.iqube_id), source: String(row.source), source_id: String(row.source_id) }))
    .sort((a, b) => a.source_id.localeCompare(b.source_id));
}

export const researchClusterQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ClusterQube',
  sources: ['research_experiment'],

  async hydrate(entry: IQubeIdMapEntry, opts: AdapterHydrateOpts = {}): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'research_experiment' || !opts.allowPrivate) return null;
    const experiment = researchExperiment(entry.source_id);
    if (!experiment) return null;
    const members = await memberEntries(experiment.id);
    const primaryPath = experiment.protocolRef.replace(/^codexes\/packs\/irl\//, '');
    const isFinalized = experiment.id === 'EXP-P1';
    const childIds = new Set(members.filter((m) => m.source === 'research_experiment').map((m) => m.iqube_id));
    const memberQubes = members.map((member) => ({
      iqube_id: member.iqube_id,
      role: (member.source_id.endsWith(`|${primaryPath}`) ? 'primary' : 'dependency') as 'primary' | 'dependency',
      version_constraint: 'pin',
    }));
    const edges = members
      .filter((member) => childIds.has(member.iqube_id))
      .map((member) => ({
        from: entry.iqube_id,
        to: member.iqube_id,
        relation: 'composes' as const,
      }));

    return {
      iqube_id: entry.iqube_id,
      primitive_type: 'ClusterQube',
      instance_type: 'instance',
      display_name: `${experiment.id} · ${experiment.programmeFocus ?? experiment.family}`,
      display_description: `${experiment.family}. ${experiment.hypothesis}`,
      source_resource_id: experiment.id,
      source_system: 'research_experiment',
      meta_qube_id: '',
      creator_identity_state: 'pseudonymous',
      origin: 'native',
      internal_lifecycle: isFinalized ? 'published' : 'review_pending',
      surface_lifecycle: isFinalized ? 'canonized' : 'wip',
      canonicalization_status: isFinalized ? 'finalized' : 'wip',
      wip_supabase_only: !isFinalized,
      visibility_state: 'private',
      gating: ['persona', 'role'],
      access_policy_id: `research-review:${experiment.id}`,
      required_credentials: [`research-lab:${experiment.id}`],
      mint_status: 'unminted',
      instance_model: 'singleton',
      cluster: {
        member_iqubes: memberQubes,
        dependency_graph: { nodes: [entry.iqube_id, ...members.map((m) => m.iqube_id)], edges },
        policy_aggregation: 'explicit',
        receipt_aggregation: 'nested',
        version_compatibility_strategy: 'pin',
        access_propagation: 'independent',
        revocation_propagation: 'cluster_only',
      },
      dvn_receipt_index: { receipt_count: 0 },
      cartridge_bindings: ['irl', 'research-lab', 'validation-programme', experiment.seriesId, experiment.id],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,
      version: '1',
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  },

  async list(filter: AdapterListFilter = {}): Promise<AdapterListResult> {
    let query = client().from('iqube_id_map').select('*').eq('source', 'research_experiment');
    if (filter.limit) query = query.limit(filter.limit);
    const { data } = await query;
    return { entries: (data ?? []) as IQubeIdMapEntry[] };
  },
};
