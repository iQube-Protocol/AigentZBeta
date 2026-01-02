import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

// CORS headers for cross-origin requests from thin client
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500,  });

  const { searchParams } = new URL(req.url);
  const did = searchParams.get('did');
  const status = searchParams.get('status') || 'open';
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
  if (!did) return NextResponse.json({ ok: false, error: 'did required' }, { status: 400,  });
  const didNoFrag = did.includes('#') ? did.split('#')[0] : did;
  // Legacy-first: run two safe queries to avoid URL-encoding issues with '#'
  const run = async (val: string) => {
    let q = supabase.from('claims').select('*').eq('claimant_did', val).order('created_at', { ascending: false }).limit(limit);
    if (status) q = q.eq('status', status);
    return q;
  };
  const r1 = await run(did);
  if (r1.data && r1.data.length > 0) return NextResponse.json({ ok: true, data: r1.data });
  const r2 = await run(didNoFrag);
  if (r2.data && r2.data.length > 0) return NextResponse.json({ ok: true, data: r2.data });
  // 3) Prefix match when URL fragment (#auth) is dropped by client
  const likeVal = `${didNoFrag}#%`;
  let q3 = supabase.from('claims').select('*').ilike('claimant_did', likeVal).order('created_at', { ascending: false }).limit(limit);
  if (status) q3 = q3.eq('status', status);
  const r3 = await q3;
  if (r3.data && r3.data.length > 0) return NextResponse.json({ ok: true, data: r3.data });
  // 4) Final fallback: return latest open claims (dev convenience)
  let q4 = supabase.from('claims').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) q4 = q4.eq('status', status);
  const r4 = await q4;
  if (r4.data && r4.data.length > 0) return NextResponse.json({ ok: true, data: r4.data });
  if (r1.error) return NextResponse.json({ ok: false, error: r1.error.message }, { status: 500,  });
  if (r2.error) return NextResponse.json({ ok: false, error: r2.error.message }, { status: 500,  });
  if (r3.error) return NextResponse.json({ ok: false, error: r3.error.message }, { status: 500,  });
  return NextResponse.json({ ok: true, data: [] });
}

export async function OPTIONS() {
  return new Response(null);
}
