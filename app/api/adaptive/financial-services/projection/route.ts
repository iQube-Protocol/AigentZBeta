/**
 * GET /api/adaptive/financial-services/projection — the AEE-owned external
 * observation endpoint for the Differ Financial Services pilot (operator
 * ruling, 2026-08-27, reconciling `review/differ-fs-pilot` into AEE proper).
 *
 * Composes ONLY `services/adaptive/externalExperienceProjection.ts`
 * (persisted observation + manifest + engine + validator) — never the
 * broader internal journey-state/service-orchestration routes (see that
 * module's own header for why those are excluded: one writes settlements,
 * the other executes a real service).
 *
 * ── Authentication — DELIBERATELY UNRESOLVED (Q7) ───────────────────────
 *
 * The Phase-0 audit's own addendum found Differ is a hosting/observation
 * platform, not a conventional API/SDK caller — meaning the correct
 * transport (a browser running inside Differ's hosting reusing the SAME
 * user session vs. a separate server-side process calling on the user's
 * behalf) is not yet known. This route does NOT implement a shared-secret
 * header or any other transport-specific check — it reads
 * `services/adaptive/externalIntegrationRegistry.ts`'s registration for
 * `differ-fs-pilot` and fails closed on `enabled: false`, which is this
 * integration's current, honest, ratified state. THE ROUTE THEREFORE
 * ANSWERS 503 TO EVERY REQUEST TODAY, BY DESIGN — enabling it requires the
 * operator to have actually settled Q7 and flipped `enabled: true` (with a
 * real `transportMode` and `allowedReturnOrigins`), never a code change
 * made because "the pilot needs to demonstrate something."
 *
 * Principal resolution itself DOES reuse the existing identity spine
 * (`getActivePersona`) once an integration is enabled — that part is not in
 * question, only how the CALLER authenticates as an approved integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { filterProjectionForIntegration, resolveExternalExperienceIntegration } from '@/services/adaptive/externalIntegrationRegistry';
import { buildExternalExperienceProjection } from '@/services/adaptive/externalExperienceProjection';
import { FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST } from '@/services/adaptive/applicationProjectionManifest';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const INTEGRATION_ID = 'differ-fs-pilot';

export async function GET(req: NextRequest) {
  const integration = resolveExternalExperienceIntegration(INTEGRATION_ID);
  if (!integration || !integration.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Integration '${INTEGRATION_ID}' is not enabled — no transport/authentication mechanism has ` +
          'been settled for this integration yet (see externalIntegrationRegistry.ts). This is the ' +
          'current, correct, honest state — not a bug.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
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

  const agent = resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: 'No registrable agent is configured for the Financial Services journey.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let citizenPassportUsable = false;
  try {
    const passport = await loadUsableCitizenPassportForAuthProfile(admin, persona.authProfileId);
    citizenPassportUsable = passport.ok;
  } catch {
    citizenPassportUsable = false;
  }

  const generatedAt = new Date().toISOString();

  let result;
  try {
    result = await buildExternalExperienceProjection(admin, {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: agent.aigentQubeId,
      participantRef: personaPublicRef(persona.personaId),
      participantState: { citizenPassportUsable },
      manifest: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
      hostId: 'differ',
      generatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `The projection could not be resolved: ${e instanceof Error ? e.message : String(e)}. This is a read that failed, not an act that failed.`,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Scoped to what THIS integration may reach (Runtime never appears here,
  // by pilot policy, not by the projection's own disposition — see
  // externalIntegrationRegistry.ts's filterProjectionForIntegration).
  const projection = filterProjectionForIntegration(INTEGRATION_ID, result.projection);

  // Explicit allowlist — never `NextResponse.json({ ok: true, ...projection })`.
  return NextResponse.json(
    {
      ok: true,
      projectionId: projection.projectionId,
      provider: projection.provider,
      level: projection.level,
      journeyRef: projection.journeyRef ?? null,
      primaryAction: projection.primaryAction ?? null,
      secondaryActions: projection.secondaryActions ?? [],
      layout: projection.layout,
      surfaces: projection.surfaces,
      fallback: Boolean(projection.fallback),
      expiresAt: projection.expiresAt ?? null,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
