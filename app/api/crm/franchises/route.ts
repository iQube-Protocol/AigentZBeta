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
        const franchiseTenants = await crmService.getFranchiseTenants(franchise.id);
        const supabase = getSupabaseServer();
        const tenantIds = franchiseTenants.map((t) => t.id);
        const personaCounts = new Map<string, number>();

        if (supabase && tenantIds.length > 0) {
          const { data: personaRows, error: personaError } = await supabase
            .from('personas')
            .select('tenant_id')
            .in('tenant_id', tenantIds);

          if (!personaError) {
            (personaRows || []).forEach((row: any) => {
              if (!row.tenant_id) return;
              personaCounts.set(row.tenant_id, (personaCounts.get(row.tenant_id) || 0) + 1);
            });
          }
        }

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

    const supabase = getSupabaseServer();
    const tenantsList = await crmService.listTenants();
    const tenantIds = tenantsList.map((t) => t.id);
    const personaCounts = new Map<string, number>();

    if (supabase && tenantIds.length > 0) {
      const { data: personaRows, error: personaError } = await supabase
        .from('personas')
        .select('tenant_id')
        .in('tenant_id', tenantIds);

      if (!personaError) {
        (personaRows || []).forEach((row: any) => {
          if (!row.tenant_id) return;
          personaCounts.set(row.tenant_id, (personaCounts.get(row.tenant_id) || 0) + 1);
        });
      }
    }

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
