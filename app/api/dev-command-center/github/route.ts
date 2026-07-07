/**
 * GET /api/dev-command-center/github — read-only repo viewport for the GitHub
 * layout (CFS-020 CDE). Backed by GITHUB_TOKEN server-side (config mirrored from
 * the aigentiq write-doc route via _lib/github). Read-only: branches, recent
 * commits, open PRs, and a file browser (?op=tree&path= / ?op=file&path=).
 *
 * When the token is absent the response is honest — `{ configured: false,
 * missingEnv: 'GITHUB_TOKEN' }` — never a fabricated state. Admin-gated
 * (getActivePersona + cartridgeFlags.isAdmin). The token never leaves the
 * server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  githubConfigured,
  GITHUB_MISSING_ENV,
  GITHUB_REPO,
  ghListBranches,
  ghRecentCommits,
  ghOpenPulls,
  ghTree,
  ghFile,
} from '@/app/api/dev-command-center/_lib/github';

export const dynamic = 'force-dynamic';

function rejectTraversal(path: string): boolean {
  return path.startsWith('/') || path.split('/').some((s) => s === '..');
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!githubConfigured()) {
    return NextResponse.json({ ok: true, configured: false, missingEnv: GITHUB_MISSING_ENV });
  }

  const op = request.nextUrl.searchParams.get('op') ?? 'overview';
  const path = (request.nextUrl.searchParams.get('path') ?? '').replace(/^\.\//, '');

  if ((op === 'tree' || op === 'file') && rejectTraversal(path)) {
    return NextResponse.json({ ok: false, error: 'path traversal is not permitted' }, { status: 400 });
  }

  if (op === 'tree') {
    const r = await ghTree(path);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true, configured: true, repo: GITHUB_REPO, op: 'tree', path, entries: r.data });
  }

  if (op === 'file') {
    const r = await ghFile(path);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true, configured: true, repo: GITHUB_REPO, op: 'file', file: r.data });
  }

  // Default overview — branches + recent commits + open PRs.
  const [branches, commits, pulls] = await Promise.all([
    ghListBranches(50),
    ghRecentCommits(15),
    ghOpenPulls(30),
  ]);

  return NextResponse.json({
    ok: true,
    configured: true,
    repo: GITHUB_REPO,
    branches: branches.data ?? [],
    commits: commits.data ?? [],
    pulls: pulls.data ?? [],
    errors: [branches, commits, pulls].filter((r) => !r.ok).map((r) => r.error),
  });
}
