/**
 * GET /api/polity-core/constitution
 *
 * The machine-readable source of legitimacy for autonomous agents. Returns the
 * current ratified Constitution, Agent Charter, and Delegation Framework plus
 * the version triple an Agent Passport must bind to. Public, read-only — agents
 * and services resolve their constitutional binding here.
 */

import { NextResponse } from 'next/server';
import { getConstitutionalFramework } from '@/services/polity/constitution';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { ok: true, ...getConstitutionalFramework() },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
