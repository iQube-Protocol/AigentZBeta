/**
 * POST /api/codex/agentiq-os/registry-draft
 *
 * Generates a structured Registry submission draft using Aigent C-OS.
 * Returns a JSON manifest (AigentQube or SkillQube) based on the developer's
 * description. Grounded strictly in the AgentiQ OS KB — no hallucination.
 *
 * Phase 1: returns a scaffold with developer-provided fields pre-filled.
 * Phase 2: LLM-assisted manifest completion using the agentiq-os chat route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

export type QubeType = 'AigentQube' | 'SkillQube' | 'WorkflowQube' | 'ConnectorQube';

interface DraftRequest {
  persona_id?: string;
  qube_type: QubeType;
  name: string;
  description: string;
  capabilities?: string[];
  tags?: string[];
  trust_band?: string;
}

const TRUST_BAND_DEFAULT = 'L1_EXPERIMENTAL';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DraftRequest;
    const {
      persona_id,
      qube_type = 'AigentQube',
      name,
      description,
      capabilities = [],
      tags = [],
      trust_band = TRUST_BAND_DEFAULT,
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64);

    const draft = buildDraft(qube_type, { slug, name, description, capabilities, tags, trust_band });

    // Emit DVN-eligible receipt for draft creation
    void emitOrchestrationEvent({
      event_id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      event_type: 'z_delegated',
      from_role: 'aigent-z',
      to_role: 'aigent-c',
      reason: `Registry draft generated: ${qube_type} "${name}"`,
      journey_stage: 'acolyte',
      active_cartridge: 'agentiq-os-cartridge',
      active_codex: 'agentiq-os-cartridge',
      receipt_eligible: true,
      metadata: {
        draft_event: 'registry_draft_generated',
        persona_id: persona_id ?? 'anonymous',
        qube_type,
        slug,
        trust_band,
        agent_root_did: 'did:iqube:aigent-c-os-root',
      },
    });

    return NextResponse.json({
      ok: true,
      draft,
      qube_type,
      persona_id: persona_id ?? 'anonymous',
      instructions: [
        'Review the generated manifest and fill in any TODOs.',
        'Submit to the Registry at L1_EXPERIMENTAL using `npx agentiq publish`.',
        'See SDK Quickstart tab for the full publish command.',
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// ============================================================================
// Draft builders
// ============================================================================

interface DraftFields {
  slug: string;
  name: string;
  description: string;
  capabilities: string[];
  tags: string[];
  trust_band: string;
}

function buildDraft(type: QubeType, f: DraftFields): Record<string, unknown> {
  const base = {
    schema_version: '1.0',
    qube_type: type,
    id: `${f.slug}-${Date.now()}`,
    slug: f.slug,
    name: f.name,
    description: f.description,
    version: '0.1.0',
    trust_band: f.trust_band,
    tags: f.tags.length > 0 ? f.tags : ['TODO: add tags'],
    owner: 'TODO: your persona DID',
    created_at: new Date().toISOString(),
  };

  if (type === 'AigentQube') {
    return {
      ...base,
      root_did: 'did:iqube:TODO-your-root-did',
      capabilities: f.capabilities.length > 0
        ? f.capabilities
        : ['knowledge_retrieval', 'TODO: add capabilities'],
      policy_bindings: {
        allowed_surfaces: ['TODO: list allowed cartridges'],
        forbidden_actions: ['write_to_aigency_pack', 'access_supabase_service_role'],
        disclosure_class: 'tenant',
        requires_guardian_approval: false,
      },
      modes: ['TODO: define operating modes'],
      grounding_sources: ['TODO: list KB packs or data sources'],
    };
  }

  if (type === 'SkillQube') {
    return {
      ...base,
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'TODO: describe input' },
        },
        required: ['query'],
      },
      output_schema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
      implementation: {
        runtime: 'agentiq-os',
        entrypoint: 'TODO: your skill entrypoint',
      },
    };
  }

  if (type === 'WorkflowQube') {
    return {
      ...base,
      steps: [
        { id: 'step_1', action: 'TODO: define workflow step', depends_on: [] },
        { id: 'step_2', action: 'TODO: define next step', depends_on: ['step_1'] },
      ],
      trigger: 'manual',
    };
  }

  // ConnectorQube
  return {
    ...base,
    protocol: 'TODO: REST | GraphQL | gRPC | WebSocket',
    base_url: 'TODO: https://your-api.example.com',
    auth: {
      type: 'TODO: bearer | api_key | oauth2',
      header: 'Authorization',
    },
    endpoints: [
      {
        id: 'endpoint_1',
        method: 'GET',
        path: '/TODO',
        description: 'TODO: describe endpoint',
      },
    ],
  };
}
