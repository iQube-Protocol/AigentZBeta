/**
 * GET /api/public/irl/doc?path=<repo-relative path within codexes/packs/irl>
 *
 * Public, persona-free RAW markdown download for the IRL OS open corpus —
 * the additive doc-delivery seam of the replication contract
 * (IRL_VALIDATION_ROADMAP.md; CFS-042). The gated pack-file route
 * (/api/codex/packs/irl/file) returns JSON-wrapped content for the cartridge
 * renderer; THIS route returns the raw bytes with a download disposition so an
 * external reviewer's agent can fetch protocol/handoff documents directly:
 *
 *   curl -O https://<host>/api/public/irl/doc?path=foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md
 *
 * Scope discipline: the irl pack ONLY (the published open corpus), .md/.json
 * only, path-traversal hardened — same sanitization as the pack-file route.
 * T2-safe by construction: the irl pack contains no persona data.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const dynamic = 'force-dynamic';

const PACK_ID = 'irl';

function sanitizePath(filePath: string): string | null {
  if (path.isAbsolute(filePath)) return null;
  const normalized = path.normalize(filePath);
  if (normalized.startsWith('..')) return null;
  return normalized;
}

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get('path');
  if (!filePath) {
    return NextResponse.json({ ok: false, error: 'Missing path query.' }, { status: 400 });
  }
  const safePath = sanitizePath(filePath);
  if (!safePath) {
    return NextResponse.json({ ok: false, error: 'Invalid path.' }, { status: 400 });
  }
  if (!safePath.endsWith('.md') && !safePath.endsWith('.json')) {
    return NextResponse.json({ ok: false, error: 'Unsupported file type (.md/.json only).' }, { status: 400 });
  }

  const packRoot = path.join(process.cwd(), 'codexes', 'packs', PACK_ID);
  const fullPath = path.join(packRoot, safePath);
  if (!fullPath.startsWith(packRoot + path.sep)) {
    return NextResponse.json({ ok: false, error: 'Path out of bounds.' }, { status: 400 });
  }

  try {
    const raw = await fs.readFile(fullPath, 'utf-8');
    const filename = path.basename(safePath);
    return new NextResponse(raw, {
      status: 200,
      headers: {
        'content-type': safePath.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
  }
}
