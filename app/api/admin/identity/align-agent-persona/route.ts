import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/identity/align-agent-persona
 *
 * Links an agent persona (e.g. aigentz@aigent) to a user profile (e.g. dele@metame.com)
 * so that the agent wallet and Q¢ balance surface under that user's account.
 *
 * Body:
 *   { email: string; fioHandle: string; setOwner?: boolean; dryRun?: boolean }
 *
 * What it does:
 *  1. Resolves the user's auth_profile_id via crm_auth_profiles
 *  2. Finds the persona row in personas table by fio_handle
 *  3. Optionally claims ownership by updating personas.auth_profile_id
 *  4. Upserts user_iqubes with a persona_grant so the wallet appears in their profile
 *  5. Reports qc_balances tied to that persona_id
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      fioHandle?: string;
      setOwner?: boolean;
      dryRun?: boolean;
    };

    const email = (body.email || '').trim().toLowerCase();
    const fioHandle = (body.fioHandle || '').trim().toLowerCase();
    const setOwner = body.setOwner !== false; // default true
    const dryRun = body.dryRun === true;

    if (!email || !fioHandle) {
      return NextResponse.json({ ok: false, error: 'email and fioHandle are required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Resolve auth profile for email
    const { data: authProfile, error: authError } = await supabase
      .from('crm_auth_profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (authError) return NextResponse.json({ ok: false, error: authError.message }, { status: 500 });
    if (!authProfile?.id) return NextResponse.json({ ok: false, error: `No auth profile found for ${email}` }, { status: 404 });

    const authProfileId = String(authProfile.id);

    // 2. Find the persona by fio_handle
    const { data: personaRow, error: personaError } = await supabase
      .from('personas')
      .select('id, fio_handle, tenant_id, auth_profile_id')
      .ilike('fio_handle', fioHandle)
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (personaError) return NextResponse.json({ ok: false, error: personaError.message }, { status: 500 });
    if (!personaRow?.id) {
      return NextResponse.json(
        { ok: false, error: `Persona not found for handle ${fioHandle}. Run /api/admin/sync-agent-personas first.` },
        { status: 404 }
      );
    }

    const personaId = String(personaRow.id);
    const tenantId = String(personaRow.tenant_id || 'metaproof');
    const actions: string[] = [];

    // 3. Check existing qc_balances
    const { data: balances } = await supabase
      .from('qc_balances')
      .select('balance, currency')
      .eq('persona_id', personaId);

    const totalQc = (balances || []).reduce((sum, row) => sum + Number(row.balance || 0), 0);

    // 4. Optionally claim ownership
    if (setOwner && personaRow.auth_profile_id !== authProfileId) {
      if (!dryRun) {
        const { error: ownerError } = await supabase
          .from('personas')
          .update({ auth_profile_id: authProfileId, updated_at: new Date().toISOString() })
          .eq('id', personaId);
        if (ownerError) return NextResponse.json({ ok: false, error: ownerError.message }, { status: 500 });
      }
      actions.push(`Set auth_profile_id on persona ${personaId} to ${authProfileId}`);
    } else if (personaRow.auth_profile_id === authProfileId) {
      actions.push('Persona auth_profile_id already matches — no update needed');
    }

    // 5. Load existing user_iqubes
    const { data: existingIQube } = await supabase
      .from('user_iqubes')
      .select('auth_profile_id, emails, email_verified, allowed_tenant_ids, persona_grants, default_persona_by_tenant, status')
      .eq('auth_profile_id', authProfileId)
      .maybeSingle();

    type PersonaGrant = { personaId?: string; tenantId?: string; role?: string; active?: boolean };
    const existingGrants = ((existingIQube?.persona_grants || []) as PersonaGrant[]);
    const otherGrants = existingGrants.filter((g) => g?.personaId !== personaId);
    const role = setOwner ? 'owner' : 'operator';

    const mergedGrants: PersonaGrant[] = [
      ...otherGrants,
      { personaId, tenantId, role, active: true },
    ];

    const allowedTenantIds = Array.from(
      new Set([...(existingIQube?.allowed_tenant_ids || []), tenantId].filter(Boolean))
    );

    const defaultPersonaByTenant = {
      ...((existingIQube?.default_persona_by_tenant || {}) as Record<string, string>),
    };
    if (!defaultPersonaByTenant[tenantId]) {
      defaultPersonaByTenant[tenantId] = personaId;
    }

    const emails = Array.from(new Set([...(existingIQube?.emails || []), email].filter(Boolean)));

    const upsertPayload = {
      auth_profile_id: authProfileId,
      emails,
      email_verified: existingIQube?.email_verified ?? true,
      allowed_tenant_ids: allowedTenantIds,
      persona_grants: mergedGrants,
      default_persona_by_tenant: defaultPersonaByTenant,
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    if (!dryRun) {
      const { error: upsertError } = await supabase
        .from('user_iqubes')
        .upsert(upsertPayload, { onConflict: 'auth_profile_id' });
      if (upsertError) return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
    }

    actions.push(`Upserted user_iqubes for ${email}: ${role} grant on ${fioHandle} (tenant: ${tenantId})`);

    return NextResponse.json({
      ok: true,
      dryRun,
      email,
      authProfileId,
      persona: {
        id: personaId,
        fioHandle: personaRow.fio_handle,
        tenantId,
        role,
      },
      wallet: {
        qcBalance: totalQc,
        currencies: balances || [],
      },
      actions,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
