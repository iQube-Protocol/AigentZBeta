/**
 * CRM Platform Franchise Access API
 * 
 * POST /api/crm/platform/franchise-access - Grant franchise access to platform account
 * 
 * Links platform accounts to franchises they can access/manage.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/services/crm/crmDataAccess';
import { PlatformFranchiseRole } from '@/types/crm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      platformAccountId,
      franchiseId,
      accessRole,
      grantedByPlatformAccountId,
    } = body;

    if (!platformAccountId || !franchiseId) {
      return NextResponse.json(
        { error: 'platformAccountId and franchiseId are required' },
        { status: 400 }
      );
    }

    const access = await db.grantPlatformFranchiseAccess({
      platformAccountId,
      franchiseId,
      accessRole: accessRole as PlatformFranchiseRole,
      grantedByPlatformAccountId,
    });

    return NextResponse.json({
      success: true,
      data: access,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /platform/franchise-access error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to grant franchise access' },
      { status: 500 }
    );
  }
}
