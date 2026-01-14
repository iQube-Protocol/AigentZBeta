/**
 * Users API
 * GET /api/users - List users
 * POST /api/users - Create new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/services/tenant/tenantService';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const tenantId = searchParams.get('tenantId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: 'tenantId is required',
      }, { status: 400 });
    }

    const result = await tenantService.listTenantMembers(tenantId, {
      role: role || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      users: result.members,
      total: result.total,
      limit,
      offset,
      filters: {
        tenantId,
        role,
        status,
      },
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list users',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['email', 'display_name'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    // Check if user already exists
    const existingUser = await tenantService.getUserByEmail(body.email);
    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'User with this email already exists',
      }, { status: 409 });
    }

    const user = await tenantService.createUser({
      email: body.email,
      username: body.username,
      display_name: body.display_name,
      avatar_url: body.avatar_url,
      password: body.password,
    });

    // Add to tenant if specified
    if (body.tenant_id && body.role) {
      await tenantService.addTenantMembership({
        tenant_id: body.tenant_id,
        user_id: user.user_id,
        role: body.role,
        invited_by: body.invited_by,
      });
    }

    // Create receipt for user creation
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'user',
        action: 'create_user',
        tenantId: body.tenant_id || 'system',
        result: {
          userId: user.user_id,
          email: user.email,
          displayName: user.display_name,
        },
      });
    } catch (error) {
      console.warn('Failed to create user creation receipt:', error);
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create user',
    }, { status: 500 });
  }
}
