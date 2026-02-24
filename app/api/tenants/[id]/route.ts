/**
 * Individual Tenant API
 * GET /api/tenants/[id] - Get specific tenant
 * PUT /api/tenants/[id] - Update tenant
 * DELETE /api/tenants/[id] - Delete tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/services/tenant/tenantService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Tenant ID is required',
      }, { status: 400 });
    }

    const tenant = await tenantService.getTenant(id);

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant not found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      tenant,
    });
  } catch (error) {
    console.error('Error getting tenant:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get tenant',
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Tenant ID is required',
      }, { status: 400 });
    }

    // Check if tenant exists
    const existingTenant = await tenantService.getTenant(id);
    if (!existingTenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant not found',
      }, { status: 404 });
    }

    // If updating slug, check for conflicts
    if (body.slug && body.slug !== existingTenant.slug) {
      const slugConflict = await tenantService.getTenantBySlug(body.slug);
      if (slugConflict) {
        return NextResponse.json({
          success: false,
          error: 'Tenant slug already exists',
        }, { status: 409 });
      }
    }

    const updatedTenant = await tenantService.updateTenant(id, body);

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update tenant',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Tenant ID is required',
      }, { status: 400 });
    }

    // Check if tenant exists
    const existingTenant = await tenantService.getTenant(id);
    if (!existingTenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant not found',
      }, { status: 404 });
    }

    // Soft delete by updating status
    await tenantService.updateTenant(id, { status: 'inactive' });

    return NextResponse.json({
      success: true,
      message: 'Tenant deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete tenant',
    }, { status: 500 });
  }
}
