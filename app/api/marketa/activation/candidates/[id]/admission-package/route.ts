/**
 * POST /api/marketa/activation/candidates/[id]/admission-package
 *
 * Stage 3 of the canonical lifecycle (2026-08-05 Agent Bench plan, §3):
 * generates the Constitutional Admission Package for one candidate and
 * delivers it via an Access & Invitations invitation scoped to
 * 'venture-lab'/'partner-operator' (reusing the existing role — "do not
 * invent new names if equivalent roles already exist", operator ruling
 * 2026-07-27 — rather than adding an 'external-agent-operator' role).
 *
 * Generating and delivering this package creates NO authority. The
 * invitation only grants access to the pre-populated Journey; Operator
 * Activation (the operator's own accept, once they open it) remains the
 * sole act that originates delegated authority.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { dbToCandidate } from '@/services/marketa/activation/normalizers';
import { generateAdmissionPackage } from '@/services/marketa/activation/admissionPackage';
import { createAccessInvitation } from '@/services/passport/participationAccess';

export const dynamic = 'force-dynamic';

const JOURNEY_BASE_PATH = '/journey/external-agent-admission';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  // Consistent with this subsystem's existing convention (discover/route.ts)
  // — Marketa's activation routes are not persona-session-gated today;
  // matching the sibling routes here rather than introducing an
  // inconsistent auth requirement on only this one.
  const persona = await getActivePersona(request).catch(() => null);

  let body: { campaignId?: unknown; intendedRecipient?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const campaignId = typeof body.campaignId === 'string' && body.campaignId.trim() ? body.campaignId.trim() : undefined;
  const intendedRecipient = typeof body.intendedRecipient === 'string' ? body.intendedRecipient.trim() : undefined;

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !data) return jsonError('candidate-not-found', 404, error?.message);

  const candidate = dbToCandidate(data as Record<string, unknown>);
  const journeyBaseUrl = new URL(JOURNEY_BASE_PATH, request.nextUrl.origin).toString();

  let invitationCode: string | null = null;
  let invitationError: string | null = null;
  const invite = await createAccessInvitation(supabase, {
    domain: 'venture-lab',
    role: 'partner-operator',
    label: `Constitutional Admission Package — ${candidate.name}`,
    intendedRecipient,
    issuerPersonaId: persona?.personaId ?? 'marketa',
    campaignId,
    externalAgentRef: candidate.registryProvider && candidate.onChainAgentId
      ? `${candidate.registryProvider}:${candidate.registryNetwork ?? ''}:${candidate.onChainAgentId}`
      : undefined,
    requestedServiceDomain: 'financial-services',
  });
  if (invite.ok) {
    invitationCode = invite.rawCode;
  } else {
    invitationError = invite.error;
  }

  const admissionPackage = generateAdmissionPackage(candidate, {
    journeyBaseUrl,
    campaignId,
    invitationId: invite.ok ? invite.invitation.id : undefined,
  });

  await supabase
    .schema('marketa')
    .from('marketa_activation_events')
    .insert({
      candidate_agent_id: candidate.id,
      event_type: 'admission_package_generated',
      summary: `Constitutional Admission Package generated for ${candidate.name}${invite.ok ? ' and delivered via invitation' : ' (invitation delivery failed)'}`,
      actor: persona?.personaId ?? 'marketa',
    })
    .then(() => undefined, () => undefined);

  return NextResponse.json(
    {
      ok: true,
      package: admissionPackage,
      // The raw invitation code is shown ONCE, same discipline as every other
      // Access & Invitations issuance — the caller must relay it now.
      invitationCode,
      invitationError,
      note:
        'Package delivery creates no authority. Operator Activation — the operator opening the Journey link and accepting ' +
        'sponsorship — remains the sole act that originates delegated authority.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
