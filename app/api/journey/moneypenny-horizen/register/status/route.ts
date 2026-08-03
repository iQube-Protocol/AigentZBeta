/**
 * POST /api/journey/moneypenny-horizen/register/status
 *
 * Register stage, step 3 of 3 (agent-selectable, 2026-07-31,
 * services/horizen/registrationClient.ts). ONE status check against
 * Horizen's get_onboarding_status — never an internal polling loop (a
 * 10-attempt/15s-apart poll, the CLI script's own posture, does not fit a
 * serverless request lifecycle). The Register stage UI re-invokes this on an
 * interval until `confirmed: true`.
 *
 * On confirmation, persists the resolved tokenId/registryAlias onto the
 * agent's canonical AigentQube record (registry_assets, the SAME
 * external_registry_bindings[0] Verify/Claim already read from — never a
 * second source of truth) and writes the horizen_agent_registered receipt
 * the journey `state` route has been checking for since Phase 2 but that no
 * route has ever written until now.
 *
 * Spine-gated: getActivePersona resolves the operator, recorded as the
 * receipt's principal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import {
  checkAgentRegistrationStatus,
  resolveAgentOwnerWalletAddress,
} from '@/services/horizen/registrationClient';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';
import type { HorizenNetwork } from '@/services/horizen/identity';

export const dynamic = 'force-dynamic';
/*
 * This route talks to Horizen's MCP server over the network — connect, list
 * tools, call get_onboarding_status, then reread the registry. Every sibling
 * route that does comparable network work sets a budget (the corpus-scout
 * routes all use 60); this one set none and inherited the platform default,
 * so a slow Horizen became a gateway 504 with no body. A 504 tells the
 * operator nothing, and on THIS route it reads as the registration having
 * failed when the transaction is untouched.
 */
export const maxDuration = 60;

/**
 * How long we will wait for Horizen before answering anyway.
 *
 * Deliberately inside the route's own budget: an answer we produce says
 * something true ("the check did not complete"), and an answer the gateway
 * produces says nothing at all. The check is cheap to repeat and the
 * transaction is unaffected either way, so failing fast and saying so beats
 * hanging until something upstream gives up on us.
 */
const HORIZEN_STATUS_DEADLINE_MS = 25_000;

interface StatusBody {
  agentSlug?: string;
  txHash?: string;
  ownerWalletAddress?: string;
  network?: string;
  /** Horizen's own agent identifier, recovered with the txHash from the
   *  broadcast receipt. Absent is honest and the client says so. */
  horizenAgentId?: string | null;
}

/**
 * WHY THIS MUST NEVER FAIL SILENTLY (Aigent Nakamoto's live registration,
 * 2026-08-03). This write and the confirmation receipt below it are two
 * INDEPENDENT Supabase writes from the same confirmation event — nothing
 * makes them atomic. Nakamoto's registration proved it: the receipt was
 * written, this one was not, and every surface reading this projection
 * (PulseTransparencyToggle, the Register ladder, AgentCardSurface, Claim's
 * own gate) reported her unregistered while the receipt-driven master
 * Journey stepper had already advanced past Register. Three silent-return
 * points (`!admin`, `!row`, `bindings.length === 0`) and a discarded
 * `.update()` error meant that divergence produced no signal anywhere.
 *
 * Every branch below is now named. It does not retry and it does not fail
 * the request — `checkAgentRegistrationStatus`'s caller still gets its
 * confirmed result either way, because `services/horizen/
 * agentRegistrationBinding.ts`'s receipt fallback is what actually keeps
 * readers correct when this write is stuck. This function's job is only to
 * stop hiding that it happened.
 */
async function updateRegistryAssetBinding(
  aigentQubeId: string,
  patch: { tokenId: string; registryAlias: string; agentIdentifier: string | null; humanReadableUrl: string | null },
) {
  const admin = getSupabaseServer();
  if (!admin) {
    console.error(`[HORIZEN BINDING] no Supabase admin client — cannot persist tokenId ${patch.tokenId} onto "${aigentQubeId}"`);
    return;
  }
  const { data: row, error: readError } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  if (readError) {
    console.error(`[HORIZEN BINDING] read failed for "${aigentQubeId}": ${readError.message} — tokenId ${patch.tokenId} not persisted`);
    return;
  }
  if (!row) {
    console.error(`[HORIZEN BINDING] no registry_assets row for "${aigentQubeId}" — tokenId ${patch.tokenId} not persisted`);
    return;
  }
  const metadata = (row.metadata ?? {}) as { external_registry_bindings?: ExternalAgentRegistryBinding[] };
  const bindings = Array.isArray(metadata.external_registry_bindings) ? [...metadata.external_registry_bindings] : [];
  if (bindings.length === 0) {
    console.error(`[HORIZEN BINDING] "${aigentQubeId}" has no external_registry_bindings entry to update — tokenId ${patch.tokenId} not persisted`);
    return;
  }
  bindings[0] = {
    ...bindings[0],
    token_id: patch.tokenId,
    registry_alias: patch.registryAlias,
    agent_identifier: patch.agentIdentifier,
    human_readable_url: patch.humanReadableUrl,
    status: 'registered',
  };
  const { error: writeError } = await admin
    .from('registry_assets')
    .update({ metadata: { ...metadata, external_registry_bindings: bindings }, updated_at: new Date().toISOString() })
    .eq('asset_id', aigentQubeId);
  if (writeError) {
    console.error(`[HORIZEN BINDING] write failed for "${aigentQubeId}": ${writeError.message} — tokenId ${patch.tokenId} not persisted`);
  }
}

/*
 * EVERY EXIT IS A NAMED ANSWER (operator, 2026-08-03, on the third report of
 * `Unexpected end of JSON input`).
 *
 * An unanticipated throw here — a Supabase client error, a partner socket
 * dropped, an import that fails at runtime — left the platform to answer, and
 * what it sends is not guaranteed to be JSON and can be nothing at all. A
 * thrown error is still information; discarding it and returning silence is
 * the defect. Enforced across every journey route by
 * tests/journey-response-honesty.test.ts.
 */
export async function POST(request: NextRequest) {
  try {
    return await postImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: StatusBody = {};
  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  if (!body.agentSlug || !body.txHash || !body.network) {
    return NextResponse.json({ ok: false, error: 'agentSlug, txHash and network are all required' }, { status: 400 });
  }
  const agent = resolveRegistrableAgent(body.agentSlug);
  if (!agent) {
    return NextResponse.json({ ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${body.agentSlug}" is not a registrable agent` }, { status: 400 });
  }

  /*
   * A BROADCAST MUST STAY ASKABLE-ABOUT (operator, 2026-08-02, 13:43).
   *
   *   > "We advanced to approve and then it hung and gave this error: Horizen
   *   >  has not confirmed registration yet ... And then interface is back to
   *   >  start over."
   *
   * A transaction WAS broadcast and receipted. The confirmation poll then ran
   * out, and because `ownerWalletAddress` was a REQUIRED input held only in
   * the page's memory, the check became unaskable the moment the page
   * re-rendered — leaving a real on-chain transaction with no way to learn its
   * outcome, and "register again" as the only visible move. That is the worst
   * possible affordance in front of an unconfirmed registration.
   *
   * The owner address is a property OF THE AGENT (its own custodied wallet)
   * and was always derivable server-side. Requiring the browser to remember it
   * was the defect. A caller may still supply one — but not supplying it is no
   * longer a refusal.
   */
  const ownerWalletAddress =
    body.ownerWalletAddress?.trim() || (await resolveAgentOwnerWalletAddress(agent));
  if (!ownerWalletAddress) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'OWNER_KEY_NOT_CONFIGURED',
        error:
          `${agent.displayName} has no custodied wallet on record, so the registry cannot be reread for her. ` +
          'This is a lookup failure, not a statement that the transaction failed — the broadcast stands.',
      },
      { status: 400 },
    );
  }

  /*
   * UNKNOWN IS NOT UNCONFIRMED (2026-08-02).
   *
   * A check that never came back must NOT be reported as `confirmed: false` —
   * that would state a fact about the chain on the strength of our own
   * timeout, which is the exact class of lie this ceremony has been fixing
   * all session. It is refused by name instead, and the refusal says the
   * transaction is unaffected.
   */
  const timedOut = Symbol('horizen-status-deadline');
  const result = await Promise.race([
    checkAgentRegistrationStatus(
    {
      agentSlug: agent.slug,
      txHash: body.txHash,
      ownerWalletAddress,
      horizenAgentId: body.horizenAgentId ?? null,
      network: body.network as HorizenNetwork,
      actorPersonaId: persona.personaId,
      // Read-only recovery input (services/horizen/agentIdRecovery.ts) — used
      // ONLY to decode the registration's own receipt logs when
      // horizenAgentId is absent. Same resolution as registerCeremony.ts's
      // broadcast rpcUrl; never read from process.env inside the client.
      rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
    },
    {
      updateRegistryAssetBinding,
      /*
       * STRUCTURED, NOT JUST THE TRANSACTION (Al, 2026-08-03: "the receipt
       * must record the result the observer needs, not merely the
       * transaction that may have produced it"). `tokenId` here is the SAME
       * ownerOf-verified value `updateRegistryAssetBinding` was just asked to
       * persist — never re-derived, never guessed — so a reader of this
       * receipt alone (services/horizen/agentRegistrationBinding.ts's
       * fallback) can reach REGISTER_COMPLETE without a second chain lookup,
       * independently of whether that other write actually landed.
       */
      createRegistrationReceipt: async ({ actorPersonaId, agent: a, network, txHash, tokenId, registryAddress, ownerAddress, confirmationSource, blockNumber, logIndex }) => {
        const receipt = await createActivityReceipt({
          personaId: actorPersonaId,
          activeCartridge: 'agentiq',
          actionType: 'horizen_agent_registered',
          summary: `${a.displayName} registered in Horizen's ERC-8004 registry (${network}, tx ${txHash}, tokenId ${tokenId})`,
          agentsInvoked: [a.runtimeAgentId],
          actionInput: {
            aigentQubeId: a.aigentQubeId,
            network,
            txHash,
            registration: {
              protocol: 'erc-8004',
              network,
              txHash,
              tokenId,
              registryAddress,
              ownerAddress,
              blockNumber,
              logIndex,
              confirmationSource,
              confirmedAt: new Date().toISOString(),
            },
          },
        });
        // Wallet Signing Topology (operator ruling 2026-08-01) — two of the
        // ceremony's five INDEPENDENT evidence types are only knowable here,
        // at the same moment confirmation + reread succeed. Written
        // alongside horizen_agent_registered, never replacing it — that
        // receipt remains the pre-ceremony completion evidence.
        await createActivityReceipt({
          personaId: actorPersonaId,
          activeCartridge: 'agentiq',
          actionType: 'horizen_registration_confirmed',
          summary: `Horizen confirmed ${a.displayName}'s registration on reread (${network}, tx ${txHash})`,
          agentsInvoked: [a.runtimeAgentId],
          actionInput: { aigentQubeId: a.aigentQubeId, network, txHash },
        });
        await createActivityReceipt({
          personaId: actorPersonaId,
          activeCartridge: 'agentiq',
          actionType: 'agent_registry_binding_recorded',
          summary: `${a.displayName}'s Horizen registry binding recorded on her AigentQube (${network})`,
          agentsInvoked: [a.runtimeAgentId],
          actionInput: { aigentQubeId: a.aigentQubeId, network, txHash },
        });
        return receipt?.id ?? null;
      },
    },
    ),
    new Promise<typeof timedOut>((resolve) =>
      setTimeout(() => resolve(timedOut), HORIZEN_STATUS_DEADLINE_MS),
    ),
  ]);

  if (result === timedOut) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'STATUS_UNAVAILABLE',
        error:
          `Horizen did not answer the status check within ${Math.round(HORIZEN_STATUS_DEADLINE_MS / 1000)}s. ` +
          'This says nothing about the transaction — it is broadcast and unaffected, and nothing needs ' +
          're-registering. The check is safe to repeat.',
      },
      { status: 504 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...result.value });
}
