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
