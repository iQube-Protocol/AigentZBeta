/**
 * POST /api/wallet/identity/consolidate
 *
 * Consolidates ALL identity assets (auth profile UUIDs, personas) associated
 * with the caller's email into a single canonical crm_auth_profiles entry.
 *
 * What it does:
 *  1. Resolves caller email from Bearer token
 *  2. Finds every crm_auth_profiles UUID linked to that email (direct + aliases)
 *  3. Finds the Supabase auth.users.id for the email
 *  4. Links all found UUIDs to the canonical CRM profile via crm_auth_profile_links
 *  5. Re-assigns personas that carry a non-canonical UUID to the canonical one
 *  6. Returns a summary: canonicalId, linkedIds[], personaCount
 *
 * Requires: Authorization: Bearer <supabase_access_token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function ensureProfileExists(id: string, email: string): Promise<void> {
  await admin
    .from('crm_auth_profiles')
    .upsert(
      { id, email, email_verified: false, is_active: true, oauth_providers: {} },
      { onConflict: 'id' }
    );
}

async function linkToCanonical(canonicalId: string, otherId: string): Promise<void> {
  if (canonicalId === otherId) return;
  await admin.from('crm_auth_profile_links').upsert(
    {
      owner_auth_profile_id: canonicalId,
      linked_auth_profile_id: otherId,
      relationship_mode: 'merged',
      active: true,
    },
    { onConflict: 'owner_auth_profile_id,linked_auth_profile_id' }
  );
}

export async function POST(request: NextRequest) {
  try {
    const context = await getCallerIdentityContext(request);
    if (!context?.authProfileId || !context.email) {
      return NextResponse.json({ error: 'Unauthorized — Bearer token with email required' }, { status: 401 });
    }

    const canonicalId = context.authProfileId;
    const email = context.email.trim().toLowerCase();

    // -------------------------------------------------------------------------
    // Step 1 — Ensure email alias row is registered
    // -------------------------------------------------------------------------
    await admin.from('crm_auth_profile_emails').upsert(
      {
        auth_profile_id: canonicalId,
        email,
        email_normalized: email,
        is_primary: true,
        is_verified: true,
        status: 'active',
      },
      { onConflict: 'email_normalized' }
    );

    // -------------------------------------------------------------------------
    // Step 2 — Find every other crm_auth_profiles UUID for this email
    // -------------------------------------------------------------------------
    const linkedIds = new Set<string>();

    // Direct email match on crm_auth_profiles
    const { data: directProfiles } = await admin
      .from('crm_auth_profiles')
      .select('id')
      .ilike('email', email);
    for (const row of directProfiles ?? []) {
      if (row.id && row.id !== canonicalId) linkedIds.add(row.id);
    }

    // Via email aliases
    const { data: aliasRows } = await admin
      .from('crm_auth_profile_emails')
      .select('auth_profile_id')
      .eq('email_normalized', email);
    for (const row of aliasRows ?? []) {
      if (row.auth_profile_id && row.auth_profile_id !== canonicalId) linkedIds.add(row.auth_profile_id);
    }

    // -------------------------------------------------------------------------
    // Step 3 — Find the Supabase auth.users.id for this email
    // -------------------------------------------------------------------------
    // We can't query auth.users directly from the service-role JS client's
    // admin.auth.listUsers — instead we get it from the incoming JWT.
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let supabaseUserId: string | null = null;
    if (token) {
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user?.id) supabaseUserId = userData.user.id;
    }
    if (supabaseUserId && supabaseUserId !== canonicalId) {
      linkedIds.add(supabaseUserId);
    }

    // -------------------------------------------------------------------------
    // Step 4 — For every discovered UUID: ensure CRM profile exists, link,
    //          and re-assign any personas carrying the non-canonical UUID.
    // -------------------------------------------------------------------------
    let personasReassigned = 0;

    for (const otherId of linkedIds) {
      if (!isUuid(otherId)) continue;
      // Ensure a crm_auth_profiles row exists for this UUID
      await ensureProfileExists(otherId, `${otherId}@linked.agentiq.local`);
      // Link it to canonical
      await linkToCanonical(canonicalId, otherId);
      // Re-assign personas from otherId → canonicalId
      const { count } = await admin
        .from('personas')
        .update({ auth_profile_id: canonicalId })
        .eq('auth_profile_id', otherId)
        .select('id', { count: 'exact', head: true });
      personasReassigned += count ?? 0;
    }

    // -------------------------------------------------------------------------
    // Step 5 — Count total personas now visible under canonical
    // -------------------------------------------------------------------------
    const allLinkedIds = [canonicalId, ...Array.from(linkedIds)];
    const { count: personaCount } = await admin
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .in('auth_profile_id', allLinkedIds);

    return NextResponse.json({
      canonicalId,
      email,
      supabaseUserId,
      linkedProfileIds: Array.from(linkedIds),
      personasReassigned,
      totalPersonas: personaCount ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
