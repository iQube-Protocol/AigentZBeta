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
