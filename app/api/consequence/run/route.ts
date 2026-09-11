/**
 * /api/consequence/run — the Consequence Operating Model runner (CFS-006a).
 *
 * POST { intentRef, contextDomain?, namespace?, execute?, outcome? }
 *   - Runs the pre-approval pipeline (Intent → … → Planning) and returns the
 *     ConsequenceRun with its disposition.
 *   - When execute=true AND the run is executable (disposition act|escalate),
 *     also runs the post-approval arc (Execution → … → Knowledge Evolution),
 *     closing the flywheel. Escalate still requires explicit execute=true —
 *     the approval gate is the caller's act.
 *
 * Admin-gated (the operating model acts on constitutional memory). Spine-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { executeApproved, runConsequencePipeline } from '@/services/consequence';
import { INVARIANT_NAMESPACES, type InvariantNamespace } from '@/types/invariants';

export const dynamic = 'force-dynamic';

interface RunBody {
  intentRef?: string;
  contextDomain?: string;
  namespace?: string;
  execute?: boolean;
  outcome?: 'confirmed' | 'contradicted';
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: RunBody;
  try {
    body = (await request.json()) as RunBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.intentRef || typeof body.intentRef !== 'string') {
    return NextResponse.json({ error: 'intentRef is required (string)' }, { status: 400 });
  }
  if (body.namespace && !(INVARIANT_NAMESPACES as string[]).includes(body.namespace)) {
    return NextResponse.json(
      { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const actor = { personaId: persona.personaId };
    const run = await runConsequencePipeline({
      intentRef: body.intentRef,
      contextDomain: body.contextDomain ?? null,
      namespace: (body.namespace as InvariantNamespace) ?? undefined,
      actor,
    });

    let execution: Awaited<ReturnType<typeof executeApproved>> | null = null;
    if (body.execute) {
      if (!run.awaitingApproval) {
        return NextResponse.json(
          { ok: true, run, execution: null, note: `disposition '${run.disposition}' is not executable; nothing executed` },
        );
      }
      execution = await executeApproved({
        run,
        outcome: body.outcome ?? 'confirmed',
        actor,
      });
    }

    return NextResponse.json({ ok: true, run, execution });
  } catch (error) {
    console.error('[api/consequence/run] failed', error);
    return NextResponse.json({ error: 'run_failed' }, { status: 500 });
  }
}
