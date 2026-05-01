import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    // Get all agent personas with their tenant info
    const { data: personas, error } = await supabase
      .from('personas')
      .select('id, fio_handle, tenant_id, discoverable_within_tenant, display_name')
      .in('fio_handle', [
        'aigentz@aigent',
        'moneypenny@aigent', 
        'kn0w1@aigent',
        'nakamoto@aigent',
        'marketa@aigent'
      ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      personas: personas || [],
      count: personas?.length || 0
    });

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
