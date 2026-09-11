/**
 * Records the real Bitcent (B¢) testnet etch as a DVN-anchorable
 * `activity_receipts` row (action type `bitcent_treasury_etch_executed`).
 *
 * Requires live Supabase — this script cannot run from a network-restricted
 * sandbox. Run it from an environment with real Supabase access (the
 * operator's machine, or a deployed job).
 *
 * Resolves Aigent Z's persona_id by querying the `personas` table for
 * `fio_handle = 'aigentz@aigent'` — the same lookup
 * app/api/admin/identity/align-agent-persona/route.ts uses, not a new
 * resolution mechanism. Aigent Z is the ratified operational treasury
 * custodian for Bitcent (scripts/bitcent-issuance-record.json's
 * premineCustodian note).
 *
 * Usage (defaults are the real 2026-07-30 testnet etch already broadcast):
 *   npx tsx scripts/record-bitcent-etch-receipt.ts
 *
 * Override any fact if recording a different (e.g. future) etch:
 *   npx tsx scripts/record-bitcent-etch-receipt.ts --tx-hash=... --network=testnet
 */

import { createClient } from '@supabase/supabase-js';
import { recordBitcentEtchReceipt, type BitcentEtchFacts } from '@/services/treasury/bitcentTreasuryReceipts';
import { loadIssuanceRecord, resolveTokenomics } from './deploy-qct-bitcoin.js';

const AIGENT_Z_FIO_HANDLE = 'aigentz@aigent';

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: string) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  return {
    txHash: flag('tx-hash', '551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65'),
    network: flag('network', 'testnet') as 'testnet' | 'mainnet',
    mandateCommitment: flag('mandate-commitment', 'ba69bc0bfe319dae7591006a213f4e1b5dd90772da749f3a9f53531d87a1d644'),
    deployerAddress: flag('deployer-address', 'tb1qdhc2l3d3w348re4j70a0cykvmh47ptwu8fk9nh'),
  };
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  return createClient(url, key);
}

async function resolveAigentZPersonaId(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('personas')
    .select('id')
    .eq('fio_handle', AIGENT_Z_FIO_HANDLE)
    .maybeSingle();
  if (error) throw new Error(`Failed to resolve Aigent Z's persona: ${error.message}`);
  if (!data?.id) throw new Error(`No persona row found with fio_handle = '${AIGENT_Z_FIO_HANDLE}'. Refusing to guess a persona_id.`);
  return String(data.id);
}

async function main() {
  const args = parseArgs();
  const record = loadIssuanceRecord();
  const tokenomics = resolveTokenomics(record, { allowIllustrative: false });

  const facts: BitcentEtchFacts = {
    txHash: args.txHash,
    network: args.network,
    mandateCommitment: args.mandateCommitment,
    requiredSignatory: 'aigent-nakamoto',
    requiredSignatoryReason: 'issuance record ratified, network authorised, amount within cap',
    observer: 'aigent-kn0w1',
    observerReason: 'sole-principal context and issuance-record ratification confirmed',
    transactionClass: 'bitcent-treasury-ordinary',
    runeName: tokenomics.name,
    symbol: tokenomics.symbol,
    maxSupply: tokenomics.maxSupply,
    premine: tokenomics.premine,
    initiallyActiveIssuance: tokenomics.initiallyActiveIssuance,
    governedReserve: tokenomics.governedReserve,
    premineCustodianAddress: record.premineCustodian.value,
    deployerAddress: args.deployerAddress,
  };

  console.log('Resolving Aigent Z persona_id (personas.fio_handle = aigentz@aigent)...');
  const personaId = await resolveAigentZPersonaId();
  console.log(`Resolved. Recording receipt for tx ${facts.txHash} on ${facts.network}...`);

  const receipt = await recordBitcentEtchReceipt(facts, personaId);
  if (!receipt) {
    console.error('createActivityReceipt returned null -- check the warnings above (missing table/column).');
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ Receipt recorded.');
  console.log('  id:             ', receipt.id);
  console.log('  actionType:     ', receipt.actionType);
  console.log('  receiptStatus:  ', receipt.receiptStatus, '(DVN anchoring is fire-and-forget -- check again shortly for dvn_recorded)');
  console.log('  createdAt:      ', receipt.createdAt);
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
