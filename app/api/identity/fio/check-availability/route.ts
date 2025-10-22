import { NextRequest, NextResponse } from 'next/server';
import { getFIOService } from '@/services/identity/fioService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Check FIO handle availability
 * POST /api/identity/fio/check-availability
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

    // FIRST: Check our database to prevent duplicates
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: existingPersona, error: dbError } = await supabase
      .from('persona')
      .select('id, fio_handle')
      .eq('fio_handle', handle)
      .maybeSingle();

    if (existingPersona) {
      console.log('[FIO Availability] Handle already exists in database:', handle);
      return NextResponse.json({
        ok: true,
        available: false,
        handle,
        reason: 'Handle already registered in our system'
      });
    }

    // SECOND: Check FIO blockchain
    const mockMode = process.env.FIO_MOCK_MODE === 'true';
    
    if (mockMode) {
      // In mock mode, only check database (already done above)
      console.log('[FIO Availability] MOCK MODE: Handle available in database');
      return NextResponse.json({
        ok: true,
        available: true,
        handle,
        mockMode: true
      });
    }

    // Real FIO blockchain check
    try {
      const fioService = getFIOService();
      await fioService.initialize({
        endpoint: process.env.FIO_API_ENDPOINT || 'https://testnet.fioprotocol.io/v1/',
        chainId: process.env.FIO_CHAIN_ID || 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e'
      });

      const available = await fioService.isHandleAvailable(handle);

      return NextResponse.json({
        ok: true,
        available,
        handle
      });
    } catch (fioError: any) {
      // If FIO API is down, still allow if not in our database
      console.warn('[FIO Availability] FIO API error, allowing based on database check:', fioError.message);
      return NextResponse.json({
        ok: true,
        available: true,
        handle,
        warning: 'FIO network unavailable, checked database only'
      });
    }
  } catch (e: any) {
    console.error('FIO availability check error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to check handle availability' },
      { status: 500 }
    );
  }
}
