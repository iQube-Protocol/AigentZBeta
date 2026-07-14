/**
 * POST /api/dev-command-center/remediate — the dedicated remediation-plan
 * runner (2026-07-14; the validation runner's sibling).
 *
 * Same defect class, same cure: the auto-fired "produce the remediation_plan"
 * chat turn is a heavy structured generation on top of the copilot mega-prompt
 * and dies at Amplify Hosting's hard ~30s response ceiling. Remediation is a
 * structured job — one compact, invariant-governed inference through the
 * canonical Model Router (`callSovereign('analysis', …)` — consequence-bearing
 * reasoning), producing a remedy + captured lesson per failed/unresolved
 * validation item. Returns a standard `remediation_plan` stage proposal so the
 * existing approval path (apply → session plan → `remediation_recorded`
 * receipt → re-validate or Deploy Auth) is unchanged.
 *
 * Admin-gated (spine). T2-safe: validation items + goal text only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { callSovereign } from '@/services/constitutional/modelRouter';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // honored where the platform allows; the call is sized for ~30s regardless

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

interface FailureIn {
  consequenceId?: unknown;
  description?: unknown;
  verdict?: unknown;
  evidence?: unknown;
  severity?: unknown;
}

/** Strip a ```json fence if the model wrapped the payload. Pure. */
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: { goal?: unknown; failures?: unknown; implementationSummary?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const failures = (Array.isArray(body.failures) ? (body.failures as FailureIn[]) : [])
    .map((f) => ({
      consequenceId: typeof f.consequenceId === 'string' ? f.consequenceId : '',
      description: typeof f.description === 'string' ? f.description.trim() : '',
      verdict: typeof f.verdict === 'string' ? f.verdict : 'unresolved',
      evidence: typeof f.evidence === 'string' ? f.evidence.slice(0, 300) : '',
      severity: typeof f.severity === 'string' && SEVERITIES.has(f.severity) ? f.severity : 'medium',
    }))
    .filter((f) => f.description.length > 0)
    .slice(0, 20);
  if (!goal || failures.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'goal and at least one failed/unresolved validation item are required' },
      { status: 400 },
    );
  }
  const implementationSummary =
    typeof body.implementationSummary === 'string' ? body.implementationSummary.slice(0, 6000) : '';

  const system =
    'You are the constitutional remediation engine of a development loop. For each failed, partial, ' +
    'or unresolved validation item, propose ONE concrete remedy (a specific action — what to build, ' +
    'fix, or verify; max 40 words) and ONE captured lesson (learningNote — what the loop should learn ' +
    'so this class of failure is prevented next time; max 25 words). Ground remedies in the ' +
    'implementation summary; never invent capabilities. Set revalidationRequired=true unless every ' +
    'remedy is a pure verification step. residualRisk: one sentence on what risk remains after the ' +
    'remedies, or "" if none. Respond with ONLY a JSON object, no prose: ' +
    '{"remedies":[{"consequenceId":string,"description":string,"remedy":string,"learningNote":string}],' +
    '"residualRisk":string,"revalidationRequired":boolean}';

  const user = [
    `Goal: ${goal.slice(0, 300)}`,
    '',
    'Validation items to remedy:',
    ...failures.map(
      (f) => `- [${f.consequenceId || 'unlabelled'}] (${f.severity} · ${f.verdict}) ${f.description}${f.evidence ? ` — evidence: ${f.evidence}` : ''}`,
    ),
    '',
    implementationSummary ? `Implementation summary:\n${implementationSummary}` : 'Implementation summary: NOT PROVIDED.',
  ].join('\n');

  try {
    const result = await callSovereign('analysis', system, user, 1800, 0);
    const parsed = JSON.parse(extractJson(result.text)) as {
      remedies?: unknown;
      residualRisk?: unknown;
      revalidationRequired?: unknown;
    };
    const remedies = (Array.isArray(parsed.remedies) ? parsed.remedies : [])
      .map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          consequenceId: typeof r.consequenceId === 'string' ? r.consequenceId : '',
          description: typeof r.description === 'string' ? r.description : '',
          remedy: typeof r.remedy === 'string' ? r.remedy.slice(0, 400) : '',
          learningNote: typeof r.learningNote === 'string' ? r.learningNote.slice(0, 300) : '',
        };
      })
      .filter((r) => r.remedy || r.description);
    if (remedies.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'the remediation model returned no remedies — retry, or remediate via chat' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      proposal: {
        kind: 'remediation_plan',
        summary: `Remediation plan — ${remedies.length} remed${remedies.length === 1 ? 'y' : 'ies'} (${result.provider})`,
        data: {
          remedies,
          residualRisk: typeof parsed.residualRisk === 'string' ? parsed.residualRisk.slice(0, 400) : '',
          // The safe constitutional default travels even if the model omits it.
          revalidationRequired: typeof parsed.revalidationRequired === 'boolean' ? parsed.revalidationRequired : true,
        },
      },
      provider: result.provider,
      model: result.model,
      degraded: result.degraded,
      governingInvariants: result.governingInvariants,
    });
  } catch (err) {
    console.error('[dev-command-center/remediate] failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'remediation inference failed' },
      { status: 502 },
    );
  }
}
