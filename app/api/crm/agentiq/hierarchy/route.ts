/**
 * AgentiQ Hierarchy API
 * GET /api/crm/agentiq/hierarchy - Get complete AgentiQ franchise hierarchy
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeTenants = searchParams.get('includeTenants') !== 'false';
    const includeStats = searchParams.get('includeStats') === 'true';

    // Get AgentiQ anchor franchise
    const agentiq = await crmService.getAgentiqAnchor();
    if (!agentiq) {
      return NextResponse.json({
        success: false,
        error: 'AgentiQ anchor franchise not found',
      }, { status: 404 });
    }

    // Get complete hierarchy
    const hierarchy = await crmService.getAgentiqHierarchy();

    // Get tenant hierarchy if requested
    let tenantHierarchy = null;
    if (includeTenants) {
      tenantHierarchy = await crmService.getAgentiqTenantHierarchy();
    }

    // Calculate statistics
    let stats = null;
    if (includeStats) {
      stats = {
        totalFranchises: hierarchy.franchises.length,
        totalTenants: tenantHierarchy?.allTenants.length || 0,
        directAgentiqTenants: tenantHierarchy?.directTenants.length || 0,
        hierarchyLevels: Math.max(...Object.values(hierarchy.hierarchy).map(h => h.level)) + 1,
        anchorFranchise: {
          id: agentiq.id,
          name: agentiq.name,
          slug: agentiq.slug,
        },
      };
    }

    return NextResponse.json({
      success: true,
      hierarchy: {
        anchor: agentiq,
        franchises: hierarchy.franchises,
        structure: hierarchy.hierarchy,
        tenants: tenantHierarchy,
        stats,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        includeTenants,
        includeStats,
      },
    });
  } catch (error) {
    console.error('Error getting AgentiQ hierarchy:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get AgentiQ hierarchy',
    }, { status: 500 });
  }
}
