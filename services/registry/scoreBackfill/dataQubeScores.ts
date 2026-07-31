/**
 * DataQube score derivation (v1).
 *
 * Backlog rules:
 *   - LiquidUI templates (id prefix 'liquidui-template-'): open-source
 *     UI schemas — sensitivity 1, accuracy 8, verifiability 10, risk 1
 *   - Other DataQubes: defaults per source (5/5/5/5)
 *
 * Reads iqube_id_map for primitive_type='DataQube'. Stage 1 C1 reclassified
 * 20 LiquidUI seeds from LiquidUITemplateArchetypeQube to DataQube; the
 * legacy_primitive_type column carries the original tag for one-rev rollback.
 */

import { createClient } from '@supabase/supabase-js';
import type { DerivationResult } from './types';

const STRATEGY = 'data_qube_v1';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function deriveDataQubeScores(): Promise<DerivationResult[]> {
  const sb = client();

  const { data } = await sb
    .from('iqube_id_map')
    .select('iqube_id, source, source_id, legacy_primitive_type')
    .eq('primitive_type', 'DataQube');
  if (!data || data.length === 0) return [];

  return data.map((entry) => {
    const e = entry as {
      iqube_id: string;
      source: string;
      source_id: string;
      legacy_primitive_type: string | null;
    };
    const isLiquidUi =
      e.source === 'code:liquidui-template' ||
      e.source_id?.startsWith('liquidui-template-') ||
      e.legacy_primitive_type === 'LiquidUITemplateArchetypeQube';

    if (isLiquidUi) {
      return {
        iqube_id: e.iqube_id,
        strategy: STRATEGY,
        scores: { sensitivity: 1, accuracy: 8, verifiability: 10, risk: 1 },
      };
    }

    // Default for other DataQubes — middle of the scale until per-record
    // operator override or richer source signal arrives
    return {
      iqube_id: e.iqube_id,
      strategy: STRATEGY,
      scores: { sensitivity: 5, accuracy: 5, verifiability: 5, risk: 5 },
      notes: 'default 5/5/5/5; operator should override or richer source needed',
    };
  });
}
