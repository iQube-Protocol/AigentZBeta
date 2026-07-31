/**
 * GET /api/public/irl/invariants — the PUBLIC, read-only projection of the
 * live invariant substrate for the IRL OS cartridge's public Invariant
 * Registry (CFS-033 §8 anonymous-read follow-on; audit 2026-07-17).
 *
 * WHY THIS IS A NEW ROUTE, NOT A WEAKENED GATE (CLAUDE.md PARAMOUNT):
 * the internal `/api/invariants` GET is spine-gated (getActivePersona) and
 * stays exactly as-is — this route NEVER touches it. This is a NEW public
 * surface that reuses the SAME store reader (`listInvariants`) and returns
 * the SAME projection the gated route returns. The data is the published
 * constitutional canon — the identical invariant statements already fully
 * readable in IRL OS's markdown corpus (appendix-a). No access gate is
 * removed or weakened; a new read-only endpoint publishes already-public
 * data through a live API.
 *
 * SAFETY:
 * - READ-ONLY. No POST, no writes, no persona resolution, no credentials.
 * - T2-safe: `listInvariants` returns canon rows only (id, seedId, statement,
 *   namespace, semanticType, status, confidence, standing, reach, contexts,
 *   provenance) — never a personaId or any T0 identifier (the reader is not
 *   persona-scoped; the gated route used the persona ONLY for the auth check,
 *   never to filter the data).
 * - Hard-capped limit (250) so the endpoint can't be used to bulk-scrape
 *   beyond the substrate's published size.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listInvariants } from '@/services/invariants';
import {
  INVARIANT_NAMESPACES,
  type InvariantNamespace,
  type InvariantStatus,
} from '@/types/invariants';

export const dynamic = 'force-dynamic';

// Raised 250 -> 500 (2026-07-17): the live substrate reached 319 invariants
// after the Polity Papers canonization, so a 250 cap silently truncated the
// registry to the highest-Standing 250 and hid all 136 operator-ratified
// polity invariants (Standing 0 until validated). 500 matches the store's own
// ceiling (services/invariants/store.ts listInvariants: Math.min(limit, 500)).
const PUBLIC_LIMIT_CAP = 500;

function isNamespace(value: unknown): value is InvariantNamespace {
  return typeof value === 'string' && (INVARIANT_NAMESPACES as string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const namespace = params.get('namespace');
  const status = params.get('status');
  const domain = params.get('domain');
  const q = params.get('q');
  const ontologyClassId = params.get('ontology');
  // `ids` — fetch specific ratified invariants verbatim by id (comma-separated,
  // capped). Additive, read-only, T2-safe: it filters the SAME already-public
  // projection to an explicit id set — the constitutional-definition surface
  // (explain_primitive's Layer 1) uses it to lead with the exact defining
  // invariants rather than a fuzzy resolver ranking.
  const idsParam = params.get('ids');
  const ids = idsParam
    ? idsParam.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 50)
    : null;
  const requested = Number(params.get('limit') ?? PUBLIC_LIMIT_CAP);
  const limit = Number.isFinite(requested) ? Math.min(requested, PUBLIC_LIMIT_CAP) : PUBLIC_LIMIT_CAP;

  if (namespace && !isNamespace(namespace)) {
    return NextResponse.json(
      { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const invariants = await listInvariants({
      namespace: (namespace as InvariantNamespace) ?? undefined,
      status: status ? (status.split(',') as InvariantStatus[]) : undefined,
      domain: domain ?? undefined,
      q: q ?? undefined,
      ontologyClassId: ontologyClassId ?? undefined,
      // When an explicit id set is requested, read the full substrate (capped)
      // and filter to it below — the store reader has no id filter.
      limit: ids ? PUBLIC_LIMIT_CAP : limit,
    });
    const filtered = ids
      ? (() => {
          const want = new Set(ids);
          return invariants.filter((inv: { id?: string }) => typeof inv.id === 'string' && want.has(inv.id));
        })()
      : invariants;
    return NextResponse.json({ ok: true, count: filtered.length, invariants: filtered, public: true });
  } catch (error) {
    console.error('[api/public/irl/invariants] list failed', error);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}
