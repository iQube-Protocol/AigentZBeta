/**
 * POST /api/moneypenny/factor/use-case-zero/execute — the run-to-completion
 * contract behind Factor's `constitutional_financial_agent_establishment:execute`
 * action (services/factor/factorCapabilityManifest.ts). Scoped 2026-09-06:
 * codexes/packs/agentiq/updates/2026-09-06_factor-agent-callable-execution-scope.md.
 *
 * Distinct from `.../advance` (unchanged — one step per call, driven by the
 * UI capsule): this route runs `runUseCaseZeroToCompletion`, looping the
 * SAME single-step orchestrator until it hits a real boundary (input needed,
 * an approval gate, or completion) — the contract a DELEGATING caller (e.g.
 * MoneyPenny, or a future external agent) uses to have Factor run the whole
 * task, rather than driving it step-by-step itself. Factor remains the
 * executing agent; this never auto-chains across any boundary
 * `advanceUseCaseZero` itself refuses to cross.
 *
 * Dual auth, per the scoped auth-path design:
 *   - A human-authenticated persona session (getActivePersona) — the SAME
 *     bar `.../advance` already uses. The session's own personaId is used;
 *     any `actorPersonaId` in the body is IGNORED on this path (never let a
 *     session act as a different persona).
 *   - A platform credential (CRON_TRIGGER_TOKEN, `x-cron-token` header or
 *     Bearer) — for a genuinely external/service-to-service caller with no
 *     shared human-persona context (mirrors services/agents/sponsorPolityAgent.ts's
 *     `isPlatformAuthority` pattern). On this path the caller MUST supply
 *     `actorPersonaId` explicitly in the body — Factor never invents which
 *     accountable persona an external delegation is acting for.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { runUseCaseZeroToCompletion } from '@/services/factor/useCaseZeroOrchestrator';
import { respondError, resolveTenantId } from '../../_lib/respondError';

export const dynamic = 'force-dynamic';

interface ExecuteAuthResult {
  ok: true;
  actorPersonaId: string;
  via: 'persona-session' | 'platform-credential';
}
interface ExecuteAuthFailure {
  ok: false;
  response: NextResponse;
}

async function resolveExecuteAuth(req: NextRequest, body: Record<string, unknown>): Promise<ExecuteAuthResult | ExecuteAuthFailure> {
  const persona = await getActivePersona(req).catch(() => null);
  if (persona?.personaId) {
    return { ok: true, actorPersonaId: persona.personaId, via: 'persona-session' };
  }

  const expected = process.env.CRON_TRIGGER_TOKEN;
  const provided = req.headers.get('x-cron-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (expected && provided === expected) {
    const actorPersonaId = typeof body.actorPersonaId === 'string' ? body.actorPersonaId.trim() : '';
    if (!actorPersonaId) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'missing-required-field', detail: 'actorPersonaId is required when calling under a platform credential — Factor never invents which accountable persona a delegated execution is acting for.' },
          { status: 400 },
        ),
      };
    }
    return { ok: true, actorPersonaId, via: 'platform-credential' };
  }

  return { ok: false, response: NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 }) };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const auth = await resolveExecuteAuth(req, body);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  const agentSlug = typeof body.agentSlug === 'string' ? body.agentSlug : null;
  if (!agentSlug) {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'agentSlug is required.' }, { status: 400 });
  }
  const path = body.path === 'create_and_establish' ? 'create_and_establish' : 'bring_own_agent';
  const caseId = typeof body.caseId === 'string' ? body.caseId : undefined;
  const tenantId = resolveTenantId(body.tenantId);
  const journeyProfile = body.journeyProfile === 'financial_intelligence' ? ('financial_intelligence' as const) : undefined;
  const launchSpec =
    body.launchSpec && typeof body.launchSpec === 'object'
      ? (body.launchSpec as { chain: string; tokenName: string; tokenSymbol: string; description?: string })
      : undefined;
  const agentGenesisBody = body.agentGenesis && typeof body.agentGenesis === 'object' ? (body.agentGenesis as Record<string, unknown>) : null;
  const agentGenesis = agentGenesisBody
    ? {
        sponsorPassportId: typeof agentGenesisBody.sponsorPassportId === 'string' ? agentGenesisBody.sponsorPassportId : '',
        displayName: typeof agentGenesisBody.displayName === 'string' ? agentGenesisBody.displayName : '',
        description: typeof agentGenesisBody.description === 'string' ? agentGenesisBody.description : '',
        origin: typeof agentGenesisBody.origin === 'string' && agentGenesisBody.origin ? agentGenesisBody.origin : req.nextUrl.origin,
      }
    : undefined;
  const maxSteps = typeof body.maxSteps === 'number' && body.maxSteps > 0 ? Math.min(body.maxSteps, 50) : undefined;

  try {
    const result = await runUseCaseZeroToCompletion({
      admin,
      tenantId,
      actorPersonaId: auth.actorPersonaId,
      agentSlug,
      path,
      caseId,
      journeyProfile,
      launchSpec,
      agentGenesis,
      maxSteps,
    });
    return NextResponse.json({ ok: true, via: auth.via, result });
  } catch (err) {
    return respondError(err);
  }
}

/** GET documents the contract — the invocation reference an external caller
 *  (or the Agent Card) points at. */
export async function GET() {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Runs Aigent Factor\'s Use Case Zero orchestrator to completion (or the first real boundary) on behalf ' +
        'of a delegating caller. Factor remains the executing agent. Never auto-chains across a human/Aegis/' +
        'MoneyPenny approval boundary, never issues tokens, broadcasts transactions, moves funds, or uses ' +
        'production credentials.',
      auth: [
        'A human-authenticated persona session (the caller acts as themself).',
        'x-cron-token / Bearer CRON_TRIGGER_TOKEN, WITH actorPersonaId in the body (a platform-authenticated ' +
          'caller acting on behalf of a named accountable persona — never invented).',
      ],
      body: {
        agentSlug: 'string (required)',
        path: '"bring_own_agent" | "create_and_establish" (default bring_own_agent)',
        actorPersonaId: 'string (required only under a platform credential)',
        tenantId: 'string (optional, default "default")',
        caseId: 'string (optional — resume an existing case)',
        journeyProfile: '"standard" | "financial_intelligence" (optional)',
        launchSpec: '{ chain, tokenName, tokenSymbol, description? } (only when governedOperationRehearsal is reached)',
        agentGenesis: '{ sponsorPassportId, displayName, description, origin? } (only when agentShell needs to sponsor a new agent)',
        maxSteps: 'number (optional, default 50, capped at 50)',
      },
      response: {
        ok: 'boolean',
        via: '"persona-session" | "platform-credential"',
        result: {
          outcome: '"completed" | "awaiting_input" | "awaiting_external_action" | "blocked" | "step_limit_exceeded"',
          steps: 'AdvanceUseCaseZeroResult[] — the full trace of every step actually taken',
          readiness: 'UseCaseZeroReadiness — the last snapshot',
          caseId: 'string | null',
          detail: 'string',
        },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
