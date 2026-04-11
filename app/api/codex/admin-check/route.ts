/**
 * Codex Admin Check API
 *
 * GET /api/codex/admin-check?email=xxx
 *
 * Returns whether a given email has any active admin role in crm_admin_roles.
 * Used by the embed auth bridge to auto-detect admin status without relying
 * on the (currently empty) check-admin-aa Supabase edge function.
 *
 * Uses the service-role client so it can read crm_admin_roles regardless of
 * RLS policies (the response only exposes a boolean — no role details).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase configuration missing');
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ isAdmin: false, reason: 'no_email' });
    }

    const supabase = createServerClient();

    // Look up the auth profile for this email
    const { data: profile } = await supabase
      .from('crm_auth_profiles')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ isAdmin: false, reason: 'no_profile' });
    }

    // Check for any active admin role attached to this auth profile
    const { data: role } = await supabase
      .from('crm_admin_roles')
      .select('id, role_type')
      .eq('auth_profile_id', profile.id)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .maybeSingle();

    return NextResponse.json({
      isAdmin: Boolean(role),
      roleType: role?.role_type ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[codex/admin-check]', message);
    return NextResponse.json({ isAdmin: false, reason: 'error' });
  }
}
