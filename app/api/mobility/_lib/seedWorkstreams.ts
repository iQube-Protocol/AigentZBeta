import { SupabaseClient } from '@supabase/supabase-js';

const WORKSTREAM_DEFAULTS = [
  { key: 'A', label: 'Strategic Repatriation Assessment', priority: 'immediate' },
  { key: 'B', label: 'Housing Acquisition',              priority: 'critical'  },
  { key: 'C', label: 'Educational Continuity',           priority: 'critical'  },
  { key: 'D', label: 'Physical Relocation',              priority: 'critical'  },
  { key: 'E', label: 'Business Continuity',              priority: 'high'      },
  { key: 'F', label: 'Economic Reactivation',            priority: 'high'      },
  { key: 'G', label: 'Family Stabilization',             priority: 'medium'    },
] as const;

export async function seedWorkstreams(
  caseId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  const rows = WORKSTREAM_DEFAULTS.map(ws => ({
    case_id: caseId,
    workstream_key: ws.key,
    label: ws.label,
    priority: ws.priority,
    status: 'pending',
  }));
  await supabase.from('mobility_workstreams').insert(rows);
}
