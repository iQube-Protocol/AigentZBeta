/**
 * Reputation API
 * 
 * GET /api/crm/reputation - Get persona reputation or list reputation events
 * POST /api/crm/reputation - Create manual attestation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPersonaReputation,
  listReputationEvents,
  createManualAttestation,
  listCategoryDefaults,
} from '@/services/crm/taskService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    const tenantId = searchParams.get('tenantId');
    const events = searchParams.get('events');
    const categoryDefaults = searchParams.get('categoryDefaults');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Get category defaults
    if (categoryDefaults === 'true') {
      const defaults = await listCategoryDefaults();
      return NextResponse.json({ categoryDefaults: defaults });
    }

    // Get reputation events
    if (events === 'true') {
      const reputationEvents = await listReputationEvents({
        tenantId: tenantId || undefined,
        personaId: personaId || undefined,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });
      return NextResponse.json({ events: reputationEvents });
    }

    // Get persona reputation
    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required (or use events=true for event list)' },
        { status: 400 }
      );
    }

    const reputation = await getPersonaReputation(personaId);

    if (!reputation) {
      // Return empty reputation for new personas
      return NextResponse.json({
        reputation: {
          personaId,
          repTechnical: 0,
          repCreative: 0,
          repEntrepreneurial: 0,
          repDataArch: 0,
          repCommunity: 0,
          repOverall: 0,
          lifetimeCvs: 0,
          totalTasksCompleted: 0,
          totalTasksClaimed: 0,
          repRolling12m: 0,
        },
      });
    }

    return NextResponse.json({ reputation });
  } catch (error: unknown) {
    console.error('[API] GET /api/crm/reputation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get reputation' },
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
      deltaTechnical,
      deltaCreative,
      deltaEntrepreneurial,
      deltaDataArch,
      deltaCommunity,
      reason,
      createdByPersonaId,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required for manual attestations' },
        { status: 400 }
      );
    }

    // Validate at least one delta is provided
    const hasDeltas = 
      deltaTechnical || deltaCreative || deltaEntrepreneurial || 
      deltaDataArch || deltaCommunity;

    if (!hasDeltas) {
      return NextResponse.json(
        { error: 'At least one reputation delta is required' },
        { status: 400 }
      );
    }

    const reputationEvent = await createManualAttestation({
      tenantId,
      personaId,
      deltaTechnical,
      deltaCreative,
      deltaEntrepreneurial,
      deltaDataArch,
      deltaCommunity,
      reason,
      createdByPersonaId,
    });

    // Get updated reputation
    const reputation = await getPersonaReputation(personaId);

    return NextResponse.json({
      reputationEvent,
      reputation,
      message: 'Manual attestation created',
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API] POST /api/crm/reputation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create attestation' },
      { status: 500 }
    );
  }
}
