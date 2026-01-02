import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { personaId, referrerId, referralMethod, referralIdentifier } = await request.json();
    
    if (!personaId || !referrerId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check if referrer is already locked
    const { data: persona } = await supabase
      .from('personas')
      .select('referral_locked_at, referred_by_persona_id')
      .eq('id', personaId)
      .single();
    
    if (persona?.referral_locked_at) {
      return NextResponse.json({ 
        success: false, 
        error: 'Referrer already set and locked',
        locked: true 
      }, { status: 400 });
    }
    
    // Set referrer and lock
    const { error } = await supabase
      .from('personas')
      .update({
        referred_by_persona_id: referrerId,
        referral_locked_at: new Date().toISOString(),
        referral_method: referralMethod || 'persona_name',
        referral_identifier: referralIdentifier
      })
      .eq('id', personaId);
    
    if (error) {
      console.error('Error setting referrer:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Create referral event
    await supabase
      .from('referral_events')
      .insert({
        referrer_persona_id: referrerId,
        referee_persona_id: personaId,
        event_type: 'signed_up',
        metadata: { method: referralMethod, identifier: referralIdentifier }
      });
    
    return NextResponse.json({ success: true, locked: true });
  } catch (error) {
    console.error('Set referrer error:', error);
    return NextResponse.json({ success: false, error: 'Failed to set referrer' }, { status: 500 });
  }
}
