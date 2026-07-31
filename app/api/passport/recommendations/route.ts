/**
 * Passport recommendations (Phase 4 MVP).
 *
 * POST — a citizen with Stewardship Standing recommends an application or an
 * agent-card URL to the Bureau review queue. Recommendation != admission —
 * the Bureau remains sovereign.
 *
 * GET  — list recommendations for a given application (steward-only).
 *
 * Gate: POST requires the caller's Stewardship Standing >=
 * STEWARDSHIP_RIGHTS_THRESHOLD. Standing is read off crm_persona_reputation
 * via the identity-spine link (personas.id → crm_personas.identity_persona_id).
 *
 * T0 discipline: recommender_persona_id is the T0 spine persona id; it stays
 * server-side except in the row payload visible only to the recommender (via
 * RLS) or stewards (via the service-role queue projection).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

const STEWARDSHIP_RIGHTS_THRESHOLD = 5;

interface CreateBody {
  candidateApplicationId?: string;
  candidateAgentCardUrl?: string;
  recommenderKind?: 'citizen_steward' | 'marketa';
  reason?: string;
  assessmentPayload?: Record<string, unknown>;
}

async function resolveStewardshipStanding(personaId: string): Promise<number | null> {
  const crm = getCrmClient();
  const { data: crmPersona } = await crm
    .from('crm_personas')
    .select('id')
    .eq('identity_persona_id', personaId)
    .maybeSingle();
  if (!crmPersona?.id) return 0;
  const { data, error } = await crm
    .from('crm_persona_reputation')
    .select('standing_stewardship')
    .eq('persona_id', crmPersona.id)
    .maybeSingle();
  if (error) {
    if (error.message.includes('standing_stewardship')) return null; // migration pending
    return 0;
  }
  return Number(data?.standing_stewardship ?? 0);
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as CreateBody;
    const kind = body.recommenderKind ?? 'citizen_steward';

    if (kind === 'citizen_steward') {
      const standing = await resolveStewardshipStanding(persona.personaId);
      if (standing === null) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: Standing schema (20260616100000_standing_keystone.sql) must be applied before stewardship-gated recommendations can be evaluated.',
          },
          { status: 503 },
        );
      }
      if (standing < STEWARDSHIP_RIGHTS_THRESHOLD) {
        return NextResponse.json(
          {
            ok: false,
            code: 'stewardship_rights_insufficient',
            error: `Recommendation rights require Stewardship Standing >= ${STEWARDSHIP_RIGHTS_THRESHOLD}. Yours is ${standing.toFixed(1)}.`,
            standingStewardship: standing,
            threshold: STEWARDSHIP_RIGHTS_THRESHOLD,
          },
          { status: 403 },
        );
      }
    } else if (kind === 'marketa') {
      // Marketa kind is reserved for the system persona (PASSPORT_BUREAU_SYSTEM_PERSONA_ID)
      // or a cartridge admin acting on its behalf. Block self-service.
      const isAdmin =
        persona.cartridgeFlags.isAdmin ||
        persona.cartridgeFlags.adminCartridges.includes(PASSPORT_BUREAU_CARTRIDGE_SLUG);
      if (!isAdmin) {
        return NextResponse.json(
          { ok: false, error: 'Marketa-kind recommendations require Bureau admin authority.' },
          { status: 403 },
        );
      }
    }

    // Exactly one target.
    const hasAppId = typeof body.candidateApplicationId === 'string' && body.candidateApplicationId.length > 0;
    const hasCardUrl = typeof body.candidateAgentCardUrl === 'string' && body.candidateAgentCardUrl.length > 0;
    if (hasAppId === hasCardUrl) {
      return NextResponse.json(
        { ok: false, error: 'Provide exactly one of candidateApplicationId or candidateAgentCardUrl' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { data: inserted, error: insertErr } = await admin
      .from('passport_recommendations')
      .insert({
        tenant_id: 'default',
        candidate_application_id: hasAppId ? body.candidateApplicationId : null,
        candidate_agent_card_url: hasCardUrl ? body.candidateAgentCardUrl : null,
        recommender_persona_id: persona.personaId,
        recommender_kind: kind,
        reason: body.reason ?? null,
        assessment_payload: body.assessmentPayload ?? null,
      })
      .select('id, created_at')
      .single();
    if (insertErr) {
      if (insertErr.message.includes('passport_recommendations')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260616300000_passport_recommendations.sql must be applied before recommendations can be created.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      recommendationId: String(inserted.id),
      createdAt: inserted.created_at,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Recommendation create failed' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const isSteward =
      persona.cartridgeFlags.isAdmin ||
      persona.cartridgeFlags.adminCartridges.includes(PASSPORT_BUREAU_CARTRIDGE_SLUG);
    if (!isSteward) {
      return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const applicationId = url.searchParams.get('applicationId');
    const agentCardUrl = url.searchParams.get('agentCardUrl');
    if (!applicationId && !agentCardUrl) {
      return NextResponse.json(
        { ok: false, error: 'Provide applicationId or agentCardUrl' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    let query = admin
      .from('passport_recommendations')
      .select('id, recommender_kind, reason, assessment_payload, created_at, withdrawn_at, candidate_application_id, candidate_agent_card_url')
      .is('withdrawn_at', null)
      .order('created_at', { ascending: false });
    query = applicationId
      ? query.eq('candidate_application_id', applicationId)
      : query.eq('candidate_agent_card_url', agentCardUrl as string);

    const { data, error } = await query;
    if (error) {
      if (error.message.includes('passport_recommendations')) {
        return NextResponse.json(
          { ok: true, recommendations: [], migrationPending: '20260616300000_passport_recommendations.sql' },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      recommendations: (data ?? []).map((row) => ({
        id: String(row.id),
        recommenderKind: row.recommender_kind,
        reason: row.reason,
        assessmentPayload: row.assessment_payload,
        createdAt: row.created_at,
        candidateApplicationId: row.candidate_application_id,
        candidateAgentCardUrl: row.candidate_agent_card_url,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Recommendation list failed' },
      { status: 500 },
    );
  }
}
