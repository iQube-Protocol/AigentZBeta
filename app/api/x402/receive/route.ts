import { NextRequest, NextResponse } from 'next/server';
import { resolveIdentity } from '@/services/identity/identityResolver';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export async function POST(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries());
  const payload = await req.json().catch(() => ({}));
  const intent = headers['x-402-intent'];
  const sender = headers['x-402-sender'];
  const recipient = headers['x-402-recipient'];
  if (!intent || !sender || !recipient) {
    return NextResponse.json({ ok: false, error: 'Missing required x402 headers' }, { status: 400 });
  }
  const resolvedSender = await resolveIdentity(sender);
  const resolvedRecipient = await resolveIdentity(recipient);
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });
  }
  const insertHeaders = {
    ...headers,
    'x-402-resolved-sender': resolvedSender.canonicalDid,
    'x-402-resolved-recipient': resolvedRecipient.canonicalDid,
  };
  const { data: msgRow, error: msgErr } = await supabase
    .from('x402_messages')
    .insert({
      intent,
      headers: insertHeaders,
      payload,
      state: 'received',
      resolved_sender_did: resolvedSender.canonicalDid,
      resolved_recipient_did: resolvedRecipient.canonicalDid,
    })
    .select('id')
    .single();
  if (msgErr) {
    return NextResponse.json({ ok: false, error: msgErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: { messageId: msgRow.id } }, { status: 202 });
}
