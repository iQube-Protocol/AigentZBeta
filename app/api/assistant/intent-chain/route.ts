/**
 * GET /api/assistant/intent-chain?intentId=<uuid>
 *
 * Returns the orchestration_events timeline for a single IntentQube,
 * plus any attached intent_chains row when the intent kicked off a
 * declarative chain.
 *
 * Powers the click-to-expand on workbench-ledger pills — surfaces
 * "Aigent Z → Marketa", "specialist replied", "artifact sent",
 * "chain advanced", etc., so the operator can see the chain of intent
 * behind the headline pill label.
 *
 * Auth: spine-resolved. The caller must own the intent — we look up
 * the nbe_plans row and require persona_id match before returning any
 * events. Receipt-eligible events live in orchestration_events; we
 * filter them by metadata->>intent_id.
 *
 * Privacy: T0 fields are never serialized. The events returned are
 * already T1-safe (sanitizeReceiptMetadata strips persona/auth ids
 * before insertion); we just surface them.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getIntentQube, getChildIntents } from '@/services/iqube/intentQube';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

interface TimelineEvent {
  eventId: string;
  eventType: string;
  fromRole: string;
  toRole: string;
  reason: string;
  cartridge: string | null;
  receiptEligible: boolean;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

interface AttachedChain {
  chainId: string;
  templateId: string;
  templateVersion: number | null;
  status: string;
  currentStepId: string | null;
  currentStepIndex: number | null;
  totalSteps: number | null;
  costQc: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface AttachedSpecialistResponse {
  title: string;
  summary: string;
  recommendations: string[];
  suggestedArtifacts: string[];
  confidence: 'low' | 'medium' | 'high';
  source: 'llm' | 'template';
}

interface AttachedReceipt {
  receiptId: string;
  /** intentId this receipt was filed against — root or a child/grandchild intent */
  intentId: string;
  actionType: string;
  summary: string;
  agentsInvoked: string[];
  toolsUsed: string[];
  artifactsCreated: string[];
  receiptStatus: string;
  specialistResponse: AttachedSpecialistResponse | null;
  /** Connector to call when the operator dispatches this artifact. Null for runtime-only artifacts. */
  actionConnectorId: string | null;
  actionConnectorLabel: string | null;
  actionInput: Record<string, unknown> | null;
  createdAt: string;
}

interface ChildIntentSummary {
  intentId: string;
  intentName: string;
  status: string;
  /** Generation depth relative to the queried root: 1 = child, 2 = grandchild */
  depth: number;
}

interface IntentChainResponse {
  intent: {
    intentId: string;
    intentName: string;
    intentType: string;
    cartridge: string;
    status: string;
    targetAgents: string[];
    createdAt: string;
  };
  events: TimelineEvent[];
  receipts: AttachedReceipt[];
  chain: AttachedChain | null;
  childIntents: ChildIntentSummary[];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }

  const url = new URL(req.url);
  const intentId = url.searchParams.get('intentId');
  if (!intentId) {
    return NextResponse.json({ error: 'missing-intentId' }, { status: 400 });
  }

  const intent = await getIntentQube(intentId);
  if (!intent) {
    return NextResponse.json({ error: 'intent-not-found' }, { status: 404 });
  }
  if (intent.personaId !== persona.personaId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json({ error: 'db-unavailable' }, { status: 503 });
  }

  // Pull every orchestration event whose metadata.intent_id matches +
  // every activity_receipt rowed against this intent_id. The receipts
  // carry the specialist consultation outputs (summary text, artifact
  // refs) that the operator wants to see when expanding a pill — the
  // orchestration_events alone don't show "Marketa drafted X".
  // Also fetch child intents spawned from this parent's recommendations.
  // Both queries are bounded; most intents have <20 events / receipts.
  const childIntentRecords = await getChildIntents(intentId, persona.personaId).catch(() => []);
  // Fetch grandchildren (depth 2) so all 3 generations are visible in the chain panel.
  const grandchildRecords = (
    await Promise.all(
      childIntentRecords.map((c) => getChildIntents(c.id, persona.personaId).catch(() => [])),
    )
  ).flat();

  // Collect all intentIds to query — root + every child/grandchild so their
  // artifacts and specialist receipts appear in the unified timeline.
  const allIntentIds = [
    intentId,
    ...childIntentRecords.map((c) => c.id),
    ...grandchildRecords.map((c) => c.id),
  ];

  // Select all columns so the query works whether or not the optional
  // connector-metadata columns (action_connector_id etc.) have been
  // migrated yet. Avoids a 500 when the schema is one migration behind.
  const [eventsRes, receiptsRes] = await Promise.all([
    sb
      .from('orchestration_events')
      .select(
        'event_id, event_type, from_role, to_role, reason, active_cartridge, receipt_eligible, created_at, metadata',
      )
      .eq('metadata->>intent_id', intentId)
      .order('created_at', { ascending: true })
      .limit(200),
    sb
      .from('activity_receipts')
      .select('*')
      .in('intent_id', allIntentIds)
      .eq('persona_id', persona.personaId)
      .order('created_at', { ascending: true })
      .limit(200),
  ]);

  if (eventsRes.error) {
    return NextResponse.json(
      { error: 'events-query-failed', detail: eventsRes.error.message },
      { status: 500 },
    );
  }

  const events: TimelineEvent[] = (eventsRes.data ?? []).map((r) => ({
    eventId: String(r.event_id),
    eventType: String(r.event_type),
    fromRole: String(r.from_role ?? ''),
    toRole: String(r.to_role ?? ''),
    reason: String(r.reason ?? ''),
    cartridge: r.active_cartridge ? String(r.active_cartridge) : null,
    receiptEligible: Boolean(r.receipt_eligible),
    recordedAt: String(r.created_at),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }));

  // activity_receipts may not be queryable (table missing in some envs).
  // Treat error as empty rather than failing the whole expand.
  const receipts: AttachedReceipt[] = (receiptsRes.error ? [] : receiptsRes.data ?? []).map((r) => ({
    receiptId: String(r.id),
    intentId: String(r.intent_id),
    actionType: String(r.action_type),
    summary: String(r.summary ?? ''),
    agentsInvoked: Array.isArray(r.agents_invoked) ? (r.agents_invoked as string[]) : [],
    toolsUsed: Array.isArray(r.tools_used) ? (r.tools_used as string[]) : [],
    artifactsCreated: Array.isArray(r.artifacts_created) ? (r.artifacts_created as string[]) : [],
    receiptStatus: String(r.receipt_status ?? 'local'),
    specialistResponse: (r.specialist_response as AttachedSpecialistResponse | null) ?? null,
    actionConnectorId: typeof r.action_connector_id === 'string' ? r.action_connector_id : null,
    actionConnectorLabel: typeof r.action_connector_label === 'string' ? r.action_connector_label : null,
    actionInput: (r.action_input as Record<string, unknown> | null) ?? null,
    createdAt: String(r.created_at),
  }));

  // Optional: surface an attached intent_chains row if any of the
  // events carry a chain_id. The chain is the richer surface (step
  // history + cost + status) — UI can deep-link into the chain
  // detail drawer when present.
  let chain: AttachedChain | null = null;
  const chainEventId = events
    .map((e) => (typeof e.metadata?.chain_id === 'string' ? (e.metadata.chain_id as string) : null))
    .find((id): id is string => !!id);

  if (chainEventId) {
    const { data: chainRow } = await sb
      .from('intent_chains')
      .select(
        'id, template_id, template_version, status, current_step_id, current_step_index, total_steps, cost_qc, started_at, completed_at',
      )
      .eq('id', chainEventId)
      .maybeSingle();
    if (chainRow) {
      chain = {
        chainId: String(chainRow.id),
        templateId: String(chainRow.template_id),
        templateVersion: typeof chainRow.template_version === 'number' ? chainRow.template_version : null,
        status: String(chainRow.status),
        currentStepId: chainRow.current_step_id ? String(chainRow.current_step_id) : null,
        currentStepIndex:
          typeof chainRow.current_step_index === 'number' ? chainRow.current_step_index : null,
        totalSteps: typeof chainRow.total_steps === 'number' ? chainRow.total_steps : null,
        costQc: typeof chainRow.cost_qc === 'number' ? chainRow.cost_qc : null,
        startedAt: String(chainRow.started_at),
        completedAt: chainRow.completed_at ? String(chainRow.completed_at) : null,
      };
    }
  }

  const childIntents: ChildIntentSummary[] = [
    ...childIntentRecords.map((c) => ({
      intentId: c.id,
      intentName: c.intentName,
      status: c.status,
      depth: 1,
    })),
    ...grandchildRecords.map((c) => ({
      intentId: c.id,
      intentName: c.intentName,
      status: c.status,
      depth: 2,
    })),
  ];

  const body: IntentChainResponse = {
    intent: {
      intentId: intent.id,
      intentName: intent.intentName,
      intentType: intent.intentType,
      cartridge: intent.activeCartridge,
      status: intent.status,
      targetAgents: intent.targetAgents,
      createdAt: intent.createdAt,
    },
    events,
    receipts,
    chain,
    childIntents,
  };

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
