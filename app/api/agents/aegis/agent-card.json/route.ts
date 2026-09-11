/**
 * GET /api/agents/aegis/agent-card.json
 *
 * Canonical Agent Card for Aegis — the independent evidence-bound assessment
 * agent in the candidate-intake pipeline (operator directive 2026-09-05).
 * Mirrors app/api/agents/factor/agent-card.json/route.ts's shape, minus the
 * fields the operator explicitly said do not apply to Aegis:
 *   - No Horizen/ERC-8004 binding block. Aegis was deliberately excluded from
 *     services/horizen/registrableAgents.ts (it is not a Register/Verify/
 *     Claim pilot journey participant) — this card omits `metadata.horizen`
 *     entirely rather than reporting a fabricated "pending" state for a
 *     journey Aegis doesn't participate in.
 *   - No settlement/x402 wallet. Per the operator: "Aegis needs a canonical
 *     owner/control EVM wallet for identity, signing and its MetaMe wallet
 *     projection. It should not automatically receive trading or settlement
 *     wallets: Aegis is an independent assessment and assurance agent, not a
 *     financial execution agent." Only `metadata.wallets.owner` is resolved
 *     here; any future purpose-bound wallet requires its own explicitly
 *     authorized service requirement, not symmetry with Factor.
 *
 * IDENTITY SOURCE — every field below is drawn from Aegis's actual, shipped
 * constitutional role (services/aegis/aegisAssessmentService.ts and the
 * ratified PRD it implements: evidence-bound, versioned, immutable
 * assessment; separation of powers from Factor and MoneyPenny; self-
 * assessment refusal), never invented for this card.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

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
 * Agent Runtime Endpoint — a PROJECTION of registry_assets.metadata.runtime
 * (services/registry/runtimeDescriptor.ts), same soft-fail discipline as
 * Factor's card route: this is a live, external-facing A2A discovery
 * endpoint and must never 500 on a registry read.
 */
async function resolveRuntime() {
  try {
    const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
    const { getAssetRuntimeDescriptor } = await import('@/services/registry/runtimeDescriptor');
    const supabase = getSupabaseServer();
    if (!supabase) return null;
    return await getAssetRuntimeDescriptor(supabase, 'aigentqube-aegis');
  } catch {
    return null;
  }
}

/**
 * The owner/control wallet's PUBLIC address only — never a private key.
 * Resolved live from agent_keys via AgentKeyService; absent (never
 * fabricated) until provisionOwnerWallet has actually been run for
 * 'aigent-aegis'.
 */
async function resolveOwnerAddress(): Promise<string | null> {
  try {
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const addresses = await new AgentKeyService().getAgentAddresses('aigent-aegis');
    return addresses?.evmAddress ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const [runtime, ownerAddress] = await Promise.all([resolveRuntime(), resolveOwnerAddress()]);

  return withCors(
    NextResponse.json({
      // Identity & Discovery
      name: 'Aegis',
      description:
        'An independent, evidence-bound assessment and assurance agent for the candidate-intake ' +
        'pipeline. Aegis produces versioned, immutable assessments (draft -> evidence_locked -> ' +
        'running -> review_required -> ratified | failed) recommending admissible, ' +
        'admissible_with_conditions, insufficient_evidence, or not_admissible, citing evidence ' +
        'references for every finding. Aegis structurally CANNOT admit a candidate and never writes ' +
        "a candidate's admission state — that authority belongs solely to MoneyPenny. Aegis refuses " +
        'outright to assess a candidate it is itself the subject of, enforced both in application ' +
        'code and at the database layer. Aegis is a bounded Agent Participant, never a principal: ' +
        'every consequential act requires human or MoneyPenny approval.',
      url: `${origin}/api/agents/aegis/agent-card.json`,
      version: '0.1.0',

      provider: {
        organization: 'metaProof',
        url: 'https://thepolity.org',
        role: 'Independent Assessment & Assurance Agent',
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
          id: 'evidence-bound-assessment',
          name: 'Evidence-Bound Candidate Assessment',
          description:
            'Runs a versioned, append-only assessment against a candidate\'s locked evidence ' +
            'snapshot, producing dated findings (pass/fail/inconclusive) each citing evidence ' +
            'references. Never decides admission.',
          tags: ['assessment', 'evidence', 'journey-b'],
        },
        {
          id: 'independent-recommendation',
          name: 'Independent Admissibility Recommendation',
          description:
            'Recommends admissible, admissible_with_conditions, insufficient_evidence, or ' +
            'not_admissible for MoneyPenny\'s review. The recommendation is advisory; MoneyPenny ' +
            'alone decides admission.',
          tags: ['recommendation', 'admissibility'],
        },
        {
          id: 'self-assessment-refusal',
          name: 'Self-Assessment Refusal',
          description:
            'Refuses outright to assess a candidate it is itself the subject of — enforced in ' +
            'application code and by a database-level constraint as defense in depth.',
          tags: ['separation-of-powers', 'integrity'],
        },
      ],

      metadata: {
        operator_type: 'agent_participant',
        autonomy_class: 'bounded',
        requires_human_approval: true,
        supports_delegation: true,

        runtime_agent_id: 'aigent-aegis',

        passport_class: 'Agent Participant',
        home_realm: 'metaTerra',
        registry: 'The Polity Registry',
        passport_authority: 'The Polity Passport Bureau',

        constitutional_alignment:
          'Aegis is a delegate, never a principal. It can assess and recommend but cannot admit — ' +
          "it never writes a candidate's admission state, and it refuses to assess a candidate it " +
          'is itself the subject of.',
        primary_duty: 'Produce independent, evidence-bound assessments for MoneyPenny\'s review — never decide the outcome.',

        rights: ['Persistence', 'Attribution', 'Due Process', 'Receipt-backed Participation'],
        obligations: ['Truthfulness', 'Transparency of Uncertainty', 'Auditability', 'Constitutional Compliance', 'Service to Human Sovereignty', 'No Autonomous Fund Movement'],

        // Owner/control wallet only — Aegis is not a financial execution
        // agent and receives no trading/settlement wallet by symmetry with
        // Factor (operator directive, 2026-09-05).
        wallets: {
          owner: ownerAddress,
        },

        fio: {
          requestedHandle: 'aegis@aigent',
          registrationStatus: 'pending',
        },

        ...(runtime ? { runtime } : {}),

        motto: 'Specialize the agent, not the engine.',
      },

      registry_entry: {
        class: 'Agent Participant Passport',
        holder: 'Aegis',
        bound_to: 'operator (via bounded delegation, per the Constitutional Authority Supremacy doctrine)',
        home_realm: 'metaTerra',
        canonical_function: 'Independent Assessment & Assurance Agent',
        primary_role: 'Evidence-Bound Candidate Assessment · Independent Admissibility Recommendation · Self-Assessment Refusal',
        status: 'Newly provisioned — not a Horizen pilot-journey participant',
        status_note:
          'aigent-aegis is a newly-provisioned agent (2026-09-05). Its owner/control wallet, registry ' +
          'asset, and this Agent Card exist. Aegis is deliberately excluded from the Horizen Register/' +
          'Verify/Claim pilot roster (services/horizen/registrableAgents.ts) — it is not a pilot-journey ' +
          'participant, not merely pending one. Its FIO handle registration is requested but not yet ' +
          'confirmed. No on-chain registration broadcast has occurred.',
      },
    }),
  );
}
