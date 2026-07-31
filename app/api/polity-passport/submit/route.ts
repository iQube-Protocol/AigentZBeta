/**
 * POST /api/polity-passport/submit — participant passport application.
 *
 * Machine surface (PRD §10 steps 1–6): agents/robots/organizations submit
 * applications as JSON conforming to
 * participant-passport.application.schema.json (served at
 * /api/polity-passport/schemas/participant-passport.application.schema.json).
 *
 * Validation is shared with /api/polity-passport/validate. On success the
 * application row is written (application_payload carries the full submitted
 * body — participant application material is registry-listing-public by
 * design, unlike citizen private data which NEVER lands here) and the
 * passport_application_submitted receipt rides the canonical pipeline.
 *
 * Signature handling (v0.1): an optional top-level `signature` object is
 * recorded with status 'recorded_unverified'. Full signed-JSON verification
 * (key format + canonicalization spec) is a documented v0.2 item — see
 * polity-passport-bureau/README.md.
 *
 * Receipts: machine submissions have no spine persona. When
 * PASSPORT_BUREAU_SYSTEM_PERSONA_ID is set, the receipt is written under the
 * Bureau system persona; otherwise receipt emission is skipped with an
 * escalation log (the application row itself is never lost).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { validateParticipantApplication } from '@/services/passport/participantApplicationValidator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const result = validateParticipantApplication(body);
    if (!result.valid) {
      return NextResponse.json(
        { ok: false, valid: false, issues: result.issues },
        { status: 422 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase configuration missing' },
        { status: 500 },
      );
    }

    const payload = body as Record<string, unknown>;
    const agentIdentity = payload.agent_identity as Record<string, unknown>;
    const agentCard = agentIdentity.agent_card as Record<string, unknown>;
    const participant = payload.participant as Record<string, unknown>;
    const request = payload.passport_request as Record<string, unknown>;
    const protocols = Array.isArray(agentIdentity.supported_protocols)
      ? (agentIdentity.supported_protocols as unknown[]).map(String)
      : [];

    const agentCardUrl = String(agentCard.agent_card_url);

    // One open application per agent card URL.
    const { data: openApps } = await admin
      .from('polity_passport_applications')
      .select('id, application_status')
      .eq('agent_card_url', agentCardUrl)
      .in('application_status', ['submitted', 'pending_approval', 'needs_more_information'])
      .limit(1);
    if (openApps && openApps.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'An open application already exists for this agent card',
          applicationId: String(openApps[0].id),
          applicationStatus: String(openApps[0].application_status),
        },
        { status: 409 },
      );
    }

    const signature = payload.signature;
    const applicationPayload = {
      ...payload,
      ...(signature !== undefined
        ? { signature_status: 'recorded_unverified' }
        : {}),
    };

    const { data: appRow, error: insertError } = await admin
      .from('polity_passport_applications')
      .insert({
        passport_class: result.passportClass,
        application_status: 'submitted',
        agent_card_url: agentCardUrl,
        agent_protocol: protocols[0] ?? null,
        personhood_proof_type: 'agent_declaration',
        personhood_proof_ref: `agent-card:${agentCardUrl}`,
        personhood_proof_at: new Date().toISOString(),
        passport_grade: String(request.requested_passport_type),
        requested_domains: Array.isArray(request.requested_scope)
          ? request.requested_scope
          : [],
        consents: payload.consents,
        application_payload: applicationPayload,
        submitted_at: new Date().toISOString(),
      })
      .select('id, application_status')
      .single();
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    let receiptId: string | null = null;
    const systemPersonaId = process.env.PASSPORT_BUREAU_SYSTEM_PERSONA_ID;
    if (systemPersonaId) {
      try {
        const receipt = await createActivityReceipt({
          personaId: systemPersonaId,
          activeCartridge: 'polity-passport-bureau',
          actionType: 'passport_application_submitted',
          summary: `Participant passport application submitted: ${String(
            participant.display_name,
          )} (${result.passportClass})`,
          contextShared: ['agent-card'],
        });
        receiptId = receipt?.id ?? null;
      } catch (e) {
        console.error('[polity-passport submit] receipt write failed:', e);
      }
    } else {
      console.error(
        '[polity-passport submit] PASSPORT_BUREAU_SYSTEM_PERSONA_ID unset — submission receipt skipped for application',
        String(appRow.id),
      );
    }

    return NextResponse.json({
      ok: true,
      applicationId: String(appRow.id),
      applicationStatus: String(appRow.application_status),
      passportClass: result.passportClass,
      receiptId,
      statusUrl: `/api/polity-passport/status/${String(appRow.id)}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Submission failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
