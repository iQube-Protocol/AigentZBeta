/**
 * ToolQube score derivation (v1).
 *
 * Backlog rules:
 *   - sensitivity from auth_scheme: none→2, bearer/api_key→5, oauth2→6
 *   - risk from wrapper_strategy: skill→2, mcp/workflow→5, browser→7
 *   - accuracy from validation: all-pass→9, some-warn→7, some-fail→4
 *     (no validation data on registry_assets today; default 6)
 *   - verifiability from provenance: signed npm→8, verified GitHub→7,
 *     manual→4 (default 6)
 *
 * Reads registry_assets where primitive_type='ToolQube'. Code-only
 * ToolQubes (openclawCore — currently 0 in DB) handled separately via
 * syntheticIQubeId; this deriver covers the DB-backed path.
 */

import { createClient } from '@supabase/supabase-js';
import type { DerivationResult } from './types';
import { clampAxis } from './types';

const STRATEGY = 'tool_qube_v1';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function sensitivityFromAuth(auth_scheme: string | null): number {
  switch (auth_scheme) {
    case null: case 'none': return 2;
    case 'bearer': case 'api_key': return 5;
    case 'oauth2': return 6;
    default: return 4;
  }
}

function riskFromWrapper(wrapper: string | null): number {
  switch (wrapper) {
    case 'skill':   return 2;
    case 'mcp':     return 5;
    case 'workflow':return 5;
    case 'browser': return 7;
    default:        return 4;
  }
}

export async function deriveToolQubeScores(): Promise<DerivationResult[]> {
  const sb = client();

  const { data } = await sb
    .from('iqube_id_map')
    .select('iqube_id, source_id')
    .eq('primitive_type', 'ToolQube');
  if (!data || data.length === 0) return [];

  const sourceIds = data.map((r) => (r as { source_id: string }).source_id);

  // Pull registry_assets metadata for these tool subtypes/wrappers/auth.
  const { data: assets } = await sb
    .from('registry_assets')
    .select('asset_id, wrapper_strategy, tool_subtype')
    .in('asset_id', sourceIds);

  const wrapperByAsset = new Map<string, string | null>();
  for (const a of assets ?? []) {
    const r = a as { asset_id: string; wrapper_strategy: string | null };
    wrapperByAsset.set(r.asset_id, r.wrapper_strategy);
  }

  return data.map((entry) => {
    const e = entry as { iqube_id: string; source_id: string };
    const wrapper = wrapperByAsset.get(e.source_id) ?? null;
    // auth_scheme is not on registry_assets today; default 'none' / 'bearer'
    // depending on wrapper type as a stand-in until DB promotion lands
    // tool secrets metadata
    const auth_scheme = wrapper === 'mcp' || wrapper === 'browser' ? 'bearer' : 'none';
    return {
      iqube_id: e.iqube_id,
      strategy: STRATEGY,
      scores: {
        sensitivity: clampAxis(sensitivityFromAuth(auth_scheme)),
        risk: clampAxis(riskFromWrapper(wrapper)),
        accuracy: 6,       // No validation data yet; backlog default
        verifiability: 6,  // No provenance signal on registry_assets; backlog default
      },
    };
  });
}
