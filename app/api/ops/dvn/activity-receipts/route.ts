import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DVN_ACTION_TYPES = ['agent_delegated', 'agent_delegation_revoked'];

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('activity_receipts')
    .select('id, action_type, receipt_status, summary, created_at, dvn_receipt_id')
    .in('action_type', DVN_ACTION_TYPES)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ receipts: data ?? [] });
}
