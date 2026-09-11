import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  ensureBoundaryResearchExchangeMembershipOperatorAssisted,
  OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
} from '@/services/journey/boundaryResearchExchangeAdmission';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/exchanges/operator-assisted-admission
 *
 * Admin-gated invocation surface for the existing, unmodified
 * `ensureBoundaryResearchExchangeMembershipOperatorAssisted` — for a bound
 * principal who cannot themselves reach the ordinary bridge-crossing UI
 * (services/journey/boundaryResearchExchangeAdmission.ts). This route adds
 * nothing beyond: authenticate the operator, resolve the target from a
 * genuine server-side lookup, invoke the canonical service, return its
 * result. Passport usability and research-lab grant scope are re-verified
 * FOR REAL inside the canonical service — this route performs no eligibility
 * logic of its own.
 *
 * Body: { targetPersonaId: string; workspaceId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetPersonaId = typeof body?.targetPersonaId === 'string' ? body.targetPersonaId.trim() : '';
    const workspaceId =
      typeof body?.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID;

    if (!targetPersonaId) {
      return NextResponse.json({ ok: false, error: 'targetPersonaId is required' }, { status: 400 });
    }

    const operatorContext = await getActivePersona(req);
    if (!operatorContext) {
      return NextResponse.json({ ok: false, error: 'authentication required' }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    // Resolve the target from a genuine server-side lookup — never trust a
    // chat-asserted authProfileId. personaId itself is re-verified for real
    // inside the canonical service's own Passport + research-lab-grant checks.
    const { data: targetPersona, error: personaError } = await admin
      .from('personas')
      .select('id, auth_profile_id')
      .eq('id', targetPersonaId)
      .maybeSingle();

    if (personaError) {
      return NextResponse.json({ ok: false, error: personaError.message }, { status: 500 });
    }
    if (!targetPersona) {
      return NextResponse.json({ ok: false, error: `persona ${targetPersonaId} not found` }, { status: 404 });
    }

    const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(admin, {
      operatorContext,
      targetPersonaId: String(targetPersona.id),
      targetAuthProfileId: targetPersona.auth_profile_id ? String(targetPersona.auth_profile_id) : null,
      workspaceId,
    });

    if (!result.ok) {
      const status = result.reason === 'operator-authorization-required' ? 403 : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: 'error' in result ? result.error : undefined },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      exchangeId: result.exchangeId,
      created: result.created,
      role: result.role,
      targetPersonaId,
      workspaceId,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 },
    );
  }
}
