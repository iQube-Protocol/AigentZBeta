/**
 * POST /api/homecoming/agent/converse — Harness Homecoming (CFS-023, Workstream 3).
 *
 * Talk to a constitutional delegate NATIVELY: the reply is grounded in the
 * delegate's constitutional identity + the sovereign Constitutional Knowledge
 * Repository (Phase-1 `homecoming` KB domain), and routed through the
 * invariant-aware Model Router. The frontier model is an invisible, swappable
 * provider — the response carries a sovereignty receipt proving the conversation
 * ran inside AgentiQ, not in a vendor chat interface.
 *
 * Body: { delegate: HomecomingDelegateId, message: string, maxTokens?: number }.
 * Admin-gated (spends provider credits). T2-safe: no T0 id in the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import { converseWithDelegate } from '@/services/homecoming/delegateConverse';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  let body: { delegate?: string; message?: string; maxTokens?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const delegate = body.delegate as HomecomingDelegateId;
  if (!delegate || !(HOMECOMING_DELEGATES as readonly string[]).includes(delegate)) {
    return NextResponse.json(
      { ok: false, error: `delegate must be one of: ${HOMECOMING_DELEGATES.join(', ')}` },
      { status: 400 },
    );
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 });

  // Best-effort grounding from the sovereign Constitutional Knowledge Repository
  // (the `homecoming` KB domain from Phase 1). A retrieval failure degrades to an
  // ungrounded but still-native reply — never blocks the conversation.
  let knowledge: string[] = [];
  let knowledgeError: string | undefined;
  try {
    const kb = getKnowledgeBaseService();
    const chunks = await kb.getRelevantChunks(message, 'homecoming', 5, 1500);
    knowledge = chunks.map((c) => c.content).filter(Boolean);
  } catch (e) {
    knowledgeError = e instanceof Error ? e.message : 'knowledge retrieval unavailable';
  }

  try {
    const result = await converseWithDelegate({
      delegate,
      message,
      grounding: { knowledge },
      maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      grounding: { knowledgeChunks: knowledge.length, ...(knowledgeError ? { knowledgeError } : {}) },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note: 'POST { delegate, message } (admin) to converse with a constitutional delegate natively. The reply is grounded in the sovereign KB and carries a sovereignty receipt (provider is swappable).',
  });
}
