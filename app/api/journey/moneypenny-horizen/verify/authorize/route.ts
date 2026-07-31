/**
 * POST /api/journey/moneypenny-horizen/verify/authorize
 *
 * GJR-VFY-001 Phase 2 — the Verify stage's one consequential action: the
 * operator authorizes Horizen Pulse monitoring + P&L disclosure for
 * MoneyPenny. Drives the Phase 1 signing substrate
 * (services/horizen/authorizationClient.ts) end to end — prepare, sign,
 * submit, verify — then enriches her Agent Card
 * (services/horizen/agentCardEnrichment.ts) only once Horizen's authoritative
 * reread confirms activation.
 *
 * Resolves every input from REAL sources, never a guess:
 *   - tokenId/network/registryAlias  <- registry_assets 'aigentqube-moneypenny'
 *     external_registry_bindings[0] (the same binding the Agent Card route
 *     itself projects from)
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
 * MoneyPenny's) via getActivePersona — recorded as every receipt's principal.
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { runHorizenTransparencyAuthorization } from '@/services/horizen/authorizationClient';
import { enrichAgentCardAfterHorizenAuthorization } from '@/services/horizen/agentCardEnrichment';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';
import type { HorizenNetwork } from '@/services/horizen/identity';

export const dynamic = 'force-dynamic';

const AIGENTQUBE_ID = 'aigentqube-moneypenny';
const AGENT_KEY_REF = 'aigent-moneypenny';

interface AuthorizeBody {
  /** The exact disclosure scope the operator reviewed before authorizing (spec §5 "operator reviews exact scope"). */
  scope?: string[];
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: AuthorizeBody = {};
  try {
    body = (await request.json()) as AuthorizeBody;
  } catch {
    // No body is fine — scope falls back to the default below.
  }
  const scope = Array.isArray(body.scope) && body.scope.length > 0 ? body.scope : ['pulse-monitoring', 'pnl-disclosure'];

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

  const metadata = (aigentQube.metadata ?? {}) as { external_registry_bindings?: ExternalAgentRegistryBinding[] };
  const binding = metadata.external_registry_bindings?.[0];
  if (!binding?.token_id) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'MISSING_TOKEN_ID',
        error: 'MoneyPenny has no Horizen tokenId yet — the Register stage must complete before Verify can run',
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
  try {
    const cardRes = await fetch(`${origin}/api/agents/moneypenny/agent-card.json`, { cache: 'no-store' });
    if (!cardRes.ok) throw new Error(`agent-card fetch failed: HTTP ${cardRes.status}`);
    const cardText = await cardRes.text();
    agentCardHash = createHash('sha256').update(cardText, 'utf8').digest('hex');
  } catch (err) {
    return NextResponse.json(
      { ok: false, refusalCode: 'AGENT_CARD_UNAVAILABLE', error: err instanceof Error ? err.message : 'agent-card fetch failed' },
      { status: 502 },
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
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }

  const enrichment = await enrichAgentCardAfterHorizenAuthorization({
    actorPersonaId: persona.personaId,
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
