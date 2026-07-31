/**
 * POST /api/homecoming/knowledge/constitutionalize — Knowledge Homecoming slice 2.
 *
 * Turns imported operator memory into invariant-aware knowledge: extract the
 * governing invariants a corpus embodies and PROPOSE them (Law XI — status
 * 'proposed', never canonical) into the `invariants` substrate. Idempotent by
 * seed id. This is where "import" becomes "homecoming".
 *
 * Input: either { export: <conversations.json> } (re-parsed to transcripts) or
 * { documents: [{ sourceId, title, text }] } directly. `limit` caps documents
 * processed this run (default 25; the response reports the remainder). `dryRun`
 * extracts + returns candidates WITHOUT writing to the substrate.
 *
 * Auth: ADMIN_OPS_TOKEN bearer OR an admin persona. T2-safe: statements,
 * namespaces, seed ids and counts only — no T0 id, no personaId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { chatGptExportToDocuments } from '@/services/homecoming/chatgptImport';
import {
  constitutionalizeDocuments,
  type ConstitutionalizeDocInput,
} from '@/services/homecoming/constitutionalize';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function requireAdmin(req: NextRequest) {
  const expected = process.env.ADMIN_OPS_TOKEN;
  if (expected) {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token === expected) return { ok: true as const };
  }
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return { ok: false as const, status: 401, error: 'Not authenticated' };
  if (!persona.cartridgeFlags?.isAdmin) return { ok: false as const, status: 403, error: 'Admin access required' };
  return { ok: true as const };
}

function collectDocuments(bodyRec: Record<string, unknown>, body: unknown): ConstitutionalizeDocInput[] {
  // Direct documents form takes precedence when present and well-shaped.
  if (Array.isArray(bodyRec.documents)) {
    return bodyRec.documents
      .map((d) => {
        const r = d && typeof d === 'object' ? (d as Record<string, unknown>) : {};
        const sourceId = typeof r.sourceId === 'string' ? r.sourceId : '';
        const title = typeof r.title === 'string' ? r.title : 'Untitled';
        const text = typeof r.text === 'string' ? r.text : '';
        return { sourceId, title, text };
      })
      .filter((d) => d.text.trim().length > 0);
  }
  // Otherwise parse a ChatGPT export (from { export } or the raw body).
  const exportPayload = 'export' in bodyRec ? bodyRec.export : body;
  return chatGptExportToDocuments(exportPayload).map((d) => ({ sourceId: d.sourceId, title: d.title, text: d.text }));
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const bodyRec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const dryRun = bodyRec.dryRun === true;
  const limit = typeof bodyRec.limit === 'number' && bodyRec.limit >= 0 ? Math.floor(bodyRec.limit) : 25;

  const documents = collectDocuments(bodyRec, body);
  if (documents.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      note: 'No documents to constitutionalize. Provide { export } (a ChatGPT conversations.json) or { documents:[{sourceId,title,text}] }.',
    });
  }

  try {
    const summary = await constitutionalizeDocuments(documents, { limit, dryRun });
    return NextResponse.json({
      ok: true,
      dryRun,
      domain: 'homecoming',
      lawXi: 'all invariants proposed (status: proposed) — the operator ratifies; nothing is canonicalized here',
      ...summary,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  return NextResponse.json({
    ok: true,
    note: 'POST { export } or { documents } to extract + propose invariants (Law XI: status proposed). dryRun:true previews; limit caps documents (default 25).',
  });
}
