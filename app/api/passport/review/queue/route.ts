/**
 * GET /api/passport/review/queue — steward review queue.
 *
 * PRD §4.5, §14. Lists open applications for stewards. Gate: spine
 * cartridge-admin (operator decision 3) — cartridgeFlags.isAdmin OR
 * adminCartridges includes 'polity-passport-bureau'. The queue projection
 * excludes T0 identity refs and vault refs — stewards review the
 * application material, not the holder's identity anchors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';

export const dynamic = 'force-dynamic';

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

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase configuration missing' },
        { status: 500 },
      );
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');
    const statuses =
      statusFilter && ['submitted', 'pending_approval', 'needs_more_information'].includes(statusFilter)
        ? [statusFilter]
        : ['submitted', 'pending_approval', 'needs_more_information'];

    const { data, error } = await admin
      .from('polity_passport_applications')
      .select(
        'id, passport_class, application_status, passport_grade, personhood_proof_type, agent_card_url, application_payload, review_priority, assigned_steward_id, submitted_at, created_at',
      )
      .in('application_status', statuses)
      .order('submitted_at', { ascending: true })
      .limit(100);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Phase 4 — recommendation counts per application (single batched query).
    const appIds = (data ?? []).map((r) => String(r.id));
    const recommendationCountByApp: Record<string, number> = {};
    if (appIds.length > 0) {
      const { data: recs, error: recsErr } = await admin
        .from('passport_recommendations')
        .select('candidate_application_id')
        .in('candidate_application_id', appIds)
        .is('withdrawn_at', null);
      // Pre-migration soft-fail — leave the map empty rather than 500ing the
      // whole queue when 20260616300000 hasn't been applied yet.
      if (!recsErr) {
        for (const r of recs ?? []) {
          const aid = String(r.candidate_application_id);
          recommendationCountByApp[aid] = (recommendationCountByApp[aid] ?? 0) + 1;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      queue: (data ?? []).map((row) => ({
        applicationId: String(row.id),
        passportClass: row.passport_class,
        applicationStatus: row.application_status,
        passportGrade: row.passport_grade,
        personhoodProofType: row.personhood_proof_type,
        agentCardUrl: row.agent_card_url,
        applicationPayload: row.application_payload,
        reviewPriority: row.review_priority,
        // assigned_steward_id is a persona id (T0) — only a boolean projects.
        hasAssignedSteward: Boolean(row.assigned_steward_id),
        recommendationCount: recommendationCountByApp[String(row.id)] ?? 0,
        submittedAt: row.submitted_at,
        createdAt: row.created_at,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Queue lookup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
