import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';

type CrmPersona = {
  id: string;
  tenant_id: string;
  identity_persona_id?: string | null;
};

export async function resolveCrmPersona(
  client: SupabaseClient,
  personaId?: string | null
): Promise<CrmPersona | null> {
  if (!personaId) return null;

  const { data: direct } = await client
    .from('crm_personas')
    .select('id,tenant_id,identity_persona_id')
    .eq('id', personaId)
    .maybeSingle();

  if (direct) return direct as CrmPersona;

  const { data: linked } = await client
    .from('crm_personas')
    .select('id,tenant_id,identity_persona_id')
    .eq('identity_persona_id', personaId)
    .maybeSingle();

  return (linked as CrmPersona) || null;
}

/**
 * Marketa QubeTalk access gate.
 *
 * ── The defect this replaces ────────────────────────────────────────────────
 *
 * Every Marketa QubeTalk route authenticated like this:
 *
 *     const personaId = request.headers.get('x-persona-id');
 *     if (!personaId) return 401;
 *     const persona = await resolveCrmPersona(supabase, personaId);
 *
 * `x-persona-id` is a header the CALLER writes. Nothing verified that the
 * caller was that persona — presenting the identifier WAS the authentication.
 * Combined with a module-level service-role Supabase client (which bypasses
 * RLS), anyone who could name a valid `crm_personas` id could read that
 * tenant's QubeTalk channels, messages and content transfers.
 *
 * This is the identical shape to the 2026-07-28 anonymous read leak on
 * `/api/qubetalk/channels`: a caller-supplied identifier used as its own
 * authorization while the server reads with the service role. The only
 * difference is that the identifier here is a UUID rather than a tenant slug,
 * which raises the cost of the attack without changing its nature. Requiring a
 * guess is not requiring a credential.
 *
 * ── What this does ──────────────────────────────────────────────────────────
 *
 * Resolves the caller through the identity spine (Bearer-authenticated), then
 * maps that AUTHENTICATED persona onto its CRM persona to derive the tenant.
 * The tenant mapping — `resolveCrmPersona`, which matches on `crm_personas.id`
 * OR `identity_persona_id` — is unchanged; only the identity feeding it is now
 * proven rather than claimed. `x-persona-id` is no longer consulted for auth.
 *
 * The requested `tenant_id` stays a REQUEST: it must match the tenant derived
 * from the caller, and a mismatch is 403 rather than a silent downgrade.
 */
export type MarketaQubeTalkAccess =
  | { ok: true; persona: CrmPersona; tenantId: string }
  | { ok: false; response: NextResponse };

export async function requireMarketaQubeTalkAccess(
  request: NextRequest,
  client: SupabaseClient,
  requestedTenantId: string | null | undefined,
): Promise<MarketaQubeTalkAccess> {
  const active = await getActivePersona(request).catch(() => null);
  if (!active?.personaId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const persona = await resolveCrmPersona(client, active.personaId);
  if (!persona) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No Marketa persona for this caller' },
        { status: 403 },
      ),
    };
  }

  if (requestedTenantId && persona.tenant_id !== requestedTenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Access denied: tenant mismatch' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, persona, tenantId: persona.tenant_id };
}
