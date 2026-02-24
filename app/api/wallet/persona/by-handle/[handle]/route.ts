import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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

export async function GET(request: NextRequest, { params }: { params: { handle: string } }) {
  try {
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const handle = decodeURIComponent(params.handle).trim().toLowerCase();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    let query = supabase
      .from('personas')
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at'
      )
      .ilike('fio_handle', handle);

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Persona not found' }, { status: 404 });

    const isOwner = !!data.auth_profile_id && data.auth_profile_id === callerAuthProfileId;
    const isDiscoverable =
      !!tenantId && tenantId === data.tenant_id && data.discoverable_within_tenant === true;

    if (!isOwner && !isDiscoverable) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    return NextResponse.json(toPublicSafePersona(data, isOwner || isDiscoverable));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

