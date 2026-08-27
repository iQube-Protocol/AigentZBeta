/**
 * GET /api/codex/packs/:packId/file?path=...
 *
 * Serves files from codexes/packs/:packId (markdown or JSON).
 *
 * SECURITY (2026-08-12 forensic correction pass): this route has no access
 * control of its own — it is a general-purpose reader for AgentiqCartridgeTab,
 * and most pack collections ARE meant to be publicly readable that way
 * (AlphaDocsTab, RefStudioTab, etc.). The codex tab-registry `adminOnly` flag
 * on a specific tab (e.g. `polity-core-commentary-constitutional-internet`)
 * is a CLIENT-SIDE gate only — it hides the tab in the UI, but a direct
 * request to this route with the same packId/path bypasses it entirely,
 * since this route never consulted the tab registry at all.
 *
 * `ADMIN_GATED_PACK_PATHS` closes that gap for the specific collections that
 * carry working, non-public material — the Constitutional Internet
 * manuscript is the first entry, added because its tab is `adminOnly: true`
 * while its sibling commentary tabs (Experience Sovereignty, COYN Thesis,
 * The Polity) are not and must stay reachable. Scoped to exact
 * pack+path-prefix pairs rather than gating this whole route, so every other
 * pack/collection's existing public-read behavior is unchanged.
 *
 * SECURITY (2026-08-27 IRL OS containment — see
 * docs/security/2026-08-27_irl-os-containment-breach-audit.md): the `irl`
 * pack is DEFAULT-DENY, not default-allow like every other pack. This is the
 * root-cause fix for the confirmed breach: the `irl` pack's `col_foundation`
 * / `col_experiments` collections carry the laboratory's confidential
 * research IP (internal charter canon, research-programme roadmaps,
 * experiment protocols/methods/PRDs, EXP-P1 readiness material) and were
 * being served to ANY caller — public, unauthenticated, or otherwise — via
 * this route regardless of the calling tab's `adminOnly` flag or which
 * cartridge (private `irl-cartridge` or public `irl-os`) mounted the tab.
 * `IRL_PUBLIC_PACK_PATHS` is the explicit allowlist of the few `irl`-pack
 * paths that ARE deliberately public (today: only the shared Participation
 * Overview, consumed by both cartridges' `irl(-os)-participation-overview`
 * tabs, neither of which is admin-gated). Every other `irl`-pack path
 * requires canonical server-resolved admin authority — never a client
 * `isAdmin` query/prop, which this route never reads. Do not widen this
 * allowlist without an explicit operator public-classification decision;
 * see the audit doc's Phase 2 section for the pending classification work.
 *
 * SECURITY/FUNCTIONAL ADDENDUM (2026-08-27, discovered during Phase 1
 * deployment verification): `AgentiqCartridgeTab` (the client this route
 * serves) ALWAYS fetches `collections.json` first — to find the named
 * collection, then resolve `defaultPath` within it — even when the caller
 * already has a specific `defaultPath` and needs nothing else from the
 * index. Blocking `collections.json` outright (the naive extension of the
 * default-deny rule above) broke the ONE surface this pass explicitly
 * intended to keep public: Participation Overview. Widening the allowlist
 * to include the REAL `collections.json` is not an option — the operator's
 * own verification pass confirmed it lists `IRL-015_partner-cover-letter.md`
 * and `IRL-012_austin-feedback-integration.md` by filename, i.e. it is
 * itself confidential metadata, not an index that happens to gate safely.
 * `servePublicRedactedIrlCollections()` is the resolution: for a non-admin
 * caller, `collections.json` is never denied outright and never served
 * verbatim — it is read once (admin-equivalent internal access) and
 * re-emitted with every collection's `items` array filtered down to
 * `IRL_PUBLIC_PACK_PATHS` only, and `description` fields dropped (they name
 * internal CFS/EXP/PRD ids in prose, not just paths). The client's existing
 * `collections.find(...).items` / `.title` logic works unmodified against
 * this redacted shape — no change to the shared client component.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { corpusReadPackFile } from "@/services/knowledge/packCorpusStore";
import { getActivePersona } from "@/services/identity/getActivePersona";

const ADMIN_GATED_PACK_PATHS: Array<{ packId: string; pathPrefix: string }> = [
  { packId: "polity-core", pathPrefix: "items/commentary/constitutional-internet/" },
];

/**
 * IRL pack — default-deny allowlist (2026-08-27 containment). Exact paths
 * only (not prefixes): every other `irl`-pack read requires canonical admin.
 */
const IRL_PUBLIC_PACK_PATHS: string[] = [
  "foundation/PARTICIPATION_overview.md",
];

const IRL_COLLECTIONS_PATH = "collections.json";

/**
 * Redacted `collections.json` for a non-admin caller on the `irl` pack —
 * see the file-header addendum comment. Filters every collection's `items`
 * to the public allowlist only, and drops `description` fields (the real
 * ones name internal CFS/EXP/IRL/PRD ids in prose). A collection whose
 * filtered `items` ends up empty is kept (with an empty array), never
 * dropped — dropping it would make `AgentiqCartridgeTab`'s
 * `collections.find((col) => col.id === collectionId)` fail for a caller
 * requesting that collection's own allowlisted document, which is exactly
 * the regression this function exists to fix.
 */
async function servePublicRedactedIrlCollections(): Promise<NextResponse> {
  try {
    const raw = await corpusReadPackFile("irl", IRL_COLLECTIONS_PATH);
    if (raw === null) {
      return NextResponse.json({ ok: false, error: "File not found." }, { status: 404 });
    }
    const real = JSON.parse(raw) as {
      collections?: Array<{ id: string; title: string; items?: string[] }>;
    };
    const redactedCollections = (real.collections ?? []).map((col) => ({
      id: col.id,
      title: col.title,
      items: (col.items ?? []).filter((item) => IRL_PUBLIC_PACK_PATHS.includes(item)),
    }));
    return NextResponse.json(
      {
        ok: true,
        format: "json",
        path: IRL_COLLECTIONS_PATH,
        data: { collections: redactedCollections },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "File not found.", details: String(error) },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
}

// SECURITY (2026-08-27 hotfix — no-store): this route's response now varies
// by caller identity (admin vs non-admin) for the SAME URL on the `irl`
// pack — `force-dynamic` keeps Next.js's own Full Route/Data Cache from
// ever serving one caller's response to another; `Cache-Control: no-store`
// on the caller-dependent responses below covers any downstream CDN/browser
// cache the same way. Prevents exactly the cache-mixing class of bug this
// route's admin/non-admin branching would otherwise be exposed to.
export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function isValidPackId(packId: string): boolean {
  return /^[a-z0-9-]+$/i.test(packId);
}

function sanitizePath(filePath: string): string | null {
  if (path.isAbsolute(filePath)) return null;
  const normalized = path.normalize(filePath);
  if (normalized.startsWith("..")) return null;
  return normalized;
}

export async function GET(request: NextRequest, context: { params: Promise<{ packId: string }> }) {
  const { packId } = (await context.params);

  if (!isValidPackId(packId)) {
    return NextResponse.json({ ok: false, error: "Invalid packId." }, { status: 400 });
  }

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ ok: false, error: "Missing path query." }, { status: 400 });
  }

  const safePath = sanitizePath(filePath);
  if (!safePath) {
    return NextResponse.json({ ok: false, error: "Invalid path." }, { status: 400 });
  }

  if (!safePath.endsWith(".md") && !safePath.endsWith(".json")) {
    return NextResponse.json({ ok: false, error: "Unsupported file type." }, { status: 400 });
  }

  // Defence-in-depth against traversal even though sanitizePath already rejects
  // absolute paths and leading "..": the resolved path must stay under the pack.
  const packRoot = path.join(process.cwd(), "codexes", "packs", packId);
  const fullPath = path.join(packRoot, safePath);
  if (!fullPath.startsWith(packRoot + path.sep)) {
    return NextResponse.json({ ok: false, error: "Path out of bounds." }, { status: 400 });
  }

  const gate = ADMIN_GATED_PACK_PATHS.find(
    (g) => g.packId === packId && safePath.startsWith(g.pathPrefix),
  );
  // IRL pack — default-deny (2026-08-27 containment): everything requires
  // canonical admin except the explicit public allowlist above. This is the
  // opposite default from every other pack (which is default-allow, gated
  // only by ADMIN_GATED_PACK_PATHS), because the `irl` pack's collections
  // carry confidential laboratory IP that was never meant to be servable to
  // an unauthenticated caller. `getActivePersona` resolves admin from the
  // authenticated session server-side — this never reads a client `isAdmin`
  // query param or prop.
  const requiresAdmin = gate || (packId === "irl" && !IRL_PUBLIC_PACK_PATHS.includes(safePath));
  if (requiresAdmin) {
    const persona = await getActivePersona(request).catch(() => null);
    if (!persona?.cartridgeFlags?.isAdmin) {
      // collections.json on the irl pack: redact and serve rather than deny
      // outright — see the file-header addendum comment and
      // servePublicRedactedIrlCollections's own doc comment.
      if (packId === "irl" && safePath === IRL_COLLECTIONS_PATH) {
        return servePublicRedactedIrlCollections();
      }
      return NextResponse.json(
        { ok: false, error: "Admin required." },
        { status: 403, headers: packId === "irl" ? NO_STORE_HEADERS : undefined },
      );
    }
  }

  try {
    // Reads through the pack-corpus seam: local FS in dev, the in-memory corpus
    // (hydrated from the remote blob) in the SSR Lambda where the pack files are
    // no longer bundled. A missing file surfaces as the same 404 as before.
    const raw = await corpusReadPackFile(packId, safePath);
    // irl-pack responses vary by caller identity (admin-only content falls
    // through to here only for an authenticated admin) — never cacheable by
    // URL alone. Every other pack's content is caller-independent, so its
    // existing cacheability is left untouched.
    const headers = packId === "irl" ? NO_STORE_HEADERS : undefined;
    if (raw === null) {
      return NextResponse.json({ ok: false, error: "File not found." }, { status: 404, headers });
    }
    if (safePath.endsWith(".json")) {
      try {
        const data = JSON.parse(raw);
        return NextResponse.json({ ok: true, format: "json", path: safePath, data }, { headers });
      } catch (error) {
        return NextResponse.json(
          { ok: false, error: "Invalid JSON file.", details: String(error) },
          { status: 500, headers }
        );
      }
    }
    return NextResponse.json({ ok: true, format: "markdown", path: safePath, content: raw }, { headers });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "File not found.", details: String(error) },
      { status: 404, headers: packId === "irl" ? NO_STORE_HEADERS : undefined }
    );
  }
}
