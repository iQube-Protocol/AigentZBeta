/**
 * GET /api/wallet/identity/profile
 *
 * Returns a unified identity profile for the signed-in user:
 *  - canonicalId: their crm_auth_profiles UUID (= persona cluster ID)
 *  - email: primary email from the JWT
 *  - personaCount: total personas owned by canonicalId
 *  - personaClusters: all auth_profile_ids that own personas for this user
 *    (canonicalId + any linked merged profile IDs that still have personas)
 *  - emailAliases: all email aliases in crm_auth_profile_emails
 *  - linkedProfiles: active merged links in crm_auth_profile_links
 *  - rootDid: did_uri from root_identity (null if not yet bound)
 *  - rootId: root_identity UUID
 *  - kycStatus: kyc_status from root_identity
 *  - didPersonas: did_persona rows bound to this root identity
 *
 * Requires: Authorization: Bearer <supabase_access_token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getCallerIdentityContext(request);
    if (!context?.authProfileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const canonicalId = context.authProfileId;
    const email = context.email;

    // Email aliases
    const { data: aliasRows } = await admin
      .from('crm_auth_profile_emails')
      .select('email, email_normalized, is_primary, is_verified, status')
      .eq('auth_profile_id', canonicalId)
      .order('is_primary', { ascending: false });

    // Persona count under the canonical cluster
    const { count: personaCount } = await admin
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('auth_profile_id', canonicalId);

    // First persona with a stored EVM address (for identity display)
    const { data: evmPersonaRows } = await admin
      .from('personas')
      .select('evm_address')
      .eq('auth_profile_id', canonicalId)
      .not('evm_address', 'is', null)
      .limit(1);

    const storedEvmAddress: string | null =
      (evmPersonaRows?.[0] as Record<string, unknown> | undefined)?.evm_address as string | null ?? null;

    // Linked profiles (all modes — we show merged separately in the UI)
    const { data: linkRows } = await admin
      .from('crm_auth_profile_links')
      .select('linked_auth_profile_id, relationship_mode, active')
      .eq('owner_auth_profile_id', canonicalId)
      .eq('active', true);

    // For each merged linked profile, check if it still owns personas
    // (legacy clusters that weren't fully migrated to canonicalId)
    const mergedIds = (linkRows ?? [])
      .filter((l) => (l as Record<string, unknown>).relationship_mode === 'merged')
      .map((l) => (l as Record<string, unknown>).linked_auth_profile_id as string);

    const personaClusters: Array<{ clusterId: string; personaCount: number; isCanonical: boolean }> = [
      { clusterId: canonicalId, personaCount: personaCount ?? 0, isCanonical: true },
    ];
    for (const linkedId of mergedIds) {
      const { count: linkedCount } = await admin
        .from('personas')
        .select('id', { count: 'exact', head: true })
        .eq('auth_profile_id', linkedId);
      if ((linkedCount ?? 0) > 0) {
        personaClusters.push({ clusterId: linkedId, personaCount: linkedCount ?? 0, isCanonical: false });
      }
    }

    // Root DID — resolve via Supabase auth user ID from the JWT
    let rootDid: string | null = null;
    let rootId: string | null = null;
    let kycStatus: string = 'unverified';
    let didPersonas: Array<{ id: string; personaType: string; fioHandle: string | null }> = [];

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );
      const { data: userData } = await anonClient.auth.getUser(token);
      const authUserId = userData?.user?.id;
      if (authUserId) {
        const { data: rootRow } = await admin
          .from('root_identity')
          .select('id, did_uri, kyc_status')
          .eq('auth_user_id', authUserId)
          .maybeSingle();

        if (rootRow) {
          const r = rootRow as Record<string, unknown>;
          rootDid = r.did_uri as string | null;
          rootId = r.id as string | null;
          kycStatus = (r.kyc_status as string | null) ?? 'unverified';

          if (rootId) {
            const { data: personaRows } = await admin
              .from('did_persona')
              .select('id, persona_type, fio_handle')
              .eq('root_id', rootId);
            didPersonas = (personaRows ?? []).map((p) => {
              const pr = p as Record<string, unknown>;
              return {
                id: pr.id as string,
                personaType: pr.persona_type as string,
                fioHandle: (pr.fio_handle as string | null) ?? null,
              };
            });
          }
        }
      }
    }

    return NextResponse.json({
      canonicalId,
      email,
      personaCount: personaCount ?? 0,
      personaClusters,
      storedEvmAddress,
      emailAliases: aliasRows ?? [],
      linkedProfiles: (linkRows ?? []).map((l) => {
        const lr = l as Record<string, unknown>;
        return {
          linked_auth_profile_id: lr.linked_auth_profile_id as string,
          relationship_mode: lr.relationship_mode as string,
        };
      }),
      rootDid,
      rootId,
      kycStatus,
      didPersonas,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
