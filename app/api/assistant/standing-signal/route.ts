/**
 * /api/assistant/standing-signal
 *
 *   POST — log a unit of work DONE as a Standing signal (activity receipt +
 *          best-effort Personal Standing accrual). Two kinds:
 *            - 'action'   → operator_action_logged (work done on- or off-platform:
 *                           produced a document, sent an email, made a call)
 *            - 'document' → standing_document_added (a proof-of-work file already
 *                           uploaded via the upload pipeline as use-kind
 *                           'standing_document'; pass its uploadId)
 *   GET  — list the caller's recent Standing signals (the actions-taken log),
 *          so the operator can see logged work that grounds progress reports.
 *
 * These receipts are the VERIFIED-progress provenance a grounded Venture
 * Progress report reads as movement from the ingested baseline — instead of
 * inventing metrics. Auth: persona-scoped via the spine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { logStandingSignal, type StandingSignalKind } from '@/services/standing/standingSignalService';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

const SIGNAL_ACTION_TYPES = ['operator_action_logged', 'standing_document_added'] as const;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  }
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit')) || 20, 1), 100);
  try {
    const receipts = await listActivityReceiptsForPersona(persona.personaId, {
      actionTypes: [...SIGNAL_ACTION_TYPES],
      limit,
    });
    // T1-safe projection — persona_id stays server-side.
    const signals = receipts.map((r) => ({
      id: r.id,
      kind: r.actionType,
      summary: r.summary,
      cartridge: r.activeCartridge,
      ventureRef: r.contextShared?.[0] ?? null,
      uploadId: r.artifactsCreated?.[0] ?? null,
      receiptStatus: r.receiptStatus,
      createdAt: r.createdAt,
    }));
    return NextResponse.json({ ok: true, signals }, { headers: NO_STORE });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  }

  let body: {
    kind?: 'action' | 'document';
    summary?: string;
    ventureRef?: string | null;
    uploadId?: string | null;
    cvs?: number;
    accrue?: boolean;
    activeCartridge?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400, headers: NO_STORE });
  }

  const summary = (body.summary ?? '').trim();
  if (!summary) {
    return NextResponse.json({ ok: false, error: 'summary is required' }, { status: 400, headers: NO_STORE });
  }
  const kind: StandingSignalKind =
    body.kind === 'document' ? 'standing_document_added' : 'operator_action_logged';
  if (kind === 'standing_document_added' && !body.uploadId) {
    return NextResponse.json(
      { ok: false, error: 'uploadId is required for a standing document' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const { receipt, accrual } = await logStandingSignal({
      personaId: persona.personaId,
      kind,
      summary,
      ventureRef: body.ventureRef ?? null,
      uploadId: body.uploadId ?? null,
      activeCartridge: body.activeCartridge,
      cvs: typeof body.cvs === 'number' ? body.cvs : undefined,
      accrue: body.accrue,
    });
    return NextResponse.json(
      {
        ok: true,
        signal: receipt
          ? { id: receipt.id, kind: receipt.actionType, summary: receipt.summary, createdAt: receipt.createdAt }
          : null,
        standing: accrual
          ? { personal: accrual.personal, overall: accrual.overall, bucket: accrual.bucket }
          : null,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_STORE });
  }
}
