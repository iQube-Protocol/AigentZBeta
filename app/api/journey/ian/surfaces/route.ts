/**
 * GET /api/journey/ian/surfaces
 *
 * Return the list of capability surfaces available at each journey stage.
 * Used by the UI to discover and route to stage-specific panels (Passport,
 * Delegation, iQube creation, Signing, Exchange, etc.).
 *
 * Surfaces are NOT created by Journey Spine — they are discovered from the
 * journey definition. Each surface references an existing capability
 * (Passport, Delegation, iQube, Signing, Exchange) that Ian journey composes.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { JourneyDefinition } from '@/types/journey';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { getActivePersona } from '@/services/identity/getActivePersona';

interface SurfacesByStage {
  [stageId: string]: JourneyDefinition['stages'][0]['surfaces'];
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const persona = await getActivePersona(request);
    if (!persona) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Extract surfaces keyed by stage ID
    const surfaces: SurfacesByStage = {};
    for (const stage of IAN_BOUNDARY_RESEARCH_JOURNEY.stages) {
      surfaces[stage.id] = stage.surfaces;
    }

    return NextResponse.json({
      journey: {
        id: IAN_BOUNDARY_RESEARCH_JOURNEY.id,
        label: IAN_BOUNDARY_RESEARCH_JOURNEY.label,
      },
      surfaces,
    });
  } catch (err) {
    console.error('[ian-journey-surfaces]', err);
    return NextResponse.json(
      { error: 'Failed to resolve surfaces' },
      { status: 500 }
    );
  }
}
