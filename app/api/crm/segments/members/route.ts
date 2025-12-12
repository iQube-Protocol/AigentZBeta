/**
 * CRM Segment Members API
 * 
 * POST /api/crm/segments/members - Add persona to segment
 * DELETE /api/crm/segments/members - Remove persona from segment
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segmentId, personaId } = body;

    if (!segmentId || !personaId) {
      return NextResponse.json(
        { error: 'segmentId and personaId are required' },
        { status: 400 }
      );
    }

    await crmService.addPersonaToSegment(segmentId, personaId);

    return NextResponse.json({
      success: true,
      message: 'Persona added to segment',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /segments/members error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add persona to segment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get('segmentId');
    const personaId = searchParams.get('personaId');

    if (!segmentId || !personaId) {
      return NextResponse.json(
        { error: 'segmentId and personaId are required' },
        { status: 400 }
      );
    }

    await crmService.removePersonaFromSegment(segmentId, personaId);

    return NextResponse.json({
      success: true,
      message: 'Persona removed from segment',
    });
  } catch (error: any) {
    console.error('[CRM API] DELETE /segments/members error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove persona from segment' },
      { status: 500 }
    );
  }
}
