import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type PersonaGrant = {
  personaId?: string;
  tenantId?: string;
  role?: 'owner' | 'operator' | 'viewer';
  active?: boolean;
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerIdentityContext(request);
    if (!caller?.authProfileId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, fioHandle } = (await request.json()) as {
      tenantId?: string;
      fioHandle?: string;
    };

    const normalizedHandle = (fioHandle || '').trim().toLowerCase();
    const normalizedTenant = (tenantId || '').trim();
    if (!normalizedTenant || !normalizedHandle) {
      return NextResponse.json(
        { ok: false, error: 'tenantId and fioHandle are required' },
        { status: 400 }
      );
    }

    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, tenant_id, auth_profile_id, fio_handle, status')
      .eq('tenant_id', normalizedTenant)
      .ilike('fio_handle', normalizedHandle)
      .neq('status', 'deleted')
      .maybeSingle();

    if (personaError) {
      return NextResponse.json({ ok: false, error: personaError.message }, { status: 500 });
    }
    if (!persona?.id) {
      return NextResponse.json({ ok: false, error: 'Persona not found' }, { status: 404 });
    }

    const { data: existingIQube, error: iqubeError } = await supabase
      .from('user_iqubes')
      .select('auth_profile_id,emails,email_verified,allowed_tenant_ids,persona_grants,default_persona_by_tenant,status')
      .eq('auth_profile_id', caller.authProfileId)
      .maybeSingle();
    if (iqubeError) {
      return NextResponse.json({ ok: false, error: iqubeError.message }, { status: 500 });
    }

    const existingGrants = (existingIQube?.persona_grants || []) as PersonaGrant[];
    const otherGrants = existingGrants.filter((grant) => grant?.personaId !== persona.id);
    const role: PersonaGrant['role'] =
      persona.auth_profile_id && String(persona.auth_profile_id) === caller.authProfileId
        ? 'owner'
        : 'operator';

    const mergedGrants: PersonaGrant[] = [
      ...otherGrants,
      {
        personaId: String(persona.id),
        tenantId: String(persona.tenant_id || normalizedTenant),
        role,
        active: true,
      },
    ];

    const allowedTenantIds = Array.from(
      new Set([...(existingIQube?.allowed_tenant_ids || []), String(persona.tenant_id || normalizedTenant)].filter(Boolean))
    );

    const defaultPersonaByTenant = {
      ...((existingIQube?.default_persona_by_tenant || {}) as Record<string, string>),
      [String(persona.tenant_id || normalizedTenant)]:
        ((existingIQube?.default_persona_by_tenant || {}) as Record<string, string>)[String(persona.tenant_id || normalizedTenant)] ||
        String(persona.id),
    };

    const emails = Array.from(
      new Set([...(existingIQube?.emails || []), ...(caller.email ? [caller.email] : [])].filter(Boolean))
    );

    const payload = {
      auth_profile_id: caller.authProfileId,
      emails,
      email_verified: existingIQube?.email_verified ?? true,
      allowed_tenant_ids: allowedTenantIds,
      persona_grants: mergedGrants,
      default_persona_by_tenant: defaultPersonaByTenant,
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('user_iqubes')
      .upsert(payload, { onConflict: 'auth_profile_id' });
    if (upsertError) {
      return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      personaId: String(persona.id),
      fioHandle: persona.fio_handle,
      role,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

