import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  try {
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    let query = supabase
      .from('personas')
      .select(
        'id,tenant_id,auth_profile_id,display_name,avatar_uri,fio_handle,fio_domain,discoverable_within_tenant,reputation_score,reputation_bucket,badges,default_identity_state,world_id_status,app_origin,status,created_at,updated_at'
      )
      .eq('auth_profile_id', callerAuthProfileId);

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });

    return NextResponse.json((data || []).map(toOwnerSafePersona));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

