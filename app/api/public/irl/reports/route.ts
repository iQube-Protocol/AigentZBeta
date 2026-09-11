/**
 * GET /api/public/irl/reports — the PUBLISHED research reports (stage 3 of
 * the report lifecycle: live draft → canonical → published).
 *
 * Public, persona-free — the Publications → Reports tab of the IRL OS open
 * cartridge (and the internal cartridge's public mirror) renders from this.
 * Only versions an admin explicitly published (published_at set) appear;
 * every one is a canonical, DVN-receipted record, so the payload is T2-safe
 * by construction: report prose, content hash, receipt id, timestamps — no
 * persona identifiers of any tier.
 */

import { NextResponse } from 'next/server';
import { listPublishedReports } from '@/services/research/reportComposition';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await listPublishedReports();
  return NextResponse.json(
    {
      ok: true,
      reports: rows.map((r) => ({
        scope: r.scope,
        version: r.version,
        title: r.title,
        content: r.content,
        contentHash: r.content_hash,
        receiptId: r.receipt_id,
        publishedAt: r.published_at ?? null,
        createdAt: r.created_at,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
