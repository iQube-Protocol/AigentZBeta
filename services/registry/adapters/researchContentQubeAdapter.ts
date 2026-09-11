/** Research protocol/reviewer documents projected as ContentQubes by reference. */

import { createHash } from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { CanonicalIQubeInternalRecord, IQubeIdMapEntry } from '@/types/registry-canonical';
import type { AdapterHydrateOpts, AdapterListFilter, AdapterListResult, RegistryPrimitiveAdapter } from './types';
import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';
import {
  experimentIdForResearchDocumentSource,
  pathForResearchDocumentSource,
} from '@/services/research/experimentIQubeSources';

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export const researchContentQubeAdapter: RegistryPrimitiveAdapter = {
  primitive_type: 'ContentQube',
  sources: ['research_document'],

  async hydrate(entry: IQubeIdMapEntry, opts: AdapterHydrateOpts = {}): Promise<CanonicalIQubeInternalRecord | null> {
    if (entry.source !== 'research_document' || !opts.allowPrivate) return null;
    const experimentId = experimentIdForResearchDocumentSource(entry.source_id);
    const sourcePath = pathForResearchDocumentSource(entry.source_id);
    if (!experimentId || !sourcePath) return null;
    const content = await corpusReadPackFile('irl', sourcePath);
    if (content === null) return null;
    const name = path.posix.basename(sourcePath).replace(/\.(md|json)$/i, '').replace(/[-_]+/g, ' ');
    return {
      iqube_id: entry.iqube_id,
      primitive_type: 'ContentQube',
      instance_type: 'instance',
      display_name: `${experimentId} · ${name}`,
      display_description: `Experiment-governed IRL artifact · ${sourcePath}`,
      source_resource_id: entry.source_id,
      source_system: 'research_document',
      meta_qube_id: '',
      creator_identity_state: 'pseudonymous',
      origin: 'native',
      internal_lifecycle: 'published',
      surface_lifecycle: 'canonized',
      canonicalization_status: 'finalized',
      wip_supabase_only: false,
      visibility_state: 'private',
      gating: ['persona', 'role'],
      access_policy_id: `research-review:${experimentId}`,
      required_credentials: [`research-lab:${experimentId}`],
      mint_status: 'unminted',
      instance_model: 'singleton',
      dvn_receipt_index: { receipt_count: 0 },
      cartridge_bindings: ['irl', 'research-lab', experimentId],
      card_url: `/api/iqubes/${entry.iqube_id}/card`,
      version: createHash('sha256').update(content).digest('hex').slice(0, 12),
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  },

  async list(filter: AdapterListFilter = {}): Promise<AdapterListResult> {
    let query = client().from('iqube_id_map').select('*').eq('source', 'research_document');
    if (filter.limit) query = query.limit(filter.limit);
    const { data } = await query;
    return { entries: (data ?? []) as IQubeIdMapEntry[] };
  },
};

