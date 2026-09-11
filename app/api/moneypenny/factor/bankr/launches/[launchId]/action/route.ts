/**
 * POST /api/moneypenny/factor/bankr/launches/[launchId]/action — the real
 * HTTP surface behind Factor's `bankr_tokenization` action descriptors
 * (services/factor/factorCapabilityManifest.ts): preflight, request_aegis,
 * request_approval, submit, inspect_status, fee_claims. `action` selects
 * which services/factor/bankrCapabilityHandlers.ts function runs — this
 * route adds no domain logic of its own, mirroring
 * cases/[caseId]/transition/route.ts's dispatch shape.
 *
 * Deliberately NOT included here: 'approve'. Approving a launch is a
 * separate, MoneyPenny/human-owned surface
 * (launches/[launchId]/approve/route.ts) — Factor's own manifest has no
 * `bankr_tokenization:approve` action, and this route must not invent one
 * (Phase 5/9: Factor never approves its own or anyone's token).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  preflightLaunch,
  requestAegisAssessment,
  requestApproval,
  submitApprovedLaunch,
  inspectDeploymentStatus,
  inspectFeeClaims,
} from '@/services/factor/bankrCapabilityHandlers';
import { respondError, resolveTenantId } from '../../../../_lib/respondError';

export const dynamic = 'force-dynamic';

const ACTIONS = ['preflight', 'request_aegis', 'request_approval', 'submit', 'inspect_status', 'fee_claims'] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ launchId: string }> }) {
  const { launchId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const tenantId = resolveTenantId(body.tenantId);
  const action = body.action;
  if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ ok: false, error: 'unknown-action', detail: `action must be one of: ${ACTIONS.join(', ')}.` }, { status: 400 });
  }

  try {
    if (action === 'preflight') {
      const result = await preflightLaunch(admin, launchId, tenantId, persona.personaId);
      return NextResponse.json({ ok: true, launch: result.launch, bankrTerms: result.bankrTerms });
    }

    if (action === 'request_aegis') {
      const policyVersion = typeof body.policyVersion === 'string' ? body.policyVersion : null;
      const requestedByAgentRef = typeof body.requestedByAgentRef === 'string' ? body.requestedByAgentRef : null;
      const evidenceSnapshot = typeof body.evidenceSnapshot === 'object' && body.evidenceSnapshot !== null ? (body.evidenceSnapshot as Record<string, unknown>) : null;
      if (!policyVersion || !requestedByAgentRef || !evidenceSnapshot) {
        return NextResponse.json(
          { ok: false, error: 'missing-required-field', detail: 'policyVersion, requestedByAgentRef and evidenceSnapshot are required for action=request_aegis.' },
          { status: 400 },
        );
      }
      const launch = await requestAegisAssessment(admin, {
        launchId,
        tenantId,
        policyVersion,
        evidenceSnapshot,
        requestedByAgentRef,
        actorPersonaId: persona.personaId,
      });
      return NextResponse.json({ ok: true, launch });
    }

    if (action === 'request_approval') {
      const launch = await requestApproval(admin, launchId, tenantId, persona.personaId);
      return NextResponse.json({ ok: true, launch });
    }

    if (action === 'submit') {
      const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null;
      if (!idempotencyKey) {
        return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'idempotencyKey is required for action=submit.' }, { status: 400 });
      }
      const launch = await submitApprovedLaunch(admin, {
        id: launchId,
        tenantId,
        actorPersonaId: persona.personaId,
        idempotencyKey,
        authorityChainId: typeof body.authorityChainId === 'string' ? body.authorityChainId : undefined,
      });
      return NextResponse.json({ ok: true, launch });
    }

    if (action === 'inspect_status') {
      const launch = await inspectDeploymentStatus(admin, { id: launchId, tenantId, actorPersonaId: persona.personaId });
      return NextResponse.json({ ok: true, launch });
    }

    // action === 'fee_claims'
    const inspection = await inspectFeeClaims(admin, launchId, tenantId);
    return NextResponse.json({ ok: true, feeClaims: inspection });
  } catch (err) {
    return respondError(err);
  }
}
