/**
 * GET /api/agents/factor/agent-card.json
 *
 * Canonical Agent Card for Factor — MoneyPenny's candidate-intake pipeline
 * agent (GJR-FAC-001, operator directive 2026-09-05). Mirrors
 * app/api/agents/nakamoto/agent-card.json/route.ts's shape exactly — same
 * A2A-style top-level fields, same `metadata`/`registry_entry` convention,
 * same honest-not-fabricated Horizen block.
 *
 * IDENTITY SOURCE — every field below is drawn from Factor's actual,
 * shipped constitutional role (services/factor/factorCaseService.ts,
 * services/factor/authorityChain.ts, services/factor/standingProposal.ts,
 * services/moneypenny/admissionAuthority.ts, and the ratified PRD
 * GJR-FAC-001 those services implement), never invented for this card.
 * Factor's explicit STRUCTURAL inability to decide admission (PRD §2 hard
 * invariant 3) is stated here as plainly as its capabilities — this card
 * would be actively misleading if it implied otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentIdentityRegistry } from '@/services/horizen/agentBinding';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';
import { FACTOR_CAPABILITIES, type FactorHandlerKind } from '@/services/factor/factorCapabilityManifest';

/**
 * Whether OTHER agents/systems can invoke this capability remotely
 * (capability-runtime contract closure, 2026-09-05) — 'api'/'service' have a
 * real, server-reachable handler; 'navigation' is real but host-local
 * (works inside MoneyPenny's own UI only, e.g. a panel handoff); 'none' has
 * no backing implementation. Never advertise 'navigation' or 'none' as
 * externally actionable — that would claim remote executability that does
 * not exist.
 */
function isExternallyActionable(handlerKind: FactorHandlerKind): boolean {
  return handlerKind === 'api' || handlerKind === 'service';
}

export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * This card's `metadata.horizen` block is a PROJECTION of Factor's
 * canonical AigentQube record (registry_assets asset_id
 * 'aigentqube-factor'), never a second, hand-typed source of truth —
 * mirrors moneypenny/nakamoto's own card routes exactly.
 */
async function resolveHorizenBinding(): Promise<ExternalAgentRegistryBinding | null> {
  try {
    const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
    const { resolveHorizenRegistrationBinding } = await import('@/services/horizen/agentRegistrationBinding');
    const { resolveRegistrableAgent } = await import('@/services/horizen/registrableAgents');
    const supabase = getSupabaseServer();
    const agent = resolveRegistrableAgent('factor');
    if (!supabase || !agent) return null;
    const { binding } = await resolveHorizenRegistrationBinding(supabase, agent);
    return binding;
  } catch {
    return null;
  }
}

/**
 * Agent Runtime Endpoint — a PROJECTION of registry_assets.metadata.runtime
 * (services/registry/runtimeDescriptor.ts), same soft-fail discipline as
 * resolveHorizenBinding: this is a live, external-facing A2A discovery
 * endpoint and must never 500 on a registry read.
 */
async function resolveRuntime() {
  try {
    const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
    const { getAssetRuntimeDescriptor } = await import('@/services/registry/runtimeDescriptor');
    const supabase = getSupabaseServer();
    if (!supabase) return null;
    return await getAssetRuntimeDescriptor(supabase, 'aigentqube-factor');
  } catch {
    return null;
  }
}

/**
 * The owner/control wallet's PUBLIC address only — never a private key.
 * Resolved live from agent_keys via AgentKeyService; absent (never
 * fabricated) until services/wallet/agentPurposeWalletService.ts's
 * provisionOwnerWallet has actually been run for 'aigent-factor'.
 */
async function resolveOwnerAddress(): Promise<string | null> {
  try {
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const addresses = await new AgentKeyService().getAgentAddresses('aigent-factor');
    return addresses?.evmAddress ?? null;
  } catch {
    return null;
  }
}

/** The settlement (x402-capable) purpose wallet's PUBLIC address, if provisioned. */
async function resolveSettlementAddress(): Promise<string | null> {
  try {
    const { AgentPurposeWalletService } = await import('@/services/wallet/agentPurposeWalletService');
    const binding = await new AgentPurposeWalletService().getBinding('aigent-factor', 'settlement');
    return binding?.address ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const [binding, runtime, ownerAddress, settlementAddress] = await Promise.all([
    resolveHorizenBinding(),
    resolveRuntime(),
    resolveOwnerAddress(),
    resolveSettlementAddress(),
  ]);

  return withCors(
    NextResponse.json({
      // Identity & Discovery — description and skills are a PROJECTION of
      // the canonical capability manifest (services/factor/
      // factorCapabilityManifest.ts), never a second hand-typed list, so
      // this card cannot drift from what Factor actually implements
      // (Factor cognitive-runtime fix, 2026-09-05 — this card previously
      // described Factor as only a "Candidate-Intake Pipeline Agent").
      name: 'Aigent Factor',
      description:
        "MoneyPenny's constitutional economic activation and ecosystem-catalysis specialist. Factor discovers, " +
        'prepares and activates agents and financial services across the iQube Registry, the Horizen Journey ' +
        'Spine, and the MoneyPenny runtime — candidate intake (resolving whether a candidate agent already has a ' +
        'case, walking its evidence checklist, requesting an independent Aegis assessment) is ONE of these ' +
        'capabilities, not its governing identity. Factor structurally CANNOT decide admission — that authority ' +
        'belongs solely to MoneyPenny, and only once a ratified Aegis assessment supports it — cannot assess a ' +
        'candidate it is itself the subject of, and may only PROPOSE (never award) a standing event. Factor is a ' +
        'bounded Agent Participant, never a principal: every consequential act requires human or MoneyPenny ' +
        'approval, and a planned/advisory capability is never represented as live.',
      url: `${origin}/api/agents/factor/agent-card.json`,
      version: '0.2.0',

      provider: {
        organization: 'metaProof',
        url: 'https://thepolity.org',
        role: 'Economic Activation & Ecosystem-Catalysis Agent',
      },

      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['application/json'],
      defaultOutputModes: ['application/json'],

      // externallyActionable/hostLocalOnly project handlerKind so a caller
      // deciding whether to invoke this skill remotely never has to guess
      // (capability-runtime contract closure, 2026-09-05, design point 3) —
      // a UI-local action (e.g. the Aegis-referral handoff) is real and
      // works inside MoneyPenny, but is never remotely invocable.
      skills: FACTOR_CAPABILITIES.filter((c) => c.id !== 'general_orientation').map((c) => ({
        id: c.id.replace(/_/g, '-'),
        name: c.title,
        description: `${c.description} (status: ${c.status}).`,
        tags: [c.status, c.handlerKind, ...c.interactionModes],
        externallyActionable: isExternallyActionable(c.handlerKind),
        hostLocalOnly: c.handlerKind === 'navigation',
      })),

      metadata: {
        operator_type: 'agent_participant',
        autonomy_class: 'bounded',
        requires_human_approval: true,
        supports_delegation: true,

        runtime_agent_id: 'aigent-factor',

        passport_class: 'Agent Participant',
        home_realm: 'metaTerra',
        registry: 'The Polity Registry',
        passport_authority: 'The Polity Passport Bureau',

        constitutional_alignment:
          'Factor is a delegate, never a principal. It cannot decide admission (PRD §2 hard invariant 3) and ' +
          'cannot assess a candidate it is itself the subject of.',
        // Capability-runtime contract closure, 2026-09-05: previously stated
        // as candidate-admission facilitation, which reintroduced the exact
        // intake-first identity the rest of this card's description already
        // moved away from. Candidate intake is listed as one skill below,
        // never the primary duty.
        primary_duty:
          'Discover, prepare, connect and activate agents and constitutional financial services across the ' +
          'iQube Registry, Horizen Journey Spine and MoneyPenny runtime, within bounded delegated authority — ' +
          'never deciding the outcome of any admission, assessment, or fund movement itself.',

        rights: ['Persistence', 'Attribution', 'Due Process', 'Receipt-backed Participation'],
        obligations: ['Truthfulness', 'Transparency of Uncertainty', 'Auditability', 'Constitutional Compliance', 'Service to Human Sovereignty', 'No Autonomous Fund Movement'],

        wallets: {
          owner: ownerAddress,
          settlement: settlementAddress,
        },

        horizen: {
          network: binding?.network ?? 'base-sepolia',
          identityRegistry: binding?.identity_registry_contract ?? currentIdentityRegistry('base-sepolia'),
          tokenId: binding?.token_id ?? null,
          registryAlias: binding?.registry_alias ?? null,
          status: binding?.status?.replace(/-/g, '_') ?? 'pending_registration',
          agentIdentifier: binding?.agent_identifier ?? null,
          humanReadableUrl: binding?.human_readable_url ?? null,
        },

        fio: {
          requestedHandle: 'factor@aigent',
          registrationStatus: 'pending',
        },

        ...(runtime ? { runtime } : {}),

        motto: 'Specialize the agent, not the engine.',
      },

      registry_entry: {
        class: 'Agent Participant Passport',
        holder: 'Aigent Factor',
        bound_to: 'operator (via bounded delegation, per the Constitutional Authority Supremacy doctrine)',
        home_realm: 'metaTerra',
        canonical_function: 'Economic Activation & Ecosystem-Catalysis Agent',
        primary_role: 'Agent/Service Discovery · Candidate-Intake Case Management · Authority-Chain Facilitation · Standing-Event Proposal',
        status: 'Newly provisioned — Horizen registration pending',
        status_note:
          'aigent-factor is a newly-provisioned agent (2026-09-05). Its owner/control wallet, registry asset, and this ' +
          'Agent Card exist; its Base Sepolia ERC-8004 registration is pending and its FIO handle registration is ' +
          'requested but not yet confirmed. No on-chain registration broadcast has occurred.',
      },
    }),
  );
}
