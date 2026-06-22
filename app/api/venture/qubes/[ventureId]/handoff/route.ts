/**
 * POST /api/venture/qubes/[ventureId]/handoff — hand the Venture Blueprint to
 * the execution agents (aigentMe / DevOn / Marketa / Venture Lab / Investor
 * Office). Writes a DVN-anchored `venture_blueprint_handoff` receipt.
 *
 * Body: { targets?: VentureAgentConsumer[] } — omit to hand to every agent
 * assignment in the Delegation layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { handoffVentureBlueprint } from '@/services/venture/blueprintHandoff';
import type { VentureAgentConsumer } from '@/types/ventureQube';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ventureId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { ventureId } = await params;
  let body: { targets?: VentureAgentConsumer[] } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const result = await handoffVentureBlueprint({
    personaId: persona.personaId,
    ventureId,
    targets: body.targets,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, payloads: [] }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    receiptId: result.receiptId,
    payloads: result.payloads,
  });
}
