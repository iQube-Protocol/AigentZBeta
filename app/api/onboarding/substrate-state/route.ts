/**
 * GET /api/onboarding/substrate-state — where the CALLER currently stands on
 * the one onboarding substrate, and the single next action from there.
 *
 * SPEC-COS-001 Phase 1 (operator-ratified 2026-07-25). The response is the
 * seven-layer substrate (Claude → MCP → Passport → Delegation → Agent Me →
 * Experience Qubes → Journey), each layer carrying its status, HOW that status
 * was resolved, and the evidence behind it — plus the set of surfaces
 * progressive activation (§4) permits right now.
 *
 * Spine-gated: the caller is resolved exactly once via `getActivePersona`, and
 * `services/onboarding/substrateState.ts` composes every downstream read from
 * that one resolution. Client callers MUST use `personaFetch` (CLAUDE.md
 * "Client-side spine fetches"), passing `personaIdHint` where the surface knows
 * the active persona.
 *
 * T1-safe by construction: no `personaId`, `authProfileId`, `rootDid`,
 * `fioHandle`, or any other T0 identifier appears in the response — every field
 * is a status enum, a boolean-derived string, a surface id, or copy. The canary
 * `tests/onboarding-substrate.test.ts` asserts this.
 *
 * READ-ONLY. There is no POST. No layer can be advanced through this route —
 * advancing Delegation is `authorizeAgreement`, which refuses anyone but the
 * owning human persona (CFS-043 §2, Principal–Delegate Separation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  getSubstrateState,
  unauthenticatedSubstrateState,
  type ArrivalChannel,
} from '@/services/onboarding/substrateState';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest) {
  // The arrival channel is DECLARED by the caller, never observed — a
  // third-party-agent crossing (PRD-THR-001) says so; anything else is a direct
  // browser arrival (SPEC-COS-001 §2.3). It changes only the topmost rung; every
  // layer from Passport onward is identical either way, so an untrusted value
  // here can never widen what is observed or activated.
  const declared = req.nextUrl.searchParams.get('channel');
  const arrivalChannel: ArrivalChannel = declared === 'threshold-companion' ? 'threshold-companion' : 'direct';

  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json(
      { ok: true, authenticated: false, substrate: unauthenticatedSubstrateState(arrivalChannel) },
      { headers: NO_STORE },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const substrate = await getSubstrateState(
    req,
    admin,
    { personaId: persona.personaId, authProfileId: persona.authProfileId },
    { arrivalChannel },
  );

  return NextResponse.json({ ok: true, authenticated: true, substrate }, { headers: NO_STORE });
}
