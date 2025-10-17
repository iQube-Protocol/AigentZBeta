import { NextRequest, NextResponse } from 'next/server';
import { PersonaService } from '@/services/identity/personaService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  try {
    // Use persona_with_reputation view to include reputation data
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: personas, error } = await supabase
      .from('persona_with_reputation')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, data: personas || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to list personas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const svc = new PersonaService();
    const persona = await svc.createPersona({
      rootId: body?.rootId,
      fioHandle: body?.fioHandle,
      defaultState: body?.defaultState,
      appOrigin: body?.appOrigin,
      worldIdStatus: body?.worldIdStatus
    });
    return NextResponse.json({ ok: true, data: persona });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create persona' }, { status: 500 });
  }
}
