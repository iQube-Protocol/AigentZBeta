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

/**
 * WHY the address lookup came back empty — the structured form of
 * `resolvePersonaWalletAddress` (operator report, 2026-08-02).
 *
 * THE DEFECT THIS CLOSES: the Register ceremony refused with a flat
 * "No wallet is on file for the operator", which is true but tells the
 * operator nothing they can act on. There are three independent places an
 * address can live, and they fail for completely different reasons:
 *
 *   - `personas.evm_address` empty but `evm_key.address` present
 *       → a BACKFILL gap. The key material exists; the canonical column was
 *         never populated. POST /api/admin/identity/sync-persona-evm-addresses
 *         fixes it.
 *   - both empty
 *       → this persona has NO EVM key material at all. Personas created via
 *         /api/identity/persona/create-with-fio are inserted with
 *         `evm_key: null`, so they land here. A wallet must actually be
 *         created for the persona; no backfill can invent one.
 *   - present but malformed
 *       → data corruption, not absence. Saying "no wallet" would send the
 *         operator looking for a missing thing that is in fact there and
 *         wrong.
 *
 * Collapsing all three into one message is what made this unfixable from the
 * error alone.
 */
export type WalletAddressAbsence =
  | 'resolved'
  | 'needs-backfill'
  | 'no-key-material'
  | 'malformed-address'
  | 'store-unavailable';

export interface WalletAddressDiagnosis {
  address: string | null;
  reason: WalletAddressAbsence;
  /** What the operator should do next, in their own terms. */
  remediation: string | null;
}

export async function diagnosePersonaWalletAddress(
  personaId: string,
  chain: string,
): Promise<WalletAddressDiagnosis> {
  const address = await resolvePersonaWalletAddress(personaId, chain);
  if (address) return { address, reason: 'resolved', remediation: null };

  const sb = getSupabaseServer();
  if (!sb) {
    return {
      address: null,
      reason: 'store-unavailable',
      // UNKNOWN, never "you have no wallet" — a store outage must not read
      // as an absent wallet.
      remediation: 'The persona store could not be read, so this is unknown rather than absent. Try again shortly.',
    };
  }

  const { data: row } = await sb
    .from('personas')
    .select('evm_address, evm_key')
    .eq('id', personaId)
    .maybeSingle();

  const rawColumn = typeof row?.evm_address === 'string' ? row.evm_address : null;
  const rawKey =
    row?.evm_key && typeof (row.evm_key as { address?: unknown }).address === 'string'
      ? (row.evm_key as { address: string }).address
      : null;
  const wellFormed = (v: string | null) => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

  if ((rawColumn && !wellFormed(rawColumn)) || (rawKey && !wellFormed(rawKey))) {
    return {
      address: null,
      reason: 'malformed-address',
      remediation:
        'An address is recorded for this persona but is not a well-formed EVM address. It needs correcting, not creating.',
    };
  }

  if (rawKey) {
    return {
      address: null,
      reason: 'needs-backfill',
      remediation:
        'This persona has wallet key material but its canonical evm_address column was never populated. ' +
        'Run POST /api/admin/identity/sync-persona-evm-addresses to backfill it.',
    };
  }

  return {
    address: null,
    reason: 'no-key-material',
    remediation:
      'This persona has no EVM wallet key material at all, so there is nothing to back a signature. ' +
      'Create a metaMe wallet for this persona (SmartWallet drawer → create persona wallet), then retry. ' +
      'Personas created through the FIO-only path are inserted without a key pair and always land here.',
  };
}
