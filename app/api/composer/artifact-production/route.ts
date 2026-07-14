/**
 * GET /api/composer/artifact-production — the Studio Composer observer seam
 * (CVR-002, the AR/CPS + observer awareness rule in CLAUDE.md).
 *
 * A surface that PRODUCES artifacts must also OBSERVE the current state of
 * artifact production in its space — observed, never asserted. This route
 * returns the same `artifactProduction` projection `/api/research/overview`
 * folds for the lab copilot: recent ArtifactRecords (best-effort — an empty
 * store reads as zero records, honestly) + the Publication Register.
 *
 * Spine-gated (`getActivePersona`) like the research overview; T2-safe
 * projection only — no persona identifier, no record bodies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listArtifactRecords } from '@/services/artifact/artifactRecordStore';
import { PUBLICATION_REGISTER } from '@/services/artifact/publicationRegistry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const records = await listArtifactRecords({ limit: 8 }).catch(() => []);
  const artifactProduction = {
    recentRecords: records.map((r) => ({
      artifactId: r.artifact_id,
      profile: r.profile,
      consequenceClass: r.consequence_class,
      delegate: r.delegate,
      title: r.title.slice(0, 80),
      contentHashPrefix: r.content_hash.slice(0, 12),
      receiptId: r.receipt_id,
      createdAt: r.created_at,
    })),
    publications: PUBLICATION_REGISTER.map((p) => ({ number: p.number, title: p.title, state: p.state })),
  };

  return NextResponse.json(
    { ok: true, artifactProduction, computedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
