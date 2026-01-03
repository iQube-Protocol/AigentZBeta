import { createClient } from '@supabase/supabase-js';

import type {
  CampaignDefinition,
  CampaignEventInput,
  CampaignState,
  CampaignStateView,
} from '@/types/campaign';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { CAMPAIGN_REGISTRY, getCampaignDefinition } from './campaignRegistry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

const PHASE_COUNTER_PREFIX = 'phase:';

function buildInitialState(definition: CampaignDefinition, personaId: string): Omit<CampaignState, 'id' | 'updatedAt'> {
  const startedAt = new Date().toISOString();
  return {
    campaignId: definition.id,
    personaId,
    tenantId: definition.tenantId,
    franchiseId: definition.franchiseId,
    progress: 0,
    currentPhaseId: definition.phases[0]?.id ?? null,
    state: {
      startedAt,
      phases: definition.phases.map((phase) => ({
        id: phase.id,
        label: phase.label,
        targetCount: phase.targetCount,
        counterKey: phase.counterKey,
      })),
      counters: {},
    },
  };
}

function normalizeStateRow(row: any): CampaignState {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    personaId: row.persona_id,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
    progress: row.progress ?? 0,
    currentPhaseId: row.current_phase_id,
    state: row.state || { startedAt: new Date().toISOString(), phases: [], counters: {} },
    updatedAt: row.updated_at,
  };
}

function buildStateView(definition: CampaignDefinition, state: CampaignState): CampaignStateView {
  const completedSteps = state.state.phases
    .map((phase, index) => (phase.completedAt ? index + 1 : null))
    .filter((index): index is number => Boolean(index));

  const completedCount = completedSteps.length;
  const totalSteps = definition.phases.length;
  const currentStep = completedCount >= totalSteps ? totalSteps : completedCount + 1;

  return {
    campaignId: definition.id,
    title: definition.title,
    group: definition.group,
    personaId: state.personaId,
    progress: state.progress,
    currentStep,
    totalSteps,
    completedSteps,
    phases: definition.phases,
    counters: state.state.counters || {},
  };
}

function applyEventToState(
  definition: CampaignDefinition,
  state: CampaignState,
  eventType: string,
  nowIso: string
): CampaignState {
  const counters = { ...(state.state.counters || {}) };
  const phases = state.state.phases.length
    ? state.state.phases.map((phase) => ({ ...phase }))
    : definition.phases.map((phase) => ({
        id: phase.id,
        label: phase.label,
        targetCount: phase.targetCount,
        counterKey: phase.counterKey,
      }));

  const matchingIndex = definition.phases.findIndex((phase) => phase.eventTypes.includes(eventType));
  if (matchingIndex === -1) {
    return { ...state, state: { ...state.state, counters, phases } };
  }

  const matchingPhase = definition.phases[matchingIndex];
  const counterKey = matchingPhase.counterKey || `${PHASE_COUNTER_PREFIX}${matchingPhase.id}`;
  counters[counterKey] = (counters[counterKey] || 0) + 1;

  for (let index = 0; index < definition.phases.length; index += 1) {
    const phaseDef = definition.phases[index];
    const phaseState = phases[index];

    if (phaseState?.completedAt) {
      continue;
    }

    const previousComplete = phases.slice(0, index).every((phase) => Boolean(phase.completedAt));
    if (!previousComplete) {
      break;
    }

    const phaseCounterKey = phaseDef.counterKey || `${PHASE_COUNTER_PREFIX}${phaseDef.id}`;
    const targetCount = phaseDef.targetCount ?? 1;
    const currentCount = counters[phaseCounterKey] || 0;

    if (currentCount >= targetCount) {
      phases[index] = {
        ...phaseState,
        completedAt: nowIso,
      };
    } else {
      break;
    }
  }

  const completedCount = phases.filter((phase) => Boolean(phase.completedAt)).length;
  const totalSteps = definition.phases.length || 1;
  const progress = Number(((completedCount / totalSteps) * 100).toFixed(2));
  const currentPhaseId = phases.find((phase) => !phase.completedAt)?.id ?? null;

  return {
    ...state,
    progress,
    currentPhaseId,
    state: {
      ...state.state,
      phases,
      counters,
    },
  };
}

export async function recordCampaignEvent(input: CampaignEventInput) {
  const definition = getCampaignDefinition(input.campaignId);
  if (!definition) {
    return { eventId: null, stateView: null };
  }

  const supabase = getSupabase();
  const tenantId = input.tenantId || definition.tenantId;
  const franchiseId = input.franchiseId || definition.franchiseId;
  const nowIso = new Date().toISOString();

  const { data: eventRow, error: eventError } = await supabase
    .from('campaign_events')
    .insert({
      campaign_id: definition.id,
      persona_id: input.personaId,
      referrer_persona_id: input.referrerPersonaId || null,
      event_type: input.eventType,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      content_id: input.contentId || null,
      source: input.source || null,
      metadata: input.metadata || null,
    })
    .select('id')
    .single();

  if (eventError) {
    console.error('[CampaignService] Failed to record event:', eventError);
  }

  const { data: existingState, error: stateError } = await supabase
    .from('campaign_states')
    .select('*')
    .eq('campaign_id', definition.id)
    .eq('persona_id', input.personaId)
    .maybeSingle();

  if (stateError) {
    console.error('[CampaignService] Failed to fetch campaign state:', stateError);
  }

  const baseState = existingState
    ? normalizeStateRow(existingState)
    : ({
        ...buildInitialState(definition, input.personaId),
        id: '',
        updatedAt: nowIso,
      } as CampaignState);

  const updatedState = applyEventToState(definition, baseState, input.eventType, nowIso);

  const upsertPayload = {
    campaign_id: definition.id,
    persona_id: input.personaId,
    tenant_id: tenantId,
    franchise_id: franchiseId,
    progress: updatedState.progress,
    current_phase_id: updatedState.currentPhaseId,
    state: updatedState.state,
    updated_at: nowIso,
  };

  const { data: savedState, error: upsertError } = await supabase
    .from('campaign_states')
    .upsert(upsertPayload, { onConflict: 'campaign_id,persona_id' })
    .select('*')
    .single();

  if (upsertError) {
    console.error('[CampaignService] Failed to update campaign state:', upsertError);
  }

  const stateForView = savedState ? normalizeStateRow(savedState) : updatedState;

  return {
    eventId: eventRow?.id || null,
    stateView: buildStateView(definition, stateForView),
  };
}

export async function updateCampaignEventDvn(eventId: string, dvnMessageId: string) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('campaign_events')
    .update({ dvn_message_id: dvnMessageId })
    .eq('id', eventId);

  if (error) {
    console.error('[CampaignService] Failed to update DVN message id:', error);
  }
}

export async function submitCampaignEventToDvn(payload: Record<string, unknown>) {
  const canisterId =
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  const mockMode =
    process.env.DVN_MOCK_MODE === 'true' || process.env.NEXT_PUBLIC_DVN_MOCK_MODE === 'true';

  if (!canisterId) {
    return { ok: false, skipped: true, error: 'DVN canister not configured' };
  }

  const messageId = `campaign_${Date.now()}`;
  const payloadBytes = Array.from(new TextEncoder().encode(JSON.stringify(payload)));

  if (mockMode) {
    return { ok: true, mockMode: true, messageId: `mock_${messageId}` };
  }

  try {
    const dvn = await getActor<any>(canisterId, dvnIdl);
    const response = await dvn.submit_dvn_message(11155111, 0, payloadBytes, messageId);
    const resolvedMessageId = typeof response === 'string' ? response : messageId;
    return { ok: true, messageId: resolvedMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit DVN message';
    console.error('[CampaignService] DVN submission failed:', message);
    return { ok: false, error: message };
  }
}

export async function emitCampaignEvent(input: CampaignEventInput) {
  const payload = {
    type: 'campaign_event',
    ...input,
    ts: Date.now(),
  };

  const { eventId, stateView } = await recordCampaignEvent(input);
  if (!eventId) {
    return { eventId, stateView, dvnMessageId: null, dvnOk: false };
  }

  const dvnResult = await submitCampaignEventToDvn(payload);
  if (dvnResult.ok && dvnResult.messageId) {
    await updateCampaignEventDvn(eventId, dvnResult.messageId);
  }

  return {
    eventId,
    stateView,
    dvnMessageId: dvnResult.ok ? dvnResult.messageId : null,
    dvnOk: dvnResult.ok,
  };
}

export async function getCampaignStateViewsForPersona(personaId: string): Promise<CampaignStateView[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('campaign_states')
    .select('*')
    .eq('persona_id', personaId);

  if (error) {
    console.error('[CampaignService] Failed to fetch campaign states:', error);
  }

  const stateRows = (data || []).map((row) => normalizeStateRow(row));
  const stateMap = new Map(stateRows.map((state) => [state.campaignId, state]));

  return Object.values(CAMPAIGN_REGISTRY).map((definition) => {
    const existingState = stateMap.get(definition.id);
    if (existingState) {
      return buildStateView(definition, existingState);
    }

    const transientState: CampaignState = {
      ...buildInitialState(definition, personaId),
      id: '',
      updatedAt: new Date().toISOString(),
    };

    return buildStateView(definition, transientState);
  });
}
