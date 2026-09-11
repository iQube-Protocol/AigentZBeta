import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';
import { dedupePersonaInventory, listVisiblePersonaInventory } from '@/services/wallet/personaInventory';

// Anon client for validating user JWTs (service role client cannot use getUser with token).
// Keep on bare createClient — JWT validation hits /auth/v1/user, not the DB, so the
// timeout guard from getSupabaseServer is unnecessary here.
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const dynamic = 'force-dynamic';

export type PersonaRow = {
  id: string;
  tenant_id: string;
  auth_profile_id: string | null;
  display_name: string;
  avatar_uri: string | null;
  fio_handle: string;
  fio_domain: string | null;
  discoverable_within_tenant: boolean | null;
  reputation_score: number | null;
  reputation_bucket: number | null;
  badges: string[] | null;
  default_identity_state: string | null;
  world_id_status: string | null;
  app_origin: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export function dedupeById(rows: PersonaRow[]): PersonaRow[] {
  return dedupePersonaInventory(rows);
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
    // Canonical EVM address for FIO handle → chain resolution
    evmAddress: record.evm_address || record.evm_key?.address || record.evm_key?.evmAddress || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    // Also include the raw Supabase auth.users.id — personas created before
    // canonicalization may still carry this UUID as their auth_profile_id.
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let supabaseUserId: string | null = null;
    if (bearerToken) {
      const { data: userData } = await supabaseAnon.auth.getUser(bearerToken);
      if (userData?.user?.id) supabaseUserId = userData.user.id;
    }

    const includeArchived = searchParams.get('includeArchived') === 'true';
    const merged = await listVisiblePersonaInventory(supabase, {
      callerAuthProfileId,
      legacyAuthUserId: supabaseUserId,
      tenantId,
      includeArchived,
    });
    return NextResponse.json(merged.map(toOwnerSafePersona));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
