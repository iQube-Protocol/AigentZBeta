/**
 * /api/invariants/[id]/advance — lifecycle transitions (CFS-001 §4).
 *
 * POST { action: 'propose' | 'validate' | 'canonize' | 'reject' | 'deprecate' }
 *
 * Admin-gated (Law XI: humans define semantics — canonical promotion is a
 * human ratification act). Receipts are emitted by the service layer;
 * canonize/validate receipts are DVN-anchored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  canonizeInvariant,
  transitionInvariant,
  validateInvariant,
} from '@/services/invariants';

export const dynamic = 'force-dynamic';

type AdvanceAction = 'propose' | 'validate' | 'canonize' | 'reject' | 'deprecate';
const ACTIONS: AdvanceAction[] = ['propose', 'validate', 'canonize', 'reject', 'deprecate'];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = (await context.params);
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action = body.action as AdvanceAction | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }

  const actor = { personaId: persona.personaId };

  try {
    if (action === 'validate') {
      const { invariant, verdict } = await validateInvariant(id, actor);
      return NextResponse.json({ ok: verdict.ok, invariant, verdict });
    }
    if (action === 'canonize') {
      const invariant = await canonizeInvariant(id, actor);
      return NextResponse.json({ ok: true, invariant });
    }
    const to = action === 'propose' ? 'proposed' : action === 'reject' ? 'rejected' : 'deprecated';
    const invariant = await transitionInvariant(id, to, actor);
    return NextResponse.json({ ok: true, invariant });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'advance_failed';
    const status = message.includes('not found')
      ? 404
      : message.includes('invalid lifecycle transition')
        ? 409
        : 500;
    if (status === 500) console.error('[api/invariants/advance] failed', error);
    return NextResponse.json({ error: message }, { status });
  }
}
