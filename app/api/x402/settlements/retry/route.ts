import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });

  try {
    const body = await req.json().catch(() => ({}));
    const settlementId: string | undefined = body?.settlementId;
    const messageId: string | undefined = body?.messageId;

    if (!settlementId && !messageId) {
      return NextResponse.json({ ok: false, error: 'settlementId or messageId required' }, { status: 400 });
    }

    let settlement: any = null;
    if (settlementId) {
      const { data, error } = await supabase
        .from('x402_settlements')
        .select('id, message_id, asset, amount, status, escrow_tx, release_tx')
        .eq('id', settlementId)
        .single();
      if (error || !data) return NextResponse.json({ ok: false, error: error?.message || 'Settlement not found' }, { status: 404 });
      settlement = data;
    } else if (messageId) {
      const { data, error } = await supabase
        .from('x402_settlements')
        .select('id, message_id, asset, amount, status, escrow_tx, release_tx')
        .eq('message_id', messageId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return NextResponse.json({ ok: false, error: error?.message || 'Settlement not found' }, { status: 404 });
      settlement = data;
    }

    if (!settlement) return NextResponse.json({ ok: false, error: 'Settlement not found' }, { status: 404 });

    const { data: msg, error: msgErr } = await supabase
      .from('x402_messages')
      .select('id, headers, payload, intent')
      .eq('id', settlement.message_id)
      .single();
    if (msgErr || !msg) return NextResponse.json({ ok: false, error: msgErr?.message || 'Message not found' }, { status: 404 });

    const headers = (msg.headers || {}) as Record<string, string>;
    const chainIdHeader = headers['x-402-chainid'] || headers['x-402-chain-id'];
    const tokenHeader = headers['x-402-tokenaddress'] || headers['x-402-token-address'];
    const payToHeader = headers['x-402-payto'] || headers['x-402-pay-to'];
    const rawAmount = headers['x-402-amount'] || settlement.amount || '0';

    const chainId = Number(chainIdHeader || 80002);
    const tokenAddress = (tokenHeader as string) || '0x4C4f1aD931589449962bB675bcb8e95672349d09';
    const treasury = process.env.TREASURY_ADDRESS || '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5f';
    const to = (payToHeader as string) || treasury;

    const amountQcent = BigInt(String(rawAmount));
    const amountWei = (amountQcent * 10n ** 18n).toString();

    const signerUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/a2a/signer/transfer`;
    const a2aBody = {
      chainId,
      amount: amountWei,
      asset: 'QCT',
      agentId: 'aigent-z',
      to,
      tokenAddress,
    } as any;

    const r = await fetch(signerUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(a2aBody),
    });

    const text = await r.text();
    let txHash: string | null = null;
    try {
      const parsed = JSON.parse(text);
      txHash = parsed?.txHash || null;
    } catch {}

    if (!r.ok || !txHash) {
      return NextResponse.json({ ok: false, error: 'retry failed', response: text }, { status: 502 });
    }

    await supabase
      .from('x402_settlements')
      .update({ status: 'paid', escrow_tx: txHash })
      .eq('id', settlement.id);

    return NextResponse.json({ ok: true, settlementId: settlement.id, txHash });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'retry error' }, { status: 500 });
  }
}
