/**
 * CRM Admin Roles API
 * 
 * DiDQube Identity Hierarchy:
 * - KybeDID: Proof-of-personhood anchor (rarely shared directly)
 * - Root DID: Deep identity for regulated/admin contexts (used for admin roles)
 * - Persona: Day-to-day identity surface
 * 
 * Admin roles should use Root DIDs per DiDQube policy.
 * API accepts both rootDid and kybeDid for backward compatibility.
 * 
 * GET /api/crm/admin/roles - Get admin roles for a user or scope
 * POST /api/crm/admin/roles - Create a new admin role (requires admin access)
 * PATCH /api/crm/admin/roles - Update an admin role
 * DELETE /api/crm/admin/roles - Delete an admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/services/crm/crmDataAccess';
import { AdminRoleType, AdminPermissions, canManageRole } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kybeDid = searchParams.get('kybeDid');
    const franchiseId = searchParams.get('franchiseId') || undefined;
    const tenantId = searchParams.get('tenantId') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const roleType = searchParams.get('roleType') as AdminRoleType | undefined;
    const uberOnly = searchParams.get('uberOnly') === 'true';
    const categorySlug = searchParams.get('categorySlug') || undefined;

    // Get uber admins
    if (uberOnly) {
      const uberAdmins = await db.getUberAdmins();
      return NextResponse.json({
        success: true,
        data: uberAdmins,
      });
    }

    // Get category uber admins
    if (categorySlug && !kybeDid) {
      const categoryUberAdmins = await db.getCategoryUberAdmins(categorySlug);
      return NextResponse.json({
        success: true,
        data: categoryUberAdmins,
      });
    }

    // Get roles for a specific user
    if (kybeDid) {
      const roles = await db.getAdminRolesByKybeDid(kybeDid);
      const highestRole = roles.length > 0 ? roles[0] : null;
      
      return NextResponse.json({
        success: true,
        data: {
          kybeDid,
          roles,
          highestRole,
          isUberAdmin: roles.some(r => r.roleType === 'uber_admin'),
          hasAdminAccess: roles.length > 0,
        },
      });
    }

    // Get roles for a specific scope
    const roles = await db.getAdminRolesForScope({
      franchiseId,
      tenantId,
      categoryId,
      roleType,
    });

    return NextResponse.json({
      success: true,
      data: roles,
    });
  } catch (error: any) {
    console.error('[CRM API] GET /admin/roles error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin roles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      // DiDQube policy: Use Root DIDs for admin roles (preferred)
      grantorRootDid,  // The admin granting the role (Root DID - preferred)
      rootDid,         // The assignee's Root DID (preferred)
      // Legacy support for KybeDID (deprecated for admin roles)
      grantorKybeDid,  // Fallback if grantorRootDid not provided
      kybeDid,         // Fallback if rootDid not provided
      platformAccountId,
      authProfileId,
      roleType,
      franchiseId,
      tenantId,
      categoryId,
      permissions,
      expiresAt,
    } = body;

    // Use Root DID if provided, fall back to KybeDID for backward compatibility
    const effectiveGrantorDid = grantorRootDid || grantorKybeDid;
    const effectiveAssigneeDid = rootDid || kybeDid;

    if (!effectiveGrantorDid) {
      return NextResponse.json(
        { error: 'grantorRootDid is required (the Root DID of the admin granting this role)' },
        { status: 400 }
      );
    }

    if (!roleType) {
      return NextResponse.json(
        { error: 'roleType is required' },
        { status: 400 }
      );
    }

    if (!effectiveAssigneeDid && !platformAccountId && !authProfileId) {
      return NextResponse.json(
        { error: 'rootDid (assignee Root DID), platformAccountId, or authProfileId is required' },
        { status: 400 }
      );
    }

    // Check if grantor has permission to create this role
    console.log('[Admin Roles API] Looking up grantor:', effectiveGrantorDid);
    const grantorRoles = await db.getAdminRolesByKybeDid(effectiveGrantorDid);
    console.log('[Admin Roles API] Grantor roles found:', grantorRoles.length, grantorRoles);
    if (grantorRoles.length === 0) {
      return NextResponse.json(
        { error: `Grantor does not have admin access. Looked up: "${effectiveGrantorDid}"` },
        { status: 403 }
      );
    }

    const grantorHighestRole = grantorRoles[0];
    
    // Check if grantor can manage the target role type
    if (!canManageRole(grantorHighestRole.roleType, roleType as AdminRoleType)) {
      return NextResponse.json(
        { error: `${grantorHighestRole.roleType} cannot grant ${roleType} roles` },
        { status: 403 }
      );
    }

    // Check grantor has manage_admins permission
    if (!grantorHighestRole.permissions.manage_admins) {
      return NextResponse.json(
        { error: 'Grantor does not have manage_admins permission' },
        { status: 403 }
      );
    }

    // Create the admin role
    // Store as kybeDid in DB for compatibility, but conceptually this is the Root DID
    const adminRole = await db.createAdminRole({
      platformAccountId,
      authProfileId,
      kybeDid: effectiveAssigneeDid, // Root DID stored in kybeDid field
      roleType: roleType as AdminRoleType,
      franchiseId,
      tenantId,
      categoryId,
      permissions: permissions as Partial<AdminPermissions>,
      grantedByAdminRoleId: grantorHighestRole.id,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      data: adminRole,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /admin/roles error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create admin role' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      updaterKybeDid,  // The admin updating the role
      roleId,
      permissions,
      expiresAt,
      isActive,
      suspensionReason,
    } = body;

    if (!updaterKybeDid || !roleId) {
      return NextResponse.json(
        { error: 'updaterKybeDid and roleId are required' },
        { status: 400 }
      );
    }

    // Get the role being updated
    const targetRole = await db.getAdminRole(roleId);
    if (!targetRole) {
      return NextResponse.json(
        { error: 'Admin role not found' },
        { status: 404 }
      );
    }

    // Check if updater has permission
    const updaterRoles = await db.getAdminRolesByKybeDid(updaterKybeDid);
    if (updaterRoles.length === 0) {
      return NextResponse.json(
        { error: 'Updater does not have admin access' },
        { status: 403 }
      );
    }

    const updaterHighestRole = updaterRoles[0];
    
    // Check if updater can manage the target role type
    if (!canManageRole(updaterHighestRole.roleType, targetRole.roleType)) {
      return NextResponse.json(
        { error: `${updaterHighestRole.roleType} cannot modify ${targetRole.roleType} roles` },
        { status: 403 }
      );
    }

    // Update the role
    const updatedRole = await db.updateAdminRole(roleId, {
      permissions,
      expiresAt,
      isActive,
      suspensionReason,
    });

    return NextResponse.json({
      success: true,
      data: updatedRole,
    });
  } catch (error: any) {
    console.error('[CRM API] PATCH /admin/roles error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update admin role' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deleterKybeDid = searchParams.get('deleterKybeDid');
    const roleId = searchParams.get('roleId');

    if (!deleterKybeDid || !roleId) {
      return NextResponse.json(
        { error: 'deleterKybeDid and roleId are required' },
        { status: 400 }
      );
    }

    // Get the role being deleted
    const targetRole = await db.getAdminRole(roleId);
    if (!targetRole) {
      return NextResponse.json(
        { error: 'Admin role not found' },
        { status: 404 }
      );
    }

    // Check if deleter has permission
    const deleterRoles = await db.getAdminRolesByKybeDid(deleterKybeDid);
    if (deleterRoles.length === 0) {
      return NextResponse.json(
        { error: 'Deleter does not have admin access' },
        { status: 403 }
      );
    }

    const deleterHighestRole = deleterRoles[0];
    
    // Check if deleter can manage the target role type
    if (!canManageRole(deleterHighestRole.roleType, targetRole.roleType)) {
      return NextResponse.json(
        { error: `${deleterHighestRole.roleType} cannot delete ${targetRole.roleType} roles` },
        { status: 403 }
      );
    }

    // Delete the role
    await db.deleteAdminRole(roleId);

    return NextResponse.json({
      success: true,
      message: 'Admin role deleted',
    });
  } catch (error: any) {
    console.error('[CRM API] DELETE /admin/roles error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete admin role' },
      { status: 500 }
    );
  }
}
