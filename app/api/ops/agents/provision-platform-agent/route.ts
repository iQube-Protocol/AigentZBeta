import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { sponsorPolityAgent } from '@/services/agents/sponsorPolityAgent';
import { provisionAgentPersona } from '@/services/agents/provisionAgentPersona';
import { resolveCanonicalAgentPersonaId } from '@/services/standing/agentStandingPersona';
import { REGISTRABLE_AGENTS } from '@/services/horizen/registrableAgents';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/agents/provision-platform-agent
 *
 * Provisions the full identity chain for a PLATFORM agent (Factor/Aegis
 * canonical identity provisioning, operator directive 2026-09-05, capacity
 * remediation 2026-09-05) — agent_root_identity → agent_persona → the
 * canonical wallet-visible Standing persona — under PLATFORM AUTHORITY, not
 * a live human admin session. This is the machine-to-machine counterpart to
 * `/api/homecoming/agent/stand-up`, which requires a live authenticated
 * admin persona; a GitHub Actions job has no persona session at all, only
 * this route's own validated CRON_TRIGGER_TOKEN credential.
 *
 * SECURITY — the platform-agent slug is ALLOWLISTED here, never
 * client-supplied identity: the caller passes only `agentSlug`, and every
 * identity field (runtimeAgentId, did_uri, agent_card_url, display_name,
 * description) is resolved from this file's own PLATFORM_AGENT_SPECS
 * constant, never from the request body. This prevents the route being used
 * to mint an arbitrary root identity under platform authority.
 *
 * `isPlatformAuthority: true` is passed to `sponsorPolityAgent` — set ONLY
 * here, after the CRON_TRIGGER_TOKEN check below has already succeeded,
 * never derived from anything in the request body (services/access/
 * personaCapacity.ts's forgery-immunity contract).
 *
 * The sponsor is the SAME established platform sponsor MoneyPenny/Nakamoto/
 * Kn0w1 already share (verified live, 2026-09-05) — mirroring, not
 * inventing, a new sponsorship topology. These are T0 identifiers: hardcoded
 * here, never accepted from the request, never returned in the response.
 */
const PLATFORM_SPONSOR_PERSONA_ID = 'f1fafe54-be66-41e5-950a-3722e2fa93ed';
const PLATFORM_SPONSOR_PASSPORT_ID = 'ppc-d10624f91042de1c3dd915bb';

interface PlatformAgentSpec {
  slug: string;
  displayName: string;
  runtimeAgentId: string;
  agentCardPath: string;
  description: string;
}

const PLATFORM_AGENT_SPECS: Record<string, PlatformAgentSpec> = {
  // Sourced from services/horizen/registrableAgents.ts's own 'factor' entry
  // — never a second, independently-typed copy of the same identifiers.
  factor: {
    slug: REGISTRABLE_AGENTS.factor.slug,
    displayName: REGISTRABLE_AGENTS.factor.displayName,
    runtimeAgentId: REGISTRABLE_AGENTS.factor.runtimeAgentId,
    agentCardPath: REGISTRABLE_AGENTS.factor.agentCardPath,
    description:
      "MoneyPenny's candidate-intake pipeline agent (GJR-FAC-001). Walks a candidate's evidence " +
      'checklist and facilitates its authority chain. Cannot decide admission.',
  },
  // Aegis is deliberately NOT in registrableAgents.ts (not a Horizen pilot-
  // journey participant, operator ruling 2026-09-05) — its identity fields
  // live only here, sourced from the operator's own approved identifier set.
  aegis: {
    slug: 'aegis',
    displayName: 'Aegis',
    runtimeAgentId: 'aigent-aegis',
    agentCardPath: '/api/agents/aegis/agent-card.json',
    description:
      'Independent, evidence-bound assessment and assurance agent for the candidate-intake ' +
      'pipeline. Cannot decide admission; refuses to assess a candidate it is itself the subject of.',
  },
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided = req.headers.get('x-cron-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { agentSlug?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const spec = body.agentSlug ? PLATFORM_AGENT_SPECS[body.agentSlug] : undefined;
  if (!spec) {
    return NextResponse.json(
      { ok: false, error: 'unknown-agent-slug', detail: `agentSlug must be one of: ${Object.keys(PLATFORM_AGENT_SPECS).join(', ')}` },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
  }

  const origin = resolveRequestOrigin(req);
  const didUri = `did:agent:root:${spec.runtimeAgentId}`;
  const agentCardUrl = `${origin}${spec.agentCardPath}`;

  const rootOutcome = await sponsorPolityAgent({
    admin,
    sponsorPersonaId: PLATFORM_SPONSOR_PERSONA_ID,
    sponsorPassportId: PLATFORM_SPONSOR_PASSPORT_ID,
    slug: spec.slug,
    displayName: spec.displayName,
    description: spec.description,
    origin,
    existingIdentity: { agentId: spec.runtimeAgentId, didUri, agentCardUrl },
    isPlatformAuthority: true,
  });

  if (!rootOutcome.ok || !rootOutcome.agent) {
    const { status, ok: _ok, ...rest } = rootOutcome;
    return NextResponse.json({ ok: false, ...rest }, { status });
  }

  const personaOutcome = await provisionAgentPersona({
    admin,
    sponsorPersonaId: PLATFORM_SPONSOR_PERSONA_ID,
    agentRootId: rootOutcome.agent.agentRootId,
    allowUnanchored: true,
  }).catch((e) => ({ ok: false as const, status: 500, error: e instanceof Error ? e.message : 'agent persona provisioning failed' }));

  let standingPersonaId: string | null = null;
  let standingPersonaError: string | null = null;
  try {
    standingPersonaId = await resolveCanonicalAgentPersonaId(
      admin,
      { slug: spec.slug, displayName: spec.displayName, runtimeAgentId: spec.runtimeAgentId },
      didUri,
    );
  } catch (e) {
    standingPersonaError = e instanceof Error ? e.message : 'canonical standing persona resolution failed';
  }

  return NextResponse.json(
    {
      ok: true,
      agent: {
        agentId: rootOutcome.agent.agentId,
        didUri: rootOutcome.agent.didUri,
        agentClass: rootOutcome.agent.agentClass,
        displayName: rootOutcome.agent.displayName,
        agentCardUrl: rootOutcome.agent.agentCardUrl,
        agentCardSlug: rootOutcome.agent.agentCardSlug,
        rootFreshlyCreated: !rootOutcome.alreadyExisted,
      },
      capacityOverride: rootOutcome.capacityOverride ?? null,
      agentPersona: personaOutcome.ok
        ? {
            provisioned: true,
            alreadyExists: 'alreadyExists' in personaOutcome ? Boolean(personaOutcome.alreadyExists) : false,
            agentPersonaId: 'agentPersona' in personaOutcome ? personaOutcome.agentPersona?.agentPersonaId : undefined,
          }
        : { provisioned: false, error: personaOutcome.error },
      walletPersona: standingPersonaId
        ? { personaId: standingPersonaId }
        : { personaId: null, error: standingPersonaError },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Provisions the full identity chain (agent_root_identity -> agent_persona -> canonical wallet-visible ' +
        'Standing persona) for an ALLOWLISTED platform agent, under platform authority (unbounded sponsorship ' +
        'capacity, services/access/personaCapacity.ts). Body: { agentSlug: "factor" | "aegis" }. Requires ' +
        'x-cron-token header (CRON_TRIGGER_TOKEN). Idempotent. Never returns a sponsor persona/passport id.',
      allowlistedAgents: Object.keys(PLATFORM_AGENT_SPECS),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
