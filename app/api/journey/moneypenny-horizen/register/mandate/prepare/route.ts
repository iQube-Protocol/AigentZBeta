/**
 * POST /api/journey/moneypenny-horizen/register/mandate/prepare
 *
 * Register ceremony, step 1 (Wallet Signing Topology, operator ruling
 * 2026-08-01). Creates the PRINCIPAL-role SigningRequest — "authorize
 * registration" — the operator's own wallet must sign before anything else
 * happens. Signs NOTHING itself; only prepares the request the wallet's
 * Pending Actions section will render.
 *
 * This is the FIRST step of the Register stage now — the old direct
 * register/prepare + register/broadcast routes (which fired a real
 * server-custodial signature as the consequence of a single authenticated
 * "confirm" click) are retired. There is no administrative fallback: this
 * ceremony is the only path from "operator wants to register this agent" to
 * a signed, broadcast Horizen transaction.
 *
 * Spine-gated: getActivePersona resolves the operator, who becomes the
 * request's principalPersonaId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { prepareRegistrationMandate } from '@/services/horizen/registerCeremony';

export const dynamic = 'force-dynamic';

interface PrepareBody {
  agentSlug?: string;
}

/*
 * EVERY EXIT IS A NAMED ANSWER (operator, 2026-08-03, on the third report of
 * `Unexpected end of JSON input`).
 *
 * An unanticipated throw here — a Supabase client error, a partner socket
 * dropped, an import that fails at runtime — left the platform to answer, and
 * what it sends is not guaranteed to be JSON and can be nothing at all. A
 * thrown error is still information; discarding it and returning silence is
 * the defect. Enforced across every journey route by
 * tests/journey-response-honesty.test.ts.
 */
export async function POST(request: NextRequest) {
  try {
    return await postImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: PrepareBody = {};
  try {
    body = (await request.json()) as PrepareBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  if (!body.agentSlug) {
    return NextResponse.json({ ok: false, error: 'agentSlug is required' }, { status: 400 });
  }

  const origin = resolveRequestOrigin(request);

  /*
   * FAIL FAITHFUL (operator report, 2026-08-02: "register/mandate/prepare
   * returned an unexpected response (HTTP 500)").
   *
   * `prepareRegistrationMandate` returns a typed refusal for every condition it
   * ANTICIPATES — unknown agent, no principal wallet — and those come back as a
   * 422 the operator can act on. A condition it does not anticipate THROWS, and
   * an uncaught throw becomes a bare 500 whose cause exists only in a log the
   * operator cannot reach. The ceremony then looks broken rather than blocked,
   * and the two need opposite responses.
   *
   * Note what this does NOT do: it does not turn a failure into a success, and
   * it does not invent a refusal code for something we have not classified. An
   * unanticipated failure stays a 500 — it reports itself instead of vanishing.
   */
  let result: Awaited<ReturnType<typeof prepareRegistrationMandate>>;
  try {
    result = await prepareRegistrationMandate(
      { agentSlug: body.agentSlug, principalPersonaId: persona.personaId },
      { agentCardBase: origin },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[register mandate/prepare] unhandled failure', { agentSlug: body.agentSlug, message });
    // A missing table or column is a PENDING MIGRATION on this environment,
    // which the operator fixes by applying it — quite different from a logic
    // fault, which they escalate. Both carry the store's own words.
    const schemaShaped = /relation .* does not exist|column .* does not exist|violates check constraint|schema cache/i.test(
      message,
    );
    return NextResponse.json(
      {
        ok: false,
        refusalCode: schemaShaped ? 'SIGNING_STORE_UNAVAILABLE' : 'MANDATE_PREPARE_FAILED',
        error: schemaShaped
          ? 'The signing-request store is not available on this environment, so the mandate could not be prepared. ' +
            'Apply the pending migrations under supabase/migrations/ (the signing-request and receipt-type batch), then try again.'
          : 'The registration mandate could not be prepared.',
        detail: message,
      },
      { status: 500 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({ ok: true, request: result.value });
}
