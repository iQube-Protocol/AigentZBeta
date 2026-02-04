import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500,  });

  const { searchParams } = new URL(req.url);
  const did = searchParams.get('did');
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
  if (!did) return NextResponse.json({ ok: false, error: 'did required' }, { status: 400,  });
  const didNoFrag = did.includes('#') ? did.split('#')[0] : did;
  const isMissingColumn = (err?: { message?: string } | null) => {
    const msg = (err?.message || '').toLowerCase();
    return msg.includes('column') && msg.includes('does not exist');
  };

  const run = (val: string) =>
    supabase
      .from('custody_events')
      .select('*')
      .eq('to_did', val)
      .order('created_at', { ascending: false })
      .limit(limit);

  const r1 = await run(did);
  if (r1.data && r1.data.length > 0) return NextResponse.json({ ok: true, data: r1.data });
  const r2 = await run(didNoFrag);
  if (r2.data && r2.data.length > 0) return NextResponse.json({ ok: true, data: r2.data });
  const likeVal = `${didNoFrag}#%`;
  const r3 = await supabase
    .from('custody_events')
    .select('*')
    .ilike('to_did', likeVal)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (r3.data && r3.data.length > 0) return NextResponse.json({ ok: true, data: r3.data });

  if (r1.error && !isMissingColumn(r1.error)) return NextResponse.json({ ok: false, error: r1.error.message }, { status: 500,  });
  if (r2.error && !isMissingColumn(r2.error)) return NextResponse.json({ ok: false, error: r2.error.message }, { status: 500,  });
  if (r3.error && !isMissingColumn(r3.error)) return NextResponse.json({ ok: false, error: r3.error.message }, { status: 500,  });
  return NextResponse.json({ ok: true, data: [] });
}

export async function OPTIONS() {
  return new Response(null);
}
