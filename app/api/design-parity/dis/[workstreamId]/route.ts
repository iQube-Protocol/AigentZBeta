/**
 * GET /api/design-parity/dis/[workstreamId]
 *
 * Serves a Design Intent Spec by workstream id from
 * `codexes/packs/agentiq/items/dis/<workstreamId>.dis.json`.
 *
 * Lets the in-browser ParityChecker fetch the live DIS for a
 * workstream so the dog-food loop (handbook §8b) can run from any
 * surface without bundling DIS JSON into client code.
 *
 * Currently public-read — DIS specs are architectural contracts, not
 * secrets (handbook §8a/§8b). If a workstream's DIS ever needs to be
 * restricted, gate this route via getActivePersona + admin flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIS_DIR = 'codexes/packs/agentiq/items/dis';
const WORKSTREAM_ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workstreamId: string }> },
) {
  const { workstreamId } = await params;
  if (!WORKSTREAM_ID_RE.test(workstreamId)) {
    return NextResponse.json(
      { ok: false, error: 'invalid workstreamId' },
      { status: 400 },
    );
  }
  const filePath = join(process.cwd(), DIS_DIR, `${workstreamId}.dis.json`);
  try {
    const raw = await readFile(filePath, 'utf8');
    const dis = JSON.parse(raw);
    return NextResponse.json(
      { ok: true, workstreamId, dis },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'load failed';
    if (/ENOENT/.test(message)) {
      return NextResponse.json(
        { ok: false, error: `no DIS for workstream "${workstreamId}"` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
