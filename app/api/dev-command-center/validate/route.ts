/**
 * POST /api/dev-command-center/validate — the dedicated consequence-validation
 * runner (2026-07-14).
 *
 * WHY THIS EXISTS: the operator could not complete the Validate stage through
 * chat — every "validate the build" turn died with the generic client error.
 * Root cause: Amplify Hosting hard-caps SSR/API responses at ~30s (maxDuration
 * is not honored — amplify-hosting#3475/#3223), and the validate chat turn is
 * the heaviest turn in the system (full copilot mega-prompt: KB search +
 * persona + platform knowledge + ground context + dual proposal schemas, then
 * the longest structured generation of any stage). It cannot fit the ceiling.
 *
 * THE FIX: validation is a structured JOB, not a conversation — so it gets a
 * focused seam that fits the budget: a compact prompt (the consequence canvas
 * + an implementation summary, nothing else), one invariant-governed inference
 * through the canonical Model Router (`callSovereign('validation', …)` — the
 * 'validation' purpose maps to the validation reasoning stage), terse bounded
 * output. The result returns as a standard `validation_report` stage proposal
 * so the EXISTING approval path is unchanged: approve → session report +
 * `constitutional_validation_recorded` receipt (with packId) → the merge gate
 * opens. Chat validation still works when it fits; this is the reliable lane.
 *
 * Admin-gated (spine). T2-safe: canvas entries + goal text only — no persona
 * identifier reaches the model or the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { dispatchBranchFor } from '@/app/api/dev-command-center/implement/route';
import { GITHUB_REPO } from '@/app/api/dev-command-center/_lib/github';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // honored where the platform allows; the call is sized for ~30s regardless

interface CanvasEntryIn {
  id?: unknown;
  description?: unknown;
  severity?: unknown;
}

const VERDICTS = new Set(['satisfied', 'unresolved', 'unintended', 'partial']);
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

function coerceEntries(raw: unknown): { id: string; description: string; severity: string }[] {
  if (!Array.isArray(raw)) return [];
  return (raw as CanvasEntryIn[])
    .map((e) => ({
      id: typeof e.id === 'string' ? e.id : '',
      description: typeof e.description === 'string' ? e.description.trim() : '',
      severity: typeof e.severity === 'string' && SEVERITIES.has(e.severity) ? e.severity : 'medium',
    }))
    .filter((e) => e.description.length > 0)
    .slice(0, 40); // bounded prompt — a canvas beyond this is a modelling smell
}

/** Strip a ```json fence if the model wrapped the payload. Pure. */
export function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: { goal?: unknown; shouldHappen?: unknown; shouldNeverHappen?: unknown; implementationSummary?: unknown; packId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const shouldHappen = coerceEntries(body.shouldHappen);
  const shouldNeverHappen = coerceEntries(body.shouldNeverHappen);
  if (!goal || (shouldHappen.length === 0 && shouldNeverHappen.length === 0)) {
    return NextResponse.json(
      { ok: false, error: 'goal and at least one consequence-canvas entry are required' },
      { status: 400 },
    );
  }
  // The implementation summary is CONTEXT, not the subject — bounded hard so
  // the prompt (and therefore the latency) stays inside the platform ceiling.
  let implementationSummary =
    typeof body.implementationSummary === 'string' ? body.implementationSummary.slice(0, 6000) : '';

  // PR-awareness (2026-07-15, operator: "how would it resolve it if it doesn't
  // go back and write the code?"): when the pack has a dispatched PR, validate
  // against the ACTUAL work — the PR body + changed files — not just the
  // static brief. Critical after a remediation dispatch: the remedies live in
  // new commits, and judging the stale brief would re-fail forever.
  // Best-effort: any failure degrades to brief-only validation.
  const packId = typeof body.packId === 'string' ? body.packId.trim() : '';
  if (packId && process.env.GITHUB_TOKEN) {
    try {
      const branch = dispatchBranchFor(packId);
      const gh = {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const owner = GITHUB_REPO.split('/')[0];
      const prsRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
        { headers: gh, cache: 'no-store' },
      );
      const prs = prsRes.ok ? ((await prsRes.json()) as Array<{ number: number; body?: string | null }>) : [];
      if (Array.isArray(prs) && prs.length > 0) {
        const pr = prs[0];
        const filesRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/pulls/${pr.number}/files?per_page=60`,
          { headers: gh, cache: 'no-store' },
        );
        const files = filesRes.ok
          ? ((await filesRes.json()) as Array<{ filename: string; additions: number; deletions: number }>)
          : [];
        implementationSummary +=
          `\n\n## Dispatched PR #${pr.number} (${branch}) — the ACTUAL implementation under review\n` +
          String(pr.body ?? '').slice(0, 3000) +
          (files.length > 0
            ? `\n\nChanged files:\n${files.map((f) => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}`
            : '');
      }
    } catch {
      // PR context is additive — brief-only validation proceeds.
    }
  }

  const system =
    'You are the constitutional consequence-validation engine of a development loop. ' +
    'Judge each consequence-canvas entry against the implementation summary. Verdicts: ' +
    "'satisfied' (a should-happen is delivered / a must-never-happen is provably avoided), " +
    "'unresolved' (cannot be confirmed from the summary), 'partial' (partly delivered), " +
    "'unintended' (the implementation appears to VIOLATE a must-never-happen). " +
    'Evidence: ONE terse sentence (max 25 words) grounded in the summary — never invent facts; ' +
    "if the summary is silent on an entry, the verdict is 'unresolved' with evidence naming what is missing. " +
    'Respond with ONLY a JSON object, no prose: ' +
    '{"items":[{"consequenceId":string,"description":string,"verdict":string,"evidence":string,"severity":string}],' +
    '"workflowImpacts":string[],"governanceImpacts":string[],"testingRequirements":string[]}';

  const entryLine = (e: { id: string; description: string; severity: string }, kind: string) =>
    `- [${e.id || 'unlabelled'}] (${kind}, ${e.severity}) ${e.description}`;
  const user = [
    `Goal: ${goal.slice(0, 300)}`,
    '',
    'Consequence canvas:',
    ...shouldHappen.map((e) => entryLine(e, 'should-happen')),
    ...shouldNeverHappen.map((e) => entryLine(e, 'must-never-happen')),
    '',
    implementationSummary
      ? `Implementation summary:\n${implementationSummary}`
      : 'Implementation summary: NOT PROVIDED — verdicts must be unresolved unless an entry is self-evidently structural.',
  ].join('\n');

  try {
    const result = await callSovereign('validation', system, user, 2000, 0);
    const parsed = JSON.parse(extractJson(result.text)) as {
      items?: unknown;
      workflowImpacts?: unknown;
      governanceImpacts?: unknown;
      testingRequirements?: unknown;
    };
    const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, 12) : []);
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          consequenceId: typeof r.consequenceId === 'string' ? r.consequenceId : '',
          description: typeof r.description === 'string' ? r.description : '',
          verdict: typeof r.verdict === 'string' && VERDICTS.has(r.verdict) ? r.verdict : 'unresolved',
          evidence: typeof r.evidence === 'string' ? r.evidence.slice(0, 300) : '',
          severity: typeof r.severity === 'string' && SEVERITIES.has(r.severity) ? r.severity : 'medium',
        };
      })
      .filter((i) => i.description);
    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'the validation model returned no judgeable items — retry, or validate via chat' },
        { status: 502 },
      );
    }

    const satisfied = items.filter((i) => i.verdict === 'satisfied').length;
    // The proposal is the SAME shape the chat emits — the existing approval
    // path (apply → session report → validation receipt → merge gate) is
    // reused verbatim; this route only replaces the transport.
    return NextResponse.json({
      ok: true,
      proposal: {
        kind: 'validation_report',
        summary: `Consequence validation — ${satisfied}/${items.length} satisfied (${result.provider})`,
        data: {
          items,
          workflowImpacts: strArr(parsed.workflowImpacts),
          governanceImpacts: strArr(parsed.governanceImpacts),
          testingRequirements: strArr(parsed.testingRequirements),
        },
      },
      provider: result.provider,
      model: result.model,
      degraded: result.degraded,
      governingInvariants: result.governingInvariants,
    });
  } catch (err) {
    console.error('[dev-command-center/validate] failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'validation inference failed' },
      { status: 502 },
    );
  }
}
