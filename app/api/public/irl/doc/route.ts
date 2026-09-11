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
 * SECURITY (2026-08-27 IRL OS containment — see
 * docs/security/2026-08-27_irl-os-containment-breach-audit.md): this route's
 * original "T2-safe by construction: the irl pack contains no persona data"
 * premise conflated persona-identifier safety with confidentiality — the
 * `irl` pack's `col_foundation`/`col_experiments` collections carry the
 * laboratory's confidential research IP (internal charter canon, research
 * roadmaps, experiment protocols/methods/PRDs, EXP-P1 readiness material),
 * not just "the published open corpus" this route was documented as scoping
 * to. This was a second, unauthenticated, bulk-download-friendly path to the
 * same confidential material `/api/codex/packs/irl/file` was independently
 * found leaking. Both routes now share ONE explicit allowlist
 * (`IRL_PUBLIC_DOC_PATHS`) — the few `irl`-pack paths a genuinely public,
 * persona-free reviewer download is intended for.
 *
 * PHASE 2 SCOPED RESTORATION (2026-09-08 — audit doc Residual Risk item 0):
 * a path outside that static allowlist is now ALSO servable to an
 * authenticated persona holding a scoped research-lab reviewer grant for
 * the specific experiment the path belongs to (`experimentIdForIrlPackPath`
 * + `resolveExperimentReviewGrant` — the SAME canonical grant check the
 * Validation Programme's JSON Agent Package already uses; no ad-hoc
 * allowlist, no new grant vocabulary). This route therefore now resolves a
 * persona for any NON-allowlisted path — the genuinely anonymous case
 * (the static allowlist) is unchanged. Every denial (anonymous, wrong
 * persona, wrong scope, expired/revoked grant) still 404s, never a
 * metadata-revealing 403 — the containment posture "no existence signal on
 * denial" is preserved for every unauthorized caller, not just anonymous
 * ones.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveExperimentReviewGrant } from '@/services/passport/participationAccess';
import { experimentIdForIrlPackPath } from '@/services/research/irlExperimentPathScope';

export const dynamic = 'force-dynamic';

const PACK_ID = 'irl';

/**
 * Default-deny allowlist (2026-08-27 containment) — mirrors
 * IRL_PUBLIC_PACK_PATHS in app/api/codex/packs/[packId]/file/route.ts. Do
 * not widen without an explicit operator public-classification decision.
 * A path outside this list is not necessarily unreachable — see the Phase 2
 * scoped-grant check below — but it is never anonymously reachable.
 */
const IRL_PUBLIC_DOC_PATHS: string[] = [
  'foundation/PARTICIPATION_overview.md',
];

function sanitizePath(filePath: string): string | null {
  if (path.isAbsolute(filePath)) return null;
  // Accept BOTH path schemes (review-surface QA, Austin 2026-07-21): the
  // pack-relative form this route reads (`foundation/…`) AND the repo-relative
  // form the registry publishes as protocolRef (`codexes/packs/irl/foundation/…`).
  // Strip a leading `./` and the `codexes/packs/irl/` pack prefix so a registry
  // protocolRef passed verbatim resolves instead of double-prefixing → 404.
  const stripped = filePath.trim().replace(/^\.\//, '').replace(/^codexes\/packs\/irl\//, '');
  const normalized = path.normalize(stripped);
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

  if (!IRL_PUBLIC_DOC_PATHS.includes(safePath)) {
    // Not on the static public allowlist — the ONLY other path to a 200 is a
    // scoped research-lab reviewer grant for the experiment this path
    // belongs to. Everything else (anonymous, wrong persona, wrong scope,
    // a path outside every registered experiment's folder) 404s — neutral,
    // never a metadata-revealing 403 (containment directive: "return no ...
    // existence signals on denial"), for EVERY unauthorized caller alike.
    const persona = await getActivePersona(request).catch(() => null);
    const isAdmin = persona?.cartridgeFlags?.isAdmin === true;
    let authorized = isAdmin;
    if (!authorized && persona?.personaId) {
      const experimentId = experimentIdForIrlPackPath(safePath);
      const admin = getSupabaseServer();
      if (experimentId && admin) {
        const grant = await resolveExperimentReviewGrant(admin, persona.personaId, experimentId);
        authorized = grant !== null;
      }
    }
    if (!authorized) {
      return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
    }
  }

  // Read through the pack-corpus seam (local FS in dev; the remote in-memory
  // corpus in the SSR Lambda where the irl .md bodies are no longer bundled).
  try {
    const raw = await corpusReadPackFile(PACK_ID, safePath);
    if (raw === null) {
      return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
    }
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
