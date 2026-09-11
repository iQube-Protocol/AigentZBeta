/**
 * Knowledge-field docs as a Companion search source.
 *
 * WHY (operator, 2026-07-26). "Search Knowledge Field" federated seven
 * sources and NONE of them indexed the docs corpus — so "iQube" and
 * "Constitutional Plates" returned nothing while `CFS-027_canonical-plates.md`
 * sat unindexed in `codexes/packs/`. The operator's ruling on scope: a search
 * for "iQube" must return content ABOUT iQubes as a class — docs, specs,
 * articles — not a listing of every iQube in the registry. The knowledge
 * field is the corpus, so the corpus must be a source.
 *
 * ── DERIVED, NEVER HAND-LISTED (`inv.engineering.036`) ─────────────────────
 *
 * The index is built by walking `CODEX_DEFINITIONS` for tabs that mount
 * `AgentiqCartridgeTab` with `{ packId, collectionId }`, then reading that
 * pack's own `collections.json`. Every indexed doc therefore carries the
 * exact `(codexSlug, tabSlug)` a citizen would navigate to — the same
 * registry the picker and Quick Links already derive from. No hand-copied
 * doc list exists to drift.
 *
 * ── GATING FAILS CLOSED ────────────────────────────────────────────────────
 *
 * Only tabs with NO access gate are indexed (`adminOnly` / `partnerOnly`
 * tabs are skipped for every caller, including admins). Search results render
 * pre-navigation, so offering a gated doc title would leak that the doc
 * exists; the server-side gate still governs the destination regardless.
 *
 * ── TITLE INDEX, DELIBERATELY ──────────────────────────────────────────────
 *
 * v1 matches on the doc's filename-derived title only. Full-text over ~90
 * collections of markdown needs a cache strategy and is a chartered follow-on
 * — a slow search that reads hundreds of files per keystroke would be worse
 * than a narrow one. Titles in this corpus are descriptive
 * (`CFS-027_canonical-plates.md`), so title search already answers the
 * class-level queries the operator named.
 */

import { CODEX_DEFINITIONS } from '@/data/codex-configs';
import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';
import type { CompanionSearchResult, CompanionSearchTarget } from '@/types/companionSearch';

interface KnowledgeDoc {
  title: string;
  /** Pack-relative path — the T2-safe ref (a public repo path, no identity). */
  ref: string;
  packId: string;
  target: CompanionSearchTarget;
}

/** `foundation/CFS-027_canonical-plates.md` → `CFS-027 canonical plates`. */
export function docTitleFromPath(itemPath: string): string {
  const base = itemPath.split('/').pop() ?? itemPath;
  return base
    .replace(/\.mdx?$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

/** Tab is offered to search only when NOTHING gates it — fails closed. */
function tabIsUngated(tab: Record<string, unknown>): boolean {
  return !tab.adminOnly && !tab.partnerOnly;
}

// Per-instance cache. The corpus and CODEX_DEFINITIONS are static per deploy,
// so one build per warm lambda; a failure caches nothing and retries next call.
let cachedIndex: KnowledgeDoc[] | null = null;

async function buildIndex(): Promise<KnowledgeDoc[]> {
  if (cachedIndex) return cachedIndex;

  // (packId, collectionId) → navigation target, derived from the one registry.
  const targets = new Map<string, CompanionSearchTarget>();
  for (const codex of CODEX_DEFINITIONS) {
    for (const tab of codex.tabs ?? []) {
      const props = (tab.config as { props?: Record<string, unknown> } | undefined)?.props;
      const packId = typeof props?.packId === 'string' ? props.packId : null;
      const collectionId = typeof props?.collectionId === 'string' ? props.collectionId : null;
      if (!packId || !collectionId) continue;
      if (!tabIsUngated(tab as unknown as Record<string, unknown>)) continue;
      const key = `${packId}:${collectionId}`;
      // First registration wins — earlier CODEX_DEFINITIONS entries are the
      // more canonical homes (the hand-curated cartridges precede mirrors).
      if (!targets.has(key)) targets.set(key, { slug: codex.slug, tab: tab.slug });
    }
  }

  const packIds = [...new Set([...targets.keys()].map((k) => k.split(':')[0]))];
  const docs: KnowledgeDoc[] = [];

  await Promise.all(
    packIds.map(async (packId) => {
      const raw = await corpusReadPackFile(packId, 'collections.json').catch(() => null);
      if (!raw) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const collections = Array.isArray((parsed as { collections?: unknown }).collections)
        ? ((parsed as { collections: unknown[] }).collections as Array<Record<string, unknown>>)
        : Array.isArray(parsed)
          ? (parsed as Array<Record<string, unknown>>)
          : [];
      for (const col of collections) {
        const colId = typeof col.id === 'string' ? col.id : null;
        if (!colId) continue;
        const target = targets.get(`${packId}:${colId}`);
        if (!target) continue; // collection has no ungated home — not offered
        const items = Array.isArray(col.items) ? col.items : [];
        for (const item of items) {
          if (typeof item !== 'string') continue;
          docs.push({
            title: docTitleFromPath(item),
            ref: item,
            packId,
            target,
          });
        }
      }
    }),
  );

  cachedIndex = docs;
  return docs;
}

const KNOWLEDGE_DOC_RESULT_CAP = 12;

function normalize(value: string): string {
  return value.toLowerCase();
}

export async function searchKnowledgeDocs(query: string): Promise<CompanionSearchResult[]> {
  const needle = normalize(query.trim());
  if (!needle) return [];
  const docs = await buildIndex();

  const out: CompanionSearchResult[] = [];
  for (const doc of docs) {
    if (!normalize(doc.title).includes(needle)) continue;
    out.push({
      source: 'knowledge-doc',
      title: doc.title,
      subtitle: doc.packId,
      ref: doc.ref,
      target: doc.target,
    });
    if (out.length >= KNOWLEDGE_DOC_RESULT_CAP) break;
  }
  return out;
}

/** Test seam — lets the canary rebuild against a fresh corpus read. */
export function __resetKnowledgeDocIndex(): void {
  cachedIndex = null;
}
