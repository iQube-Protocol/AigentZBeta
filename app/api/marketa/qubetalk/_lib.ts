import type { SupabaseClient } from '@supabase/supabase-js';

type CrmPersona = {
  id: string;
  tenant_id: string;
  identity_persona_id?: string | null;
};

export async function resolveCrmPersona(
  client: SupabaseClient,
  personaId?: string | null
): Promise<CrmPersona | null> {
  if (!personaId) return null;

  const { data: direct } = await client
    .from('crm_personas')
    .select('id,tenant_id,identity_persona_id')
    .eq('id', personaId)
    .maybeSingle();

  if (direct) return direct as CrmPersona;

  const { data: linked } = await client
    .from('crm_personas')
    .select('id,tenant_id,identity_persona_id')
    .eq('identity_persona_id', personaId)
    .maybeSingle();

  return (linked as CrmPersona) || null;
}
