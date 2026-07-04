/**
 * GET /api/polity-passport/schemas/[name] — serve the v0.1 schema bundle.
 *
 * Machine-readable surface (PRD §13): agents fetch the JSON Schemas to
 * construct valid applications. Files are served verbatim from the
 * canonical in-repo bundle at polity-passport-bureau/schemas/ behind a
 * strict allowlist (no path traversal; only bundle members are reachable).
 *
 * GET /api/polity-passport/schemas/index returns the bundle manifest.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const SCHEMA_DIR = path.join(process.cwd(), 'polity-passport-bureau', 'schemas');

const BUNDLE_FILES = new Set([
  'citizen-passport.application.schema.json',
  'participant-passport.application.schema.json',
  'polity-passport.bundle.manifest.json',
  'polity-passport.citizen-privilege-standing.schema.json',
  'polity-passport.common.schema.json',
  'polity-passport.credential.schema.json',
  'polity-passport.participant-standing.schema.json',
  'polity-passport.registry-record.schema.json',
  'polity-passport.reputation-binding.schema.json',
  'polity-passport.reputation-infraction.schema.json',
  'polity-passport.review-decision.schema.json',
  'polity-passport.status-transition.schema.json',
]);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const fileName =
    name === 'index' || name === 'manifest'
      ? 'polity-passport.bundle.manifest.json'
      : name;

  if (!BUNDLE_FILES.has(fileName)) {
    return NextResponse.json(
      { ok: false, error: 'Unknown schema', available: Array.from(BUNDLE_FILES) },
      { status: 404 },
    );
  }

  try {
    const content = await readFile(path.join(SCHEMA_DIR, fileName), 'utf-8');
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/schema+json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Schema unavailable' }, { status: 500 });
  }
}
