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
      // Identity & Discovery
      name: 'Factor',
      description:
        "MoneyPenny's candidate-intake pipeline agent (GJR-FAC-001). Factor resolves whether a candidate agent " +
        'already has a case, walks its evidence checklist (capability declarations, endpoints, code provenance), ' +
        'requests an independent Aegis assessment once evidence is complete, and may PROPOSE (never award) a ' +
        'standing event for an admitted agent. Factor structurally CANNOT decide admission — that authority ' +
        'belongs solely to MoneyPenny, and only once a ratified Aegis assessment supports it. Factor also cannot ' +
        'assess a candidate it is itself the subject of. Factor is a bounded Agent Participant, never a principal: ' +
        'every consequential act requires human or MoneyPenny approval.',
      url: `${origin}/api/agents/factor/agent-card.json`,
      version: '0.1.0',

      provider: {
        organization: 'metaProof',
        url: 'https://thepolity.org',
        role: 'Candidate-Intake Pipeline Agent',
      },

      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['application/json'],
      defaultOutputModes: ['application/json'],

      skills: [
        {
          id: 'candidate-intake',
          name: 'Candidate-Intake Case Management',
          description:
            'Creates or resumes ONE case per candidate (never a duplicate) and walks its evidence checklist. ' +
            'Never decides admission.',
          tags: ['candidate-intake', 'evidence', 'journey-a'],
        },
        {
          id: 'authority-chain-facilitation',
          name: 'Authority-Chain Facilitation',
          description:
            'Establishes and validates direct or MoneyPenny-mediated authority chains for a candidate — never ' +
            'manufactures authority a real delegation_grants row does not already grant.',
          tags: ['authority', 'delegation'],
        },
        {
          id: 'standing-proposal',
          name: 'Standing-Event Proposal',
          description: 'May PROPOSE a standing event for an admitted agent, evidence-gated. Never writes standing directly.',
          tags: ['standing', 'proposal'],
        },
      ],

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
        primary_duty: "Facilitate a candidate agent's journey to admission — never decide the outcome.",

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
        holder: 'Factor',
        bound_to: 'operator (via bounded delegation, per the Constitutional Authority Supremacy doctrine)',
        home_realm: 'metaTerra',
        canonical_function: 'Candidate-Intake Pipeline Agent',
        primary_role: 'Candidate-Intake Case Management · Authority-Chain Facilitation · Standing-Event Proposal',
        status: 'Newly provisioned — Horizen registration pending',
        status_note:
          'aigent-factor is a newly-provisioned agent (2026-09-05). Its owner/control wallet, registry asset, and this ' +
          'Agent Card exist; its Base Sepolia ERC-8004 registration is pending and its FIO handle registration is ' +
          'requested but not yet confirmed. No on-chain registration broadcast has occurred.',
      },
    }),
  );
}
