import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500,  });

  const { searchParams } = new URL(req.url);
  const did = searchParams.get('did');
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
  if (!did) return NextResponse.json({ ok: false, error: 'did required' }, { status: 400,  });

  const { data, error } = await supabase
    .from('custody_events')
    .select('*')
    .eq('to_did', did)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500,  });
  return NextResponse.json({ ok: true, data });
}

export async function OPTIONS() {
  return new Response(null);
}
