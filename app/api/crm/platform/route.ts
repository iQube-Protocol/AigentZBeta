/**
 * CRM Platform Account API
 * 
 * GET /api/crm/platform - Get platform account for a Kybe DID
 * POST /api/crm/platform - Create platform account
 * 
 * Platform accounts sit ABOVE franchises in the hierarchy.
 * Users can have platform accounts independently of franchise/tenant accounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/services/crm/crmDataAccess';
import { PlatformAccountType, PrivacyLevel } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kybeDid = searchParams.get('kybeDid');

    if (!kybeDid) {
      return NextResponse.json(
        { error: 'kybeDid is required' },
        { status: 400 }
      );
    }

    const platformAccount = await db.getPlatformAccountByKybeDid(kybeDid);
    
    if (!platformAccount) {
      return NextResponse.json(
        { error: 'Platform account not found' },
        { status: 404 }
      );
    }

    // Get franchise access
    const franchiseAccess = await db.getPlatformFranchiseAccess(platformAccount.id);

    return NextResponse.json({
      success: true,
      data: {
        ...platformAccount,
        franchiseAccess,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /platform error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch platform account' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      kybeDid,
      authProfileId,
      accountType,
      displayName,
      avatarUrl,
      settings,
      privacyLevel,
    } = body;

    if (!kybeDid) {
      return NextResponse.json(
        { error: 'kybeDid is required' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await db.getPlatformAccountByKybeDid(kybeDid);
    if (existing) {
      return NextResponse.json(
        { error: 'Platform account already exists for this Kybe DID' },
        { status: 409 }
      );
    }

    // Create platform account
    const platformAccount = await db.createPlatformAccount({
      kybeDid,
      authProfileId,
      accountType: accountType as PlatformAccountType,
      displayName,
      avatarUrl,
      settings,
      privacyLevel: privacyLevel as PrivacyLevel,
    });

    // Auto-provision registry profile (DiDQube compliant)
    await db.ensureRegistryProfile({
      kybeDid,
      displayName,
      originLayer: 'platform',
    });

    return NextResponse.json({
      success: true,
      data: platformAccount,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /platform error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create platform account' },
      { status: 500 }
    );
  }
}
