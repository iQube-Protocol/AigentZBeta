/**
 * Persona API Route - Single Persona Operations
 * 
 * GET - Get persona by ID
 * PATCH - Update persona
 * DELETE - Delete persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PersonaQube } from '@/types/persona';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/wallet/persona/[id]
 * Get a single persona by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 }
        );
      }
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch persona' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(transformPersona(data));
    
  } catch (error) {
    console.error('Error fetching persona:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/wallet/persona/[id]
 * Update a persona
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    const updates = await request.json();
    
    // Transform camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {};
    
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.avatarUri !== undefined) dbUpdates.avatar_uri = updates.avatarUri;
    if (updates.reputationScore !== undefined) dbUpdates.reputation_score = updates.reputationScore;
    if (updates.reputationBucket !== undefined) dbUpdates.reputation_bucket = updates.reputationBucket;
    if (updates.badges !== undefined) dbUpdates.badges = updates.badges;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.updatedAt !== undefined) dbUpdates.updated_at = updates.updatedAt;
    
    // Always update the updated_at timestamp
    dbUpdates.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('personas')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 }
        );
      }
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update persona' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(transformPersona(data));
    
  } catch (error) {
    console.error('Error updating persona:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wallet/persona/[id]
 * Delete a persona (soft delete - sets status to 'deleted')
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    // Soft delete - just update status
    const { error } = await supabase
      .from('personas')
      .update({ 
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to delete persona' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting persona:', error);
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
