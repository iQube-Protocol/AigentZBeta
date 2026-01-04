/**
 * CRM Tenants API
 * 
 * GET /api/crm/tenants - List tenants (optionally filtered by franchise)
 * GET /api/crm/tenants?id=xxx - Get tenant by ID or slug
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const franchiseId = searchParams.get('franchiseId') || undefined;
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Get specific tenant
    if (id) {
      const tenant = await crmService.getTenant(id);
      
      if (!tenant) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: tenant,
      });
    }

    // List tenants (optionally filtered by franchise)
    const tenants = await crmService.listTenants(franchiseId, activeOnly);

    return NextResponse.json({
      success: true,
      data: tenants,
    });
  } catch (error: any) {
    console.error('[CRM API] GET /tenants error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}
