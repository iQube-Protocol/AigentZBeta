/**
 * Persona API Route
 * 
 * POST - Create a new persona
 * GET - Get all personas for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PersonaQube } from '@/types/persona';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';
import { getSubscriberPersonaLimit } from '@/services/billing/personaPlan';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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

/**
 * POST /api/wallet/persona
 * Create a new persona
 */
export async function POST(request: NextRequest) {
  try {
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Plan-tier persona cap (per-subscriber). The cap is the highest active
    // plan across all personas the caller owns; cancelled plans fall to free.
    // Counts existing non-deleted personas under this auth_profile.
    const { personaLimit, planLabel } = await getSubscriberPersonaLimit(supabase, callerAuthProfileId);
    const { count: personaCount } = await supabase
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('auth_profile_id', callerAuthProfileId)
      .neq('status', 'deleted');
    if ((personaCount ?? 0) >= personaLimit) {
      return NextResponse.json(
        {
          error: 'persona_limit_reached',
          message:
            personaLimit <= 1
              ? `Your ${planLabel} plan includes 1 persona. Upgrade to Sovereignty (3), Stewardship (8), or a Founder Office tier for more.`
              : `Your ${planLabel} plan includes ${personaLimit} personas. Upgrade your tier to create more.`,
          limit: personaLimit,
          current: personaCount ?? 0,
        },
        { status: 403 },
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
        auth_profile_id: callerAuthProfileId,
        discoverable_within_tenant: false,
        created_at: persona.createdAt,
        updated_at: persona.updatedAt,
      })
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at'
      )
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create persona', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(toOwnerSafePersona(data), { status: 201 });
    
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
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = searchParams.get('tenantId');
    // includeArchived=true → show active + inactive; default → active only.
    // Deleted and suspended personas are never returned to the owner here.
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let query = supabase
      .from('personas')
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at'
      )
      .eq('auth_profile_id', callerAuthProfileId)
      .in('status', includeArchived ? ['active', 'inactive'] : ['active']);

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
    
    return NextResponse.json({ ok: true, personas: (data || []).map(toOwnerSafePersona) });
    
  } catch (error) {
    console.error('Error fetching personas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
