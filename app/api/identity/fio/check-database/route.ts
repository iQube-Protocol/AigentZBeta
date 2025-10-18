import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Check if FIO handle exists in our database
 * POST /api/identity/fio/check-database
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { handle } = body;

    if (!handle) {
      return NextResponse.json(
        { ok: false, error: 'Handle is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if handle already exists in our database
    const { data: existingPersonas, error } = await supabase
      .from('persona')
      .select('id, fio_handle')
      .eq('fio_handle', handle)
      .limit(1);

    if (error) {
      console.error('Database check error:', error);
      return NextResponse.json(
        { ok: false, error: 'Database check failed' },
        { status: 500 }
      );
    }

    const available = !existingPersonas || existingPersonas.length === 0;

    return NextResponse.json({
      ok: true,
      available,
      message: available ? 'Handle is available' : 'Handle already exists in database'
    });
  } catch (e: any) {
    console.error('FIO database check error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to check database' },
      { status: 500 }
    );
  }
}
