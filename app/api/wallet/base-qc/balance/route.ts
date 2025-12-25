/**
 * Base Q¢ Balance API
 * GET /api/wallet/base-qc/balance?personaId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sum all base_qc balances for this persona
    const { data, error } = await supabase
      .from('qc_balances')
      .select('balance')
      .eq('persona_id', personaId)
      .eq('currency', 'base_qc');

    if (error) {
      console.error('[Base Q¢] Error fetching balance:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const totalBalance = data?.reduce((sum, row) => sum + Number(row.balance), 0) || 0;

    return NextResponse.json({
      ok: true,
      personaId,
      balance: totalBalance,
      currency: 'base_qc'
    });

  } catch (error: any) {
    console.error('[Base Q¢] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
