/**
 * CRM Franchises API
 * 
 * GET /api/crm/franchises - List franchises
 * GET /api/crm/franchises?id=xxx - Get franchise by ID or slug
 * GET /api/crm/franchises?id=xxx&tenants=true - Get franchise with its tenants
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tenants = searchParams.get('tenants') === 'true';
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
      if (tenants) {
        const franchiseTenants = await crmService.getFranchiseTenants(franchise.id);
        return NextResponse.json({
          success: true,
          data: {
            ...franchise,
            tenants: franchiseTenants,
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

    return NextResponse.json({
      success: true,
      data: franchises,
    });
  } catch (error: any) {
    console.error('[CRM API] GET /franchises error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch franchises' },
      { status: 500 }
    );
  }
}
