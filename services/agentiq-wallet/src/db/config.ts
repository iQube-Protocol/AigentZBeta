import { getSupabase } from './supabase';

export async function getOpsConfig<T = any>(key: string, fallback: T): Promise<T> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .schema('didqube')
      .from('ops_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return fallback;
    return (data.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getAnonCaps() {
  const txCap = await getOpsConfig<number>('anon_tx_cap_qcents', parseInt(process.env.ANON_TX_CAP_QCENTS || '1000', 10));
  const dailyCap = await getOpsConfig<number>('anon_daily_cap_qcents', parseInt(process.env.ANON_DAILY_CAP_QCENTS || '1000', 10));
  const ttlSec = await getOpsConfig<number>('anon_alias_ttl_sec', parseInt(process.env.ANON_ALIAS_TTL_SEC || '900', 10));
  const requirePersonhood = await getOpsConfig<boolean>('anon_require_personhood', (process.env.ANON_REQUIRE_PERSONHOOD || 'true') === 'true');
  return { txCap, dailyCap, ttlSec, requirePersonhood };
}
