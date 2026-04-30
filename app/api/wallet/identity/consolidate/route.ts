/**
 * POST /api/wallet/identity/consolidate
 *
 * Consolidates the caller's canonical crm_auth_profiles entry and re-assigns
 * any personas that are provably theirs.
 *
 * What it does:
 *  1. Resolves caller email + Supabase auth.users.id from Bearer token
 *  2. Ensures a crm_auth_profiles row exists for this email
 *  3. Finds every OTHER crm_auth_profiles UUID for the same email (duplicate rows)
 *  4. Links those duplicates under 'merged' mode (same person, different UUID)
 *  5. Re-assigns personas ONLY from:
 *       a. Duplicate email-matched profile UUIDs (provably same person)
 *       b. The Supabase auth.users.id (JWT proves identity)
 *     Device UUIDs from localStorage are NOT used for persona re-assignment —
 *     they travel via link-device as 'device_session' links only and never
 *     expand persona visibility. This enforces identity sovereignty.
 *  6. Activated-investor detection (idempotent)
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
  // ignoreDuplicates: true — never overwrite an existing row's email with a
  // synthetic placeholder. If the row already exists (real or synthetic), leave it.
  await admin
    .from('crm_auth_profiles')
    .upsert(
      { id, email, email_verified: false, is_active: true, oauth_providers: {} },
      { onConflict: 'id', ignoreDuplicates: true }
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
    // Step 2 — Find duplicate crm_auth_profiles rows for the same email.
    // These represent the same person with a different UUID (e.g. created via
    // two different code paths). Safe to merge — email is the shared proof.
    // -------------------------------------------------------------------------
    const mergeableIds = new Set<string>();

    const { data: directProfiles } = await admin
      .from('crm_auth_profiles')
      .select('id')
      .ilike('email', email);
    for (const row of directProfiles ?? []) {
      if (row.id && row.id !== canonicalId) mergeableIds.add(row.id);
    }

    const { data: aliasRows } = await admin
      .from('crm_auth_profile_emails')
      .select('auth_profile_id')
      .eq('email_normalized', email);
    for (const row of aliasRows ?? []) {
      if (row.auth_profile_id && row.auth_profile_id !== canonicalId) mergeableIds.add(row.auth_profile_id);
    }

    // -------------------------------------------------------------------------
    // Step 3 — Supabase auth.users.id from the JWT.
    // The JWT is cryptographically signed by Supabase — it definitively proves
    // the caller IS this auth user. Safe to merge + re-assign.
    // -------------------------------------------------------------------------
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
      mergeableIds.add(supabaseUserId);
    }

    // -------------------------------------------------------------------------
    // Step 4 — Link + re-assign personas for provably-same-person UUIDs only.
    //
    // IDENTITY SOVEREIGNTY RULE: only email-matched duplicates and the JWT
    // Supabase user UUID are eligible for persona re-assignment. Device UUIDs
    // from localStorage are NOT included here — they arrive via link-device as
    // 'device_session' links and never trigger persona re-assignment. This
    // prevents shared-device cross-contamination of identities.
    // -------------------------------------------------------------------------
    let personasReassigned = 0;

    for (const otherId of mergeableIds) {
      if (!isUuid(otherId)) continue;
      await ensureProfileExists(otherId, `${otherId}@linked.agentiq.local`);
      await linkToCanonical(canonicalId, otherId);

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
    const allLinkedIds = [canonicalId, ...Array.from(mergeableIds)];
    const { count: personaCount } = await admin
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .in('auth_profile_id', allLinkedIds);

    // -------------------------------------------------------------------------
    // Step 6 — Activated investor detection
    // If this email matches a nakamoto_knyt_personas investor record that hasn't
    // been linked yet, stamp platform_activated_at and platform_auth_profile_id.
    // This is idempotent — already-activated records are left unchanged.
    // -------------------------------------------------------------------------
    let activatedInvestorId: string | null = null;
    try {
      const { data: investorMatch } = await admin
        .from('nakamoto_knyt_personas')
        .select('id, platform_activated_at, "Total-Invested"')
        .ilike('"Email"', email)
        .maybeSingle();

      if (investorMatch && !investorMatch.platform_activated_at) {
        await admin
          .from('nakamoto_knyt_personas')
          .update({
            platform_activated_at: new Date().toISOString(),
            platform_auth_profile_id: canonicalId,
          })
          .eq('id', investorMatch.id);
        activatedInvestorId = investorMatch.id;
        console.info(
          `[consolidate] activated investor detected: ${investorMatch.id} ` +
          `(invested: $${investorMatch['Total-Invested'] ?? 0})`
        );
      }
    } catch (err) {
      // Non-fatal — investor activation is best-effort
      console.warn('[consolidate] investor activation check failed:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      canonicalId,
      email,
      supabaseUserId,
      mergedProfileIds: Array.from(mergeableIds),
      personasReassigned,
      totalPersonas: personaCount ?? 0,
      activatedInvestorId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
