import { NextRequest, NextResponse } from 'next/server';
import { crmService } from '@/services/crm/crmService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'kn0w1';
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    // Get contributions for this persona
    const contributions = await crmService.listContributions(tenantId, {
      personaId,
      limit: 50,
    });

    return NextResponse.json({
      success: true,
      contributions
    });
  } catch (error: any) {
    console.error('Failed to fetch contributions:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, personaId, contributionType, units, source } = body;

    if (!tenantId || !personaId || !contributionType) {
      return NextResponse.json(
        { error: 'tenantId, personaId, and contributionType are required' },
        { status: 400 }
      );
    }

    // Record a contribution
    const result = await crmService.recordContribution({
      tenantId,
      personaId,
      contributionType,
      units: units || 1,
      basePokwWeight: 1.0,
      source: source || 'marketa-cartridge'
    });

    return NextResponse.json({
      success: true,
      contribution: result
    });
  } catch (error: any) {
    console.error('Failed to record contribution:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to record contribution' },
      { status: 500 }
    );
  }
}
