/** Supabase-native experiment evidence projected as DataQubes without copying payloads. */

import { createClient } from '@supabase/supabase-js';
import type { CanonicalIQubeInternalRecord, IQubeIdMapEntry } from '@/types/registry-canonical';
import type { AdapterHydrateOpts, AdapterListFilter, AdapterListResult, RegistryPrimitiveAdapter } from './types';
import { experimentIdFromResearchObject, researchExperiment } from '@/services/research/experimentIQubeSources';

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export const researchDataQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'DataQube',
  sources: ['research_object', 'experiment_result'],

  async hydrate(entry: IQubeIdMapEntry, opts: AdapterHydrateOpts = {}): Promise<CanonicalIQubeInternalRecord | null> {
    if (!opts.allowPrivate) return null;
    const sb = client();
    let experimentId: string | null = null;
    let displayName = '';
    let state = 'wip';
    let receiptCount = 0;
    let createdAt = entry.created_at;
    let updatedAt = entry.updated_at;

    if (entry.source === 'research_object') {
      const { data } = await sb.from('research_objects')
        .select('id, object_id, object_kind, payload, lifecycle_state, receipt_id, created_at, updated_at')
        .eq('id', entry.source_id).maybeSingle();
      if (!data) return null;
      experimentId = experimentIdFromResearchObject(String(data.object_id), data.payload);
      displayName = String(data.object_id);
      state = String(data.lifecycle_state);
      receiptCount = data.receipt_id ? 1 : 0;
      createdAt = String(data.created_at);
      updatedAt = String(data.updated_at);
    } else if (entry.source === 'experiment_result') {
      const { data } = await sb.from('experiment_results')
        .select('id, experiment, provider, model, visibility, receipt_id, created_at')
        .eq('id', entry.source_id).maybeSingle();
      if (!data || !researchExperiment(String(data.experiment))) return null;
      experimentId = String(data.experiment);
      displayName = `${experimentId} result · ${String(data.provider)} / ${String(data.model)}`;
      state = String(data.visibility) === 'published' ? 'published' : 'wip';
      receiptCount = data.receipt_id ? 1 : 0;
      createdAt = String(data.created_at);
      updatedAt = createdAt;
    } else return null;

    if (!experimentId) return null;
    const finalized = ['frozen', 'executed', 'published', 'archived'].includes(state);
    return {
      iqube_id: entry.iqube_id,
      primitive_type: 'DataQube',
      instance_type: 'instance',
      display_name: displayName,
      display_description: `Experiment-governed evidence · ${experimentId}`,
      source_resource_id: entry.source_id,
      source_system: entry.source,
      meta_qube_id: '',
      creator_identity_state: 'pseudonymous',
      origin: 'native',
      internal_lifecycle: finalized ? 'published' : 'wip',
      surface_lifecycle: finalized ? 'canonized' : 'draft',
      canonicalization_status: finalized ? 'finalized' : 'wip',
      wip_supabase_only: !finalized,
      visibility_state: 'private',
      gating: ['persona', 'role'],
      access_policy_id: `research-review:${experimentId}`,
      required_credentials: [`research-lab:${experimentId}`],
      mint_status: 'unminted',
      instance_model: 'singleton',
      dvn_receipt_index: { receipt_count: receiptCount },
      cartridge_bindings: ['irl', 'research-lab', experimentId],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,
      version: '1',
      created_at: createdAt,
      updated_at: updatedAt,
    };
  },

  async list(filter: AdapterListFilter = {}): Promise<AdapterListResult> {
    let query = client().from('iqube_id_map').select('*').in('source', ['research_object', 'experiment_result']);
    if (filter.limit) query = query.limit(filter.limit);
    const { data } = await query;
    return { entries: (data ?? []) as IQubeIdMapEntry[] };
  },
};

