/**
 * POST /api/moneypenny/factor/cases/[caseId]/transition — the one route
 * for advancing, pausing, or resuming a Factor case's state machine
 * (PRD §6.1). `action` selects which factorCaseService function runs;
 * this route never encodes the state machine itself — that lives in
 * transitionCaseState's FORWARD_TRANSITIONS table.
 *
 * Admission-decision states ('admitted' | 'conditionally_admitted' |
 * 'rejected') are refused here exactly as they are in the service layer —
 * this route does not add a second gate, it just surfaces the service's
 * own refusal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { transitionCaseState, pauseCase, resumeCase, type FactorCaseState } from '@/services/factor/factorCaseService';
import { respondError, resolveTenantId } from '../../../_lib/respondError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
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

  try {
    if (action === 'pause') {
      const row = await pauseCase(admin, caseId, tenantId, persona.personaId, typeof body.reason === 'string' ? body.reason : undefined);
      return NextResponse.json({ ok: true, case: row });
    }
    if (action === 'resume') {
      const row = await resumeCase(admin, caseId, tenantId, persona.personaId);
      return NextResponse.json({ ok: true, case: row });
    }
    if (action === 'advance') {
      const toState = body.toState;
      if (typeof toState !== 'string') {
        return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'toState is required for action=advance.' }, { status: 400 });
      }
      const row = await transitionCaseState(admin, {
        caseId,
        tenantId,
        toState: toState as FactorCaseState,
        actorPersonaId: persona.personaId,
        authorityChainId: typeof body.authorityChainId === 'string' ? body.authorityChainId : undefined,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      });
      return NextResponse.json({ ok: true, case: row });
    }
    return NextResponse.json({ ok: false, error: 'unknown-action', detail: "action must be one of 'advance' | 'pause' | 'resume'." }, { status: 400 });
  } catch (err) {
    return respondError(err);
  }
}
