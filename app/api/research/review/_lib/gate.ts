/**
 * The Independent Review surface's access gate.
 *
 * This is NOT a new gate. It is the SAME resolution `/api/research/lifecycle`
 * and `/api/research/objects` already use — the caller is resolved through the
 * identity spine (`getActivePersona`) and must carry the server-resolved
 * `cartridgeFlags.isAdmin`. Inventing a second research gate here would be the
 * parallel-implementation defect in the one place where a divergence is a
 * security hole rather than an inconsistency.
 *
 * A single decision point, reused by every route in this folder, is also what
 * makes the positive-reachability canary meaningful: one caller admitted by one
 * function is admitted by all four routes, so a surface cannot be half-open.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { getReviewReadableExperiments } from '@/services/passport/participationAccess';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReviewCaller {
  /** T2-safe commitment. The raw personaId never leaves the server. */
  callerRef: string;
  isAdmin: boolean;
  admin: SupabaseClient;
}

export type GateResult = { ok: true; caller: ReviewCaller } | { ok: false; response: NextResponse };

export async function requireReviewAccess(req: NextRequest): Promise<GateResult> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 }) };
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }) };
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 }) };
  }
  // The caller is attributed by COMMITMENT, never by personaId. Review records
  // are read by the Lab and ride into receipts; a raw persona id in either is
  // the T0 leak CLAUDE.md's identity spine forbids.
  return { ok: true, caller: { callerRef: personaPublicRef(persona.personaId), isAdmin: true, admin } };
}

export interface ReviewReadCaller extends ReviewCaller {
  /** `'all'` for admin or an unrestricted grant; otherwise the exact set of
   *  experiment ids this caller may read reviews/crystal evidence for. */
  allowedExperiments: 'all' | Set<string>;
}

export type ReadGateResult = { ok: true; caller: ReviewReadCaller } | { ok: false; response: NextResponse };

/**
 * READ-ONLY variant of `requireReviewAccess` (SPEC-IRL-WORKSPACE-001 §8 —
 * External Reviewer, added 2026-08-01 for the Validation Programme's Crystal
 * Review stage). Admits a platform admin (unchanged) OR a persona holding an
 * active, review-readable research-lab grant, scoped to at least one
 * experiment.
 *
 * DELIBERATELY A SEPARATE FUNCTION from `requireReviewAccess`, not a
 * widening of it: that gate ALSO protects the governed-resolution POST
 * (accept/revise/defer/reject) and the review-creation POST, both of which
 * SPEC-IRL-WORKSPACE-001 §8 reserves for the Research Steward and which a
 * reviewer grant must never reach. Mirrors the render/authority split
 * `researchWorkspaceRoles.ts`'s own header describes for the same reason —
 * a reviewer failing to reach an unrelated review must fail CLOSED (this
 * function refuses), while an authority decision failing must fail
 * DANGEROUS if merged with a read gate (never withhold write refusal by
 * accident). Every route using this function MUST filter its OWN response
 * by `caller.allowedExperiments` before returning data — this gate answers
 * "may they read at all", not "which reviews may they see" (SPEC §10: access
 * to one experiment must not imply access to sibling experiments).
 */
export async function requireReviewReadAccess(req: NextRequest): Promise<ReadGateResult> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 }) };
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 }) };
  }
  const isAdmin = !!persona.cartridgeFlags?.isAdmin;
  const callerRef = personaPublicRef(persona.personaId);
  if (isAdmin) {
    return { ok: true, caller: { callerRef, isAdmin: true, admin, allowedExperiments: 'all' } };
  }
  const allowedExperiments = await getReviewReadableExperiments(admin, persona.personaId);
  if (allowedExperiments !== 'all' && allowedExperiments.size === 0) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }) };
  }
  return { ok: true, caller: { callerRef, isAdmin: false, admin, allowedExperiments } };
}
