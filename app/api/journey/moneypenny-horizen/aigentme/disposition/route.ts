/**
 * POST /api/journey/moneypenny-horizen/aigentme/disposition
 *
 * PRD-GJR-001 §5.10 (aigentMe Onboarding Oversight Principle) made real: the
 * ONE sovereign act the aigentMe stage requires from the principal — not
 * the incoming agent, not aigentMe itself. aigentMe surfaces the agent's
 * declared domain focus; the PRINCIPAL decides whether it becomes part of
 * their ExperienceQube population, and whether that agent is recorded as one
 * of their delegated agents. This route is that decision's write path.
 *
 * Spine-gated: resolves the caller's OWN active persona (never the agent's,
 * never another persona's) via getActivePersona. First call also writes the
 * (idempotent) aigentme_activated receipt — activation and the disposition
 * are two distinct facts, but the disposition can't be recorded without
 * aigentMe having activated first.
 *
 * AGENT-SELECTABLE (al, 2026-08-04): this route hardcoded `aigent-moneypenny`
 * into `agentsInvoked` regardless of which agent's journey was actually in
 * progress — the ONE real write path for this stage, structurally unable to
 * ever register a genuine disposition for a different agent (e.g. Nakamoto),
 * however honestly the principal answered. `agentSlug` is now accepted (query
 * param on GET, body field on POST), resolved through the same
 * `resolveRegistrableAgent` every other journey-selectable route uses, and
 * defaults to MoneyPenny only when omitted — so the existing MoneyPenny
 * caller is unaffected. Both receipts now carry the RESOLVED agent's
 * `runtimeAgentId`, and the read side filters by it too, so a disposition
 * genuinely recorded for one agent is never read back as another's. This is
 * parameter propagation only — no change to the disposition ceremony itself.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import {
  recordExperienceQubeDisposition,
  readExperienceQubeDisposition,
} from '@/services/journey/experienceQubeDispositionService';

export const dynamic = 'force-dynamic';

const VALID_DISPOSITIONS = ['central', 'secondary', 'temporary', 'not-carried-forward'] as const;
type Disposition = (typeof VALID_DISPOSITIONS)[number];

interface DispositionBody {
  disposition?: string;
  domainFocus?: string;
  /** Which agent this recognition act concerns. Defaults to MoneyPenny when omitted. */
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
export async function GET(request: NextRequest) {
  try {
    return await getImpl(request);
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

async function getImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const agentSlug = request.nextUrl.searchParams.get('agentSlug');
  const agent = resolveRegistrableAgent(agentSlug) ?? resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!;

  const { aigentMeActive, dispositionReceipt } = await readExperienceQubeDisposition(
    persona.personaId,
    agent.runtimeAgentId,
  );

  return NextResponse.json({
    ok: true,
    aigentMeActive,
    disposition: (dispositionReceipt?.actionInput as { disposition?: string } | null)?.disposition ?? null,
  });
}

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
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: DispositionBody;
  try {
    body = (await request.json()) as DispositionBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (!body.disposition || !VALID_DISPOSITIONS.includes(body.disposition as Disposition)) {
    return NextResponse.json(
      { error: 'invalid-disposition', validValues: VALID_DISPOSITIONS },
      { status: 400 },
    );
  }
  const disposition = body.disposition as Disposition;
  const agent = resolveRegistrableAgent(body.agentSlug) ?? resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!;

  /*
   * FAIL FAITHFUL (operator report, 2026-08-02: "Request failed (500) in
   * aigentMe initial selection"). The write itself, its idempotency rule,
   * and this error classification now live in
   * services/journey/experienceQubeDispositionService.ts — extracted so the
   * Constitutional Internet Bridge's own disposition ceremony shares the
   * same receipt taxonomy and fail-faithful behavior instead of forking it.
   * This route's request/response shape is unchanged.
   */
  const result = await recordExperienceQubeDisposition({
    personaId: persona.personaId,
    runtimeAgentId: agent.runtimeAgentId,
    agentDisplayName: agent.displayName,
    dispositionSummary: `Principal recorded disposition '${disposition}' on ${agent.displayName}'s Financial Services domain focus`,
    actionInput: { disposition, domainFocus: body.domainFocus ?? 'financial-services' },
    activeCartridge: 'metame-codex',
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        refusalCode: result.refusalCode,
        step: result.step,
        detail: result.detail,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    aigentMeActive: true,
    disposition,
    receiptId: result.receiptId,
  });
}
