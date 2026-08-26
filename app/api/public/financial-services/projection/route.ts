/**
 * GET /api/public/financial-services/projection — the Differ × Financial
 * Services Bridge pilot, part 2.
 *
 * A narrowly scoped, EXTERNAL-facing observation contract for the Differ
 * integration. This is a deliberately new, narrower surface — it does NOT
 * reuse `/api/journey/moneypenny-horizen/state` (that route resolves settled
 * facts, WRITES two settlements, and persists a journey resolution; see its
 * own header) or `/api/moneypenny/service-orchestration` (that route's POST
 * triggers `requestFinancialService`, a real service execution). Both are
 * internal, spine-scoped surfaces with a far broader contract than an
 * external, third-party-safe projection should ever expose.
 *
 * Auth model (two independent checks, both required):
 *   1. Differ integration auth — a shared integration key
 *      (`x-differ-integration-key` header vs `DIFFER_INTEGRATION_API_KEY`).
 *      Minimal and consistent with this repo's existing lightweight
 *      integration-key checks (e.g. `app/api/marketa/proxy/[...path]/route.ts`'s
 *      `x-api-key`) — a full OAuth DCR + PKCE crossing
 *      (`services/accessGateway/humanSession.ts`) was considered and judged
 *      disproportionate to this bounded pilot (see the closeout report).
 *   2. Principal resolution — `getActivePersona(req)`, the SAME identity
 *      spine every other principal-scoped route uses. Differ is expected to
 *      forward the T1 `personaSessionToken` (`?pst=` / `x-persona-session-
 *      token`) it received when the user was linked out to it — the existing
 *      mechanism `utils/codex-nav.ts::buildCodexUrl` already uses for every
 *      other cross-surface identity propagation (CLAUDE.md "Inter-Cartridge
 *      Navigation"). No new principal-resolution logic is added here.
 *
 * Output discipline: every field is assigned individually from the observer's
 * result — never `...spread` and never the observer's return value passed
 * through directly, so a field added to `FinancialServicesProjection` later
 * does not silently cross this boundary without a deliberate edit here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveFinancialServicesProjection } from '@/services/financialServices/financialServicesObserver';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function differIntegrationAuthorized(req: NextRequest): boolean {
  const expected = process.env.DIFFER_INTEGRATION_API_KEY;
  if (!expected) return false; // fail-closed — no configured key means no configured integration
  const presented = req.headers.get('x-differ-integration-key');
  return typeof presented === 'string' && presented.length > 0 && presented === expected;
}

export async function GET(req: NextRequest) {
  if (!differIntegrationAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: 'Differ integration not authorized for this environment.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const persona = await getActivePersona(req);
  if (!persona?.personaId || !persona.authProfileId) {
    return NextResponse.json(
      { ok: false, error: 'Not authenticated.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Financial Services projection is unavailable — no data store configured in this environment.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let projection;
  try {
    projection = await resolveFinancialServicesProjection(admin, {
      personaId: persona.personaId,
      authProfileId: persona.authProfileId,
    });
  } catch (e) {
    // Fail honestly — never repair or reconcile state from here.
    return NextResponse.json(
      {
        ok: false,
        error: `The Financial Services projection could not be resolved: ${e instanceof Error ? e.message : String(e)}. This is a read that failed, not an act that failed.`,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Explicit allowlist — never `NextResponse.json({ ok: true, ...projection })`.
  return NextResponse.json(
    {
      ok: true,
      schemaVersion: projection.schemaVersion,
      projectionId: projection.projectionId,
      generatedAt: projection.generatedAt,
      expiresAt: projection.expiresAt,
      journey: {
        id: projection.journey.id,
        currentStageId: projection.journey.currentStageId,
        stages: projection.journey.stages.map((s) => ({
          id: s.id,
          label: s.label,
          status: s.status,
          explanation: s.explanation,
        })),
      },
      services: projection.services.map((s) => ({
        serviceRef: s.serviceRef,
        label: s.label,
        provider: s.provider,
        mode: s.mode,
        availability: s.availability,
      })),
      nextActions: projection.nextActions.map((a) => ({
        actionRef: a.actionRef,
        label: a.label,
        capabilityRef: a.capabilityRef,
        nativeSurfaceRef: a.nativeSurfaceRef,
        handoffEligible: a.handoffEligible,
      })),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
