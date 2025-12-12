/**
 * Persona API Route
 * 
 * POST - Create a new persona
 * GET - Get all personas for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PersonaQube } from '@/types/persona';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * POST /api/wallet/persona
 * Create a new persona
 */
export async function POST(request: NextRequest) {
  try {
    const persona: PersonaQube = await request.json();
    
    // Validate required fields
    if (!persona.id || !persona.fioHandle || !persona.tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields: id, fioHandle, tenantId' },
        { status: 400 }
      );
    }
    
    // Check if handle already exists
    const { data: existing } = await supabase
      .from('personas')
      .select('id')
      .eq('fio_handle', persona.fioHandle)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { error: 'FIO handle already registered' },
        { status: 409 }
      );
    }
    
    // Insert persona
    const { data, error } = await supabase
      .from('personas')
      .insert({
        id: persona.id,
        type: persona.type,
        fio_handle: persona.fioHandle,
        fio_domain: persona.fioDomain,
        root_did: persona.rootDid,
        display_name: persona.displayName,
        avatar_uri: persona.avatarUri,
        evm_key: persona.evmKey,
        chain_addresses: persona.chainAddresses,
        reputation_score: persona.reputationScore,
        reputation_bucket: persona.reputationBucket,
        badges: persona.badges,
        status: persona.status,
        tenant_id: persona.tenantId,
        created_at: persona.createdAt,
        updated_at: persona.updatedAt,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create persona', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
    
  } catch (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wallet/persona
 * Get all personas (optionally filtered by authProfileId)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authProfileId = searchParams.get('authProfileId');
    const tenantId = searchParams.get('tenantId');
    
    let query = supabase.from('personas').select('*');
    
    if (authProfileId) {
      query = query.eq('auth_profile_id', authProfileId);
    }
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch personas' },
        { status: 500 }
      );
    }
    
    // Transform snake_case to camelCase
    const personas = data?.map(transformPersona) || [];
    
    return NextResponse.json(personas);
    
  } catch (error) {
    console.error('Error fetching personas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Transform database record to PersonaQube
 */
function transformPersona(record: any): PersonaQube {
  return {
    id: record.id,
    type: record.type,
    fioHandle: record.fio_handle,
    fioDomain: record.fio_domain,
    rootDid: record.root_did,
    displayName: record.display_name,
    avatarUri: record.avatar_uri,
    evmKey: record.evm_key,
    chainAddresses: record.chain_addresses,
    reputationScore: record.reputation_score,
    reputationBucket: record.reputation_bucket,
    badges: record.badges || [],
    status: record.status,
    tenantId: record.tenant_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
