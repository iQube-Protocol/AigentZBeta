/**
 * GET /api/admin/registry/action-vocabulary
 *
 * Stage 8+ — Action Vocabulary tab data source.
 *
 * Returns the current state of services/iqube/legibility/actionMap.ts:
 *   - ACTION_SURFACE_MAP (internal AccessAction → surface IQubeAgentAction
 *     or 'internal_only')
 *   - SURFACE_INTERNAL_MAP (surface → internal)
 *   - PASSIVE_SURFACE_VERBS (surface verbs with no internal mapping)
 *   - MUTATING_SURFACE_VERBS (drives card auth + DVN flags)
 *   - Coverage health: every AccessAction has an entry; every
 *     IQubeAgentAction is either in PASSIVE_SURFACE_VERBS or has an
 *     inverse map entry.
 *
 * Per PRD v1.1 §A.6, the iqube-registry cartridge admin tab is the
 * review surface for vocabulary additions. This route powers it.
 *
 * Admin-gated. No mutation — vocabulary changes land via PR + CI gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  ACTION_SURFACE_MAP,
  SURFACE_INTERNAL_MAP,
  PASSIVE_SURFACE_VERBS,
  MUTATING_SURFACE_VERBS,
} from '@/services/iqube/legibility/actionMap';
import type { AccessAction } from '@/types/access';
import type { IQubeAgentAction } from '@/types/iqube/legibility';

const KNOWN_ACCESS_ACTIONS: ReadonlyArray<AccessAction> = [
  'read',
  'watch',
  'listen',
  'invoke',
  'connect',
  'remix',
  'mint',
  'transfer',
  'payment-settle',
  'policy-escalation',
  'disclosure',
];

const KNOWN_SURFACE_VERBS: ReadonlyArray<IQubeAgentAction> = [
  'discover',
  'read_meta',
  'read_summary',
  'request_access',
  'read_payload',
  'derive_summary',
  'transform',
  'cite',
  'propose_update',
  'mint_derivative',
  'fork',
  'record_receipt',
  'revoke_access',
  'audit_state',
];

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const internalToSurface = Object.entries(ACTION_SURFACE_MAP).map(
    ([internal, surface]) => ({ internal, surface }),
  );
  const surfaceToInternal = Object.entries(SURFACE_INTERNAL_MAP).map(
    ([surface, internal]) => ({ surface, internal }),
  );
  const passiveVerbs = Array.from(PASSIVE_SURFACE_VERBS);
  const mutatingVerbs = Array.from(MUTATING_SURFACE_VERBS);

  // Health check: do all known enums have map coverage?
  const missingInternalKeys = KNOWN_ACCESS_ACTIONS.filter(
    (a) => !(a in ACTION_SURFACE_MAP),
  );
  const orphanSurfaceVerbs = KNOWN_SURFACE_VERBS.filter(
    (v) => !(v in SURFACE_INTERNAL_MAP) && !PASSIVE_SURFACE_VERBS.has(v),
  );

  return NextResponse.json({
    counts: {
      access_actions: KNOWN_ACCESS_ACTIONS.length,
      surface_verbs: KNOWN_SURFACE_VERBS.length,
      passive_verbs: passiveVerbs.length,
      mutating_verbs: mutatingVerbs.length,
      internal_to_surface_entries: internalToSurface.length,
      surface_to_internal_entries: surfaceToInternal.length,
    },
    health: {
      complete: missingInternalKeys.length === 0 && orphanSurfaceVerbs.length === 0,
      missing_internal_keys: missingInternalKeys,
      orphan_surface_verbs: orphanSurfaceVerbs,
    },
    internal_to_surface: internalToSurface,
    surface_to_internal: surfaceToInternal,
    passive_verbs: passiveVerbs,
    mutating_verbs: mutatingVerbs,
    known_access_actions: KNOWN_ACCESS_ACTIONS,
    known_surface_verbs: KNOWN_SURFACE_VERBS,
  });
}
