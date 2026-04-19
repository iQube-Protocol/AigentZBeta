import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

function computeZone(y: number, x: number): string {
  const sum = y + x;
  if (sum <= 4)  return 'formation';
  if (sum <= 7)  return 'validation';
  if (sum <= 10) return 'activation';
  if (sum <= 12) return 'strategic';
  return 'scale';
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'active';

    const { data, error } = await supabase
      .from('venture_lab_scorecard')
      .select('*')
      .eq('status', status)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, ventures: data ?? [] });
  } catch (err: unknown) {
    console.error('[venture-lab/portfolio GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

    const body = await req.json();
    const { venture_name, venture_slug, y_maturity, x_commercialization, payload, created_by } = body;

    if (!venture_name || !venture_slug || !y_maturity || !x_commercialization) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const zone = computeZone(Number(y_maturity), Number(x_commercialization));

    const { data, error } = await supabase
      .from('venture_lab_scorecard')
      .insert({
        venture_name,
        venture_slug,
        y_maturity: Number(y_maturity),
        x_commercialization: Number(x_commercialization),
        zone,
        payload: payload ?? {},
        created_by: created_by ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, venture: data });
  } catch (err: unknown) {
    console.error('[venture-lab/portfolio POST]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
