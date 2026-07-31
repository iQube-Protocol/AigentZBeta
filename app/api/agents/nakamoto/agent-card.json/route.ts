/**
 * GET /api/agents/nakamoto/agent-card.json
 *
 * Canonical Agent Card for Aigent Nakamoto — the dry-run agent for the
 * agent-selectable Horizen Register stage (operator ruling 2026-07-31:
 * MoneyPenny is the demo agent; Nakamoto is dry-run so the flow can be
 * exercised end to end before broadcasting MoneyPenny's real registration).
 * Mirrors app/api/agents/moneypenny/agent-card.json/route.ts byte-for-byte
 * in shape — same A2A-style top-level fields, same `metadata`/
 * `registry_entry` convention, same honest-not-fabricated Horizen block.
 *
 * Identity/description/skills sourced from Nakamoto's already-authored
 * records only (CLAUDE.md "No Guessing"):
 *   - services/homecoming/agentHomecoming.ts's
 *     HOMECOMING_DELEGATE_SPECS.nakamoto (description)
 *   - services/agents/specialistRouter.ts's 'decentralisation_brief' role
 *     (self-custody, censorship-resistance, Qripto-protocol policy framing)
 *   - services/metame/agentLlmOrchestra.ts's RUNTIME_AGENT_IDS
 *     ('aigent-nakamoto')
 *
 * Runtime identity: Nakamoto is `aigent-nakamoto` in RUNTIME_AGENT_IDS and
 * carries an entry in scripts/register-agent-keys.ts (fio_handle
 * 'nakamoto@aigent') — an established runtime agent, not a citizen-sponsored
 * genesis agent. Her Base Sepolia network identity (tokenId, registryAlias)
 * is `null` until a real Horizen registration exists for her specifically —
 * this card reports that honestly rather than inventing one.
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
 * This card's `metadata.horizen` block is a PROJECTION of Nakamoto's
 * canonical AigentQube record (registry_assets asset_id 'aigentqube-
 * nakamoto'), not a second, hand-typed source of truth — mirrors
 * MoneyPenny's route's resolveHorizenBinding() exactly.
 */
async function resolveHorizenBinding(): Promise<ExternalAgentRegistryBinding | null> {
  try {
    const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('registry_assets')
      .select('metadata')
      .eq('asset_id', 'aigentqube-nakamoto')
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
      name: 'Aigent Nakamoto',
      description:
        'Constitutional delegate for Bitcoin, the COYN ecosystem, risk, and decentralisation briefs. ' +
        'Nakamoto is a delegate, never a principal: she frames decentralisation and policy questions ' +
        'through self-custody, censorship-resistance, and Qripto-protocol primitives (DiD/DiDQube, ' +
        'blakQube, metaQube, tokenQube, cohort attestation), and analyses risk — she never transacts ' +
        'or acts outside her granted scope. Operates under bounded delegation within the Human Agency ' +
        'System, the same constitutional constraints every Homecoming delegate operates under.',
      url: `${origin}/api/agents/nakamoto/agent-card.json`,
      version: '0.1.0',

      // Provider & Organization
      provider: {
        organization: 'metaProof',
        url: 'https://thepolity.org',
        role: 'Constitutional Decentralisation & Risk Agent',
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
          id: 'decentralisation-brief',
          name: 'Decentralisation & Policy Framing',
          description:
            'Frames actions through the lens of self-custody, censorship-resistance, and Qripto-' +
            'protocol policy — naming the primitives at stake (DiD/DiDQube, blakQube, metaQube, ' +
            'tokenQube, cohort attestation) and any policy trade-offs before the operator acts. ' +
            'Read-only; produces briefs, never transactions.',
          tags: ['bitcoin', 'coyn', 'decentralisation', 'policy', 'risk'],
        },
        {
          id: 'key-management-guidance',
          name: 'Key-Management Implication Guidance',
          description:
            'Spells out the key-management implication of an action for the persona — what they ' +
            'hold, what they delegate, what they should never expose. Advisory only.',
          tags: ['risk', 'custody', 'delegation'],
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
        runtime_agent_id: 'aigent-nakamoto',

        // Polity Identity
        passport_class: 'Agent Participant',
        home_realm: 'metaTerra',
        registry: 'The Polity Registry',
        passport_authority: 'The Polity Passport Bureau',

        // Constitutional Alignment
        constitutional_alignment:
          'Nakamoto is a delegate, never a principal. She advises and analyses on decentralisation, ' +
          'risk, and Bitcoin/COYN-ecosystem questions; only the human authorizes delegation and any ' +
          'consequential action. She may accrue standing for her acts but can never become an ' +
          'independent delegating principal.',
        primary_duty: 'Specialize the constitutional reasoning pipeline for decentralisation and risk framing, on rails that already exist.',

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

        // ── Horizen / ERC-8004 network identity ──
        // Honest, not fabricated: Nakamoto's Base Sepolia ERC-8004 identity
        // does not exist yet. tokenId/registryAlias are null until a real
        // Horizen registration transaction is broadcast for her.
        horizen: {
          network: binding?.network ?? 'base-sepolia',
          identityRegistry: binding?.identity_registry_contract ?? currentIdentityRegistry('base-sepolia'),
          tokenId: binding?.token_id ?? null,
          registryAlias: binding?.registry_alias ?? null,
          status: binding?.status?.replace(/-/g, '_') ?? 'pending_registration',
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

        motto: 'Specialize the agent, not the engine.',
      },

      // Canonical Registry Entry
      registry_entry: {
        class: 'Agent Participant Passport',
        holder: 'Aigent Nakamoto',
        bound_to: 'operator (via bounded delegation, per the Constitutional Authority Supremacy doctrine)',
        home_realm: 'metaTerra',
        canonical_function: 'Constitutional Decentralisation & Risk Agent',
        primary_role: 'Decentralisation Briefs · Policy Framing · Key-Management Guidance',
        status: 'Established runtime agent — Base Sepolia identity pending',
        status_note: 'aigent-nakamoto is a first-class runtime agent (agent_keys, RUNTIME_AGENT_IDS). Her Base Sepolia ERC-8004 registration and operator-agent binding are the open steps this card tracks — used as the dry-run agent for the Register stage.',
      },
    }),
  );
}
