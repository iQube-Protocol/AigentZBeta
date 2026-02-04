import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();
    
    if (!identifier) {
      return NextResponse.json({ valid: false, error: 'Identifier required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    let persona = null;
    
    // Normalize format: convert 'user@knyt' to '@knyt:user'
    let normalized = identifier;
    if (identifier.includes('@') && !identifier.startsWith('@')) {
      const [user, domain] = identifier.split('@');
      normalized = `@${domain}:${user}`;
    }
    
    // Determine identifier type and search
    if (normalized.startsWith('@knyt:')) {
      const handle = normalized.replace('@knyt:', '') + '@knyt';
      const { data } = await supabase
        .from('personas')
        .select('id, fio_handle, display_name')
        .eq('fio_handle', handle)
        .single();
      persona = data;
    } else if (normalized.startsWith('@qripto:')) {
      const handle = normalized.replace('@qripto:', '') + '@qripto';
      const { data } = await supabase
        .from('personas')
        .select('id, fio_handle, display_name')
        .eq('fio_handle', handle)
        .single();
      persona = data;
    } else if (identifier.includes('@')) {
      // Email lookup
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', identifier)
        .single();
      
      if (user) {
        const { data } = await supabase
          .from('personas')
          .select('id, fio_handle, display_name')
          .eq('user_id', user.id)
          .single();
        persona = data;
      }
    } else {
      // Display name fuzzy match
      const { data } = await supabase
        .from('personas')
        .select('id, fio_handle, display_name')
        .ilike('display_name', `%${identifier}%`)
        .limit(1)
        .single();
      persona = data;
    }
    
    if (!persona) {
      return NextResponse.json({ valid: false, error: 'Referrer not found' });
    }
    
    return NextResponse.json({ 
      valid: true, 
      persona: {
        id: persona.id,
        handle: persona.fio_handle,
        displayName: persona.display_name
      }
    });
  } catch (error) {
    console.error('Referral validation error:', error);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
