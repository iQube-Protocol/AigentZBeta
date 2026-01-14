/**
 * Tenants API
 * GET /api/tenants - List tenants
 * POST /api/tenants - Create new tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/services/tenant/tenantService';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await tenantService.listTenants({
      userId: userId || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      tenants: result.tenants,
      total: result.total,
      limit,
      offset,
      filters: {
        userId,
        status,
      },
    });
  } catch (error) {
    console.error('Error listing tenants:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list tenants',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['name', 'created_by'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    // Check if slug is available
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existingTenant = await tenantService.getTenantBySlug(slug);
    if (existingTenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant slug already exists',
      }, { status: 409 });
    }

    const tenant = await tenantService.createTenant({
      name: body.name,
      slug: slug,
      description: body.description,
      created_by: body.created_by,
      settings: body.settings,
    });

    // Add creator as owner
    await tenantService.addTenantMembership({
      tenant_id: tenant.tenant_id,
      user_id: body.created_by,
      role: 'owner',
    });

    // Create receipt for tenant creation
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'tenant',
        action: 'create_tenant',
        tenantId: tenant.tenant_id,
        result: {
          tenantId: tenant.tenant_id,
          name: tenant.name,
          slug: tenant.slug,
          createdBy: body.created_by,
        },
      });
    } catch (error) {
      console.warn('Failed to create tenant creation receipt:', error);
    }

    return NextResponse.json({
      success: true,
      tenant,
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create tenant',
    }, { status: 500 });
  }
}
