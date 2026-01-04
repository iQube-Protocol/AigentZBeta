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
        const tenantIds = franchiseTenants.map((t) => t.id);
        const personaCounts = await fetchPersonaCountsByTenant(tenantIds);

        return NextResponse.json({
          success: true,
          data: {
            ...franchise,
            tenants: franchiseTenants,
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
    const personaCounts = await fetchPersonaCountsByTenant(tenantIds);

    const tenantsByFranchise = new Map<string, any[]>();
    tenantsList.forEach((tenant) => {
      const franchiseId = tenant.franchiseId || 'unassigned';
      if (!tenantsByFranchise.has(franchiseId)) tenantsByFranchise.set(franchiseId, []);
      tenantsByFranchise.get(franchiseId)?.push({
        ...tenant,
        personaCount: personaCounts.get(tenant.id) || 0,
      });
    });

    return NextResponse.json({
      success: true,
      data: franchises.map((franchise) => ({
        ...franchise,
        tenants: tenantsByFranchise.get(franchise.id) || [],
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
