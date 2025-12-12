import { getSupabase } from './supabase';

export async function registerAnonAlias(params: { alias_commitment: string; cohort_id: string; mailbox_id?: string; ttlSec: number }) {
  const sb = getSupabase();
  const expires = new Date(Date.now() + params.ttlSec * 1000).toISOString();
  const { data, error } = await sb
    .schema('didqube')
    .from('anon_aliases')
    .insert({
      alias_commitment: params.alias_commitment,
      cohort_id: params.cohort_id,
      mailbox_id: params.mailbox_id || null,
      expires_at: expires,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAnonAlias(alias_commitment: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .schema('didqube')
    .from('anon_aliases')
    .select('*')
    .eq('alias_commitment', alias_commitment)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function markAliasHuman(alias_commitment: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .schema('didqube')
    .from('anon_aliases')
    .update({ personhood_status: 'verified_human' })
    .eq('alias_commitment', alias_commitment)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAnonDailySpent(alias_commitment: string, day: Date = new Date()) {
  const sb = getSupabase();
  const dayStr = day.toISOString().slice(0, 10);
  const { data, error } = await sb
    .schema('didqube')
    .from('anon_usage')
    .select('spent_qcents')
    .eq('alias_commitment', alias_commitment)
    .eq('day', dayStr)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.spent_qcents || 0);
}

export async function addAnonSpend(alias_commitment: string, amount_qcents: number) {
  const sb = getSupabase();
  const dayStr = new Date().toISOString().slice(0, 10);
  // Read existing
  const { data: existing, error: selErr } = await sb
    .schema('didqube')
    .from('anon_usage')
    .select('spent_qcents')
    .eq('alias_commitment', alias_commitment)
    .eq('day', dayStr)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);
  const newAmount = Number(existing?.spent_qcents || 0) + amount_qcents;
  const { error: upErr } = await sb
    .schema('didqube')
    .from('anon_usage')
    .upsert({ alias_commitment, day: dayStr, spent_qcents: newAmount }, { onConflict: 'alias_commitment,day' });
  if (upErr) throw new Error(upErr.message);
  return { spent_qcents: newAmount };
}
