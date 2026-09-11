/**
 * GET /api/journey/moneypenny-horizen/preflight?agentSlug=<slug>
 *
 * Read-only Agent-N preflight (Horizen Pilot Closure item 7, 2026-08-09) —
 * the operator's go/no-go check before recording an Agent-N journey. Every
 * check is composed from the SAME canonical readers the journey state route
 * uses (services/horizen/agentPreflight.ts) — never a second resolution of
 * the same question. Performs no irreversible action: no signature, no
 * broadcast, no settle, no receipt write.
 *
 * Spine-gated: getActivePersona resolves the operator for the
 * persona/wallet/agreement checks — an unauthenticated caller still gets a
 * report, with those specific lines reporting BLOCKED by name, never a
 * blanket 401 that hides which OTHER checks passed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { runAgentPreflight } from '@/services/horizen/agentPreflight';
import { DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const agentSlug = request.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
    const origin = resolveRequestOrigin(request);
    const report = await runAgentPreflight(agentSlug, request, origin);
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. Nothing here was mutated — this route is read-only.`,
      },
      { status: 500 },
    );
  }
}
