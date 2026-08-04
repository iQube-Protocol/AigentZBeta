/**
 * POST /api/journey/moneypenny-horizen/verify/authorize
 *
 * GJR-VFY-001 Phase 2 — the Verify stage's one consequential action: the
 * operator authorizes Horizen Pulse monitoring + P&L disclosure for the
 * selected registrable agent (default MoneyPenny; agent-selectable per
 * services/horizen/registrableAgents.ts, 2026-07-31). Drives the Phase 1
 * signing substrate (services/horizen/authorizationClient.ts) end to end —
 * prepare, sign, submit, verify — then enriches the Agent Card
 * (services/horizen/agentCardEnrichment.ts) only once Horizen's authoritative
 * reread confirms activation.
 *
 * Resolves every input from REAL sources, never a guess:
 *   - tokenId/network/registryAlias  <- registry_assets (agentSlug's
 *     aigentQubeId) external_registry_bindings[0] (the same binding the
 *     Agent Card route itself projects from)
 *   - controllerWallet               <- agent_keys, via AgentKeyService's
 *     client-safe getAgentAddresses() (never the private key)
 *   - agentCardHash                  <- sha256 of the currently served
 *     agent-card.json body, fetched fresh so a stale hash can never be signed
 *
 * Refuses honestly (never fabricates progress) when Register hasn't
 * completed yet: no persisted AigentQube, or no tokenId, means this route
 * has nothing real to authorize against.
 *
 * Spine-gated: resolves the caller's OWN active persona (the operator, never
 * the agent's) via getActivePersona — recorded as every receipt's principal.
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { runHorizenTransparencyAuthorization } from '@/services/horizen/authorizationClient';
import { resolvePulseEndpoint } from '@/services/horizen/pulseEndpoint';
import { enrichAgentCardAfterHorizenAuthorization } from '@/services/horizen/agentCardEnrichment';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import type { HorizenNetwork } from '@/services/horizen/identity';

export const dynamic = 'force-dynamic';

/*
 * THIS ROUTE IS A FOUR-LEG REMOTE CEREMONY, AND THE DEFAULT BUDGET DOES NOT
 * COVER IT (operator, 2026-08-03: `Failed to execute 'json' on 'Response':
 * Unexpected end of JSON input`).
 *
 * An empty response body is not a JSON problem — it is a handler that never
 * wrote anything, i.e. one that crashed or was killed. This handler makes an
 * agent-card fetch plus prepare -> sign -> submit -> reread against Horizen's
 * remote MCP server in a SINGLE request. That is the exact shape a serverless
 * timeout kills mid-flight, and a killed handler returns zero bytes.
 *
 * Honored where the platform allows; the pipeline below is also made cheaper
 * (one connection instead of three) rather than relying on this alone.
 */
export const maxDuration = 120;

interface AuthorizeBody {
  /** The exact disclosure scope the operator reviewed before authorizing (spec §5 "operator reviews exact scope"). */
  scope?: string[];
  /** Which registrable agent (services/horizen/registrableAgents.ts) — defaults to MoneyPenny for backward compatibility. */
  agentSlug?: string;
}

/*
 * EVERY EXIT FROM THIS ROUTE IS A NAMED ANSWER (Exception Terminates in an Act).
 *
 * The handler body below returns a JSON refusal on every path it anticipates —
 * but an UNANTICIPATED throw (the MCP transport failing to connect, the partner
 * dropping the socket, a Supabase client error) escaped it entirely and left
 * the platform to answer. What the platform sends is not guaranteed to be JSON
 * and can be nothing at all, which is what the operator saw. A thrown error is
 * still information; discarding it and returning silence is the defect.
 */
export async function POST(request: NextRequest) {
  try {
    return await authorize(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_AUTHORIZATION_ERROR',
        error:
          `The authorization ceremony threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether Horizen recorded the authorization — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function authorize(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: AuthorizeBody = {};
  try {
    body = (await request.json()) as AuthorizeBody;
  } catch {
    // No body is fine — scope/agentSlug fall back to the defaults below.
  }
  const scope = Array.isArray(body.scope) && body.scope.length > 0 ? body.scope : ['pulse-monitoring', 'pnl-disclosure'];

  const agent = resolveRegistrableAgent(body.agentSlug ?? DEFAULT_REGISTRABLE_AGENT_SLUG);
  if (!agent) {
    return NextResponse.json(
      { ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${body.agentSlug}" is not a registrable agent` },
      { status: 400 },
    );
  }
  const AIGENTQUBE_ID = agent.aigentQubeId;
  const AGENT_KEY_REF = agent.runtimeAgentId;

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const { data: aigentQube } = await admin
    .from('registry_assets')
    .select('metadata')
    .eq('asset_id', AIGENTQUBE_ID)
    .maybeSingle();
  if (!aigentQube) {
    return NextResponse.json(
      { ok: false, refusalCode: 'NO_PERSISTED_AIGENTQUBE', error: `no registry_assets row for "${AIGENTQUBE_ID}"` },
      { status: 409 },
    );
  }

  /*
   * The tokenId is READ through the shared resolver (inv.engineering.036/037 —
   * the same one both Agent Card routes and Claim's gate use), so a stuck
   * `registry_assets` projection write cannot block Verify when the
   * registration is provable from the confirmation receipt or the chain. The
   * ROW itself is still required above, because Verify WRITES the transparency
   * authorization back into it — an existence check for the write target, not
   * a second opinion about whether registration happened.
   */
  const { resolveHorizenRegistrationBinding } = await import('@/services/horizen/agentRegistrationBinding');
  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'MISSING_TOKEN_ID',
        // Named for the agent actually being verified — this said "MoneyPenny"
        // regardless of the selected subject, the same defect shape Claim's
        // surface had on 2026-08-03.
        error: `${agent.displayName} has no Horizen tokenId yet — the Register stage must complete before Verify can run`,
      },
      { status: 409 },
    );
  }
  const network = (binding.network ?? 'base-sepolia') as HorizenNetwork;

  const { AgentKeyService } = await import('@/services/identity/agentKeyService');
  const addresses = await new AgentKeyService().getAgentAddresses(AGENT_KEY_REF);
  if (!addresses?.evmAddress) {
    return NextResponse.json(
      { ok: false, refusalCode: 'NO_CONTROLLER_WALLET', error: `no evm_address on record for agent "${AGENT_KEY_REF}"` },
      { status: 409 },
    );
  }

  const origin = resolveRequestOrigin(request);
  let agentCardHash: string;
  let pulseEndpoint: string | null;
  try {
    const cardRes = await fetch(`${origin}${agent.agentCardPath}`, { cache: 'no-store' });
    if (!cardRes.ok) throw new Error(`agent-card fetch failed: HTTP ${cardRes.status}`);
    const cardText = await cardRes.text();
    agentCardHash = createHash('sha256').update(cardText, 'utf8').digest('hex');
    // Parsed once, reused for both the hash (above, over the raw text — so
    // the hash still commits to exact bytes) and the Pulse endpoint below.
    pulseEndpoint = resolvePulseEndpoint(JSON.parse(cardText));
  } catch (err) {
    return NextResponse.json(
      { ok: false, refusalCode: 'AGENT_CARD_UNAVAILABLE', error: err instanceof Error ? err.message : 'agent-card fetch failed' },
      { status: 502 },
    );
  }

  /*
   * REFUSE LOCALLY, BEFORE CALLING HORIZEN AT ALL (operator ruling,
   * 2026-08-04). Pulse monitors a live HTTP service, resolved from the
   * agent's canonical Agent Runtime Endpoint descriptor
   * (registry_assets.metadata.runtime — services/registry/runtimeDescriptor.ts).
   * Nothing in this platform's Agent Cards declares one yet. Inventing a URL
   * (e.g. reusing the Agent Card route itself, which merely DESCRIBES the
   * agent) would be exactly the fabrication CLAUDE.md's No-Guessing rule
   * forbids, and would hand Horizen a health-check target no one intended it
   * to poll.
   */
  if (!pulseEndpoint) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'NO_RUNTIME_ENDPOINT',
        error:
          `${agent.displayName} has no Agent Runtime Endpoint declared (registry_assets.metadata.runtime.endpoint) ` +
          `— Pulse has nothing to health-check. Set a runtime descriptor for this asset ` +
          `(services/registry/runtimeDescriptor.ts: setAssetRuntimeDescriptor) before authorizing Pulse monitoring.`,
      },
      { status: 409 },
    );
  }

  const authorizationId = `horizen-pulse-auth-${AIGENTQUBE_ID}-${binding.token_id}-${network}`;

  const result = await runHorizenTransparencyAuthorization({
    authorizationId,
    actorPersonaId: persona.personaId,
    aigentQubeId: AIGENTQUBE_ID,
    agentCardHash,
    controllerWallet: addresses.evmAddress,
    keyRef: AGENT_KEY_REF,
    registry: { network, tokenId: binding.token_id, registryAlias: binding.registry_alias ?? undefined },
    scope,
    agentDisplayName: agent.displayName,
    pulseEndpoint,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }

  const enrichment = await enrichAgentCardAfterHorizenAuthorization({
    actorPersonaId: persona.personaId,
    aigentQubeId: AIGENTQUBE_ID,
    runtimeAgentId: AGENT_KEY_REF,
    displayName: agent.displayName,
    authorizationId,
    controllerWallet: addresses.evmAddress,
    tokenId: binding.token_id,
    network,
    signatureRef: null,
    submissionRef: null,
  });
  if (!enrichment.ok) {
    // The authorization itself is real and confirmed — enrichment failing is
    // a separate, retryable projection step, not a reason to report the
    // authorization as failed.
    return NextResponse.json({
      ok: true,
      authorizationId: result.value.authorizationId,
      receiptRef: result.value.receiptRef,
      enrichmentRefusalCode: enrichment.refusalCode,
      enrichmentError: enrichment.detail,
    });
  }

  return NextResponse.json({
    ok: true,
    authorizationId: result.value.authorizationId,
    receiptRef: result.value.receiptRef,
    receiptRefs: enrichment.receiptRefs,
  });
}
