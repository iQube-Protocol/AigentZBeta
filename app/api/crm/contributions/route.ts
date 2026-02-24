/**
 * CRM Contributions API
 * 
 * GET /api/crm/contributions - List contributions
 * POST /api/crm/contributions - Record a new contribution (computes PoKW)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import { TenantId } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') as TenantId;
    const personaId = searchParams.get('personaId') || undefined;
    const clusterqubeId = searchParams.get('clusterqubeId') || undefined;
    const contributionType = searchParams.get('contributionType') || undefined;
    const periodStart = searchParams.get('periodStart') || undefined;
    const periodEnd = searchParams.get('periodEnd') || undefined;
    const status = searchParams.get('status') || undefined;
    const hasTask = searchParams.get('hasTask');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const contributions = await crmService.listContributions(tenantId, {
      personaId,
      clusterqubeId,
      contributionType,
      periodStart,
      periodEnd,
      status,
      hasTask: hasTask === 'true' ? true : hasTask === 'false' ? false : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      contributions,  // Also return as 'contributions' for consistency
      data: contributions,
      pagination: {
        limit,
        offset,
        count: contributions.length,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /contributions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      personaId,
      qubeId,
      clusterQubeId,
      contributionType,
      units,
      basePokwWeight,
      source,
    } = body;

    if (!tenantId || !personaId || !contributionType) {
      return NextResponse.json(
        { error: 'tenantId, personaId, and contributionType are required' },
        { status: 400 }
      );
    }

    const result = await crmService.recordContribution({
      tenantId,
      personaId,
      qubeId,
      clusterQubeId,
      contributionType,
      units,
      basePokwWeight,
      source,
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /contributions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record contribution' },
      { status: 500 }
    );
  }
}
