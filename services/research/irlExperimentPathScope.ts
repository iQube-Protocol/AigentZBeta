/**
 * Maps a `codexes/packs/irl`-relative document path to the EXPERIMENT_REGISTRY
 * entry whose own experiment folder it lives under (2026-09-08, Phase 2
 * scoped reviewer restoration).
 *
 * This is the ONE mechanism the IRL pack's two file-serving routes
 * (`app/api/codex/packs/[packId]/file`, `app/api/public/irl/doc`) use to
 * decide whether a caller's SCOPED research-lab reviewer grant — not just
 * admin — may read a given path, per `services/passport/participationAccess.ts`'s
 * `resolveExperimentReviewGrant`/`diagnoseExperimentReviewAccess`. Derived
 * from each registry entry's own `protocolRef` (`inv.engineering.036` — no
 * second, hand-maintained path list, and no ad-hoc per-reviewer allowlist).
 *
 * SCOPE, DELIBERATELY NARROW: a path resolves to an experiment id ONLY when
 * it falls inside that experiment's OWN protocol directory
 * (`foundation/experiments/<slug>/`). Everything else — Charter canon,
 * research roadmaps, cross-experiment index files directly under
 * `foundation/experiments/` — returns `null` and stays exactly as gated as
 * the 2026-08-27 containment left it (admin, or the static public
 * allowlist). This mechanism only ever WIDENS access to a scoped reviewer
 * for material inside a REGISTERED experiment's own directory; it never
 * restores general/public IRL document access.
 */

import path from 'path';
import { EXPERIMENT_REGISTRY } from '@/types/research';

const IRL_PACK_PREFIX = 'codexes/packs/irl/';

interface ExperimentPathPrefix {
  id: string;
  /** Pack-relative directory prefix, always ending in '/'. */
  prefix: string;
}

/** Built once at module load — EXPERIMENT_REGISTRY is a static const array. */
const EXPERIMENT_PATH_PREFIXES: ExperimentPathPrefix[] = EXPERIMENT_REGISTRY
  .filter((entry) => entry.protocolRef.startsWith(IRL_PACK_PREFIX) && entry.protocolRef.endsWith('/README.md'))
  .map((entry) => ({
    id: entry.id,
    prefix: `${path.posix.dirname(entry.protocolRef.slice(IRL_PACK_PREFIX.length))}/`,
  }));

/**
 * Which registered experiment (if any) a pack-relative `irl` path belongs
 * to. `safePath` must already be sanitized (normalized, no `..`, no leading
 * `/`) by the caller — this function does no path-traversal validation of
 * its own.
 */
export function experimentIdForIrlPackPath(safePath: string): string | null {
  const normalized = safePath.replace(/^\.\//, '');
  for (const { id, prefix } of EXPERIMENT_PATH_PREFIXES) {
    if (normalized.startsWith(prefix)) return id;
  }
  return null;
}

/**
 * HELD, NON-OPERATIVE documents (2026-09-08, second pass) — paths that sit
 * inside a registered experiment's own directory (so path-prefix matching
 * alone cannot separate them) but are NOT operative material for that
 * experiment's review. The ONE entry today:
 * `exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md` is physically
 * colocated in EXP-P1's folder but is the Stage-0/IRE/IPV instrument-
 * validation handoff — a SEPARATE package under its own still-unresolved
 * `⚠ HOLD` (IRE-6, operator ruling 2026-07-27). This session mechanically
 * traced (2026-09-08) that the registered EXP-P1 protocol, the Crystal vP2
 * freeze record, and the frozen Arm B selector's own code contain ZERO
 * references to Stage-0/IRE/IPV — the ONLY place a dependency is asserted is
 * this document's own "EXP-P1 entry conditions" framing, never incorporated
 * into the registered protocol. Presenting it inside Austin's operative
 * EXP-P1 Reviewer Kit projection would misrepresent a held, separately-
 * governed package as EXP-P1 review material. Excluded here rather than
 * merely re-labelled, per explicit operator preference ("prefer excluding it
 * ... unless the registered EXP-P1 protocol explicitly requires it" — it does
 * not). The document itself, the HOLD, and Crystal/scientific state are
 * completely untouched; this is a document-LIST projection change only.
 */
const HELD_NON_OPERATIVE_PATHS = new Set<string>([
  'foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md',
]);

export function isHeldNonOperativeIrlPath(safePath: string): boolean {
  return HELD_NON_OPERATIVE_PATHS.has(safePath.replace(/^\.\//, ''));
}

/** Whether `experimentId` has a registered `irl`-pack protocol directory at
 *  all — i.e. whether {@link listIrlPackDocumentsForExperiment} can ever
 *  return anything non-empty for it. Used to decide whether a Workspace
 *  capability card has a "Reviewer Kit & Protocol" section to show. */
export function irlExperimentHasPackDocuments(experimentId: string): boolean {
  return EXPERIMENT_PATH_PREFIXES.some((p) => p.id === experimentId);
}

/**
 * Every `col_experiments` item (from the real `codexes/packs/irl/collections.json`,
 * never a hand-copied list) that resolves to `experimentId` via
 * {@link experimentIdForIrlPackPath} — the GENERALISED form of the
 * EXP-P1-only `resolveExpP1DocumentResources` helper in
 * `app/api/journey/validation-programme/agent-package/route.ts` (which stays
 * as-is; this is additive, not a replacement of that route's own EXP-P1
 * package). Works for ANY `EXPERIMENT_REGISTRY` entry with a matching
 * `protocolRef` — Austin/EXP-P1 is one instance, never a hardcoded case.
 */
export async function listIrlPackDocumentsForExperiment(experimentId: string): Promise<string[]> {
  if (!irlExperimentHasPackDocuments(experimentId)) return [];
  try {
    const { corpusReadPackFile } = await import('@/services/knowledge/packCorpusStore');
    const raw = await corpusReadPackFile('irl', 'collections.json');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { collections?: Array<{ id: string; items?: string[] }> };
    const collection = parsed.collections?.find((c) => c.id === 'col_experiments');
    const items = collection?.items ?? [];
    return items.filter((p) => experimentIdForIrlPackPath(p) === experimentId && !isHeldNonOperativeIrlPath(p));
  } catch {
    return [];
  }
}
