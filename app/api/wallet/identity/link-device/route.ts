import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDeterministicUuid(value: string): string {
  if (isUuid(value)) return value.toLowerCase();
  // For non-UUID strings, we cannot safely create a canonical UUID — reject them
  return '';
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST /api/wallet/identity/link-device
 *
 * Links a device-local authProfileId (from localStorage) to the caller's
 * canonical email-based crm_auth_profiles entry. This allows personas
 * created on a device before signing in to be visible after sign-in.
 *
 * Requires: Authorization: Bearer <supabase_access_token>
 * Body: { deviceProfileId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getCallerIdentityContext(request);
    if (!context?.authProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canonicalId = context.authProfileId;

    const body = await request.json().catch(() => ({}));
    const deviceProfileId = typeof body?.deviceProfileId === 'string' ? body.deviceProfileId.trim() : '';

    if (!deviceProfileId || !isUuid(deviceProfileId)) {
      return NextResponse.json({ error: 'Invalid deviceProfileId' }, { status: 400 });
    }

    const normalizedDeviceId = toDeterministicUuid(deviceProfileId);
    if (!normalizedDeviceId) {
      return NextResponse.json({ error: 'Invalid deviceProfileId format' }, { status: 400 });
    }

    // No-op if they're the same — prevents self-link constraint violation
    if (normalizedDeviceId === canonicalId.toLowerCase()) {
      return NextResponse.json({ linked: false, reason: 'same_profile' });
    }

    // Ensure the device profile exists in crm_auth_profiles (create with synthetic email if absent)
    const { data: existing } = await admin
      .from('crm_auth_profiles')
      .select('id')
      .eq('id', normalizedDeviceId)
      .maybeSingle();

    if (!existing?.id) {
      const syntheticEmail = `${normalizedDeviceId}@device.agentiq.local`;
      const { error: createErr } = await admin
        .from('crm_auth_profiles')
        .upsert(
          {
            id: normalizedDeviceId,
            email: syntheticEmail,
            email_verified: false,
            is_active: true,
            oauth_providers: {},
          },
          { onConflict: 'id' }
        );
      if (createErr) {
        return NextResponse.json({ error: 'Failed to create device profile' }, { status: 500 });
      }
    }

    // Link canonical → device in crm_auth_profile_links
    const { error: linkErr } = await admin
      .from('crm_auth_profile_links')
      .upsert(
        {
          owner_auth_profile_id: canonicalId,
          linked_auth_profile_id: normalizedDeviceId,
          relationship_mode: 'merged',
          active: true,
        },
        { onConflict: 'owner_auth_profile_id,linked_auth_profile_id' }
      );

    if (linkErr) {
      return NextResponse.json({ error: 'Failed to link profiles' }, { status: 500 });
    }

    return NextResponse.json({ linked: true, canonicalId, deviceProfileId: normalizedDeviceId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
