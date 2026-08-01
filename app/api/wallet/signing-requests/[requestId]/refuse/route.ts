/**
 * POST /api/wallet/signing-requests/[requestId]/refuse
 *
 * The operator declines an act waiting on them.
 *
 * ── Why refusal is a first-class outcome ───────────────────────────────────
 *
 * A wallet that offers only "sign" and "leave it" leaves every declined act
 * indistinguishable from an abandoned one — the request sits pending until it
 * expires, and nobody can tell whether the operator said no or never looked.
 * `SigningRequestStatus` already carries `refused` for exactly this, and the
 * state machine is poorer for having no way to reach it.
 *
 * Refusing is terminal and non-reversible: the request is closed, not paused.
 * Changing one's mind means preparing a fresh act, which is the right shape —
 * a refusal that could be un-refused would let a declined mandate be revived
 * without the operator deciding again.
 *
 * ── What refusing does NOT do ──────────────────────────────────────────────
 *
 * It records a decision. It does not roll back anything already done under an
 * earlier act in the same ceremony: refusing the agent invocation after
 * signing the principal mandate leaves the mandate signed, because it was.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSigningRequest, updateSigningRequest } from '@/services/signing/signingRequestStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, refusal: 'NOT_AUTHENTICATED', detail: 'No active persona could be resolved for this caller.' },
      { status: 401 },
    );
  }

  const { requestId } = await params;
  let reason = '';
  try {
    const body = (await req.json()) as { reason?: unknown };
    reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  } catch {
    reason = '';
  }

  const record = await getSigningRequest(requestId);
  if (!record) {
    return NextResponse.json(
      { ok: false, refusal: 'UNKNOWN_REQUEST', detail: 'No signing request exists for that id.' },
      { status: 404 },
    );
  }
  // A request may only be refused by the persona it was prepared for — the
  // same cross-check the approve routes make, for the same reason.
  if (record.principalPersonaId !== persona.personaId) {
    return NextResponse.json(
      {
        ok: false,
        refusal: 'WRONG_PERSONA',
        detail: 'That request belongs to a different persona. It cannot be declined on their behalf.',
      },
      { status: 403 },
    );
  }
  if (record.status !== 'pending') {
    return NextResponse.json(
      {
        ok: false,
        refusal: 'ALREADY_RESOLVED',
        detail: `This request is already ${record.status}, so there is nothing to decline.`,
      },
      { status: 409 },
    );
  }

  const updated = await updateSigningRequest(requestId, {
    status: 'refused',
    refusalCode: 'OPERATOR_DECLINED',
    refusalDetail: reason || 'The operator declined this act in their wallet. No reason was given.',
  });

  return NextResponse.json({
    ok: true,
    status: updated.status,
    detail:
      'Declined. This request is closed and will not be offered again — start the act afresh if you change your ' +
      'mind. Nothing already completed earlier in this ceremony has been undone.',
  });
}
