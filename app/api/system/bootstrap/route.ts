/**
 * System Bootstrap API
 * POST /api/system/bootstrap - Initialize system with first admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/services/tenant/tenantService';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['email', 'display_name', 'password', 'organization_name'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    // Check if system is already bootstrapped
    // This would typically check for existing system admins
    // For now, we'll allow multiple bootstraps for development

    // Create the first user (system admin)
    const adminUser = await tenantService.createUser({
      email: body.email,
      display_name: body.display_name,
      username: body.username,
      password: body.password,
    });

    // Update user to active status
    await tenantService.updateUser(adminUser.user_id, {
      status: 'active',
      email_verified: true,
    });

    // Create the organization tenant
    const tenant = await tenantService.createTenant({
      name: body.organization_name,
      slug: body.organization_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: body.description || 'Primary organization',
      created_by: adminUser.user_id,
      settings: {
        is_primary: true,
        bootstrap_complete: true,
      },
    });

    // Add admin as owner of the tenant
    await tenantService.addTenantMembership({
      tenant_id: tenant.tenant_id,
      user_id: adminUser.user_id,
      role: 'owner',
    });

    // Assign system admin role
    const systemRoles = await tenantService.listRoles(); // Get system roles
    const systemAdminRole = systemRoles.find(r => r.name === 'System Administrator');
    if (systemAdminRole) {
      await tenantService.assignRole(adminUser.user_id, systemAdminRole.role_id, undefined, adminUser.user_id);
    }

    // Create comprehensive bootstrap receipt
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'system',
        action: 'bootstrap_complete',
        tenantId: tenant.tenant_id,
        result: {
          systemAdminId: adminUser.user_id,
          tenantId: tenant.tenant_id,
          organizationName: body.organization_name,
          adminEmail: body.email,
          bootstrapTimestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('Failed to create bootstrap receipt:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'System bootstrap completed successfully',
      data: {
        admin: {
          user_id: adminUser.user_id,
          email: adminUser.email,
          display_name: adminUser.display_name,
        },
        tenant: {
          tenant_id: tenant.tenant_id,
          name: tenant.name,
          slug: tenant.slug,
        },
      },
    });
  } catch (error) {
    console.error('Error during system bootstrap:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Bootstrap error details:', {
        message: error.message,
        stack: error.stack,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to bootstrap system',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if system has been bootstrapped
    // This would typically check for existing system admins or tenants
    // For now, we'll return a simple status
    
    return NextResponse.json({
      success: true,
      bootstrapped: false, // This should be determined by checking actual system state
      message: 'System is ready for bootstrap',
    });
  } catch (error) {
    console.error('Error checking bootstrap status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check bootstrap status',
    }, { status: 500 });
  }
}
