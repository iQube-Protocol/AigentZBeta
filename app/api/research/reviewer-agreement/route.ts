/**
 * /api/research/reviewer-agreement — the experiment-scoped Independent
 * Reviewer Agreement surface (operator ruling, 2026-08-02).
 *
 * GET  — the canonical agreement for an experiment + the caller's own
 *        authorization state. Reading it authorizes NOTHING: the ruling is
 *        explicit that "agreement display alone does not authorize it", so
 *        this route has no side effects whatsoever.
 * POST — the reviewer's constitutional act: acknowledge the terms, declare
 *        conflict status, authorize. Emits an authorization receipt.
 *
 * ACCESS AND CONSENT ARE SEPARATE CONJUNCTS. This route checks that the
 * caller may reach the experiment's review at all (the invitation ∩ role ∩
 * scope question, answered by participationAccess) before it will show or
 * accept an agreement — an agreement is not a way to acquire access. But
 * holding access does NOT imply consent, which is exactly why the agreement
 * exists as its own record.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { diagnoseExperimentReviewAccess } from '@/services/passport/participationAccess';
import {
  currentReviewerAgreement,
  agreementHash,
  authorizeReviewerAgreement,
  requireReviewerAgreement,
} from '@/services/research/reviewerAgreement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: noStore });
  }
  const experimentId = req.nextUrl.searchParams.get('experimentId')?.trim();
  if (!experimentId) {
    return NextResponse.json({ ok: false, error: 'experimentId is required' }, { status: 400, headers: noStore });
  }

  const def = currentReviewerAgreement(experimentId);
  if (!def) {
    return NextResponse.json(
      { ok: false, error: `No reviewer agreement is defined for ${experimentId}.` },
      { status: 404, headers: noStore },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });
  }

  const isAdmin = !!persona.cartridgeFlags?.isAdmin;
  const access = await diagnoseExperimentReviewAccess(admin, persona.personaId, experimentId);
  if (!isAdmin && !access.mayRead) {
    // Structured, so the client can render the true reason (see the journey
    // state route's own note on why one generic refusal was the defect).
    return NextResponse.json(
      { ok: false, error: 'review_access_required', access },
      { status: 403, headers: noStore },
    );
  }

  const gate = await requireReviewerAgreement(admin, { personaId: persona.personaId, experimentId });

  return NextResponse.json(
    {
      ok: true,
      agreement: {
        agreementId: def.agreementId,
        version: def.version,
        experimentId: def.experimentId,
        displayLabel: def.displayLabel,
        packageScope: def.packageScope,
        effectiveFrom: def.effectiveFrom,
        supersedes: def.supersedes,
        clauses: def.clauses,
        permittedActs: def.permittedActs,
        prohibitedActs: def.prohibitedActs,
        agreementHash: agreementHash(def),
      },
      // The caller's own state. `authorized` is DERIVED from the durable row,
      // never from anything this response was asked for.
      authorized: gate.ok,
      authorizationFailure: gate.ok ? null : gate.failure,
      authorization: gate.ok
        ? {
            agreementId: gate.authorization!.agreementId,
            agreementVersion: gate.authorization!.agreementVersion,
            authorizedAt: gate.authorization!.authorizedAt,
            conflictDeclared: gate.authorization!.conflictDeclared,
            // T0 law: reviewerRef (T2), never personaId.
            reviewerRef: gate.authorization!.reviewerRef,
          }
        : null,
    },
    { headers: noStore },
  );
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: noStore });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const experimentId = typeof body?.experimentId === 'string' ? body.experimentId.trim() : '';
  const acknowledged = body?.acknowledged === true;
  const conflictDeclared = body?.conflictDeclared === true;
  const conflictStatement = typeof body?.conflictStatement === 'string' ? body.conflictStatement : null;
  // The client echoes back the hash it displayed. If the canonical terms have
  // changed since the page rendered, the reviewer would be consenting to text
  // they never saw — refuse rather than record a consent to something else.
  const acknowledgedHash = typeof body?.agreementHash === 'string' ? body.agreementHash : null;

  if (!experimentId) {
    return NextResponse.json({ ok: false, error: 'experimentId is required' }, { status: 400, headers: noStore });
  }

  const def = currentReviewerAgreement(experimentId);
  if (!def) {
    return NextResponse.json(
      { ok: false, error: `No reviewer agreement is defined for ${experimentId}.` },
      { status: 404, headers: noStore },
    );
  }
  const expectedHash = agreementHash(def);
  if (acknowledgedHash && acknowledgedHash !== expectedHash) {
    return NextResponse.json(
      {
        ok: false,
        error: 'agreement_changed',
        message: 'This agreement changed while you were reading it. Please review the current terms again.',
        agreementHash: expectedHash,
      },
      { status: 409, headers: noStore },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });
  }

  // Consent presupposes reach: an agreement is never a route to access.
  const isAdmin = !!persona.cartridgeFlags?.isAdmin;
  const access = await diagnoseExperimentReviewAccess(admin, persona.personaId, experimentId);
  if (!isAdmin && !access.mayRead) {
    return NextResponse.json(
      { ok: false, error: 'review_access_required', access },
      { status: 403, headers: noStore },
    );
  }

  const result = await authorizeReviewerAgreement(admin, {
    personaId: persona.personaId,
    definition: def,
    acknowledged,
    conflictDeclared,
    conflictStatement,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 400, headers: noStore });
  }

  return NextResponse.json(
    {
      ok: true,
      alreadyAuthorized: result.alreadyAuthorized,
      authorization: {
        agreementId: result.authorization.agreementId,
        agreementVersion: result.authorization.agreementVersion,
        agreementHash: result.authorization.agreementHash,
        experimentId: result.authorization.experimentId,
        authorizedAt: result.authorization.authorizedAt,
        conflictDeclared: result.authorization.conflictDeclared,
        reviewerRef: result.authorization.reviewerRef,
        receiptId: result.authorization.receiptId,
      },
    },
    { headers: noStore },
  );
}
