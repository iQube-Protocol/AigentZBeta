/**
 * GET /api/journey/ian/state
 *
 * Resolve Ian Boundary Research journey state for the authenticated persona.
 * Serves as the authoritative state resolver for all Ian-related UI components
 * (journey bar, Companion guidance, stage surfaces).
 *
 * SPEC-JS-001 §9: Pure, deterministic, no I/O (except required platform fetches).
 * Journey Guidance Principle: a stage is COMPLETE only when every completionEvidence
 * field is present and truthy in the authoritative platform state — never from
 * client navigation or a click.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { JourneyRuntimeState } from '@/types/journey';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import { assembleInteractionContext } from '@/services/journey/interactionContextAssembly';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { getActivePersona } from '@/services/identity/getActivePersona';
import type { AuthoritativePlatformState as JourneyAuthState } from '@/services/journey/resolveJourneyState';

/**
 * Fetch authoritative platform state for Ian journey evidence resolution.
 * Assembles evidence from real sources: receipts, passport, delegation, exchange status.
 */
async function fetchAuthoritativePlatformState(
  personaId: string
): Promise<JourneyAuthState> {
  // TODO: Stage 4 integration — fetch real evidence from:
  // - Activity receipts (orientation_ritual_completed, passport_issued, etc.)
  // - Passport service (passport status)
  // - Delegation service (delegation_active)
  // - Exchange service (reciprocal_exchange_completed)
  // - iQube service (iqube_holder_status_confirmed)

  // For now, return minimal structure (evidence absent = all stages NOT_STARTED)
  return {
    stages: {
      'orient': {},
      'passport': {},
      'delegation-establish': {},
      'create-deposit': {},
      'freeze-attestation-ready': {},
      'freeze-attestation': {},
      'exchange-ready': {},
      'exchange-complete': {},
      'research-active': {},
    },
    receiptRefs: {},
  };
}

export async function GET(request: NextRequest) {
  try {
    // Resolve active persona (spine identity)
    const persona = await getActivePersona(request);
    if (!persona) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch authoritative platform state for evidence resolution
    const authState = await fetchAuthoritativePlatformState(persona.id);

    // Resolve journey state (pure, deterministic)
    const journeyState: JourneyRuntimeState = resolveJourneyState(
      IAN_BOUNDARY_RESEARCH_JOURNEY,
      authState
    );

    // Assemble interaction context for UI consumption
    // (recommendations, conditions, stage states, authority)
    const interactionContext = assembleInteractionContext(
      IAN_BOUNDARY_RESEARCH_JOURNEY,
      journeyState,
      // TODO: Authority from owning capability (Passport, Delegation, Constitutional Computing)
      {
        permitted: true,
        reason: 'placeholder: fetch from owning capability',
      },
      // TODO: Current delegation state if applicable
      undefined,
      // TODO: Experience intent signals from prior context
      undefined
    );

    // Enrich journey state with interaction context
    const responseState: JourneyRuntimeState = {
      ...journeyState,
      interactionContext,
    };

    return NextResponse.json(responseState);
  } catch (err) {
    console.error('[ian-journey-state]', err);
    return NextResponse.json(
      { error: 'Failed to resolve journey state' },
      { status: 500 }
    );
  }
}
