/**
 * CRM Top Contributors API
 * 
 * GET /api/crm/top-contributors - Get top contributors for a tenant within a period
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import { TenantId } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') as TenantId;
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!tenantId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'tenantId, periodStart, and periodEnd are required' },
        { status: 400 }
      );
    }

    const topContributors = await crmService.getTopContributors(
      tenantId,
      periodStart,
      periodEnd,
      limit
    );

    return NextResponse.json({
      success: true,
      data: topContributors,
      period: {
        start: periodStart,
        end: periodEnd,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /top-contributors error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch top contributors' },
      { status: 500 }
    );
  }
}
