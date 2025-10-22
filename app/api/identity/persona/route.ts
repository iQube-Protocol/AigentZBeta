import { NextRequest, NextResponse } from 'next/server';
import { PersonaService } from '@/services/identity/personaService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// CRITICAL: Must use SERVICE_ROLE_KEY to bypass RLS for persona operations
// Try multiple possible environment variable names
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Log environment variable status for debugging
console.log('[Persona API] Environment check:', {
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasPublicServiceRoleKey: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  usingKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON'
});

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[Persona API] WARNING: SUPABASE_SERVICE_ROLE_KEY not set! RLS policies will apply and may cause errors.');
  console.error('[Persona API] Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (id) {
      // Fetch single persona by ID
      const { data: persona, error } = await supabase
        .from('persona_with_reputation')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({ ok: true, data: persona });
    } else {
      // Fetch all personas
      const { data: personas, error } = await supabase
        .from('persona_with_reputation')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({ ok: true, data: personas || [] });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch persona(s)' }, { status: 500 });
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
