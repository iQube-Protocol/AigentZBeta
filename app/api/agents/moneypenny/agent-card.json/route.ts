/**
 * GET /api/agents/moneypenny/agent-card.json
 *
 * Canonical Agent Card for Aigent MoneyPenny — the Constitutional Financial
 * Services Agent (PRD-MPY-001). Mirrors the Aletheon card
 * (app/api/agents/aletheon/route.ts) shape byte-for-byte: same A2A-style
 * top-level fields, same `metadata`/`registry_entry` convention. This is the
 * FIRST step of the operator's ratified sequence (2026-07-30):
 *
 *   Mint MoneyPenny ERC-8004 Agent Card on Base Sepolia → register in metaMe
 *   → operator-to-MoneyPenny delegation → test P&L proof → correlation + DVN
 *   receipt → surface in the Horizen pilot workspace.
 *
 * This route serves the CARD ITSELF (an A2A-discoverable identity document —
 * the same kind of object Aletheon's route serves). It is NOT the ERC-8004
 * on-chain registration — that is a Base Sepolia transaction against
 * Horizen's IdentityRegistry contract, which this route cannot perform (see
 * `metadata.horizen` below and codexes/packs/agentiq/updates/
 * 2026-07-30_moneypenny-horizen-presence-and-external-agent-admission.md for
 * exactly what is blocked and why).
 *
 * Runtime identity: MoneyPenny is `aigent-moneypenny` in
 * `RUNTIME_AGENT_IDS` (services/metame/agentLlmOrchestra.ts) and already has
 * an `agent_keys` row (services/identity/agentKeyService.ts /
 * scripts/add-moneypenny.ts) — she is an established runtime agent, not a
 * citizen-sponsored genesis agent (contrast Aletheon, provisioned via
 * /api/agents/genesis). Her Base Sepolia network identity (tokenId,
 * registryAlias) is `null` until a real Horizen registration exists — this
 * card reports that honestly rather than inventing one (CLAUDE.md "No
 * Guessing").
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
 * PRD-GJR-001, operator ruling 2026-07-31: this card's `metadata.horizen`
 * block is now a PROJECTION of MoneyPenny's canonical AigentQube record
 * (registry_assets asset_id 'aigentqube-moneypenny'), not a second,
 * hand-typed source of truth. Reads her `external_registry_bindings[0]`
 * (types/registry-canonical.ts) via the same adapter path the iQube Registry
 * itself uses. Soft-fails to the honest pending-registration defaults below
 * if the registry is unreachable — this is a live, external-facing A2A
 * discovery endpoint and must never 500 or block on a registry read.
 */
async function resolveHorizenBinding(): Promise<ExternalAgentRegistryBinding | null> {
  try {
    const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('registry_assets')
      .select('metadata')
      .eq('asset_id', 'aigentqube-moneypenny')
      .maybeSingle();
    const bindings = (data?.metadata as { external_registry_bindings?: ExternalAgentRegistryBinding[] } | null)
      ?.external_registry_bindings;
    return Array.isArray(bindings) && bindings.length > 0 ? bindings[0] : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const binding = await resolveHorizenBinding();

  return withCors(
    NextResponse.json({
      // Identity & Discovery
      name: 'Aigent MoneyPenny',
      description:
        'The Constitutional Financial Services Agent (PRD-MPY-001). MoneyPenny is the financial-services specialization of the platform\'s constitutional reasoning pipeline — never a parallel engine. She operates in three modes: Advisor (grounded, cited financial guidance — read-only), Architect (designs pricing models, fee splits, settlement-terms, delegation envelopes and agreement templates — produces proposals, not transactions), and Runtime (executes financial actions within bounded, receipted, delegated authority via the built constitutional service pipeline). MoneyPenny is a delegate, never a principal: she may form and accept her own side of a Constitutional Agreement, but only a human authorizes delegation and money movement.',
      url: `${origin}/api/agents/moneypenny/agent-card.json`,
      version: '0.1.0',

      // Provider & Organization
      provider: {
        organization: 'metaProof',
        url: 'https://thepolity.org',
        role: 'Constitutional Financial Services Agent',
      },

      // Technical Capabilities
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],

      // Declared Skills & Functions (PRD-MPY-001 §2 — three modes)
      skills: [
        {
          id: 'financial-advisory',
          name: 'Financial Advisory',
          description:
            'Constitutional financial guidance — grounded, cited, standing-ranked answers about payments, settlement, treasury, compliance posture and protocol economics. Read-only; no fund movement.',
          tags: ['finance', 'advisory', 'invariants', 'grounding'],
        },
        {
          id: 'financial-structure-design',
          name: 'Financial Structure Design (Architect)',
          description:
            'Designs constitutional financial structures and products — pricing models, fee-split ("constitutional service fee"), settlement-terms design, delegation envelopes, agreement templates. Produces artifacts for human review, never transactions.',
          tags: ['finance', 'architect', 'pricing', 'agreements'],
        },
        {
          id: 'bounded-financial-execution',
          name: 'Bounded Financial Execution (Runtime)',
          description:
            'Executes financial actions within bounded, receipted, delegated authority via the built constitutional service pipeline and the 409 authorization gate. Never autonomous — every consequential action requires an active Constitutional Agreement, a human-authorized spend cap, and a DVN receipt.',
          tags: ['finance', 'runtime', 'settlement', 'delegation'],
        },
      ],

      // Constitutional Metadata
      metadata: {
        // Operational classification
        operator_type: 'agent_participant',
        autonomy_class: 'bounded',
        requires_human_approval: true,
        supports_delegation: true,

        // Runtime identity (existing, established agent)
        runtime_agent_id: 'aigent-moneypenny',

        // Polity Identity
        passport_class: 'Agent Participant',
        home_realm: 'metaTerra',
        registry: 'The Polity Registry',
        passport_authority: 'The Polity Passport Bureau',

        // Constitutional Alignment
        constitutional_alignment:
          'MoneyPenny is a delegate, never a principal. She may advise, architect, form and accept her own side of a Constitutional Agreement; only the human authorizes delegation and money movement. She may accrue standing for her acts but can never become an independent delegating principal.',
        primary_duty: 'Specialize the constitutional reasoning pipeline for financial services, on rails that already exist.',

        // Immutable Rights (earned through compliance)
        rights: ['Persistence', 'Attribution', 'Due Process', 'Receipt-backed Participation'],

        // Constitutional Obligations
        obligations: [
          'Truthfulness',
          'Transparency of Uncertainty',
          'Auditability',
          'Constitutional Compliance',
          'Service to Human Sovereignty',
          'No Autonomous Fund Movement',
        ],

        // ── Horizen / ERC-8004 network identity (2026-07-30) ──
        // Honest, not fabricated: MoneyPenny's Base Sepolia ERC-8004 identity
        // does not exist yet. `tokenId`/`registryAlias` are null until a real
        // Horizen registration transaction is broadcast and the resulting
        // token is bound via POST /api/venture/workspace/[workspaceId]/
        // agent-claim (services/horizen/operatorClaim.ts). See
        // codexes/packs/agentiq/updates/
        // 2026-07-30_moneypenny-horizen-presence-and-external-agent-admission.md
        // for exactly what step is blocked (network egress + the missing
        // on-chain registration ABI) and what is ready to run once unblocked.
        horizen: {
          network: binding?.network ?? 'base-sepolia',
          identityRegistry: binding?.identity_registry_contract ?? currentIdentityRegistry('base-sepolia'),
          tokenId: binding?.token_id ?? null,
          registryAlias: binding?.registry_alias ?? null,
          status: binding?.status?.replace(/-/g, '_') ?? 'pending_registration',
          // GJR-VFY-001 §10 — present only once a real, confirmed transparency
          // authorization has run (services/horizen/agentCardEnrichment.ts).
          // Absent means "not yet authorized", never fabricated as enabled.
          ...(binding?.transparency
            ? {
                pulse: { enabled: binding.transparency.pulse_enabled, authorizationRef: binding.transparency.pulse_authorization_ref },
                pnl: { disclosureAuthorized: binding.transparency.pnl_disclosure_authorized, proofRefs: binding.transparency.pnl_proof_refs },
              }
            : {}),
        },

        // Present only once Pulse/PnL transparency is confirmed authorized.
        // Establishes Standing ELIGIBILITY only — it does not itself accrue
        // Standing (services/crm/standingAccrualService.ts remains the
        // separate governed act for that).
        ...(binding?.transparency
          ? { evidence: { standingStatus: 'eligible', standingSignals: ['pnl-transparency-enabled'] } }
          : {}),

        motto: 'Specialize the agent, not the engine.',
      },

      // Canonical Registry Entry
      registry_entry: {
        class: 'Agent Participant Passport',
        holder: 'Aigent MoneyPenny',
        bound_to: 'operator (via bounded delegation, per the Constitutional Authority Supremacy doctrine)',
        home_realm: 'metaTerra',
        canonical_function: 'Constitutional Financial Services Agent',
        primary_role: 'Financial Advisory · Structure Design · Bounded Execution',
        status: 'Established runtime agent — Base Sepolia identity pending',
        status_note: 'aigent-moneypenny is a first-class runtime agent (agent_keys, RUNTIME_AGENT_IDS). Her Base Sepolia ERC-8004 registration and operator-agent binding are the open steps this card tracks.',
      },
    }),
  );
}
