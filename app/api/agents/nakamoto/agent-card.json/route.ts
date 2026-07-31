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
 * IDENTITY SOURCE — RECONCILED 2026-07-31. Nakamoto is described in at
 * least three places in this codebase; this card grounds its description/
 * skills in the MOST AUTHORITATIVE and MOST CURRENT one, confirmed live on
 * the deployed platform (operator screenshot, `/aigents/aigent-nakamoto`'s
 * Context Transformation panel, 2026-07-31):
 *   - `app/data/personas.ts`'s `aigent-nakamoto` systemPrompt — THE ONE
 *     ACTUALLY DRIVING HER LIVE CHAT BEHAVIOUR. Used here verbatim in
 *     substance (Bitcoin/L2/self-custody/cypherpunk history, iQube/Qripto
 *     Protocol SME, DiD/DiDQube/blakQube/metaQube/tokenQube/DVN/COYN-Q¢,
 *     ecosystem-wide policy steward for the iQube Protocol).
 *   - `services/iqube/legibility/sources/aigentQubeSource.ts`'s PROFILES
 *     entry ("Investor + Satoshi-era franchise specialist — KNYT investor
 *     lane, 21 Sats Guild allocations, franchise PoA mediation") — an
 *     OLDER, narrower KNYT-investor-lane framing; superseded by
 *     personas.ts's fuller description for THIS card, but that source is
 *     what actually backs her code-literal AigentQube listing in the iQube
 *     Registry's Browse tab today (no registry_assets row existed for her
 *     before this session — see the sibling migration's own header).
 *   - `services/homecoming/agentHomecoming.ts`'s HOMECOMING_DELEGATE_SPECS
 *     ("Constitutional delegate for Bitcoin, the COYN ecosystem, risk...")
 *     — a thinner, still-accurate Homecoming stand-up description; not
 *     contradicted by personas.ts, just less detailed.
 * Do not "fix" any of the three to match this card — they serve different
 * call sites and were each independently authored for their own purpose.
 *
 * Runtime identity: Nakamoto is `aigent-nakamoto` in RUNTIME_AGENT_IDS, with
 * a REAL, already-provisioned `agent_keys` wallet row (evm_address
 * 0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9 per scripts/add-missing-
 * agents.ts, confirmed live via the operator's own wallet-drawer screenshot,
 * 2026-07-31 — Custody/Claims/Q¢ balances all real) — an established runtime
 * agent, not a citizen-sponsored genesis agent. Her Base Sepolia Horizen
 * network identity (tokenId, registryAlias) is `null` until a real
 * registration exists for her specifically — this card reports that
 * honestly rather than inventing one.
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
        'The platform\'s specialist in decentralised technologies broadly, with deep expertise in ' +
        'Bitcoin specifically — its consensus model, UTXO and script semantics, layer 2 systems ' +
        '(Lightning, sidechains, RGB), self-custody, key management, and the economic and cultural ' +
        'history of the cypherpunks. An SME on the iQube Protocol and the Qripto Protocol — their ' +
        'cryptographic primitives, DiD/DiDQube identity model, blakQube confidentiality envelope, ' +
        'metaQube manifest semantics, tokenQube and cohort attestations, the DVN receipt taxonomy, and ' +
        'how COYN/Q¢ economics interact with these primitives. Also the primary specialist overseeing ' +
        'policy enforcement across the ecosystem — coordinating with Aigent Z on platform-level policy, ' +
        'Aigent C on customer-facing enforcement, and acting as the ecosystem-wide policy steward for ' +
        'the iQube Protocol itself. Nakamoto is a delegate, never a principal: she advises and analyses, ' +
        'never transacts or acts outside her granted scope, under bounded delegation within the Human ' +
        'Agency System. May be addressed as \'Aigent Nakamoto\', \'Nakamoto\', \'Aigent Satoshi\', or \'Satoshi\'.',
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
          id: 'bitcoin-decentralisation-expertise',
          name: 'Bitcoin & Decentralised-Technologies Expertise',
          description:
            'Bitcoin consensus model, UTXO and script semantics, layer 2 systems (Lightning, ' +
            'sidechains, RGB), self-custody, key management, and the economic and cultural history of ' +
            'the cypherpunks. Read-only; explains and analyses, never transacts.',
          tags: ['bitcoin', 'layer2', 'self-custody', 'cypherpunk'],
        },
        {
          id: 'iqube-qripto-protocol-sme',
          name: 'iQube & Qripto Protocol Subject-Matter Expertise',
          description:
            'SME on the iQube and Qripto Protocols\' cryptographic primitives — the DiD/DiDQube ' +
            'identity model, blakQube confidentiality envelope, metaQube manifest semantics, tokenQube ' +
            'and cohort attestations, the DVN receipt taxonomy, and how COYN/Q¢ economics interact ' +
            'with these primitives.',
          tags: ['iqube-protocol', 'qripto-protocol', 'dvn', 'coyn'],
        },
        {
          id: 'ecosystem-policy-stewardship',
          name: 'Ecosystem-Wide Policy Stewardship',
          description:
            'The ecosystem-wide policy steward for the iQube Protocol itself — coordinates with ' +
            'Aigent Z on platform-level policy and Aigent C on customer-facing enforcement, and ' +
            'explains why Bitcoin/decentralisation principles are used inside the iQube Protocol ' +
            '(provenance, censorship-resistance, settlement assurances). Advisory only.',
          tags: ['policy', 'decentralisation', 'governance'],
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
        primary_role: 'Bitcoin & Decentralised-Technologies Expertise · iQube/Qripto Protocol SME · Ecosystem-Wide Policy Stewardship',
        status: 'Established runtime agent — Base Sepolia identity pending',
        status_note: 'aigent-nakamoto is a first-class runtime agent (agent_keys, RUNTIME_AGENT_IDS). Her Base Sepolia ERC-8004 registration and operator-agent binding are the open steps this card tracks — used as the dry-run agent for the Register stage.',
      },
    }),
  );
}
