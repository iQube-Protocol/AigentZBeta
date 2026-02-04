import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { domain, username, displayName, tenantId } = await req.json();
    if (!domain || !username || !displayName) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }
    const fioHandle = `${username}@${domain}`;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
    const addr = '0x' + hex;
    const { data, error } = await supabase.from('personas').insert({
      fio_handle: fioHandle, fio_domain: domain, display_name: displayName,
      root_did: `did:fio:${fioHandle}`, evm_key: { address: addr },
      chain_addresses: {}, tenant_id: tenantId || 'default'
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, persona: { ...data, evmKey: { address: addr } } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
