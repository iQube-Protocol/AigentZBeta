/**
 * CRM Franchises API
 * 
 * GET /api/crm/franchises - List franchises
 * GET /api/crm/franchises?id=xxx - Get franchise by ID or slug
 * GET /api/crm/franchises?id=xxx&tenants=true - Get franchise with its tenants
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const QRIPTOPIAN_TENANT = {
  id: 'c1a4e5f8-5326-4fa3-ac11-87c36e0b1848',
  slug: 'qriptopian',
  name: 'Qriptopian',
};

const FRANCHISE_TENANT_OVERRIDES: Record<string, { id: string; slug: string; name: string }> = {
  theqriptopian: QRIPTOPIAN_TENANT,
  qriptopian: QRIPTOPIAN_TENANT,
};

function getTenantOverride(franchise: { slug?: string; name?: string }) {
  const slugKey = franchise.slug?.toLowerCase() || '';
  const nameKey = franchise.name?.toLowerCase() || '';
  return FRANCHISE_TENANT_OVERRIDES[slugKey] || (nameKey.includes('qriptopian') ? QRIPTOPIAN_TENANT : undefined);
}

async function fetchPersonaCountsByTenant(tenantIds: string[]) {
  const supabase = getSupabaseServer();
  const counts = new Map<string, number>();

  if (!supabase || tenantIds.length === 0) return counts;

  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('personas')
      .select('tenant_id')
      .in('tenant_id', tenantIds)
      .order('tenant_id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    (data || []).forEach((row: { tenant_id: string | null }) => {
      if (!row.tenant_id) return;
      counts.set(row.tenant_id, (counts.get(row.tenant_id) || 0) + 1);
    });

    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  return counts;
}

async function fetchUniquePersonaCountsByFranchise(
  tenantToFranchise: Map<string, string>
): Promise<{ perFranchise: Map<string, number>; globalCount: number }> {
  const supabase = getSupabaseServer();
  const perFranchise = new Map<string, Set<string>>();
  const globalSet = new Set<string>();

  if (!supabase || tenantToFranchise.size === 0) {
    return { perFranchise: new Map(), globalCount: 0 };
  }

  const tenantIds = Array.from(tenantToFranchise.keys());
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('personas')
      .select('tenant_id, fio_handle, id')
      .in('tenant_id', tenantIds)
      .order('tenant_id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    (data || []).forEach((row: { tenant_id: string | null; fio_handle: string | null; id: string }) => {
      if (!row.tenant_id) return;
      const franchiseId = tenantToFranchise.get(row.tenant_id);
      if (!franchiseId) return;
      const key = row.fio_handle || row.id;
      globalSet.add(key);
      if (!perFranchise.has(franchiseId)) perFranchise.set(franchiseId, new Set());
      perFranchise.get(franchiseId)?.add(key);
    });

    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  const counts = new Map<string, number>();
  perFranchise.forEach((set, franchiseId) => {
    counts.set(franchiseId, set.size);
  });

  return { perFranchise: counts, globalCount: globalSet.size };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tenants = searchParams.get('tenants') === 'true';
    const includeTenants = searchParams.get('includeTenants') === 'true' || tenants;
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Get specific franchise
    if (id) {
      const franchise = await crmService.getFranchise(id);
      
      if (!franchise) {
        return NextResponse.json(
          { error: 'Franchise not found' },
          { status: 404 }
        );
      }

      // Include tenants if requested
      if (includeTenants) {
        const franchiseTenants = await crmService.getFranchiseTenants(franchise.id, activeOnly);
        const override = getTenantOverride(franchise);
        const effectiveTenants = override
          ? [
              ...franchiseTenants,
              {
                id: override.id,
                franchiseId: franchise.id,
                name: override.name,
                slug: override.slug,
                description: '',
                domain: null,
                config: {},
                supportedTokens: [],
                defaultModalities: [],
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]
          : franchiseTenants;

        const tenantIds = effectiveTenants.map((t) => t.id);
        const personaCounts = await fetchPersonaCountsByTenant(tenantIds);
        const tenantToFranchise = new Map<string, string>();
        effectiveTenants.forEach((tenant) => tenantToFranchise.set(tenant.id, franchise.id));
        const uniqueCounts = await fetchUniquePersonaCountsByFranchise(tenantToFranchise);

        return NextResponse.json({
          success: true,
          data: {
            ...franchise,
            tenants: effectiveTenants.map((tenant) => ({
              ...tenant,
              personaCount: personaCounts.get(tenant.id) || 0,
            })),
            uniquePersonaCount: uniqueCounts.perFranchise.get(franchise.id) || 0,
            personaCounts: Object.fromEntries(personaCounts.entries()),
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: franchise,
      });
    }

    // List all franchises
    const franchises = await crmService.listFranchises(activeOnly);
    if (!includeTenants) {
      return NextResponse.json({
        success: true,
        data: franchises,
      });
    }

    const tenantsList = await crmService.listTenants(undefined, activeOnly);
    const tenantIds = tenantsList.map((t) => t.id);
    Object.values(FRANCHISE_TENANT_OVERRIDES).forEach((override) => {
      if (!tenantIds.includes(override.id)) tenantIds.push(override.id);
    });
    const personaCounts = await fetchPersonaCountsByTenant(tenantIds);
    const tenantToFranchise = new Map<string, string>();

    const tenantsByFranchise = new Map<string, any[]>();
    tenantsList.forEach((tenant) => {
      const franchiseId = tenant.franchiseId || 'unassigned';
      if (!tenantsByFranchise.has(franchiseId)) tenantsByFranchise.set(franchiseId, []);
      tenantsByFranchise.get(franchiseId)?.push({
        ...tenant,
        personaCount: personaCounts.get(tenant.id) || 0,
      });
      tenantToFranchise.set(tenant.id, franchiseId);
    });

    Object.values(FRANCHISE_TENANT_OVERRIDES).forEach((override) => {
      const target = franchises.find((f) => getTenantOverride(f)?.id === override.id);
      if (target) {
        tenantToFranchise.set(override.id, target.id);
      }
    });

    const uniqueCounts = await fetchUniquePersonaCountsByFranchise(tenantToFranchise);

    return NextResponse.json({
      success: true,
      meta: {
        uniquePersonaCount: uniqueCounts.globalCount,
      },
      data: franchises.map((franchise) => ({
        ...franchise,
        tenants: (() => {
          const baseTenants = tenantsByFranchise.get(franchise.id) || [];
          const override = getTenantOverride(franchise);
          if (!override) return baseTenants;
          const alreadyPresent = baseTenants.some((t) => t.id === override.id || t.slug === override.slug);
          if (alreadyPresent) return baseTenants;
          return [
            ...baseTenants,
            {
              id: override.id,
              franchiseId: franchise.id,
              name: override.name,
              slug: override.slug,
              description: '',
              domain: null,
              config: {},
              supportedTokens: [],
              defaultModalities: [],
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              personaCount: personaCounts.get(override.id) || 0,
            },
          ];
        })(),
        uniquePersonaCount: uniqueCounts.perFranchise.get(franchise.id) || 0,
      })),
    });
  } catch (error: any) {
    console.error('[CRM API] GET /franchises error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch franchises' },
      { status: 500 }
    );
  }
}
