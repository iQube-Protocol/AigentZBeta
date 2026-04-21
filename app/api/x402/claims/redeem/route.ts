import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';
import { executeClaimRedeem } from '@/services/x402/exec';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });

  try {
    const body = await req.json().catch(() => ({}));
    const claimId: string | undefined = body?.claimId;
    const toAddress: string | undefined = body?.toAddress; // optional override
    if (!claimId) return NextResponse.json({ ok: false, error: 'claimId required' }, { status: 400 });

    // Try new schema first (claim_id), then legacy (id)
    let { data: claim, error } = await supabase
      .from('claims')
      .select('*')
      .eq('claim_id', claimId)
      .single();
    if (error || !claim) {
      const fallback = await supabase
        .from('claims')
        .select('*')
        .eq('id', claimId)
        .single();
      claim = fallback.data as any;
      error = fallback.error as any;
      if (error || !claim) return NextResponse.json({ ok: false, error: error?.message || 'Claim not found' }, { status: 404 });
    }
    if (claim.status !== 'open') return NextResponse.json({ ok: false, error: `Claim status is ${claim.status}` }, { status: 400 });

    // KNYT ledger claims — credit the DVN KNYT balance directly, no EVM exec needed
    if (claim.asset === 'knyt') {
      const amountKnyt = parseFloat(String(claim.amount || '0'));
      if (amountKnyt <= 0) return NextResponse.json({ ok: false, error: 'Invalid KNYT claim amount' }, { status: 400 });

      const creditResult = await creditKnyt(
        String(claim.to_did),
        amountKnyt,
        'deferred_claim',
        { claimId: String(claim.claim_id || claim.id) },
      );

      if (!creditResult.success) {
        return NextResponse.json({ ok: false, error: creditResult.error || 'KNYT credit failed' }, { status: 500 });
      }

      await supabase.from('claims').update({ status: 'redeemed' }).eq('claim_id', claimId);

      return NextResponse.json({
        ok: true,
        executed: true,
        asset: 'knyt',
        amountKnyt,
        newBalance: creditResult.newBalance,
        transactionId: creditResult.transaction?.id,
      });
    }

    // EVM / QCT claims — convert amount to wei and execute on-chain
    const amountQcent = BigInt(String((claim.amount ?? claim.amount_qcent) || '0'));
    const amountWei = (amountQcent * 10n ** 18n).toString();

    const res = await executeClaimRedeem({
      claimId: String(claim.claim_id || claim.id),
      toAddress: toAddress || String(claim.redeem_to || ''),
      amountWei,
      toChain: String(claim.to_chain || 'polygon'),
      dvnAttestation: String(claim.dvn_root || ''),
    });

    // Optionally update status if actually executed
    if (res.executed && res.txHash) {
      await supabase.from('claims').update({ status: 'redeemed' }).eq('claim_id', claimId);
    }

    return NextResponse.json({ ok: true, executed: res.executed, txHash: res.txHash, plan: res.plan, reason: res.reason });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'redeem error' }, { status: 500 });
  }
}
