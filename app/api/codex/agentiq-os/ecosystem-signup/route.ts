/**
 * POST /api/codex/agentiq-os/ecosystem-signup
 *
 * Records a developer as a nanOS Bridge candidate. Emits a receipt-eligible
 * OrchestrationEvent and upserts the developer into the CRM (nakamoto_knyt_personas)
 * as campaign_cohort = 'agentiq_developer' so Marketa can run onboarding sequences.
 *
 * Called at:
 *   - Persona creation (bridge_stage: open_onboarding) — DevPersonaTab
 *   - Mission track completion — DevMissionBoardTab (developer_active, contributor_candidate, …)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

const BRIDGE_STAGES = [
  'open_onboarding',
  'developer_active',
  'contributor_candidate',
  'registry_candidate',
  'studio_candidate',
  'partner_candidate',
  'nanos_onboarded',
] as const;

type BridgeStage = typeof BRIDGE_STAGES[number];

// Bridge stage → CRM campaign_state mapping.
// campaign_state tracks email-readiness for Marketa: 'unsent' = ready to receive first outreach.
// Advancing stages adds journey context to notes/tags without overwriting the email state machine.
const STAGE_TO_CRM_NOTES: Record<BridgeStage, string> = {
  open_onboarding:        'AgentiQ OS: persona created, onboarding started',
  developer_active:       'AgentiQ OS: completed beginner track — SDK installed, protocols read',
  contributor_candidate:  'AgentiQ OS: completed builder track — persona, delegation, copilot active',
  registry_candidate:     'AgentiQ OS: completed registry track — asset registered',
  studio_candidate:       'AgentiQ OS: completed advanced track — cartridge built',
  partner_candidate:      'AgentiQ OS: completed ecosystem track — docs contributed',
  nanos_onboarded:        'AgentiQ OS: nanOS bridge onboarded',
};

const STAGE_TO_TAGS: Record<BridgeStage, string[]> = {
  open_onboarding:        ['agentiq_os', 'developer_signup'],
  developer_active:       ['agentiq_os', 'developer_active'],
  contributor_candidate:  ['agentiq_os', 'contributor_candidate'],
  registry_candidate:     ['agentiq_os', 'registry_candidate'],
  studio_candidate:       ['agentiq_os', 'studio_candidate'],
  partner_candidate:      ['agentiq_os', 'partner_candidate'],
  nanos_onboarded:        ['agentiq_os', 'nanos_onboarded'],
};

function getCrmClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsertDevCohort(opts: {
  persona_id: string;
  stage: BridgeStage;
  display_name?: string;
  email?: string;
}): Promise<string | null> {
  const { persona_id, stage, display_name, email } = opts;
  const client = getCrmClient();

  const [firstName, ...rest] = (display_name ?? '').trim().split(' ');
  const lastName = rest.join(' ');

  // Check for existing record by platform_auth_profile_id (persona_id acts as platform ID here)
  const { data: existing } = await client
    .from('nakamoto_knyt_personas')
    .select('id, campaign_tags')
    .eq('platform_auth_profile_id', persona_id)
    .maybeSingle();

  if (existing) {
    // Merge new stage tag without dropping existing tags
    const existingTags: string[] = Array.isArray(existing.campaign_tags) ? existing.campaign_tags : [];
    const newTags = STAGE_TO_TAGS[stage];
    const mergedTags = [...new Set([...existingTags, ...newTags])];

    await client
      .from('nakamoto_knyt_personas')
      .update({
        campaign_cohort: 'agentiq_developer',
        campaign_notes: STAGE_TO_CRM_NOTES[stage],
        campaign_tags: mergedTags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    return existing.id;
  }

  // Insert new developer record
  const { data: inserted } = await client
    .from('nakamoto_knyt_personas')
    .insert({
      'First-Name':              firstName || null,
      'Last-Name':               lastName  || null,
      'Email':                   email     || null,
      campaign_cohort:           'agentiq_developer',
      campaign_state:            'unsent',
      campaign_notes:            STAGE_TO_CRM_NOTES[stage],
      campaign_tags:             STAGE_TO_TAGS[stage],
      platform_auth_profile_id:  persona_id,
      platform_activated_at:     new Date().toISOString(),
    })
    .select('id')
    .single();

  return inserted?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      persona_id,
      bridge_stage,
      display_name,
      email,
      completed_missions = [],
      notes,
    } = body as {
      persona_id?: string;
      bridge_stage?: BridgeStage;
      display_name?: string;
      email?: string;
      completed_missions?: string[];
      notes?: string;
    };

    if (!persona_id || typeof persona_id !== 'string') {
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    }

    const stage = (BRIDGE_STAGES.includes(bridge_stage as BridgeStage)
      ? bridge_stage
      : 'open_onboarding') as BridgeStage;

    const eventId = `signup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Emit OrchestrationEvent (non-blocking — fire and forget)
    void emitOrchestrationEvent({
      event_id: eventId,
      timestamp: new Date().toISOString(),
      event_type: 'z_delegated',
      from_role: 'aigent-z',
      to_role: 'aigent-c',
      reason: `AgentiQ OS ecosystem signup: ${stage} — persona ${persona_id}`,
      journey_stage: 'acolyte',
      active_cartridge: 'agentiq-os-cartridge',
      active_codex: 'agentiq-os-cartridge',
      receipt_eligible: true,
      metadata: {
        ecosystem_signup: true,
        bridge_stage: stage,
        persona_id,
        display_name: display_name ?? 'anonymous',
        completed_missions,
        notes: notes ?? '',
        agent_root_did: 'did:iqube:aigent-c-os-root',
        nanos_bridge_candidate: stage !== 'open_onboarding',
      },
    });

    // Upsert into CRM dev cohort so Marketa can run outreach sequences
    let crmId: string | null = null;
    try {
      crmId = await upsertDevCohort({ persona_id, stage, display_name, email });
    } catch (crmErr) {
      // CRM write is non-fatal — OrchestrationEvent is the canonical record
      console.error('[ecosystem-signup] CRM upsert failed (non-fatal):', crmErr);
    }

    const stageIndex = BRIDGE_STAGES.indexOf(stage);
    const nextStage = stageIndex < BRIDGE_STAGES.length - 1
      ? BRIDGE_STAGES[stageIndex + 1]
      : null;

    return NextResponse.json({
      ok: true,
      event_id: eventId,
      persona_id,
      bridge_stage: stage,
      next_stage: nextStage,
      crm_id: crmId,
      receipt_eligible: true,
      message: stage === 'nanos_onboarded'
        ? 'Welcome to the nanOS ecosystem. The metaMe team will be in touch.'
        : `Registered as ${stage.replace(/_/g, ' ')}. Complete your next milestone to advance to ${nextStage?.replace(/_/g, ' ') ?? 'the final stage'}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
