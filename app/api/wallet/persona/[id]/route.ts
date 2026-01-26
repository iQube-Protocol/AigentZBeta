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
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface RouteParams {
  params: { id: string };
}

function toOwnerSafePersona(record: any) {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    authProfileId: record.auth_profile_id ?? null,
    displayName: record.display_name,
    avatarUri: record.avatar_uri ?? null,
    fioHandle: record.fio_handle,
    fioDomain: record.fio_domain ?? null,
    discoverableWithinTenant: !!record.discoverable_within_tenant,
    reputationScore: record.reputation_score ?? 0,
    reputationBucket: record.reputation_bucket ?? 0,
    badges: record.badges || [],
    defaultIdentityState: record.default_identity_state ?? null,
    worldIdStatus: record.world_id_status ?? null,
    appOrigin: record.app_origin ?? null,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function toPublicSafePersona(record: any, fioVisible: boolean) {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    displayName: record.display_name,
    avatarUri: record.avatar_uri ?? null,
    fioHandle: fioVisible ? record.fio_handle : null,
    fioDomain: record.fio_domain ?? null,
    discoverableWithinTenant: !!record.discoverable_within_tenant,
    reputationScore: record.reputation_score ?? 0,
    reputationBucket: record.reputation_bucket ?? 0,
    badges: record.badges || [],
    defaultIdentityState: record.default_identity_state ?? null,
    worldIdStatus: record.world_id_status ?? null,
    appOrigin: record.app_origin ?? null,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
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
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    
    const { data, error } = await supabase
      .from('personas')
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at'
      )
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
    
    if (data.auth_profile_id && data.auth_profile_id === callerAuthProfileId) {
      return NextResponse.json({ ok: true, persona: toOwnerSafePersona(data) });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const canReveal =
      !!tenantId &&
      tenantId === data.tenant_id &&
      data.discoverable_within_tenant === true;

    return NextResponse.json({ ok: true, persona: toPublicSafePersona(data, !!canReveal) });
    
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
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const updates = await request.json();

    const { data: existing, error: existingError } = await supabase
      .from('personas')
      .select('id,auth_profile_id')
      .eq('id', id)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }
    if (!existing.auth_profile_id || existing.auth_profile_id !== callerAuthProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Transform camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {};
    
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.avatarUri !== undefined) dbUpdates.avatar_uri = updates.avatarUri;
    if (updates.reputationScore !== undefined) dbUpdates.reputation_score = updates.reputationScore;
    if (updates.reputationBucket !== undefined) dbUpdates.reputation_bucket = updates.reputationBucket;
    if (updates.badges !== undefined) dbUpdates.badges = updates.badges;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.updatedAt !== undefined) dbUpdates.updated_at = updates.updatedAt;
    if (updates.discoverableWithinTenant !== undefined) {
      dbUpdates.discoverable_within_tenant = !!updates.discoverableWithinTenant;
    }
    
    // Always update the updated_at timestamp
    dbUpdates.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('personas')
      .update(dbUpdates)
      .eq('id', id)
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at'
      )
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
    
    return NextResponse.json({ ok: true, persona: toOwnerSafePersona(data) });
    
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
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const { data: existing, error: existingError } = await supabase
      .from('personas')
      .select('id,auth_profile_id')
      .eq('id', id)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }
    if (!existing.auth_profile_id || existing.auth_profile_id !== callerAuthProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
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
