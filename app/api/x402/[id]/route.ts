import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });

  const { data: msg, error: msgErr } = await supabase
    .from('x402_messages')
    .select('*')
    .eq('id', id)
    .single();
  if (msgErr || !msg) return NextResponse.json({ ok: false, error: msgErr?.message || 'Not found' }, { status: 404 });

  const { data: settlement } = await supabase
    .from('x402_settlements')
    .select('*')
    .eq('message_id', id)
    .maybeSingle();

  const { data: delivery } = await supabase
    .from('deliveries')
    .select('*')
    .eq('message_id', id)
    .maybeSingle();

  const { data: events } = await supabase
    .from('iqube_events')
    .select('*')
    .eq('x402_message_id', id);

  return NextResponse.json({ ok: true, data: { message: msg, settlement, delivery, events } }, { status: 200 });
}
