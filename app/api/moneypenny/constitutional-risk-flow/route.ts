/**
 * GET /api/moneypenny/constitutional-risk-flow — Use Case Zero build-order
 * item 10a, extended by item 10b. Owner self-view over the Constitutional
 * Risk Flow chain state for one (persona, requestRef) pair — see
 * `services/vela/velaUnderwritingChainProjection.ts` for the full read-only
 * assembly this route is a thin wrapper over.
 *
 * Spine endpoint (calls `getActivePersona`) — any client call MUST use
 * `personaFetch`, never raw `fetch` (CLAUDE.md Identity & Access Spine,
 * PARAMOUNT). Persona-scoped throughout: `getConstitutionalRiskFlowState`
 * only ever reads the requested persona's own `activity_receipts` rows — the
 * same T1 self-view exposure class as every other persona-scoped
 * MoneyPenny read route (e.g. `/api/moneypenny/financial-profile`).
 *
 * `?requestRef=` is REQUIRED — there is no "list my requests" concept yet
 * (no route/UI in this codebase enumerates a persona's own requestRefs), so
 * the caller must already know which request to view (the panel's own text
 * input). 400 when absent/empty.
 *
 * `?party=` — OPTIONAL, item 10b. Two distinct behaviors, chosen entirely by
 * whether this param is present, with ZERO behavior change on the absent
 * path (the original item-10a contract, unmodified):
 *
 *  - ABSENT: exactly today's behavior — resolves the caller's OWN persona,
 *    reads that persona's OWN activity_receipts, returns the FULL chain
 *    state. The four original route tests
 *    (`tests/moneypenny-constitutional-risk-flow-route.test.ts`) exercise
 *    exactly this path and must keep passing unmodified.
 *
 *  - PRESENT: the caller is asking to view ONE PARTY's redacted
 *    Constitutional Risk Flow for this requestRef — never the caller's own
 *    persona-scoped receipts. `resolvePartyBindingForViewer`
 *    (`velaUnderwritingPartyBinding.ts`) resolves whether the CALLER's own
 *    resolved persona (never a client-supplied personaId — there is none on
 *    this route to begin with) is the real, bound authority for that exact
 *    (requestRef, party) pair. Denial is a SINGLE generic 403 — the same
 *    status and message whether no binding exists, the binding names a
 *    different persona, or the binding is scoped to a different requestRef —
 *    never a detail that would let a caller distinguish those cases
 *    (anti-enumeration; see `velaUnderwritingPartyBinding.ts`'s own header).
 *    On authorization, the chain state is read against the RESOLVED
 *    `flowOwnerPersonaId` (never the viewer's own persona — the viewer may
 *    have no activity_receipts of their own for this request at all) and
 *    then redacted for that party via
 *    `redactConstitutionalRiskFlowStateForParty`
 *    (`velaUnderwritingPartyView.ts`). `flowOwnerPersonaId` is used ONLY for
 *    that internal lookup and never appears in the JSON response body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';
import { resolvePartyBindingForViewer } from '@/services/vela/velaUnderwritingPartyBinding';
import { redactConstitutionalRiskFlowStateForParty } from '@/services/vela/velaUnderwritingPartyView';

export const dynamic = 'force-dynamic';

/** ONE fixed denial message for every party-view refusal — never varied by
 *  which specific case caused it (see this file's header, "?party="). */
const PARTY_VIEW_NOT_AUTHORIZED_MESSAGE = "Not authorized to view this party's flow.";

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const requestRef = req.nextUrl.searchParams.get('requestRef')?.trim() ?? '';
  if (!requestRef) {
    return NextResponse.json({ ok: false, error: 'requestRef is required' }, { status: 400 });
  }

  const party = req.nextUrl.searchParams.get('party')?.trim() ?? '';

  if (!party) {
    // Unchanged item-10a path — zero behavior change.
    const state = await getConstitutionalRiskFlowState({ personaId: persona.personaId, requestRef });
    return NextResponse.json({ ok: true, state });
  }

  const binding = await resolvePartyBindingForViewer({
    requestRef,
    partyLabel: party,
    viewerPersonaId: persona.personaId,
  });
  if (!binding.authorized) {
    return NextResponse.json({ ok: false, error: PARTY_VIEW_NOT_AUTHORIZED_MESSAGE }, { status: 403 });
  }

  // Read the FLOW OWNER's evidence (never the viewer's own persona) — the
  // whole point of the binding is that a viewing party reads the recording
  // persona's receipts, gated by the binding, never their own (likely empty)
  // receipt set. flowOwnerPersonaId never reaches the response body below.
  const state = await getConstitutionalRiskFlowState({ personaId: binding.flowOwnerPersonaId, requestRef });
  const participantView = redactConstitutionalRiskFlowStateForParty(state, party);
  return NextResponse.json({ ok: true, state: participantView });
}
