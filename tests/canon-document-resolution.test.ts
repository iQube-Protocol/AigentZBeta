/**
 * Canon document resolution canary — a `CFS-0NN` cited as a governing document
 * must resolve to a document that exists.
 *
 * THE DEFECT THIS GENERALISES (found by audit 2026-07-27, ruled on 2026-07-28).
 * `CFS-048` — the Invariant Discovery Engine charter — is named in the header of
 * `services/invariants/discoveryEngine.ts` and cited by eleven other source
 * files, by six foundation documents, and by the crystal seed, as though it were
 * a filing in `codexes/packs/irl/foundation/`. It never was. Nothing was lost:
 * git history over every ref shows no file matching `*CFS-048*` was EVER added
 * under that directory (`--diff-filter=A|D|R`, all refs). The charter is
 * complete and lives in the AgentiQ updates pack instead. So the platform spent
 * months citing a designation that resolved to nothing, and no mechanism
 * objected — because no mechanism existed. That is the CFS-053 shape exactly: a
 * rule with two homes, one of which is empty (§0, defect #2).
 *
 * Writing the check found a SECOND instance the audit had not seen: `CFS-045`
 * (Memory Compilation) is cited by eight source files under the same
 * assumption, with the same disposition. One defect, one class — which is the
 * point of putting the check here rather than pinning CFS-048 by name.
 *
 * WHAT AN EXCEPTION MEANS, AND WHY IT CANNOT HIDE THE SIGNAL. An entry in
 * `UNFILED_CHARTERS` is not a licence to be missing. It is a RELOCATION CLAIM —
 * "this designation is real, and its document is at this other path" — and every
 * clause of that claim is proven here: the path exists, its filename carries the
 * id, and its own first heading declares the id. Pointing an exception at a real
 * but different charter fails. An exception is also required to be EARNED (some
 * file must actually cite it) and to be TEMPORARY (the moment the document is
 * filed in the foundation, the exception must be deleted or the suite goes red).
 * Filing these two charters as CFS documents is an operator act under Law XI;
 * this canary records the outstanding decision rather than resolving it, and
 * makes any THIRD instance fail the build on the day it is introduced.
 *
 * WHY THIS ONE READS COMMENTS (contra `_lib/sourceAuthority`'s usual advice).
 * The `stripComments` guidance exists because a canary asserting "module X never
 * mentions Y" must not read prose. Here the prose IS the subject: the citation
 * under audit is `discoveryEngine.ts:2`, a doc-comment header. Stripping
 * comments would delete the very defect this file exists to detect.
 *
 * Indexed in `tests/source-of-truth-parity.test.ts` — a designation and its
 * document are one concern with two homes (`inv.engineering.036`).
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const REPO = process.cwd();
const FOUNDATION = 'codexes/packs/irl/foundation';

/** This file cites the ids it governs; it must not count as a citation of them. */
const SELF = 'canon-document-resolution.test.ts';

/**
 * Where a `CFS-0NN` citation is treated as naming a governing foundation
 * document. Each scope is proven non-empty below — a renamed directory must
 * fail loudly rather than silently contribute nothing.
 */
const CITATION_SCOPES: ReadonlyArray<{ dir: string; exts: readonly string[] }> = [
  { dir: FOUNDATION, exts: ['.md', '.json'] },
  { dir: 'services', exts: ['.ts', '.tsx'] },
  { dir: 'app', exts: ['.ts', '.tsx'] },
  { dir: 'components', exts: ['.ts', '.tsx'] },
  { dir: 'types', exts: ['.ts', '.tsx'] },
  { dir: 'tests', exts: ['.ts', '.tsx'] },
  { dir: 'scripts', exts: ['.ts', '.tsx'] },
];

interface UnfiledCharter {
  /** The designation cited across the platform. */
  readonly id: string;
  /** Where the charter actually lives. Proven to exist and to BE that charter. */
  readonly charterPath: string;
  /** Must name the pack that holds it — derived from charterPath, not asserted by hand. */
  readonly reason: string;
}

/**
 * Designations chartered into the AgentiQ updates pack and never filed as a CFS
 * in the foundation. Both are real, complete charters; neither is a missing
 * document. Whether a charter filed in `agentiq/updates` should be MOVED to the
 * foundation is an operator decision (Law XI) — recorded, not taken.
 */
const UNFILED_CHARTERS: readonly UnfiledCharter[] = [
  {
    id: 'CFS-045',
    charterPath:
      'codexes/packs/agentiq/updates/2026-07-19_cfs-045-memory-compilation-charter.md',
    reason:
      'Memory Compilation. Chartered into the agentiq updates pack 2026-07-19 and never filed in the foundation; cited by the memory service, the chat route and the copilot layer as a governing spec. Filing decision outstanding with the operator.',
  },
  {
    id: 'CFS-048',
    charterPath:
      'codexes/packs/agentiq/updates/2026-07-20_cfs-048-invariant-discovery-engine-charter.md',
    reason:
      'Invariant Discovery Engine. Chartered into the agentiq updates pack 2026-07-20 and never filed in the foundation — git history over all refs shows no foundation file was ever added or deleted for it. Filing decision outstanding with the operator (recorded in the CCB completion artifact, 2026-07-27).',
  },
];

// ─────────────────────────── resolution ───────────────────────────

type Resolution =
  | { kind: 'foundation'; path: string }
  | { kind: 'unfiled-charter'; path: string }
  | { kind: 'unresolved' };

/** The foundation filing for an id, or null. `CFS-003` never matches `CFS-003a_…`. */
function foundationDocFor(id: string): string | null {
  const hit = readdirSync(join(REPO, FOUNDATION)).find(
    (f) => f.startsWith(`${id}_`) && f.endsWith('.md'),
  );
  return hit ? `${FOUNDATION}/${hit}` : null;
}

/** Resolve a cited designation to the document that carries it. */
function resolveCanonDocument(id: string): Resolution {
  const filed = foundationDocFor(id);
  if (filed) return { kind: 'foundation', path: filed };
  const exception = UNFILED_CHARTERS.find((e) => e.id === id);
  if (exception) return { kind: 'unfiled-charter', path: exception.charterPath };
  return { kind: 'unresolved' };
}

// ─────────────────────────── citation scan ───────────────────────────

const CFS_TOKEN = /CFS-\d{3}[a-z]?/g;

function walk(dir: string, exts: readonly string[], out: string[]): void {
  for (const entry of readdirSync(join(REPO, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, exts, out);
    else if (exts.includes(extname(entry.name)) && entry.name !== SELF) out.push(rel);
  }
}

/** Files scanned, per configured scope. */
const filesByScope = new Map<string, string[]>(
  CITATION_SCOPES.map((s) => {
    const found: string[] = [];
    if (existsSync(join(REPO, s.dir))) walk(s.dir, s.exts, found);
    return [s.dir, found];
  }),
);

/** designation → the files that cite it. */
const citations = ((): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const files of filesByScope.values()) {
    for (const file of files) {
      const seen = new Set(readFileSync(join(REPO, file), 'utf8').match(CFS_TOKEN) ?? []);
      for (const id of seen) map.set(id, [...(map.get(id) ?? []), file]);
    }
  }
  return map;
})();

// ─────────────────────────── the canary ───────────────────────────

describe('canon document resolution — a cited CFS resolves to a real document', () => {
  it('the scan is not vacuous — every configured scope yields files AND citations', () => {
    // Without this, a renamed directory or a broken extension filter turns every
    // assertion below into a pass over an empty set. That is defect class #7/#8
    // of CFS-053 §1: a canary that survives its own mutation.
    for (const { dir } of CITATION_SCOPES) {
      const files = filesByScope.get(dir)!;
      expect(files.length, `scope '${dir}' scanned no files — the scope is broken, not clean`)
        .toBeGreaterThan(0);
      const citing = files.filter((f) => CFS_TOKEN.test(readFileSync(join(REPO, f), 'utf8')));
      CFS_TOKEN.lastIndex = 0;
      expect(citing.length, `scope '${dir}' produced no CFS citation at all`).toBeGreaterThan(0);
    }
    // And the specific citation the ruling turned on is actually observed.
    expect(citations.get('CFS-048') ?? [], 'the audited CFS-048 citation is not seen by the scan')
      .toContain('services/invariants/discoveryEngine.ts');
  });

  it('the resolver distinguishes filed, relocated and unresolved — it does not just say yes', () => {
    // Kills the mutation that makes resolveCanonDocument always resolve, which
    // would leave the whole file green while enforcing nothing.
    expect(resolveCanonDocument('CFS-009').kind).toBe('foundation');
    expect(resolveCanonDocument('CFS-048').kind).toBe('unfiled-charter');
    expect(resolveCanonDocument('CFS-999').kind).toBe('unresolved');
  });

  it('every cited designation resolves to a document', () => {
    const dangling = [...citations.entries()]
      .filter(([id]) => resolveCanonDocument(id).kind === 'unresolved')
      .map(([id, files]) => `${id} — cited by ${files.slice(0, 3).join(', ')}`);

    expect(
      dangling,
      'These designations are cited as governing documents but resolve to nothing. ' +
        'File the document, or add a reasoned relocation claim to UNFILED_CHARTERS. ' +
        'Deleting the citation to silence this is forbidden — it is the signal.',
    ).toEqual([]);
  });

  it('an exception proves its relocation claim — right path, right document', () => {
    for (const ex of UNFILED_CHARTERS) {
      const abs = join(REPO, ex.charterPath);
      expect(existsSync(abs), `${ex.id}: charterPath does not exist — ${ex.charterPath}`).toBe(true);

      // Bind the path to the id, so an exception cannot point at a real but
      // different charter (the mutation that would otherwise pass on existsSync).
      expect(ex.charterPath.toLowerCase(), `${ex.id}: charterPath is not that document`)
        .toContain(ex.id.toLowerCase());

      // The document must title itself with EXACTLY this designation. `# CFS-045-A1`
      // is a different designation and must not satisfy the claim for CFS-045.
      const body = readFileSync(abs, 'utf8');
      const heading = body.split('\n').find((l) => l.startsWith('# ')) ?? '';
      expect(heading, `${ex.id}: the document at charterPath does not title itself ${ex.id}`)
        .toMatch(new RegExp(`^# ${ex.id}(?![-\\w])`));

      // And it must be the CHARTER, not one of the phase records filed beside it:
      // a charter declares its own ratification status, a build record does not.
      expect(
        body.split('\n').slice(0, 8).join('\n'),
        `${ex.id}: the document at charterPath declares no Status — it is a phase record, not the charter`,
      ).toMatch(/\*\*Status/);

      // The reason must name the pack that actually holds it — derived from the
      // path, so a reason copy-pasted from another exception fails.
      const pack = ex.charterPath.split('/')[2];
      expect(ex.reason, `${ex.id}: reason does not name the '${pack}' pack it lives in`)
        .toContain(pack);
    }
  });

  it('an exception is earned by a real citation, never a placeholder', () => {
    for (const ex of UNFILED_CHARTERS) {
      expect(
        citations.get(ex.id) ?? [],
        `${ex.id} is excepted but nothing cites it — remove the dead exception`,
      ).not.toEqual([]);
    }
  });

  it('an exception expires the moment the document is filed in the foundation', () => {
    // The mechanism must be able to fire in BOTH directions (CFS-053 CB-2/CB-6):
    // once the operator files one of these as a CFS, the relocation claim is
    // false and must be deleted rather than left to rot as a stale second home.
    for (const ex of UNFILED_CHARTERS) {
      expect(
        foundationDocFor(ex.id),
        `${ex.id} IS now filed in the foundation — delete its UNFILED_CHARTERS entry`,
      ).toBeNull();
    }
  });
});
