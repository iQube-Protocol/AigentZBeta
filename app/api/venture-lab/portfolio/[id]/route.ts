import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getActivePersona } from '@/services/identity/getActivePersona';

// Security fix, 2026-07-28 — see app/api/venture-lab/portfolio/route.ts's
// header. Same table, same prior gap (unauthenticated GET, unauthenticated
// PATCH of an arbitrary row's maturity/commercialization/status).

function computeZone(y: number, x: number): string {
  const sum = y + x;
  if (sum <= 4)  return 'formation';
  if (sum <= 7)  return 'validation';
  if (sum <= 10) return 'activation';
  if (sum <= 12) return 'strategic';
  return 'scale';
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

    const { data, error } = await supabase
      .from('venture_lab_scorecard')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, venture: data });
  } catch (err: unknown) {
    console.error('[venture-lab/portfolio/[id] GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (persona.cartridgeFlags?.isAdmin !== true) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }
    const supabase = getSupabaseServer();
    if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

    const body = await req.json();
    const allowed = ['venture_name', 'y_maturity', 'x_commercialization', 'payload', 'status'];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }

    if ('y_maturity' in patch || 'x_commercialization' in patch) {
      const { data: existing } = await supabase
        .from('venture_lab_scorecard')
        .select('y_maturity, x_commercialization')
        .eq('id', params.id)
        .single();

      const y = Number(patch.y_maturity ?? existing?.y_maturity ?? 1);
      const x = Number(patch.x_commercialization ?? existing?.x_commercialization ?? 1);
      patch.zone = computeZone(y, x);
    }

    const { data, error } = await supabase
      .from('venture_lab_scorecard')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, venture: data });
  } catch (err: unknown) {
    console.error('[venture-lab/portfolio/[id] PATCH]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
