/**
 * GET /health — root-level liveness endpoint (Horizen Pulse operational
 * hardening, 2026-08-06).
 *
 * Horizen's Pulse defaults its monitored `healthPath` to `/health` when an
 * enrollment omits one (confirmed by Horizen directly). Aigent Nakamoto
 * (token 8798) is registered and enrolled in Pulse — `enrolled: true`,
 * `commitmentRecorded: true` — but every health probe has been landing on
 * this exact path and 404ing, because no route existed here. That is the
 * entire remaining gap: not registration, not signing, not ownership (all
 * confirmed closed) — just this one endpoint never having been built.
 *
 * Deliberately the lightest possible route per the operational brief: no
 * auth, no database read, no provider call, nothing that could itself fail
 * on cost, latency, or contention. `/api/agents/nakamoto/health` (this same
 * codebase) is the richer, agent-specific health surface reserved for
 * anything needing runtime detail — this one exists solely so a bare `GET
 * /health` at the deployment root returns 2xx for Pulse (or any other
 * external uptime monitor probing the platform root).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'aigentz', timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
