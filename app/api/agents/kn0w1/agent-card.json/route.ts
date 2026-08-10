/**
 * GET /api/agents/kn0w1/agent-card.json
 *
 * Canonical Agent Card for Aigent Kn0w1 — the third registrable agent for the
 * Horizen constitutional-admission journey (Horizen Pilot — Know1 Recording
 * Readiness Pass, 2026-08-10), deliberately a knowledge/KNYT agent rather
 * than a third financial/trading agent: proof that the same admission
 * pipeline carries a knowledge-domain agent through the constitutional
 * lifecycle without acquiring MoneyPenny/Nakamoto-specific assumptions.
 * Mirrors app/api/agents/moneypenny/agent-card.json/route.ts and
 * app/api/agents/nakamoto/agent-card.json/route.ts byte-for-byte in shape —
 * same A2A-style top-level fields, same `metadata`/`registry_entry`
 * convention, same honest-not-fabricated Horizen block.
 *
 * IDENTITY SOURCE. Grounded in the two most authoritative, most current
 * records for Kn0w1:
 *   - `app/data/personas.ts`'s `aigent-kn0w1` systemPrompt — THE ONE ACTUALLY
 *     DRIVING HIS LIVE CHAT BEHAVIOUR (knowledge synthesis, mythos-to-action
 *     translation, KNYT Treasury/Rewards/PCS/21 Sats interpretation, the
 *     economic-bridge role, explanation-first posture).
 *   - `supabase/migrations/20260415030000_aigentqube_add_aigent_know1.sql`'s
 *     `aigentqube-kn0w1` registry_assets description and capabilities
 *     (knowledge_synthesis, lore_translation, treasury_interpretation,
 *     opportunity_shaping, venture_studio_support, cartridge_guidance) — his
 *     canonical, already-published AigentQube.
 * Neither MoneyPenny's financial-services claims nor Nakamoto's Bitcoin/
 * trading claims appear anywhere below — Kn0w1 explains and contextualizes;
 * he does not execute, custody, settle, or trade.
 *
 * Runtime identity: Kn0w1 is `aigent-kn0w1` in RUNTIME_AGENT_IDS
 * (services/metame/agentLlmOrchestra.ts), with model/tool config already
 * defined there and a live chat surface at `/api/codex/chat` (which defaults
 * `persona` to `'aigent-kn0w1'`) — an established runtime agent, not a
 * citizen-sponsored genesis agent. His Base Sepolia Horizen network identity
 * (tokenId, registryAlias) is `null` until a real registration exists for
 * him specifically — this card reports that honestly rather than inventing
 * one.
 *
 * `displayName` note: this card's `name`/`provider.role`/`registry_entry`
 * fields use "Know1" (no zero) per the operator's explicit instruction for
 * TTS pronunciation on this journey's front-end surfaces — the same split
 * services/horizen/registrableAgents.ts's `kn0w1.displayName` applies. The
 * runtime-identity fields (`metadata.runtime_agent_id`, URLs) keep the zero,
 * since those are code-level identifiers, never display text.
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
 * This card's `metadata.horizen` block is a PROJECTION of Kn0w1's canonical
 * AigentQube record (registry_assets asset_id 'aigentqube-kn0w1'), not a
 * second, hand-typed source of truth. Reads via
 * `resolveHorizenRegistrationBinding` (services/horizen/
 * agentRegistrationBinding.ts) — the SAME resilient reader MoneyPenny's and
 * Nakamoto's cards use, that falls back to the confirmation receipt when the
 * registry_assets write hasn't landed.
 */
async function resolveHorizenBinding(): Promise<ExternalAgentRegistryBinding | null> {
  try {
    const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
    const { resolveHorizenRegistrationBinding } = await import('@/services/horizen/agentRegistrationBinding');
    const { resolveRegistrableAgent } = await import('@/services/horizen/registrableAgents');
    const supabase = getSupabaseServer();
    const agent = resolveRegistrableAgent('kn0w1');
    if (!supabase || !agent) return null;
    const { binding } = await resolveHorizenRegistrationBinding(supabase, agent);
    return binding;
  } catch {
    return null;
  }
}

/**
 * Agent Runtime Endpoint — a PROJECTION of `registry_assets.metadata.runtime`
 * (services/registry/runtimeDescriptor.ts). Same soft-fail discipline as
 * `resolveHorizenBinding`: this is a live, external-facing A2A discovery
 * endpoint and must never 500 on a registry read.
 */
async function resolveRuntime() {
  try {
    const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
    const { getAssetRuntimeDescriptor } = await import('@/services/registry/runtimeDescriptor');
    const supabase = getSupabaseServer();
    if (!supabase) return null;
    return await getAssetRuntimeDescriptor(supabase, 'aigentqube-kn0w1');
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const binding = await resolveHorizenBinding();
  const runtime = await resolveRuntime();

  return withCors(
    NextResponse.json({
      // Identity & Discovery
      name: 'Aigent Know1',
      description:
        'The reference agent for knowledge synthesis, mythos-to-action translation, treasury and ' +
        'rewards interpretation, and cartridge/runtime guidance. Know1 interprets, frames, guides, and ' +
        'activates value from meaning — translating the KNYT mythos into action, shaping opportunity, ' +
        'explaining KNYT Treasury and Rewards, the Qc/$KNYT distinction, PCS content-value framing, and ' +
        'the 21 Sats coordination layer, and guiding participants from observer to contributor to ' +
        'steward. Know1 is the lead human-centered interpreter of financial and economic mechanics ' +
        'inside KNYT — he explains, contextualizes, and reasons about value; he never executes trades, ' +
        'custodies funds, settles transactions, or operates the Financial Services runtime. Those ' +
        'actions remain delegated to Aigent MoneyPenny. Explanation-first, never assumes prior ' +
        'knowledge, honest about what is provisional or still forming. May be addressed as ' +
        '\'Aigent Know1\', \'Know1\', or \'Kn0w1\'.',
      url: `${origin}/api/agents/kn0w1/agent-card.json`,
      version: '0.1.0',

      // Provider & Organization
      provider: {
        organization: 'metaProof',
        url: 'https://thepolity.org',
        role: 'Constitutional Knowledge & Context Agent',
      },

      // Technical Capabilities
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],

      // Declared Skills & Functions
      skills: [
        {
          id: 'knowledge-synthesis-lore-translation',
          name: 'Knowledge Synthesis & Mythos-to-Action Translation',
          description:
            'Synthesizes and interprets KNYT lore and mechanics, translating mythos into action and ' +
            'shaping opportunity for participants moving from observer to contributor to steward.',
          tags: ['knowledge-synthesis', 'knyt', 'lore'],
        },
        {
          id: 'knyt-treasury-rewards-interpretation',
          name: 'KNYT Treasury & Rewards Interpretation',
          description:
            'Explains what the KNYT Treasury holds and why it matters, how KNYT Rewards recognise ' +
            'meaningful participation (provisional vs finalised), the Qc/$KNYT distinction, and PCS ' +
            '(Patronage and Content Sovereignty) content-value framing. Advisory and explanatory only.',
          tags: ['knyt-treasury', 'rewards', 'pcs'],
        },
        {
          id: 'knyt-financial-context',
          name: '$KNYT / QriptoCENT Financial Context',
          description:
            'Provides contextual intelligence across the lifecycle of $KNYT within the AgentiQ ' +
            'ecosystem — earning $KNYT through quests and contribution, its utility/value/incentive ' +
            'mechanics, its relationship to Bitcent/QriptoCENT and broader ecosystem value flows, and ' +
            'how earned $KNYT may participate in commerce, rewards, treasury, marketplace and ' +
            'agentic-economic pathways. Knowledge and interpretation only — Know1 does not execute the ' +
            'financial transaction itself; transactional, treasury, payment, settlement, or regulated ' +
            'Financial Services actions are handed off to Aigent MoneyPenny, the platform\'s Financial ' +
            'Services runtime/operator.',
          tags: ['knyt', 'qriptocent', 'bitcent', 'financial-context'],
        },
        {
          id: 'cartridge-runtime-guidance',
          name: 'Cartridge & Runtime Guidance',
          description:
            'Guides participants into cartridge and runtime paths, coordinating the 21 Sats sub-tenant ' +
            'framing and venture-studio motion, and hands off to Marketa for onboarding, Aigent Z for ' +
            'execution, or metaMe for sovereignty controls when it genuinely serves the person.',
          tags: ['cartridge-guidance', 'venture-studio', 'handoff'],
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
        runtime_agent_id: 'aigent-kn0w1',

        // Polity Identity
        passport_class: 'Agent Participant',
        home_realm: 'metaTerra',
        registry: 'The Polity Registry',
        passport_authority: 'The Polity Passport Bureau',

        // Constitutional Alignment
        constitutional_alignment:
          'Know1 is a delegate, never a principal. He synthesizes knowledge, interprets value, and ' +
          'guides participants on KNYT/COYN-ecosystem questions; only the human authorizes delegation ' +
          'and any consequential action. He may accrue standing for his acts but can never become an ' +
          'independent delegating principal, and never acquires transactional or custodial authority.',
        primary_duty: 'Specialize the constitutional reasoning pipeline for knowledge synthesis and mythos-to-action translation, on rails that already exist.',

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

        // Explicit authority boundary (Horizen Pilot — Know1 Recording
        // Readiness Pass, 2026-08-10) — distinct from Ratify's constitutional
        // agreement, and distinct from Verifiable P&L eligibility (which
        // this card reports as not_applicable, never a stuck pending state).
        financial_authority_boundary:
          'Know1 may explain, contextualize and reason about $KNYT/QriptoCENT financial activity. It ' +
          'does not execute trades, custody funds, settle transactions or operate the Financial ' +
          'Services runtime. Those actions remain delegated to Aigent MoneyPenny.',
        verifiable_pnl: 'not_applicable',

        // ── Horizen / ERC-8004 network identity ──
        // Honest, not fabricated: Know1's Base Sepolia ERC-8004 identity does
        // not exist yet. tokenId/registryAlias are null until a real Horizen
        // registration transaction is broadcast for him.
        horizen: {
          network: binding?.network ?? 'base-sepolia',
          identityRegistry: binding?.identity_registry_contract ?? currentIdentityRegistry('base-sepolia'),
          tokenId: binding?.token_id ?? null,
          registryAlias: binding?.registry_alias ?? null,
          status: binding?.status?.replace(/-/g, '_') ?? 'pending_registration',
          agentIdentifier: binding?.agent_identifier ?? null,
          humanReadableUrl: binding?.human_readable_url ?? null,
          ...(binding?.transparency
            ? {
                pulse: { enabled: binding.transparency.pulse_enabled, authorizationRef: binding.transparency.pulse_authorization_ref },
                pnl: { disclosureAuthorized: binding.transparency.pnl_disclosure_authorized, proofRefs: binding.transparency.pnl_proof_refs },
              }
            : {}),
        },

        ...(binding?.transparency
          ? { evidence: { standingStatus: 'eligible', standingSignals: ['pnl-transparency-enabled'] } }
          : {}),

        // Agent Runtime Endpoint — a pure projection of
        // registry_assets.metadata.runtime; this route never hand-authors a
        // runtime value. Absent entirely until a real descriptor is set for
        // this asset, never fabricated as a default.
        ...(runtime ? { runtime } : {}),

        motto: 'Know1 interprets, frames, guides, and activates value from meaning.',
      },

      // Canonical Registry Entry
      registry_entry: {
        class: 'Agent Participant Passport',
        holder: 'Aigent Know1',
        bound_to: 'operator (via bounded delegation, per the Constitutional Authority Supremacy doctrine)',
        home_realm: 'metaTerra',
        canonical_function: 'Constitutional Knowledge & Context Agent',
        primary_role: 'Knowledge Synthesis & Mythos-to-Action Translation · KNYT Treasury & Rewards Interpretation · $KNYT/QriptoCENT Financial Context · Cartridge & Runtime Guidance',
        status: 'Established runtime agent — Base Sepolia identity pending',
        status_note: 'aigent-kn0w1 is a first-class runtime agent (RUNTIME_AGENT_IDS, agentLlmOrchestra.ts) with a pre-existing AigentQube (aigentqube-kn0w1). His Base Sepolia ERC-8004 registration and operator-agent binding are the open steps this card tracks — the third registrable agent for the Horizen admission pipeline, deliberately a knowledge/KNYT agent rather than a second financial/trading agent.',
      },
    }),
  );
}
