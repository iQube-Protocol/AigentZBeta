/**
 * CRM Segments API
 * 
 * GET /api/crm/segments - List segments for a tenant
 * POST /api/crm/segments - Create a new segment
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import { TenantId } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') as TenantId;
    const segmentId = searchParams.get('segmentId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // If segmentId provided, get segment members
    if (segmentId) {
      const members = await crmService.getSegmentMembers(segmentId);
      return NextResponse.json({
        success: true,
        data: {
          segmentId,
          members,
          count: members.length,
        },
      });
    }

    // List all segments
    const segments = await crmService.listSegments(tenantId);

    return NextResponse.json({
      success: true,
      data: segments,
    });
  } catch (error: any) {
    console.error('[CRM API] GET /segments error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch segments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      name,
      description,
      ruleDefinition,
      isDynamic,
    } = body;

    if (!tenantId || !name) {
      return NextResponse.json(
        { error: 'tenantId and name are required' },
        { status: 400 }
      );
    }

    const segment = await crmService.createSegment({
      tenantId,
      name,
      description,
      ruleDefinition,
      isDynamic,
    });

    return NextResponse.json({
      success: true,
      data: segment,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /segments error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create segment' },
      { status: 500 }
    );
  }
}
