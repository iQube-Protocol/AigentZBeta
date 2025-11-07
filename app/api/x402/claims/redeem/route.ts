import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';
import { executeClaimRedeem } from '@/services/x402/exec';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });

  try {
    const body = await req.json().catch(() => ({}));
    const claimId: string | undefined = body?.claimId;
    const toAddress: string | undefined = body?.toAddress; // optional override
    if (!claimId) return NextResponse.json({ ok: false, error: 'claimId required' }, { status: 400 });

    const { data: claim, error } = await supabase
      .from('claims')
      .select('*')
      .eq('claim_id', claimId)
      .single();
    if (error || !claim) return NextResponse.json({ ok: false, error: error?.message || 'Claim not found' }, { status: 404 });
    if (claim.status !== 'open') return NextResponse.json({ ok: false, error: `Claim status is ${claim.status}` }, { status: 400 });

    // Convert amount (q¢ integer) to wei for QCT-like flows (18 decimals)
    const amountQcent = BigInt(String(claim.amount || '0'));
    const amountWei = (amountQcent * 10n ** 18n).toString();

    const res = await executeClaimRedeem({
      claimId: claim.claim_id,
      toAddress,
      amountWei,
      toChain: String(claim.to_chain),
      dvnAttestation: String(claim.dvn_root || ''),
    });

    // Optionally update status if actually executed
    if (res.executed && res.txHash) {
      await supabase.from('claims').update({ status: 'redeemed' }).eq('claim_id', claimId);
    }

    return NextResponse.json({ ok: true, executed: res.executed, txHash: res.txHash, plan: res.plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'redeem error' }, { status: 500 });
  }
}
