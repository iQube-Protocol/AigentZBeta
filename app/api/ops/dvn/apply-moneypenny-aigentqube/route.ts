import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/dvn/apply-moneypenny-aigentqube
 *
 * Applies the DML content of two EXISTING, already-authored migrations —
 * never a substitute seed — for the ONE object the migration-ledger
 * diagnostic proved still missing after the operator's schema repair
 * (Horizen Pilot Closure — AigentQube Entrance Gate, 2026-08-09):
 *
 *   - supabase/migrations/20260930000400_aigentqube_moneypenny_registry_asset.sql
 *       (registry_assets row + iqube_id_map row)
 *   - supabase/migrations/20260930002300_moneypenny_runtime_endpoint.sql
 *       (registry_assets.metadata.runtime merge)
 *
 * These migrations are pure DML (INSERT/UPDATE) — no ALTER TABLE, no CREATE
 * INDEX — so they can be executed via the same PostgREST Data API this route
 * already uses everywhere else; no exec_sql RPC is needed (confirmed absent
 * by /api/ops/dvn/migration-ledger). This route does not invent any field:
 * every value below is copied verbatim from the two migration files.
 *
 * Idempotent: if the row already exists, the insert step is skipped and
 * reported, never overwritten (mirrors the migrations' own
 * ON CONFLICT (asset_id) DO UPDATE guard that preserves an already-confirmed
 * token_id rather than blindly overwriting it with null).
 *
 * After the base row exists, calls the ONE canonical registration-binding
 * reconciler (services/horizen/agentRegistrationBinding.ts
 * resolveAgentRegistrationState) — never hand-authors token 8872 into the
 * metadata here. That resolver already knows how to recover a confirmed
 * tokenId from Horizen registration receipts when the registry_assets
 * projection hasn't caught up (exactly MoneyPenny's situation), and persists
 * the result as a settled fact other surfaces already read.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/dvn/*
 * infra routes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  const ASSET_ID = 'aigentqube-moneypenny';
  const result: Record<string, unknown> = {};

  // ── 20260930000400: registry_assets row (verbatim from the migration) ────
  const { data: existingAsset } = await admin.from('registry_assets').select('asset_id').eq('asset_id', ASSET_ID).maybeSingle();
  if (existingAsset) {
    result.registryAsset = { applied: false, reason: 'already present' };
  } else {
    const { error: insertError } = await admin.from('registry_assets').insert({
      asset_id: ASSET_ID,
      tenant_id: 'platform',
      asset_class: 'AigentQube',
      name: 'Aigent MoneyPenny',
      slug: 'aigent-moneypenny',
      description:
        'The Constitutional Financial Services Agent (PRD-MPY-001). MoneyPenny is the financial-services specialization of the platform\'s constitutional reasoning pipeline. She operates in three modes: Advisor (grounded, cited financial guidance — read-only), Architect (designs pricing models, fee splits, settlement-terms, delegation envelopes and agreement templates), and Runtime (executes financial actions within bounded, receipted, delegated authority). MoneyPenny is a delegate, never a principal.',
      current_version: '1.0.0',
      trust_band: 'L4_PRODUCTION_APPROVED',
      publication_status: 'published',
      policy_class: 'human_approval_required',
      wrapper_strategy: 'skill',
      interface_schema: {
        input: { message: 'string', personaId: 'string', mode: 'string' },
        output: { response: 'string', artifacts: 'array', receipts: 'array' },
      },
      capabilities: [
        { name: 'financial_advisory', scope: 'conversational' },
        { name: 'financial_structure_design', scope: 'content' },
        { name: 'bounded_financial_execution', scope: 'system' },
        { name: 'chat', scope: 'conversational' },
      ],
      tags: ['finance', 'advisory', 'architect', 'runtime', 'delegate', 'agentiq-native'],
      metadata: {
        agentiq_native: true,
        badge: 'M',
        trust_composite: 82,
        source: 'agentiq_core',
        personaKey: 'aigent-moneypenny',
        modelPreference: 'claude-sonnet-4-6',
        temperature: 0.6,
        cartridgeOverlays: ['AgentiQ'],
        pricingQc: 0,
        receiptEmitted: true,
        trustLevel: 'production',
        metaMePosture: 'standard',
        skillCount: 3,
        policyBindings: [
          { policyId: '409-authorization-gate', policyType: 'behaviour', policyName: 'Bounded Financial Execution Gate', enforced: true },
        ],
        external_registry_bindings: [
          {
            protocol: 'erc-8004',
            registry: 'horizen',
            network: 'base-sepolia',
            identity_registry_contract: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
            token_id: null,
            registry_alias: null,
            status: 'pending-registration',
            agent_card_url: '/api/agents/moneypenny/agent-card.json',
          },
        ],
      },
      created_by: 'agentiq-system',
    });
    result.registryAsset = insertError ? { applied: false, error: insertError.message } : { applied: true };
  }

  // ── 20260930000400: iqube_id_map row ──────────────────────────────────────
  const { data: existingIdMap } = await admin
    .from('iqube_id_map')
    .select('source_id')
    .eq('source', 'registry_asset')
    .eq('source_id', ASSET_ID)
    .maybeSingle();
  if (existingIdMap) {
    result.iqubeIdMap = { applied: false, reason: 'already present' };
  } else {
    const { error: idMapError } = await admin.from('iqube_id_map').insert({
      source: 'registry_asset',
      source_id: ASSET_ID,
      primitive_type: 'AigentQube',
      synthetic: false,
      notes:
        "PRD-GJR-001 Stage 1 — MoneyPenny's canonical AigentQube, backing her Horizen ERC-8004 external-registry binding",
    });
    result.iqubeIdMap = idMapError ? { applied: false, error: idMapError.message } : { applied: true };
  }

  // ── 20260930002300: runtime metadata merge (shallow, 'runtime' key only) ─
  const { data: assetForRuntime } = await admin.from('registry_assets').select('metadata').eq('asset_id', ASSET_ID).maybeSingle();
  const currentMetadata = (assetForRuntime?.metadata as Record<string, unknown> | null) ?? null;
  if (currentMetadata && (currentMetadata as { runtime?: unknown }).runtime) {
    result.runtimeEndpoint = { applied: false, reason: 'already present' };
  } else if (currentMetadata) {
    const { error: runtimeError } = await admin
      .from('registry_assets')
      .update({
        metadata: {
          ...currentMetadata,
          runtime: {
            endpoint: 'https://dev-beta.aigentz.me/api/moneypenny/chat',
            health: 'https://dev-beta.aigentz.me/api/agents/moneypenny/health',
            protocol: 'https',
            version: '1',
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('asset_id', ASSET_ID);
    result.runtimeEndpoint = runtimeError ? { applied: false, error: runtimeError.message } : { applied: true };
  } else {
    result.runtimeEndpoint = { applied: false, reason: 'registry_assets row still unreadable after insert step' };
  }

  // ── Canonical registration-binding reconciliation (never hand-authored) ──
  const agent = resolveRegistrableAgent('moneypenny');
  if (agent) {
    try {
      const registrationState = await resolveAgentRegistrationState(admin, agent);
      result.registrationReconciliation = registrationState;
    } catch (err) {
      result.registrationReconciliation = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Applies the DML content of 20260930000400_aigentqube_moneypenny_registry_asset.sql and ' +
        '20260930002300_moneypenny_runtime_endpoint.sql (idempotent), then reconciles her Horizen ' +
        'registration binding via the canonical resolver. Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
