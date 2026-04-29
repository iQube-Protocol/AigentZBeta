/**
 * POST /api/wallet/knyt/evm-deposit
 *
 * Verifies an Ethereum mainnet ERC-20 $KNYT Transfer to the treasury address,
 * then credits the equivalent amount to the persona's DVN KNYT ledger.
 *
 * Idempotent: duplicate txHash submissions are silently accepted (already-credited).
 *
 * Body: { txHash: string, personaId: string, amountKnyt?: number }
 * Response: { status: 'credited' | 'pending' | 'not_found' | 'already_credited', credited?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';

const KNYT_CONTRACT = '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4';
const TREASURY = (process.env.NEXT_PUBLIC_KNYT_TREASURY_ADDRESS ?? '').toLowerCase();
const ETH_RPC = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key);
}

interface EthReceipt {
  status?: string;
  logs?: Array<{
    address?: string;
    topics?: string[];
    data?: string;
  }>;
}

async function getReceipt(txHash: string): Promise<EthReceipt | null> {
  try {
    const res = await fetch(ETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });
    const json = await res.json() as { result?: EthReceipt };
    return json.result ?? null;
  } catch {
    return null;
  }
}

function parseTransferAmount(log: { topics?: string[]; data?: string }): bigint | null {
  // Transfer(from, to, value) — topics[1]=from, topics[2]=to, data=value
  if (!log.topics || log.topics.length < 3) return null;
  const raw = (log.data ?? '').replace(/^0x/, '') || '0';
  try {
    return BigInt('0x' + raw);
  } catch {
    return null;
  }
}

function formatUnits18(value: bigint): number {
  const divisor = 10n ** 18n;
  const whole = value / divisor;
  const frac = value % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

export async function POST(req: NextRequest) {
  let body: { txHash?: string; personaId?: string; amountKnyt?: number };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { txHash, personaId } = body;
  if (!txHash || !personaId) {
    return NextResponse.json({ error: 'txHash and personaId required' }, { status: 400 });
  }
  if (!TREASURY) {
    return NextResponse.json({ error: 'Treasury address not configured' }, { status: 500 });
  }

  // ── Idempotency check ──────────────────────────────────────────────────────
  try {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('persona_id', personaId)
      .eq('source', 'evm_deposit')
      .contains('metadata', { tx_hash: txHash })
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ status: 'already_credited', credited: true });
    }
  } catch {
    // non-fatal — continue to verify
  }

  // ── Fetch Ethereum receipt ─────────────────────────────────────────────────
  const receipt = await getReceipt(txHash);
  if (!receipt) {
    return NextResponse.json({ status: 'not_found', credited: false });
  }
  if (receipt.status !== '0x1') {
    return NextResponse.json({ status: 'failed', credited: false });
  }

  // ── Find matching Transfer log to treasury ─────────────────────────────────
  const logs = receipt.logs ?? [];
  let transferredAmount: bigint | null = null;

  for (const log of logs) {
    if (log.address?.toLowerCase() !== KNYT_CONTRACT.toLowerCase()) continue;
    if (!log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;

    const to = log.topics[2];
    if (!to) continue;
    const toAddr = '0x' + to.slice(-40);
    if (toAddr.toLowerCase() !== TREASURY) continue;

    transferredAmount = parseTransferAmount(log);
    if (transferredAmount !== null) break;
  }

  if (transferredAmount === null || transferredAmount === 0n) {
    return NextResponse.json({ status: 'no_transfer_to_treasury', credited: false });
  }

  const amountKnyt = formatUnits18(transferredAmount);

  // ── Credit DVN ledger ──────────────────────────────────────────────────────
  const result = await creditKnyt(personaId, amountKnyt, 'evm_deposit', { tx_hash: txHash });
  if (!result.success) {
    return NextResponse.json({ status: 'error', error: result.error, credited: false }, { status: 500 });
  }

  return NextResponse.json({
    status: 'credited',
    credited: true,
    amountKnyt,
    newBalance: result.newBalance,
  });
}
