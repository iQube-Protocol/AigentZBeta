/**
 * personaAddressResolver — resolves a persona's chain address for the
 * Phase 3.3b token credential resolver.
 *
 * Resolution order (most authoritative first):
 *   1. personas.evm_address column                    (canonical EVM address)
 *   2. personas.evm_key.address                       (legacy keypair envelope)
 *   3. wallet_aliases by (persona_id, chain, status='active')
 *
 * Returns null if no address is on file. The spine treats null as
 * "not in cohort / does not own the token" — conservative deny.
 *
 * T0/T1 contract: this function is server-only; the returned address
 * is a public chain identifier (T2-equivalent for owned funds) but
 * the persona_id mapping itself is T0 — never exposed to the browser.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export async function resolvePersonaWalletAddress(
  personaId: string,
  chain: string,
): Promise<string | null> {
  if (!personaId) return null;
  const sb = getSupabaseServer();
  if (!sb) return null;

  const isEvmChain = ['ethereum', 'base', 'optimism', 'polygon', 'arbitrum', 'eth', 'mainnet', 'arb', 'op', 'matic'].includes(
    chain.toLowerCase(),
  );

  // 1 + 2: personas table — only relevant for EVM chains.
  if (isEvmChain) {
    const { data: row } = await sb
      .from('personas')
      .select('evm_address, evm_key')
      .eq('id', personaId)
      .maybeSingle();
    if (row) {
      const direct = typeof row.evm_address === 'string' ? row.evm_address : null;
      if (direct && /^0x[0-9a-fA-F]{40}$/.test(direct)) return direct;
      const fromKey =
        row.evm_key && typeof (row.evm_key as { address?: unknown }).address === 'string'
          ? ((row.evm_key as { address: string }).address)
          : null;
      if (fromKey && /^0x[0-9a-fA-F]{40}$/.test(fromKey)) return fromKey;
    }
  }

  // 3: wallet_aliases fallback (covers BTC / SOL / explicitly registered EVM aliases)
  const aliasChain = isEvmChain ? 'evm' : chain.toLowerCase();
  const { data: alias } = await sb
    .from('wallet_aliases')
    .select('wallet_address')
    .eq('persona_id', personaId)
    .eq('chain', aliasChain)
    .eq('status', 'active')
    .order('registered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (alias?.wallet_address && typeof alias.wallet_address === 'string') {
    return alias.wallet_address;
  }
  return null;
}
