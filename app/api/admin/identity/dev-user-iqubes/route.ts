import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crmService from '@/services/crm/crmService';

export const dynamic = 'force-dynamic';

type BootstrapRequest = {
  emails?: string[];
  authProfileIds?: string[];
  tenantIds?: string[];
  franchiseIds?: string[];
  includeAllActiveTenants?: boolean;
  includeAllAuthProfilesInScope?: boolean;
  dryRun?: boolean;
  personaIdsByEmail?: Record<string, string[]>;
  emailVerified?: boolean;
};

type PersonaGrant = {
  personaId: string;
  tenantId: string;
  role: 'owner' | 'operator' | 'viewer';
  active: boolean;
};

type PersonaRow = {
  id: string;
  tenant_id: string;
  auth_profile_id: string | null;
  created_at: string;
};

type ScopedTenantScope = {
  tenantIds: string[];
  tenantMatchValues: string[];
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function isDevBootstrapEnabled(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const explicitEnable = process.env.ENABLE_DEV_IQUBE_BOOTSTRAP === 'true';
  if (!explicitEnable) return false;
  const headerSecret = request.headers.get('x-dev-bootstrap-secret');
  return !!headerSecret && headerSecret === process.env.DEV_IQUBE_BOOTSTRAP_SECRET;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

async function getScopedTenantScope(body: BootstrapRequest): Promise<ScopedTenantScope> {
  const explicitTenantIds = (body.tenantIds || []).map((tenantId) => tenantId.trim()).filter(Boolean);
  const scopedTenantIds = new Set<string>();
  const tenantMatchValues = new Set<string>(explicitTenantIds);

  const addTenant = (tenant: { id: string; slug?: string | null }) => {
    scopedTenantIds.add(tenant.id);
    tenantMatchValues.add(tenant.id);
    if (tenant.slug) tenantMatchValues.add(tenant.slug);
  };

  if (body.includeAllActiveTenants) {
    const tenants = await crmService.listTenants(undefined, true);
    tenants.forEach((tenant) => addTenant(tenant));
  }

  const franchiseIds = (body.franchiseIds || []).map((id) => id.trim()).filter(Boolean);
  for (const franchiseId of franchiseIds) {
    const tenants = await crmService.listTenants(franchiseId, true);
    tenants.forEach((tenant) => addTenant(tenant));
  }

  if (explicitTenantIds.length > 0) {
    const allTenants = await crmService.listTenants(undefined, false);
    const byIdOrSlug = new Map<string, { id: string; slug?: string | null }>();
    allTenants.forEach((tenant) => {
      byIdOrSlug.set(tenant.id, tenant);
      if (tenant.slug) byIdOrSlug.set(tenant.slug, tenant);
    });

    explicitTenantIds.forEach((tenantRef) => {
      const resolved = byIdOrSlug.get(tenantRef);
      if (resolved) addTenant(resolved);
    });
  }

  return {
    tenantIds: Array.from(scopedTenantIds),
    tenantMatchValues: Array.from(tenantMatchValues),
  };
}

async function getMappedIdentityPersonasForAuthProfile(
  authProfileId: string,
  scopedTenantIds: string[],
  scopedTenantMatchValues: string[]
): Promise<PersonaRow[]> {
  let mappingQuery = supabase
    .from('crm_auth_profile_personas')
    .select('crm_personas!inner(identity_persona_id,tenant_id)')
    .eq('auth_profile_id', authProfileId);

  if (scopedTenantMatchValues.length > 0) {
    mappingQuery = mappingQuery.in('crm_personas.tenant_id', scopedTenantMatchValues);
  }

  const { data: mappingRows, error: mappingError } = await mappingQuery;
  if (mappingError) throw mappingError;

  const identityPersonaIds = uniqueStrings(
    (mappingRows || []).map(
      (row) =>
        ((row as { crm_personas?: { identity_persona_id?: string | null } | null }).crm_personas
          ?.identity_persona_id || null)
    )
  );

  if (identityPersonaIds.length === 0) return [];

  let personasQuery = supabase
    .from('personas')
    .select('id, tenant_id, auth_profile_id, created_at')
    .in('id', identityPersonaIds);

  if (scopedTenantIds.length > 0) {
    personasQuery = personasQuery.in('tenant_id', scopedTenantIds);
  }

  const { data: mappedPersonas, error: mappedPersonasError } = await personasQuery;
  if (mappedPersonasError) throw mappedPersonasError;

  return (mappedPersonas || []) as PersonaRow[];
}

export async function POST(request: NextRequest) {
  try {
    if (!isDevBootstrapEnabled(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as BootstrapRequest;
    const normalizedEmails = (body.emails || [])
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const authProfileIdsFromBody = (body.authProfileIds || []).map((id) => id.trim()).filter(Boolean);
    const scopedTenantScope = await getScopedTenantScope(body);
    const scopedTenantIds = scopedTenantScope.tenantIds;
    const scopedTenantMatchValues = scopedTenantScope.tenantMatchValues;
    const scopedTenantIdSet = new Set(scopedTenantIds);
    const scopedTenantMatchSet = new Set(scopedTenantMatchValues);
    const dryRun = body.dryRun === true;

    if (normalizedEmails.length === 0 && authProfileIdsFromBody.length === 0 && !body.includeAllAuthProfilesInScope) {
      return NextResponse.json(
        { error: 'Provide emails[], authProfileIds[], or includeAllAuthProfilesInScope=true' },
        { status: 400 }
      );
    }

    if (body.includeAllAuthProfilesInScope && scopedTenantMatchValues.length === 0) {
      return NextResponse.json(
        {
          error:
            'includeAllAuthProfilesInScope requires tenant scope. Provide tenantIds[], franchiseIds[], or includeAllActiveTenants=true.',
        },
        { status: 400 }
      );
    }

    const tenantAllowList = uniqueStrings([...(body.tenantIds || []).map((tenantId) => tenantId.trim()), ...scopedTenantIds]);
    const personaIdsByEmail = body.personaIdsByEmail || {};
    const defaultEmailVerified = body.emailVerified ?? true;

    const results: Array<Record<string, unknown>> = [];
    const targetSubjects = new Map<string, { authProfileId: string; email: string | null }>();

    for (const email of normalizedEmails) {
      const { data: authProfile, error: authError } = await supabase
        .from('crm_auth_profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (authError) {
        results.push({ email, ok: false, error: authError.message });
        continue;
      }

      if (!authProfile?.id) {
        results.push({ email, ok: false, error: 'No auth profile found for email' });
        continue;
      }

      const authProfileId = String(authProfile.id);
      targetSubjects.set(authProfileId, { authProfileId, email });
    }

    for (const authProfileId of authProfileIdsFromBody) {
      if (!targetSubjects.has(authProfileId)) {
        targetSubjects.set(authProfileId, { authProfileId, email: null });
      }
    }

    if (body.includeAllAuthProfilesInScope) {
      let authProfilesInScopeQuery = supabase
        .from('personas')
        .select('auth_profile_id')
        .not('auth_profile_id', 'is', null);

      if (scopedTenantMatchValues.length > 0) {
        authProfilesInScopeQuery = authProfilesInScopeQuery.in('tenant_id', scopedTenantMatchValues);
      }

      const { data: authProfilesInScope, error: scopeError } = await authProfilesInScopeQuery;
      if (scopeError) {
        return NextResponse.json({ error: scopeError.message }, { status: 500 });
      }

      const uniqueAuthProfileIds = uniqueStrings((authProfilesInScope || []).map((row) => row.auth_profile_id as string | null));

      let mappedAuthProfilesQuery = supabase
        .from('crm_auth_profile_personas')
        .select('auth_profile_id,crm_personas!inner(tenant_id)')
        .not('auth_profile_id', 'is', null);

      if (scopedTenantMatchValues.length > 0) {
        mappedAuthProfilesQuery = mappedAuthProfilesQuery.in('crm_personas.tenant_id', scopedTenantMatchValues);
      }

      const { data: mappedAuthProfiles, error: mappedAuthProfilesError } = await mappedAuthProfilesQuery;
      if (mappedAuthProfilesError) {
        return NextResponse.json({ error: mappedAuthProfilesError.message }, { status: 500 });
      }

      const mappedAuthProfileIds = uniqueStrings(
        (mappedAuthProfiles || []).map((row) => (row as { auth_profile_id?: string | null }).auth_profile_id || null)
      );

      const allAuthProfileIds = uniqueStrings([...uniqueAuthProfileIds, ...mappedAuthProfileIds]);
      allAuthProfileIds.forEach((authProfileId) => {
        if (!targetSubjects.has(authProfileId)) {
          targetSubjects.set(authProfileId, { authProfileId, email: null });
        }
      });
    }

    const authProfileIdsNeedingEmail = Array.from(targetSubjects.values())
      .filter((subject) => !subject.email)
      .map((subject) => subject.authProfileId);

    if (authProfileIdsNeedingEmail.length > 0) {
      const { data: authProfiles } = await supabase
        .from('crm_auth_profiles')
        .select('id, email')
        .in('id', authProfileIdsNeedingEmail);

      for (const profile of authProfiles || []) {
        const authProfileId = String(profile.id);
        const existing = targetSubjects.get(authProfileId);
        if (existing) existing.email = (profile.email || null) as string | null;
      }
    }

    for (const subject of targetSubjects.values()) {
      const authProfileId = subject.authProfileId;
      const email = subject.email;

      const { data: ownedPersonas, error: ownedError } = await supabase
        .from('personas')
        .select('id, tenant_id, auth_profile_id, created_at')
        .eq('auth_profile_id', authProfileId)
        .order('created_at', { ascending: true });

      let scopedOwnedPersonas = (ownedPersonas || []) as PersonaRow[];
      if (scopedTenantMatchValues.length > 0) {
        scopedOwnedPersonas = scopedOwnedPersonas.filter((row) => scopedTenantMatchSet.has(row.tenant_id));
      }

      let mappedPersonas: PersonaRow[] = [];
      try {
        mappedPersonas = await getMappedIdentityPersonasForAuthProfile(
          authProfileId,
          scopedTenantIds,
          scopedTenantMatchValues
        );
      } catch (mappedError) {
        const message = mappedError instanceof Error ? mappedError.message : 'Failed to load mapped personas';
        results.push({ email, ok: false, authProfileId, error: message });
        continue;
      }

      if (ownedError) {
        results.push({ email, ok: false, authProfileId, error: ownedError.message });
        continue;
      }

      const manualPersonaIds = email ? (personaIdsByEmail[email] || []).filter(Boolean) : [];
      let manualPersonas: PersonaRow[] = [];
      if (manualPersonaIds.length > 0) {
        let manualQuery = supabase
          .from('personas')
          .select('id, tenant_id, auth_profile_id, created_at')
          .in('id', manualPersonaIds);

        if (scopedTenantMatchValues.length > 0) {
          manualQuery = manualQuery.in('tenant_id', scopedTenantMatchValues);
        }

        const { data: manualData, error: manualError } = await manualQuery;

        if (manualError) {
          results.push({ email, ok: false, authProfileId, error: manualError.message });
          continue;
        }

        manualPersonas = (manualData || []) as PersonaRow[];
      }

      const combinedPersonasMap = new Map<string, PersonaRow>();
      for (const row of scopedOwnedPersonas) {
        combinedPersonasMap.set(row.id, row);
      }
      for (const row of mappedPersonas) {
        combinedPersonasMap.set(row.id, row);
      }
      for (const row of manualPersonas) {
        combinedPersonasMap.set(row.id, row);
      }

      const combinedPersonas = Array.from(combinedPersonasMap.values());
      const derivedTenantIds = Array.from(new Set(combinedPersonas.map((p) => p.tenant_id).filter(Boolean)));
      let allowedTenantIds = Array.from(new Set([...tenantAllowList, ...derivedTenantIds]));
      if (scopedTenantMatchValues.length > 0) {
        allowedTenantIds = allowedTenantIds.filter((tenantId) => scopedTenantMatchSet.has(tenantId));
      }

      const allowedTenantSet = new Set(allowedTenantIds);

      const personaGrants: PersonaGrant[] = combinedPersonas
        .filter((persona) => allowedTenantSet.size === 0 || allowedTenantSet.has(persona.tenant_id))
        .map((persona) => ({
          personaId: persona.id,
          tenantId: persona.tenant_id,
          role: persona.auth_profile_id === authProfileId ? 'owner' : 'operator',
          active: true,
        }));

      const defaultPersonaByTenant: Record<string, string> = {};
      for (const tenantId of allowedTenantIds) {
        const first = combinedPersonas.find((p) => p.tenant_id === tenantId);
        if (first) defaultPersonaByTenant[tenantId] = first.id;
      }

      const payload = {
        auth_profile_id: authProfileId,
        emails: email ? [email] : [],
        email_verified: defaultEmailVerified,
        allowed_tenant_ids: allowedTenantIds,
        persona_grants: personaGrants,
        default_persona_by_tenant: defaultPersonaByTenant,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      if (dryRun) {
        results.push({
          email,
          ok: true,
          dryRun: true,
          authProfileId,
          grantedPersonaCount: personaGrants.length,
          allowedTenantIds,
        });
        continue;
      }

      const { error: upsertError } = await supabase
        .from('user_iqubes')
        .upsert(payload, { onConflict: 'auth_profile_id' });

      if (upsertError) {
        results.push({ email, ok: false, authProfileId, error: upsertError.message });
        continue;
      }

      results.push({
        email,
        ok: true,
        authProfileId,
        grantedPersonaCount: personaGrants.length,
        allowedTenantIds,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      scopedTenantCount: scopedTenantIds.length,
      targetedAuthProfileCount: targetSubjects.size,
      processed: results.length,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message || 'Unknown error')
          : typeof error === 'string'
            ? error
            : 'Unknown error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
