/**
 * Pack Corpus Store — the read seam for the codex pack markdown/JSON corpus.
 *
 * WHY THIS EXISTS
 * ----------------
 * The pack corpus (codexes/packs/**\/*.{md,json}) is browsable in every cartridge
 * docs tab and searched by the copilot. Tracing it into the Amplify SSR Lambda
 * bundle grew the artifact past the HARD 230686720-byte (220 MiB) platform cap —
 * and it grew every deploy (a session update doc lands in agentiq/updates each
 * time). This seam moves the corpus OUT of the bundle: the build uploads it to a
 * remote store (Supabase public object for the fast read path; canonical docs are
 * ALSO pinned to Autonomys AutoDrive for permanence + provenance — see
 * scripts/export-pack-corpus.mjs), and the Lambda hydrates it into an in-memory
 * map ONCE per container on first use. Search then runs full-content, in-memory,
 * exactly as before — no recall loss, no per-query network fetches.
 *
 * HYBRID (operator-chosen 2026-07-21): the RUNTIME read path is always the fast
 * Supabase blob (canonical docs are mirrored into it). AutoDrive holds the
 * canonical docs' permanent CIDs for provenance — it is deliberately NOT on the
 * hot path (its network latency/variance would hurt every cold start).
 *
 * MODE AUTO-DETECTION
 * -------------------
 * If the corpus is present on the local filesystem (dev, tests, or any build that
 * still traces it) we read straight from disk — zero behaviour change locally.
 * In the SSR Lambda the corpus is intentionally absent, so we hydrate from the
 * remote blob. No env flag required; presence of the files IS the signal.
 */

import * as fs from 'fs';
import * as path from 'path';

export const PACKS_ROOT = path.join(process.cwd(), 'codexes', 'packs');

/**
 * The exporter writes PACK_CORPUS_URL into .env.production ONLY after a
 * verified public upload of the full corpus blob (scripts/export-pack-corpus.mjs
 * — the same gate the amplify.yml strip step keys on). Its presence is therefore
 * the AUTHORITATIVE signal that this is a Phase-B deploy whose source of truth
 * is the remote blob — and it must override any filesystem sniffing.
 */
const PINNED_REMOTE = Boolean(process.env.PACK_CORPUS_URL);

/**
 * True in dev / tests / any bundle that still ships the corpus MARKDOWN on disk.
 *
 * Must test for an actual .md FILE, not the directory: the Amplify postBuild
 * strips the bundled pack .md (they're served remotely) but leaves the now-empty
 * `agentiq/updates/` directory behind. A directory-existence check would then
 * wrongly report local-FS mode and read an empty tree instead of hydrating the
 * remote blob. Checking for ≥1 .md in updates/ flips correctly to remote mode
 * once the bodies are stripped.
 *
 * PINNED_REMOTE SHORT-CIRCUIT (2026-07-22 incident): the deployed Lambda shipped
 * a PARTIAL pack tree — enough .md under agentiq/updates to satisfy this sniff
 * (Next's file tracer statically resolves the literal path this very check
 * names, so the check can self-satisfy) — which flipped the store to local-fs,
 * skipped remote hydration entirely, and 404'd every file outside the partial
 * tree (newer experiment docs; Austin QA ①b — corpus-status probe showed
 * mode:local-fs + packCorpusUrlEnv:true + probeHit:false). When the blob URL is
 * pinned, the blob IS the corpus: never let a lucky disk hit veto hydration.
 */
const LOCAL_CORPUS_PRESENT = (() => {
  if (PINNED_REMOTE) return false;
  try {
    const dir = path.join(PACKS_ROOT, 'agentiq', 'updates');
    return fs.readdirSync(dir).some((f) => f.endsWith('.md'));
  } catch {
    return false;
  }
})();

/**
 * Public URL of the concatenated corpus blob. Prefer an explicit override; else
 * derive the Supabase public-object URL from the standard env + branch. The
 * bucket is public-read (non-gated platform docs, already public on GitHub), so
 * the read path needs no key. Never guessed: derived only from env that the app
 * already sets (NEXT_PUBLIC_SUPABASE_URL); empty if unset → graceful degrade.
 */
function corpusBlobUrl(): string {
  if (process.env.PACK_CORPUS_URL) return process.env.PACK_CORPUS_URL;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!base) return '';
  const branch = process.env.PACK_CORPUS_BRANCH || process.env.AWS_BRANCH || 'dev';
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/pack-corpus/${branch}/corpus.json`;
}

// Absolute-path-keyed corpus (remote mode only). Keys mirror exactly what the
// callers build via path.join(PACKS_ROOT, ...), so corpusReadFile is a Map.get.
let corpus: Map<string, string> | null = null;
let hydrating: Promise<void> | null = null;
let lastAttemptMs = 0;
let lastError: string | null = null;
let lastUrl: string | null = null;
const RETRY_COOLDOWN_MS = 10_000;

function absKey(packRelKey: string): string {
  // packRelKey is relative to codexes/packs, e.g. "agentiq/updates/x.md"
  return path.join(PACKS_ROOT, packRelKey);
}

/**
 * Populate the in-memory corpus once per container. No-op in local-FS mode. On
 * fetch failure it leaves the corpus unhydrated and retries after a short
 * cooldown (so a transient blip on one cold start doesn't wedge the container
 * into permanently-empty grounding, nor retry-storm every request).
 */
export async function ensureCorpusHydrated(): Promise<void> {
  if (LOCAL_CORPUS_PRESENT) return;
  if (corpus) return;
  if (hydrating) return hydrating;
  if (Date.now() - lastAttemptMs < RETRY_COOLDOWN_MS) return; // cooldown after a recent failure

  hydrating = (async () => {
    lastAttemptMs = Date.now();
    const url = corpusBlobUrl();
    lastUrl = url;
    try {
      if (!url) throw new Error('pack corpus URL not configured (NEXT_PUBLIC_SUPABASE_URL unset)');
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`corpus fetch ${res.status} ${res.statusText}`);
      const obj = (await res.json()) as Record<string, string>;
      const map = new Map<string, string>();
      for (const [relKey, content] of Object.entries(obj)) {
        if (typeof content === 'string') map.set(absKey(relKey), content);
      }
      corpus = map; // success — cache for the container lifetime
      lastError = null;
      // eslint-disable-next-line no-console
      console.log(`[packCorpus] hydrated ${map.size} files from ${url}`);
    } catch (err) {
      // Non-fatal: copilot grounding degrades (empty results) rather than 500ing.
      lastError = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error('[packCorpus] hydration failed — grounding degraded:', lastError);
      // leave corpus null so the next request (post-cooldown) retries
    } finally {
      hydrating = null;
    }
  })();
  return hydrating;
}

/** Recursive .md lister mirroring the legacy filesystem behaviour (dev/FS mode). */
function listFsMarkdown(dir: string, root: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listFsMarkdown(full, root));
      } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        results.push(path.relative(root, full));
      }
    }
  } catch {
    // ignore unreadable dirs (parity with the legacy helper)
  }
  return results;
}

/**
 * Read one corpus file by ABSOLUTE path. Drop-in for the old
 * fs.readFileSync-based readPackFile: FS in local mode, in-memory map in remote
 * mode. Callers MUST have awaited ensureCorpusHydrated() at their async entry
 * point before the sync read loop (remote mode only).
 */
export function corpusReadFile(absPath: string): string | null {
  if (LOCAL_CORPUS_PRESENT) {
    try {
      return fs.readFileSync(absPath, 'utf8');
    } catch {
      return null;
    }
  }
  const hit = corpus?.get(absPath);
  if (hit !== undefined) return hit;
  // Remote-mode miss (or hydration failed/cooling down): fall back to disk.
  // Covers the deliberately-bundled sync-context files (exp-001 artifacts,
  // constitutional-glossary) and any partially-traced tree — a disk read that
  // also misses still returns null, so behaviour only ever improves.
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

/** List .md files under `dir`, returned relative to `root` (drop-in for the legacy lister). */
export function corpusListMarkdown(dir: string, root: string): string[] {
  if (LOCAL_CORPUS_PRESENT) return listFsMarkdown(dir, root);
  // Remote mode: list from the hydrated map, UNIONED with whatever is on disk —
  // if hydration failed (corpus null) a partially-traced tree still yields
  // partial results instead of none, and the deliberately-bundled files stay
  // listable. Dedupe keeps the two sources from double-listing.
  const seen = new Set<string>();
  const out: string[] = [];
  if (corpus) {
    const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
    for (const abs of corpus.keys()) {
      if (
        abs.startsWith(prefix) &&
        abs.endsWith('.md') &&
        !path.basename(abs).startsWith('.')
      ) {
        const rel = path.relative(root, abs);
        if (!seen.has(rel)) {
          seen.add(rel);
          out.push(rel);
        }
      }
    }
  }
  for (const rel of listFsMarkdown(dir, root)) {
    if (!seen.has(rel)) {
      seen.add(rel);
      out.push(rel);
    }
  }
  return out;
}

/**
 * Convenience for the pack-file route: hydrate then read codexes/packs/<packId>/<relPath>.
 * relPath is already sanitised by the caller.
 */
export async function corpusReadPackFile(packId: string, relPath: string): Promise<string | null> {
  await ensureCorpusHydrated();
  return corpusReadFile(path.join(PACKS_ROOT, packId, relPath));
}

/** Exposed for the canary + diagnostics. */
export function __corpusMode(): 'local-fs' | 'remote' {
  return LOCAL_CORPUS_PRESENT ? 'local-fs' : 'remote';
}

/**
 * Diagnostic snapshot of the corpus store — used by /api/codex/corpus-status to
 * root-cause "doc failed to load" without Lambda log access. Optionally probes
 * whether a specific pack-relative key (e.g. "irl/foundation/.../README.md")
 * resolves in the hydrated corpus.
 */
export function getCorpusStatus(probeRelKey?: string): Record<string, unknown> {
  const keyCount = corpus?.size ?? 0;
  const sampleKeys = corpus
    ? Array.from(corpus.keys()).slice(0, 5).map((abs) => path.relative(PACKS_ROOT, abs))
    : [];
  const status: Record<string, unknown> = {
    mode: LOCAL_CORPUS_PRESENT ? 'local-fs' : 'remote',
    pinnedRemote: PINNED_REMOTE,
    hydrated: corpus !== null,
    keyCount,
    url: lastUrl ?? corpusBlobUrl(),
    lastError,
    supabaseUrlEnv: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
    packCorpusUrlEnv: Boolean(process.env.PACK_CORPUS_URL),
    sampleKeys,
  };
  if (probeRelKey) {
    status.probe = probeRelKey;
    // Report BOTH sources: the hydrated map AND the disk (the read path falls
    // back to disk on a map miss). The old map-only probeHit reported false in
    // local-fs mode even when the read would succeed — a lying diagnostic.
    const mapHit = corpus ? corpus.has(absKey(probeRelKey)) : false;
    let fsHit = false;
    try {
      fsHit = fs.existsSync(absKey(probeRelKey));
    } catch {
      fsHit = false;
    }
    status.probeMapHit = mapHit;
    status.probeFsHit = fsHit;
    status.probeHit = mapHit || fsHit;
  }
  return status;
}
