import { getSupabase } from './supabase';

export type ResolvedIdentity = {
  personId?: string;
  personaId?: string;
  fioHandle?: string | null;
};

export async function resolveIdentityByDid(did: string): Promise<ResolvedIdentity | null> {
  const sb = getSupabase();
  // Look up persona_did_bindings first
  const { data: pdb, error: e1 } = await sb
    .from('didqube.persona_did_bindings')
    .select('id, persona_id')
    .eq('did_uri', did)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (pdb && pdb.persona_id) {
    const personaId = pdb.persona_id as string;
    const { data: persona, error: e2 } = await sb
      .from('didqube.persona')
      .select('persona_id, person_id, fio_handle')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (e2) throw e2;
    if (persona) {
      return { personId: persona.person_id as string, personaId: persona.persona_id as string, fioHandle: persona.fio_handle as string | null };
    }
  }
  // Optionally: resolve root_did_bindings (root-level DID)
  const { data: rdb, error: e3 } = await sb
    .from('didqube.root_did_bindings')
    .select('person_id')
    .eq('did_uri', did)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (e3) throw e3;
  if (rdb && rdb.person_id) {
    return { personId: rdb.person_id as string };
  }
  return null;
}
