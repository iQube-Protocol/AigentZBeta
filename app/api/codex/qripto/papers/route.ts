/**
 * Qriptopian Papers + Magazines API
 *
 * GET /api/codex/qripto/papers
 *   ?group=papers|magazines   (default: papers)
 *   ?scope=<series-scope>     optional filter, e.g. 'papers/polity'
 *
 * Lists Qriptopian content uploaded via the codex manager and groups it by
 * series scope (papers/protocols, papers/polity, magazines/2, …). The series
 * scope is parsed from the storage filename prefix because we don't yet have
 * a dedicated `series_scope` column on `codex_media_assets` (backlog ref:
 * codexes/packs/agentiq/updates/2026-05-27_qripto-cover-upload-and-wip-contentqube-backlog.md).
 *
 * Covers are matched 1:N within a scope — the most recent cover in the
 * same series scope applies to all papers in that scope until explicit
 * pairing is added.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
// Force per-request execution so freshly-uploaded rows surface
// immediately without waiting for Next's static cache to roll over.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AssetRow = {
  id: string;
  title: string | null;
  supabase_title: string | null;
  asset_kind: string | null;
  mime_type: string | null;
  auto_drive_cid: string | null;
  cover_thumb_url: string | null;
  created_at: string | null;
};

type PaperCard = {
  id: string;
  title: string;
  scope: string;
  scopeLabel: string;
  pdfUrl: string;
  coverUrl: string | null;
  coverMime: string | null;
  mimeType: string;
  uploadedAt: string | null;
};

// Map a parsed scope key back to a display label that matches the upload
// modal's series picker.
const SCOPE_LABELS: Record<string, string> = {
  'papers/protocols':              'Protocols',
  'papers/polity':                 'The Polity',
  'papers/coyn-thesis':            'COYN Thesis',
  'papers/experience-sovereignty': 'Experience Sovereignty',
  'papers/polity-plutocracy':      'The Polity and the Plutocracy',
  'magazines/0':                   'Issue #0',
  'magazines/1':                   'Issue #1',
  'magazines/2':                   'Issue #2',
  'magazines/3':                   'Issue #3',
};

// Editorial order of series sections in the codex grid — top to bottom.
// Used by the final paper sort instead of alphabetical scopeLabel so
// the operator can pin Experience Sovereignty above COYN Thesis (and
// future re-orderings) without touching the matcher. Scopes not listed
// fall to the end in scope-label order.
const SCOPE_DISPLAY_ORDER: string[] = [
  'papers/experience-sovereignty',
  'papers/coyn-thesis',
  'papers/polity',
  'papers/protocols',
  'papers/polity-plutocracy',
  'magazines/0',
  'magazines/1',
  'magazines/2',
  'magazines/3',
];
function scopeOrderIndex(scope: string): number {
  const idx = SCOPE_DISPLAY_ORDER.indexOf(scope);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

const COVER_KINDS = new Set(['cover_image', 'cover_pdf']);

/**
 * Parse the series scope out of a storage URL like
 *   .../codex/assets/qriptopian/background_lore_doc/papers-polity_1779846543025.pdf
 * Returns 'papers/polity' or null when the prefix doesn't match.
 */
function parseScopeFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/(papers|magazines)-([a-z0-9-]+?)_\d+\./i);
  if (!match) return null;
  return `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const group = (url.searchParams.get('group') || 'papers').toLowerCase() === 'magazines'
      ? 'magazines'
      : 'papers';
    const scopeFilter = url.searchParams.get('scope');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from('codex_media_assets')
      .select('id, title, supabase_title, asset_kind, mime_type, auto_drive_cid, cover_thumb_url, created_at')
      .eq('series', 'qriptopian')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message, papers: [] }, { status: 500 });
    }

    const rows = (data || []) as AssetRow[];

    // Bucket rows by scope, separating covers from papers. Group-filter
    // (papers vs magazines) is applied here but `assets` below returns
    // EVERY in-scope row so the admin view can show unmatched covers.
    const buckets = new Map<string, { papers: AssetRow[]; covers: AssetRow[] }>();
    // Diagnostic counter — when the route returns zero papers it's
    // usually because rows exist but their storage filename prefix
    // doesn't match the (papers|magazines)-<slug>_<ts> pattern. Surface
    // the unparseable count so the admin can flag it.
    let unparseableCount = 0;
    for (const row of rows) {
      const scope = parseScopeFromUrl(row.auto_drive_cid);
      if (!scope) { unparseableCount += 1; continue; }
      if (!scope.startsWith(`${group}/`)) continue;
      if (scopeFilter && scope !== scopeFilter) continue;
      const bucket = buckets.get(scope) ?? { papers: [], covers: [] };
      if (COVER_KINDS.has(row.asset_kind ?? '')) {
        bucket.covers.push(row);
      } else {
        bucket.papers.push(row);
      }
      buckets.set(scope, bucket);
    }

    // Flat per-row admin list — covers AND papers each as their own
    // entry. Used by the Magazine & Codex admin table so the operator
    // can see every uploaded row regardless of whether it matched.
    type AdminAsset = {
      id: string;
      title: string;
      scope: string;
      scopeLabel: string;
      role: 'cover' | 'paper';
      assetKind: string | null;
      storageUrl: string;
      coverThumbUrl: string | null;
      mimeType: string;
      uploadedAt: string | null;
    };
    const assets: AdminAsset[] = [];
    for (const [scope, bucket] of buckets) {
      for (const role of ['cover', 'paper'] as const) {
        const list = role === 'cover' ? bucket.covers : bucket.papers;
        for (const row of list) {
          if (!row.auto_drive_cid) continue;
          assets.push({
            id: row.id,
            title: row.supabase_title || row.title || 'Untitled',
            scope,
            scopeLabel: SCOPE_LABELS[scope] || scope,
            role,
            assetKind: row.asset_kind,
            storageUrl: row.auto_drive_cid,
            coverThumbUrl: row.cover_thumb_url,
            mimeType: row.mime_type || 'application/octet-stream',
            uploadedAt: row.created_at,
          });
        }
      }
    }

    // Pair covers to papers by SHARED TITLE STEM. Operator workflow:
    // - Paper file:  "1 Beyond the Binary.pdf"  → title "1 Beyond the Binary"
    // - Cover file:  "Beyond the Binary.png"    → title "Beyond the Binary"
    // Both normalise to the stem "beyond the binary" and bind together.
    //
    // Match hierarchy:
    //   1) cover stem === paper stem (the canonical case)
    //   2) cover's leading number === paper's leading number (fallback
    //      for files like "1.pdf" / "1.png")
    //   3) cover created closest in time to the paper (last resort —
    //      mostly catches "I uploaded one cover for a one-paper scope")
    //   4) null — card paints the gradient fallback
    //
    // Non-image cover rows are filtered out — covers must be JPG/PNG/
    // WebP per CLAUDE.md "Grids of PDF Assets with Covers".
    function titleLeadingNumber(title: string): number | null {
      const m = title.match(/^\s*(\d{1,4})\s*[.\-:)]?\s+/);
      return m ? Number(m[1]) : null;
    }
    function titleStem(title: string): string {
      return title
        .toLowerCase()
        // strip leading sequence number (e.g. "1 ", "01. ", "1) ")
        .replace(/^\s*\d{1,4}\s*[.\-:)]?\s+/, '')
        // strip trailing " cover" / " thumbnail" / " thumb" tokens
        .replace(/\s+(cover|thumbnail|thumb)\s*$/i, '')
        // collapse punctuation + whitespace to single spaces
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }
    function timeDistMs(a: string | null, b: string | null): number {
      if (!a || !b) return Number.POSITIVE_INFINITY;
      const ta = Date.parse(a);
      const tb = Date.parse(b);
      if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
      return Math.abs(ta - tb);
    }

    const papers: PaperCard[] = [];
    for (const [scope, bucket] of buckets) {
      const imageCovers = bucket.covers
        .filter((c) => (c.mime_type || '').startsWith('image/'))
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

      // Pre-index covers by stem and by leading number for O(1) lookup.
      // First-seen wins (because covers are sorted DESC, that's the
      // most-recent matching cover for any given key).
      const coversByStem = new Map<string, AssetRow>();
      const coversByNumber = new Map<number, AssetRow>();
      for (const c of imageCovers) {
        const t = c.supabase_title || c.title || '';
        const stem = titleStem(t);
        if (stem && !coversByStem.has(stem)) coversByStem.set(stem, c);
        const n = titleLeadingNumber(t);
        if (n != null && !coversByNumber.has(n)) coversByNumber.set(n, c);
      }

      for (const row of bucket.papers) {
        const storageUrl = row.auto_drive_cid;
        if (!storageUrl) continue;
        const paperTitle = row.supabase_title || row.title || 'Untitled';
        const paperStem = titleStem(paperTitle);
        const paperNum = titleLeadingNumber(paperTitle);

        // 1) stem match
        let matchedCover: AssetRow | null = paperStem ? coversByStem.get(paperStem) ?? null : null;

        // 2) leading-number match
        if (!matchedCover && paperNum != null) {
          matchedCover = coversByNumber.get(paperNum) ?? null;
        }

        // 3) time-proximity fallback
        if (!matchedCover && imageCovers.length > 0) {
          matchedCover = [...imageCovers].sort(
            (a, b) => timeDistMs(a.created_at, row.created_at) - timeDistMs(b.created_at, row.created_at),
          )[0] ?? null;
        }

        const coverUrl = matchedCover?.cover_thumb_url || matchedCover?.auto_drive_cid || null;
        const coverMime = matchedCover?.mime_type || null;
        papers.push({
          id: row.id,
          title: paperTitle,
          scope,
          scopeLabel: SCOPE_LABELS[scope] || scope,
          pdfUrl: storageUrl,
          coverUrl,
          coverMime,
          mimeType: row.mime_type || 'application/pdf',
          uploadedAt: row.created_at,
        });
      }
    }

    // Final order: scope by editorial index (SCOPE_DISPLAY_ORDER), then
    // leading sequence number ASC (1 first) within scope, tie-break by
    // uploaded_at ASC. Reuses titleLeadingNumber declared above. Papers
    // without a leading number fall to the end of their scope.
    papers.sort((a, b) => {
      const sa = scopeOrderIndex(a.scope);
      const sb = scopeOrderIndex(b.scope);
      if (sa !== sb) return sa - sb;
      const na = titleLeadingNumber(a.title) ?? Number.POSITIVE_INFINITY;
      const nb = titleLeadingNumber(b.title) ?? Number.POSITIVE_INFINITY;
      if (na !== nb) return na - nb;
      return (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? '');
    });

    return NextResponse.json({
      group,
      scope: scopeFilter,
      papers,
      assets,
      diagnostics: {
        totalRows: rows.length,
        unparseable: unparseableCount,
        bucketCount: buckets.size,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error)?.message || 'Failed to load papers', papers: [] },
      { status: 500 },
    );
  }
}
