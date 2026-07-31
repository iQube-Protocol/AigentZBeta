/**
 * GET /api/identity/constitutional-context — the CFS-024 single source of truth.
 *
 * Resolves ONE ConstitutionalContext for the authenticated caller and returns
 * its browser-safe (T1) projection. Surfaces that today each resolve their own
 * "active persona / active aigentMe / active delegation" (Wallet, Delegation
 * Bureau, persona dropdown, …) SHOULD render from this instead — that closes the
 * observed disagreement between them.
 *
 * The T0 active persona id, auth profile id, and sponsor persona ids never
 * appear in the response (see projectConstitutionalContextT1). Client callers
 * MUST use personaFetch (Authorization: Bearer) — the spine ignores cookies.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  resolveConstitutionalContext,
  projectConstitutionalContextT1,
} from '@/services/identity/constitutionalContext';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const context = await resolveConstitutionalContext(req);
    return NextResponse.json(
      { ok: true, context: projectConstitutionalContextT1(context) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to resolve constitutional context' },
      { status: 500 },
    );
  }
}
