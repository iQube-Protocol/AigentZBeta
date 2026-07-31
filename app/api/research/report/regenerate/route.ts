/**
 * /api/research/report/regenerate — the Findings Report as a produced artifact
 * (CFS-025 research profile · CFS-019). Admin-gated + spine-guarded.
 *
 * POST — REGENERATE the whole report narrative from the collective canonical
 *   findings to date (coherent across ALL experiments, not appended), emit ONE
 *   DVN-anchorable `artifact_published` receipt, and persist it as the next
 *   canonical version for its scope. Body: { scope?: 'all' | <seriesId> | <expId> }.
 * GET  — list a scope's canonical report versions (?scope=all). Newest first.
 *
 * The report content + content hash + receipt id are T2-safe (a publication
 * commitment + its anchor). The real T0 personaId is resolved at the route under
 * the gate solely to write the receipt.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  composeCanonicalReport,
  persistReportVersion,
  listReportVersions,
  attachReportReceipt,
} from '@/services/research/reportComposition';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const SCOPE_TITLE: Record<string, string> = {
  all: 'The metaMe Invariant Research Lab — Findings Report',
  FVS: 'The Foundational Validation Series — Findings Report',
  PSE: 'The Platform Sovereignty Series — Findings Report',
};

export async function GET(req: NextRequest) {
  const scope = new URL(req.url).searchParams.get('scope')?.trim() || 'all';
  const versions = await listReportVersions(scope);
  return NextResponse.json(
    {
      ok: true,
      scope,
      versions: versions.map((v) => ({
        version: v.version,
        title: v.title,
        contentHash: v.content_hash,
        receiptId: v.receipt_id,
        createdAt: v.created_at,
        publishedAt: v.published_at ?? null,
        sovereignty: v.sovereignty,
        // content included so the tab can render the latest canonical report
        content: v.content,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * PATCH — mint the DVN-anchorable publication receipt for an EXISTING canonical
 * version that was persisted without one (so it can be published without a full,
 * hash-changing regenerate). Body: { scope?: string, version: number }.
 */
export async function PATCH(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { scope?: string; version?: number };
  const scope = typeof body.scope === 'string' && body.scope.trim() ? body.scope.trim() : 'all';
  if (typeof body.version !== 'number') {
    return NextResponse.json({ ok: false, error: 'version (number) is required' }, { status: 400 });
  }

  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    activeCartridge: 'irl',
    actionType: 'artifact_published',
    summary: `canonical research report receipt minted (${scope} v${body.version})`,
    contextShared: ['irl-research', 'canonical-report', 'artifact-runtime'],
  }).catch(() => null);
  if (!receipt?.id) {
    return NextResponse.json({ ok: false, error: 'receipt mint failed — try again' }, { status: 502 });
  }

  const attached = await attachReportReceipt(scope, body.version, receipt.id);
  if (!attached.ok) return NextResponse.json({ ok: false, error: attached.error }, { status: 500 });
  return NextResponse.json({ ok: true, scope, version: body.version, receiptId: attached.receiptId });
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { scope?: string };
  const scope = typeof body.scope === 'string' && body.scope.trim() ? body.scope.trim() : 'all';
  const title = SCOPE_TITLE[scope] ?? `Research Findings Report — ${scope}`;

  // 1) Regenerate the whole narrative from the collective canonical findings.
  const composed = await composeCanonicalReport(scope).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }) as const);
  if ('error' in composed) return NextResponse.json({ ok: false, error: composed.error }, { status: 502 });

  // 2) Emit the single DVN-anchorable publication receipt (real personaId at the route).
  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    activeCartridge: 'irl',
    actionType: 'artifact_published',
    summary: `canonical research report regenerated (${scope}) — sha256 ${composed.contentHash.slice(0, 16)}`,
    contextShared: ['irl-research', 'canonical-report', 'artifact-runtime'],
  }).catch(() => null);

  // 3) Persist as the next canonical version.
  const saved = await persistReportVersion({
    scope,
    title,
    content: composed.markdown,
    contentHash: composed.contentHash,
    receiptId: receipt?.id ?? null,
    sovereignty: composed.sovereignty,
    groundedOn: composed.groundedOn,
  });
  if (!saved.ok) {
    const status = saved.code === 'migration_pending' ? 503 : 500;
    return NextResponse.json({ ok: false, code: saved.code, error: saved.error, markdown: composed.markdown }, { status });
  }

  return NextResponse.json({
    ok: true,
    scope,
    version: saved.version,
    title,
    contentHash: composed.contentHash,
    receiptId: receipt?.id ?? null,
    groundedOn: composed.groundedOn,
    sovereignty: composed.sovereignty,
    content: composed.markdown,
  });
}
