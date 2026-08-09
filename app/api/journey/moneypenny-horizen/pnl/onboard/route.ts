/**
 * POST /api/journey/moneypenny-horizen/pnl/onboard
 * GET  /api/journey/moneypenny-horizen/pnl/onboard?agentSlug=nakamoto
 *
 * The production boundary for "Onboard Verifiable P&L" (Horizen Pilot
 * Closure — AigentQube Entrance Gate + Nakamoto P&L Closure, 2026-08-09,
 * part 6). Wires the existing `services/horizen/pnlOnboardingClient.ts`
 * (previously had no production caller) into a real, idempotent,
 * spine-gated action.
 *
 * Sequence, every call:
 *   1. Resolve the agent's OWN existing registration state
 *      (resolveAgentRegistrationState — never mints a second ERC-8004
 *      identity; refuses if the agent isn't registered yet).
 *   2. Read-only check: is Verifiable PnL already onboarded for this exact
 *      tokenId/network (correlateAgent)? If yes, report that — never
 *      re-register an already-onboarded agent.
 *   3. If not yet onboarded: run `checkExistingModeEligibility`. Absent a
 *      genuinely distinct trading wallet, this returns
 *      `TRADING_WALLET_DECISION_REQUIRED` — the ONE operator decision this
 *      route surfaces rather than resolves. GET always stops here (read-only).
 *   4. POST only: if a `tradingWalletAddress` was supplied AND a trading-key
 *      resolver is configured (none exists yet in this codebase — see the
 *      module doc on `pnlOnboardingClient.ts`), attempt the real
 *      `registerExistingAgent` ceremony and receipt `pnl_service_registered`
 *      on success. Never fabricates a wallet or a key.
 *
 * This route does NOT call `discoverAndReceiptPnlServiceEvidence` —
 * `pnl_service_verified` is issued only by that independent, asynchronous
 * rereader, never by the registration mutation certifying itself.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { correlateAgent } from '@/services/horizen/correlate';
import { checkExistingModeEligibility, registerExistingAgent } from '@/services/horizen/pnlOnboardingClient';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { AgentPurposeWalletService } from '@/services/wallet/agentPurposeWalletService';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

/**
 * The trading wallet is resolved from the agent's own provisioned
 * agent_wallet_bindings row (Horizen Pilot Closure part 2/3, 2026-08-09) —
 * never fabricated, never falling back to the owner wallet. If no binding
 * has been provisioned yet, this returns null and the caller falls through
 * to the existing TRADING_WALLET_DECISION_REQUIRED refusal path unchanged.
 */
async function resolveProvisionedTradingWalletAddress(agent: RegistrableAgentConfig): Promise<string | null> {
  const binding = await new AgentPurposeWalletService().getBinding(agent.runtimeAgentId, 'trading');
  return binding?.address ?? null;
}

interface OnboardBody {
  agentSlug?: string;
  tradingWalletAddress?: string;
}

async function resolveCurrentState(agentSlug: string) {
  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    return { ok: false as const, status: 400, body: { ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${agentSlug}" is not a registrable agent` } };
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return { ok: false as const, status: 503, body: { ok: false, error: 'Service unavailable' } };
  }
  const registration = await resolveAgentRegistrationState(admin, agent);
  if (!registration.registered || !registration.tokenId) {
    return {
      ok: false as const,
      status: 409,
      body: { ok: false, refusalCode: 'AGENT_NOT_REGISTERED', error: `${agent.displayName} has no confirmed Horizen ERC-8004 registration yet — Register must complete first` },
    };
  }
  const network = (registration.network ?? 'base-sepolia') as 'base-sepolia' | 'base-mainnet';
  const correlated = await correlateAgent(registration.tokenId, network);
  const alreadyOnboarded = correlated.ok && correlated.record.pnl.present;
  return { ok: true as const, agent, tokenId: registration.tokenId, network, alreadyOnboarded, correlated };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getOnboardStatus(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ONBOARD_STATUS_ERROR',
        error: `The onboarding status read threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. Re-read the state before retrying.`,
      },
      { status: 500 },
    );
  }
}

async function getOnboardStatus(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const agentSlug = request.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
  const state = await resolveCurrentState(agentSlug);
  if (!state.ok) return NextResponse.json(state.body, { status: state.status });

  if (state.alreadyOnboarded) {
    return NextResponse.json({
      ok: true,
      status: 'already_onboarded',
      agentSlug: state.agent.slug,
      tokenId: state.tokenId,
      network: state.network,
    });
  }

  const tradingWalletAddress = await resolveProvisionedTradingWalletAddress(state.agent);
  const eligibility = await checkExistingModeEligibility({
    agentSlug: state.agent.slug,
    tokenId: state.tokenId,
    tradingWalletAddress: tradingWalletAddress ?? undefined,
  });
  return NextResponse.json({
    ok: true,
    status: 'not_onboarded',
    agentSlug: state.agent.slug,
    tokenId: state.tokenId,
    network: state.network,
    eligibility,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await postOnboard(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ONBOARD_ERROR',
        error:
          `The onboarding ceremony threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether Horizen recorded a registration — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postOnboard(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: OnboardBody = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine — defaults apply */
  }
  const agentSlug = body.agentSlug ?? DEFAULT_REGISTRABLE_AGENT_SLUG;

  const state = await resolveCurrentState(agentSlug);
  if (!state.ok) return NextResponse.json(state.body, { status: state.status });

  if (state.alreadyOnboarded) {
    return NextResponse.json({
      ok: true,
      status: 'already_onboarded',
      agentSlug: state.agent.slug,
      tokenId: state.tokenId,
      network: state.network,
      pnlUuid: state.correlated.ok && state.correlated.record.pnl.present ? state.correlated.record.pnl.value.uuid : null,
    });
  }

  const tradingWalletAddress = body.tradingWalletAddress || (await resolveProvisionedTradingWalletAddress(state.agent));
  if (!tradingWalletAddress) {
    const eligibility = await checkExistingModeEligibility({ agentSlug: state.agent.slug, tokenId: state.tokenId });
    return NextResponse.json(
      { ok: false, status: 'not_onboarded', agentSlug: state.agent.slug, tokenId: state.tokenId, network: state.network, eligibility },
      { status: 409 },
    );
  }

  const registerResult = await registerExistingAgent(
    {
      agentSlug: state.agent.slug,
      tokenId: state.tokenId,
      tradingWalletAddress,
      network: state.network,
      confirm: true,
    },
    {
      resolveTradingWalletPrivateKey: (address) => new AgentPurposeWalletService().resolvePurposeWalletPrivateKeyByAddress(address),
    },
  );

  if (!registerResult.ok) {
    return NextResponse.json(
      { ok: false, status: 'registration_refused', agentSlug: state.agent.slug, tokenId: state.tokenId, network: state.network, refusalCode: registerResult.refusalCode, detail: registerResult.detail },
      { status: 409 },
    );
  }

  let receiptRef: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'agentiq',
      actionType: 'pnl_service_registered',
      summary: `Registered ${state.agent.displayName} (token ${state.tokenId}, ${state.network}) for Horizen Verifiable PnL — existing-mode onboarding`,
      agentsInvoked: [state.agent.runtimeAgentId],
      actionInput: { agentSlug: state.agent.slug, tokenId: state.tokenId, network: state.network, pnlAgentId: registerResult.value.agentId },
    });
    receiptRef = receipt?.id ?? null;
  } catch {
    // Registration itself succeeded; a failed receipt write is surfaced via a null ref, never a rollback of a real Horizen mutation.
  }

  return NextResponse.json({
    ok: true,
    status: 'registered',
    agentSlug: state.agent.slug,
    tokenId: state.tokenId,
    network: state.network,
    pnlAgentId: registerResult.value.agentId,
    receiptRef,
  });
}
