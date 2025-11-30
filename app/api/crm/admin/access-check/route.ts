/**
 * CRM Admin Access Check API
 * 
 * GET /api/crm/admin/access-check - Check if a user has admin access for a specific action
 */

import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/services/crm/crmDataAccess';
import { AdminPermissions, AdminCategorySlug } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kybeDid = searchParams.get('kybeDid');
    const action = searchParams.get('action') as keyof AdminPermissions;
    const franchiseId = searchParams.get('franchiseId') || undefined;
    const tenantId = searchParams.get('tenantId') || undefined;
    const categorySlug = searchParams.get('categorySlug') as AdminCategorySlug | undefined;

    if (!kybeDid || !action) {
      return NextResponse.json(
        { error: 'kybeDid and action are required' },
        { status: 400 }
      );
    }

    // Validate action
    const validActions: (keyof AdminPermissions)[] = [
      'read', 'write', 'delete', 'manage_users', 
      'manage_admins', 'manage_settings', 'view_audit_logs', 'export_data'
    ];
    
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const hasAccess = await db.checkAdminAccess({
      kybeDid,
      action,
      franchiseId,
      tenantId,
      categorySlug,
    });

    // Also get the user's roles for context
    const roles = await db.getAdminRolesByKybeDid(kybeDid);
    const highestRole = roles.length > 0 ? roles[0] : null;

    return NextResponse.json({
      success: true,
      data: {
        kybeDid,
        action,
        hasAccess,
        scope: {
          franchiseId,
          tenantId,
          categorySlug,
        },
        highestRole: highestRole ? {
          roleType: highestRole.roleType,
          scopeDescription: highestRole.scopeDescription,
          accessLevel: highestRole.accessLevel,
        } : null,
        isUberAdmin: roles.some(r => r.roleType === 'uber_admin'),
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /admin/access-check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check admin access' },
      { status: 500 }
    );
  }
}
