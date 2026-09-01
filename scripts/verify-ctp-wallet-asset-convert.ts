/**
 * Live acceptance verification: ctp.wallet.asset.convert (CTP Slice C,
 * commit 25ba5ac26) — steps 2-8 of the operator's checklist.
 *
 * Calls `constitutionalRuntime.execute('ctp.wallet.asset.convert', ...)`
 * DIRECTLY with a real service-role admin client — the EXACT same call
 * `app/api/wallet/qct/convert/usdc-to-qc/route.ts` makes (see that file's
 * `constitutionalRuntime.execute(admin, 'ctp.wallet.asset.convert', ...)`
 * line). This script exists because this sandboxed session has no live
 * Supabase credentials and no authenticated HTTP session to actually call
 * the deployed route with — it exercises the real business logic and real
 * DB writes, which the route's own handler does nothing beyond wrapping.
 *
 * This script NEVER credits or fabricates funds — the target persona must
 * already hold a real USDC balance >= the amount(s) used.
 *
 * Usage:
 *   # Single conversion (steps 2-6, 8):
 *   npx tsx scripts/verify-ctp-wallet-asset-convert.ts \
 *     --persona-id=<uuid> --usdc-amount=1
 *
 *   # Add the concurrency rehearsal (step 7) — fires TWO simultaneous
 *   # conversions of --concurrency-amount each against the SAME balance:
 *   npx tsx scripts/verify-ctp-wallet-asset-convert.ts \
 *     --persona-id=<uuid> --usdc-amount=1 --concurrency-amount=5
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { constitutionalRuntime } from '../services/ctp/constitutionalRuntime';
import '../services/ctp/primitives/walletAssetConvert';
import { getWalletAssetBalance } from '../services/wallet/qctLedgerService';

function argValue(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.slice(flag.length + 3) : null;
}

async function readBalances(personaId: string) {
  const [usdc, qct] = await Promise.all([
    getWalletAssetBalance(personaId, 'USDC'),
    getWalletAssetBalance(personaId, 'QCT'),
  ]);
  return { usdc: usdc.balance?.balance ?? 0, qct: qct.balance?.balance ?? 0 };
}

async function runOneConversion(admin: ReturnType<typeof createClient>, personaId: string, usdcAmount: number) {
  return constitutionalRuntime.execute(
    admin,
    'ctp.wallet.asset.convert',
    { channel: 'web', channelSessionRef: null, callerPersonaId: personaId, callerAuthProfileId: null },
    { usdcAmount },
  );
}

async function main() {
  const personaId = argValue('persona-id');
  const usdcAmount = Number(argValue('usdc-amount'));
  const concurrencyAmountRaw = argValue('concurrency-amount');
  const concurrencyAmount = concurrencyAmountRaw ? Number(concurrencyAmountRaw) : null;

  if (!personaId || !Number.isFinite(usdcAmount) || usdcAmount <= 0) {
    console.error('Usage: npx tsx scripts/verify-ctp-wallet-asset-convert.ts --persona-id=<uuid> --usdc-amount=<positive number> [--concurrency-amount=<positive number>]');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // ── STEP 2: one real conversion ────────────────────────────────────────
  const before = await readBalances(personaId);
  console.log(`\n=== Before ===\nUSDC: ${before.usdc}\nBASE_QC: ${before.qct}\n`);
  if (before.usdc < usdcAmount) {
    console.error(`❌ Persona ${personaId} holds only ${before.usdc} USDC — need >= ${usdcAmount}. This script never credits funds. Fund the wallet first, then re-run.`);
    process.exit(1);
  }

  console.log(`Converting ${usdcAmount} USDC -> BASE_QC for persona ${personaId} via constitutionalRuntime.execute('ctp.wallet.asset.convert', ...)...\n`);
  const outcome = await runOneConversion(admin, personaId, usdcAmount);

  if (!outcome.ok) {
    console.error(`❌ REFUSED: ${outcome.refusal.reasonCode} — ${outcome.refusal.reason}`);
    console.log('Refusal evidence ID:', outcome.refusal.evidenceId);
    process.exit(1);
  }

  const result = outcome.result;
  console.log('✓ SUCCESS');
  console.log('  conversionId:', result.conversionId);
  console.log('  debitTxId:', result.debitTxId);
  console.log('  creditTxId:', result.creditTxId);
  console.log('  USDC:', result.priorUsdcBalance, '->', result.resultingUsdcBalance);
  console.log('  BASE_QC:', result.priorBaseQcBalance, '->', result.resultingBaseQcBalance);
  console.log('  CTP evidence ID:', outcome.receipt.evidenceId);

  // ── STEP 3+8: re-read authoritative balances — never trust the return alone ──
  const afterFirst = await readBalances(personaId);
  console.log(`\n=== After (re-read from wallet_balances directly) ===\nUSDC: ${afterFirst.usdc}\nBASE_QC: ${afterFirst.qct}`);
  const atomicOk = afterFirst.usdc === result.resultingUsdcBalance && afterFirst.qct === result.resultingBaseQcBalance;
  console.log(atomicOk ? '✓ Re-read balances match the RPC-returned committed balances (atomic, no drift).' : '❌ MISMATCH between re-read balances and the RPC-returned result — investigate before trusting this run.');

  // ── STEP 4: two wallet_transactions rows ───────────────────────────────
  const { data: txRows, error: txErr } = await admin
    .from('wallet_transactions')
    .select('id, asset_code, amount, direction, created_at')
    .in('id', [result.debitTxId, result.creditTxId]);
  if (txErr) {
    console.error('❌ Could not read wallet_transactions:', txErr.message);
  } else {
    console.log(`\n✓ wallet_transactions rows found: ${txRows?.length ?? 0} (expected 2)`);
    console.log(JSON.stringify(txRows, null, 2));
  }

  // ── STEP 5+6: ONE SUCCESS ctp_transition_evidence row, balances match ──
  const { data: evidenceRows, error: evErr } = await admin
    .from('ctp_transition_evidence')
    .select('*')
    .eq('id', outcome.receipt.evidenceId);
  if (evErr) {
    console.error('❌ Could not read ctp_transition_evidence:', evErr.message);
  } else {
    console.log(`\n✓ ctp_transition_evidence rows found for this evidence ID: ${evidenceRows?.length ?? 0} (expected 1)`);
    const row = evidenceRows?.[0];
    if (row) {
      console.log('  outcome:', row.outcome);
      console.log('  prior_state:', JSON.stringify(row.prior_state));
      console.log('  resulting_state:', JSON.stringify(row.resulting_state));
      console.log('  realized_consequence:', JSON.stringify(row.realized_consequence));
      const priorMatches = row.prior_state?.usdcBalance === result.priorUsdcBalance;
      const resultingMatches = row.resulting_state?.usdcBalance === result.resultingUsdcBalance;
      console.log(priorMatches && resultingMatches ? '✓ Evidence prior/resulting state matches the RPC-returned committed balances.' : '❌ Evidence state does not match the RPC-returned balances — investigate.');
    }
  }

  // ── STEP 7 (optional): live two-call concurrency rehearsal ────────────
  if (concurrencyAmount) {
    console.log(`\n=== Concurrency rehearsal: two simultaneous ${concurrencyAmount} USDC conversions ===`);
    const before2 = await readBalances(personaId);
    console.log('Balance before race:', before2);

    const [r1, r2] = await Promise.allSettled([
      runOneConversion(admin, personaId, concurrencyAmount),
      runOneConversion(admin, personaId, concurrencyAmount),
    ]);
    const outcomes = [r1, r2].map((r) => (r.status === 'fulfilled' ? r.value : { ok: false as const, refusal: { reasonCode: 'PROMISE_REJECTED', reason: String((r as PromiseRejectedResult).reason) } }));
    const succeeded = outcomes.filter((o) => o.ok);
    const refused = outcomes.filter((o) => !o.ok);

    console.log(`Succeeded: ${succeeded.length} / 2`);
    console.log(`Refused: ${refused.length} / 2`, refused.map((o: any) => o.refusal?.reasonCode));

    const after2 = await readBalances(personaId);
    console.log('Balance after race:', after2);

    const expectedDebit = succeeded.length * concurrencyAmount;
    const actualDebit = before2.usdc - after2.usdc;
    const noLostUpdate = Math.abs(actualDebit - expectedDebit) < 1e-8 && after2.usdc >= -1e-8;
    console.log(
      noLostUpdate
        ? `✓ No lost update / no overdraft: exactly ${succeeded.length} conversion(s) applied (debited ${actualDebit}, expected ${expectedDebit}), resulting balance non-negative.`
        : `❌ RACE DEFECT: expected debit ${expectedDebit} (${succeeded.length} succeeded x ${concurrencyAmount}) but actual debit was ${actualDebit}. Investigate immediately — this would mean the atomic function's locking failed.`,
    );
  }
}

const isRunDirectly = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (isRunDirectly) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
