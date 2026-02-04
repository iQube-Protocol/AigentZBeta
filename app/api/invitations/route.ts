/**
 * User Invitations API
 * GET /api/invitations - List invitations
 * POST /api/invitations - Create invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/services/tenant/tenantService';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: 'tenantId is required',
      }, { status: 400 });
    }

    // Note: This would need to be implemented in tenantService
    // For now, return empty result
    return NextResponse.json({
      success: true,
      invitations: [],
      total: 0,
      limit,
      offset,
      filters: {
        tenantId,
        status,
      },
    });
  } catch (error) {
    console.error('Error listing invitations:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list invitations',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['tenant_id', 'email', 'invited_by'];
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

    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid role. Must be one of: ' + validRoles.join(', '),
      }, { status: 400 });
    }

    const invitation = await tenantService.createInvitation({
      tenant_id: body.tenant_id,
      email: body.email,
      role: body.role || 'member',
      invited_by: body.invited_by,
    });

    // Create receipt for invitation
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'invitation',
        action: 'create_invitation',
        tenantId: body.tenant_id,
        result: {
          invitationId: invitation.invitation_id,
          email: invitation.email,
          role: invitation.role,
          invitedBy: body.invited_by,
        },
      });
    } catch (error) {
      console.warn('Failed to create invitation receipt:', error);
    }

    return NextResponse.json({
      success: true,
      invitation,
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create invitation',
    }, { status: 500 });
  }
}
