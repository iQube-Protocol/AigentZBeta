/**
 * /api/invariants/flip — operator-gated shadow→authoritative flip control
 * (CFS-035 §11 Observatory amendment).
 *
 * GET  — list every node's flip state (client-safe; any authenticated persona).
 * POST — set a node's flip state. ADMIN-GATED via the identity spine
 *        (persona.cartridgeFlags.isAdmin) — never a parallel gate. Body:
 *        { nodeId: string, authoritative: boolean, rationale?: string }.
 *
 * Flipping a node to authoritative makes the runtime serve that node's
 * projection instead of the incumbent heuristic — a consequential act, so it is
 * admin-only and records who flipped it + why (audit is server-internal; the
 * response never includes a personaId).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listNodeFlips, setNodeFlip, getNodeFlip } from '@/services/invariants/flipStore';
import { listRegisteredNodes } from '@/services/invariants/engine';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import '@/services/invariants/nodes'; // ensure nodes are registered for validation

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const flips = await listNodeFlips();
  return NextResponse.json({ ok: true, flips, isAdmin: persona.cartridgeFlags?.isAdmin === true });
}

export async function POST(req: NextRequest): Promise<Response> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  // Access gate — spine-resolved admin only (CLAUDE.md: never a parallel gate).
  if (persona.cartridgeFlags?.isAdmin !== true) {
    return NextResponse.json({ ok: false, error: 'Admin required to flip a node' }, { status: 403 });
  }

  let body: { nodeId?: unknown; authoritative?: unknown; rationale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : '';
  const authoritative = body.authoritative === true;
  const rationale = typeof body.rationale === 'string' ? body.rationale : null;

  if (!nodeId) {
    return NextResponse.json({ ok: false, error: 'nodeId required' }, { status: 400 });
  }
  // Only flip a registered node.
  if (!listRegisteredNodes().some((n) => n.id === nodeId)) {
    return NextResponse.json({ ok: false, error: `Unknown node: ${nodeId}` }, { status: 404 });
  }

  const wrote = await setNodeFlip({ nodeId, authoritative, rationale, personaId: persona.personaId });
  if (!wrote) {
    return NextResponse.json(
      { ok: false, error: 'Flip write failed — is migration 20260718010000_invariant_node_flips applied?' },
      { status: 500 },
    );
  }

  const state = await getNodeFlip(nodeId);

  // DVN-anchor the ratification act (CFS-035 §11) — operator-approved. Best-effort:
  // the flip already succeeded, so a receipt/anchor failure must not fail the request.
  // T2-safe: the summary carries the node id (a public identifier), the new state,
  // and a sha256 commitment of the flip act; the persona is hashed by the DVN
  // pipeline (hashPersonaRef) — no raw personaId reaches the receipt payload.
  try {
    const commitment = createHash('sha256')
      .update(`invariant:flip:${nodeId}:${authoritative ? 'authoritative' : 'shadow'}:${state?.flippedAt ?? ''}:${rationale ?? ''}`)
      .digest('hex');
    await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'iqube-registry',
      actionType: 'invariant_node_flipped',
      summary: `Invariant Decision Node ${nodeId} flipped to ${authoritative ? 'AUTHORITATIVE' : 'shadow'} (CFS-035 ratification). commit:${commitment.slice(0, 32)}`,
    });
  } catch {
    /* anchoring is best-effort; the flip state is already persisted */
  }

  return NextResponse.json({ ok: true, flip: state });
}
