import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { messageId, proofOfDelivery, bridgeMessageId } = body || {};
  if (!messageId) return NextResponse.json({ ok: false, error: 'messageId required' }, { status: 400 });
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });

  const updates: any = { state: 'finalized' };
  if (bridgeMessageId) updates.bridge_message_id = bridgeMessageId;
  if (proofOfDelivery) updates.proofs = { pod: proofOfDelivery };

  const { error: msgErr } = await supabase
    .from('x402_messages')
    .update(updates)
    .eq('id', messageId);
  if (msgErr) return NextResponse.json({ ok: false, error: msgErr.message }, { status: 500 });

  const { error: settleErr } = await supabase
    .from('x402_settlements')
    .update({ status: 'released' })
    .eq('message_id', messageId);
  if (settleErr) return NextResponse.json({ ok: false, error: settleErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
