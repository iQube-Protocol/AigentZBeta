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
 * RULED AND REPAIRED, 2026-07-28. The operator ruled the defect wider than the
 * audit had reported — *"a contiguous filing-convention defect covering CFS-045,
 * CFS-046, CFS-047 and CFS-048… the correct repair is therefore family-wide"* —
 * and ordered all four moved into the foundation, byte-identical, with **no
 * pointer stub** (*"a pointer-only stub would hide the convention failure without
 * actually restoring canonical resolution"*). All four are filed and registered,
 * so `UNFILED_CHARTERS` is now EMPTY and every clause below resolves through the
 * foundation. Recorded for honesty: CFS-045 and CFS-048 were cited-and-dangling;
 * **CFS-046 and CFS-047 were cited by nothing** — they shared the filing defect
 * but broke no reference, and filing them is prospective repair, not a fix.
 *
 * WHAT AN EXCEPTION MEANS, AND WHY IT CANNOT HIDE THE SIGNAL. An entry in
 * `UNFILED_CHARTERS` is not a licence to be missing. It is a RELOCATION CLAIM —
 * "this designation is real, and its document is at this other path" — and every
 * clause of that claim is proven here: the path exists, its filename carries the
 * id, and its own first heading declares the id. Pointing an exception at a real
 * but different charter fails. An exception is also required to be EARNED (some
 * file must actually cite it) and to be TEMPORARY (the moment the document is
 * filed in the foundation, the exception must be deleted or the suite goes red).
 *
 * WHY AN EMPTY EXCEPTION LIST DOES NOT MAKE THIS FILE VACUOUS (CB-2 / CB-7).
 * Every clause of the relocation-claim contract is a PURE function
 * (`relocationClaimFaults`, `hasExpired`) exercised against SYNTHETIC claims that
 * are known-bad, so each clause is watched failing on every run whether or not a
 * live exception exists. A canary whose only assertions iterate an empty array is
 * a mechanism that cannot fire, which CFS-053 CB-1 rules constitutionally
 * indistinguishable from a mechanism that does not exist.
 *
 * REGISTRY RESOLUTION, added on the same ruling. *"Add a canary requiring every
 * canonically cited CFS identifier to resolve through the foundation registry,
 * regardless of where its source file was originally authored."* Presence on disk
 * is not resolution: a document filed in the foundation directory but absent from
 * `codexes/packs/irl/collections.json` is unreachable in the Laboratory and in
 * the pack corpus, which is the CFS-048 defect wearing a different face — the
 * designation resolves for a reader with a checkout and for nobody else.
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
 * Designations chartered outside the foundation and not yet filed as a CFS.
 *
 * EMPTY since 2026-07-28. It previously held CFS-045 and CFS-048; the operator
 * ruled the defect family-wide across CFS-045…CFS-048 and all four were moved
 * into the foundation byte-identical (hashes before/after recorded in
 * `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`). The exceptions
 * expired exactly as this file was built for them to.
 *
 * Empty is the CORRECT resting state, not a disabled check: every clause of the
 * relocation-claim contract is proven against synthetic claims below, so a new
 * exception is checked the moment it appears. Filing a charter as a CFS remains
 * an operator act under Law XI.
 */
const UNFILED_CHARTERS: readonly UnfiledCharter[] = [];

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

/**
 * Resolve a cited designation to the document that carries it.
 *
 * `exceptions` is injectable so the `unfiled-charter` branch stays reachable —
 * and therefore provable — now that the live list is empty. A branch no test can
 * reach is CB-1's defect: it cannot fire, so it is indistinguishable from absent.
 */
function resolveCanonDocument(
  id: string,
  exceptions: readonly UnfiledCharter[] = UNFILED_CHARTERS,
): Resolution {
  const filed = foundationDocFor(id);
  if (filed) return { kind: 'foundation', path: filed };
  const exception = exceptions.find((e) => e.id === id);
  if (exception) return { kind: 'unfiled-charter', path: exception.charterPath };
  return { kind: 'unresolved' };
}

// ─────────── the relocation-claim contract, as pure predicates ───────────
//
// Extracted from the assertions they used to live inside so each clause can be
// exercised against a SYNTHETIC known-bad claim. That is what keeps this file
// non-vacuous with zero live exceptions (CFS-053 CB-2/CB-7).

/** Every way a relocation claim can be false. Empty = the claim is proven. */
function relocationClaimFaults(ex: UnfiledCharter): string[] {
  const faults: string[] = [];
  const abs = join(REPO, ex.charterPath);

  if (!existsSync(abs)) {
    faults.push(`charterPath does not exist — ${ex.charterPath}`);
    return faults; // nothing further is readable
  }
  // Bind the path to the id, so a claim cannot point at a real but different
  // charter (the mutation that would otherwise pass on existsSync alone).
  if (!ex.charterPath.toLowerCase().includes(ex.id.toLowerCase())) {
    faults.push('charterPath is not that document');
  }

  const body = readFileSync(abs, 'utf8');
  // The document must title itself with EXACTLY this designation. `# CFS-045-A1`
  // is a different designation and must not satisfy the claim for CFS-045.
  const heading = body.split('\n').find((l) => l.startsWith('# ')) ?? '';
  if (!new RegExp(`^# ${ex.id}(?![-\\w])`).test(heading)) {
    faults.push(`the document at charterPath does not title itself ${ex.id}`);
  }
  // And it must be the CHARTER, not a phase record filed beside it: a charter
  // declares its own ratification status, a build record does not.
  if (!/\*\*Status/.test(body.split('\n').slice(0, 8).join('\n'))) {
    faults.push('the document at charterPath declares no Status — it is a phase record, not the charter');
  }
  // The reason must name the pack that actually holds it — derived from the
  // path, so a reason copy-pasted from another exception fails.
  const pack = ex.charterPath.split('/')[2];
  if (!ex.reason.includes(pack)) faults.push(`reason does not name the '${pack}' pack it lives in`);

  return faults;
}

/** A relocation claim expires the moment its document IS filed in the foundation. */
function hasExpired(ex: UnfiledCharter): boolean {
  return foundationDocFor(ex.id) !== null;
}

// ─────────── the foundation REGISTRY (operator ruling, 2026-07-28) ───────────

const IRL_COLLECTIONS = 'codexes/packs/irl/collections.json';

/** Every `foundation/…` item registered in the IRL pack's collections. */
function registeredFoundationPaths(): Set<string> {
  const raw = JSON.parse(readFileSync(join(REPO, IRL_COLLECTIONS), 'utf8')) as {
    collections?: Array<{ items?: string[] }>;
  };
  const out = new Set<string>();
  for (const c of raw.collections ?? []) {
    for (const item of c.items ?? []) {
      if (item.startsWith('foundation/')) out.add(`codexes/packs/irl/${item}`);
    }
  }
  return out;
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
    expect(resolveCanonDocument('CFS-999').kind).toBe('unresolved');

    // The relocated branch, proven through an injected claim because the live
    // list is empty. Filing CFS-045…048 must not silently retire this branch.
    const probe: UnfiledCharter = {
      id: 'CFS-999',
      charterPath: 'codexes/packs/agentiq/updates/2026-07-20_cfs-999-nonexistent.md',
      reason: 'synthetic probe — agentiq',
    };
    expect(resolveCanonDocument('CFS-999', [probe]).kind).toBe('unfiled-charter');

    // And a filing always OUTRANKS a relocation claim, so a stale claim can
    // never shadow the real document.
    const shadow: UnfiledCharter = { ...probe, id: 'CFS-009' };
    expect(resolveCanonDocument('CFS-009', [shadow]).kind).toBe('foundation');
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

  it('the four charters ruled family-wide on 2026-07-28 resolve in the foundation', () => {
    // The repair itself, pinned. Moving one of them back — or renaming it so the
    // `CFS-0NN_` prefix is lost — fails here rather than silently re-opening the
    // defect the ruling closed. Titles are asserted so a stub bearing the name
    // cannot satisfy it: a pointer-only file would hide the convention failure.
    for (const id of ['CFS-045', 'CFS-046', 'CFS-047', 'CFS-048'] as const) {
      const res = resolveCanonDocument(id);
      expect(res.kind, `${id} must be filed in the foundation (operator ruling 2026-07-28)`).toBe(
        'foundation',
      );
      const body = readFileSync(join(REPO, (res as { path: string }).path), 'utf8');
      const heading = body.split('\n').find((l) => l.startsWith('# ')) ?? '';
      expect(heading, `${id}: the filed document does not title itself ${id}`).toMatch(
        new RegExp(`^# ${id}(?![-\\w])`),
      );
      // No stub: the ruling forbids a pointer standing in for the charter.
      expect(
        body.length,
        `${id}: the filed document is too short to be the charter — a pointer stub hides the defect`,
      ).toBeGreaterThan(2000);
    }
  });

  it('no pointer stub was left where the four charters used to live', () => {
    // "A pointer-only stub would hide the convention failure without actually
    // restoring canonical resolution" — operator, 2026-07-28. A stub would ALSO
    // recreate `inv.engineering.036`: two homes claiming one designation.
    for (const legacy of [
      'codexes/packs/agentiq/updates/2026-07-19_cfs-045-memory-compilation-charter.md',
      'codexes/packs/agentiq/updates/2026-07-19_cfs-046-invariant-reasoning-cycle.md',
      'codexes/packs/agentiq/updates/2026-07-20_cfs-047-observer-modelling-researchqube-retrieval.md',
      'codexes/packs/agentiq/updates/2026-07-20_cfs-048-invariant-discovery-engine-charter.md',
    ]) {
      expect(existsSync(join(REPO, legacy)), `a stub survives at ${legacy}`).toBe(false);
    }
    // And the stale registration is gone, so only one registry claims them.
    const agentiq = readFileSync(join(REPO, 'codexes/packs/agentiq/collections.json'), 'utf8');
    for (const id of ['cfs-045-memory-compilation-charter', 'cfs-046-invariant-reasoning-cycle']) {
      expect(agentiq.includes(id), `agentiq/collections.json still registers ${id}`).toBe(false);
    }
  });

  it('EVERY cited designation that resolves also resolves through the foundation REGISTRY', () => {
    // The ruling's canary: *"every canonically cited CFS identifier [must]
    // resolve through the foundation registry, regardless of where its source
    // file was originally authored."* Presence on disk is not resolution — an
    // unregistered document is unreachable in the Laboratory and the pack
    // corpus, which is the CFS-048 defect wearing a different face.
    const registered = registeredFoundationPaths();
    expect(registered.size, 'the foundation registry read produced nothing — the reader is broken')
      .toBeGreaterThan(20);

    const unregistered = [...citations.keys()]
      .map((id) => ({ id, res: resolveCanonDocument(id) }))
      .filter((r) => r.res.kind === 'foundation')
      .filter((r) => !registered.has((r.res as { path: string }).path))
      .map((r) => `${r.id} — ${(r.res as { path: string }).path}`);

    expect(
      unregistered,
      `These designations are cited and their documents exist on disk, but they are not registered ` +
        `in ${IRL_COLLECTIONS}, so they resolve for a reader with a checkout and for nobody else. ` +
        `Register them; do not delete the citation.`,
    ).toEqual([]);
  });

  it('the registry check can fail — an unregistered path is detected, not assumed away', () => {
    // CB-5 applied to the check above: a set-membership assertion over a set
    // that happens to contain everything is indistinguishable from no check.
    const registered = registeredFoundationPaths();
    expect(registered.has(`${FOUNDATION}/CFS-048_invariant-discovery-engine-charter.md`)).toBe(true);
    expect(registered.has(`${FOUNDATION}/CFS-999_this-was-never-registered.md`)).toBe(false);
  });

  it('the relocation-claim contract bites — each clause rejects a known-bad claim', () => {
    // Every live claim must be fault-free…
    for (const ex of UNFILED_CHARTERS) {
      expect(relocationClaimFaults(ex), `${ex.id}: relocation claim is not proven`).toEqual([]);
    }

    // …and the contract itself is watched failing, so an empty list never means
    // an unenforced list. One synthetic claim per clause.
    const filed = 'codexes/packs/irl/foundation/CFS-048_invariant-discovery-engine-charter.md';
    const phaseRecord = 'codexes/packs/agentiq/updates/2026-07-20_cfs-048-phase2-compare.md';

    // (a) the path does not exist
    expect(
      relocationClaimFaults({ id: 'CFS-999', charterPath: 'codexes/packs/agentiq/updates/cfs-999.md', reason: 'agentiq' }),
    ).toContain('charterPath does not exist — codexes/packs/agentiq/updates/cfs-999.md');

    // (b) the path is a real document, but not that designation's
    expect(
      relocationClaimFaults({ id: 'CFS-045', charterPath: filed, reason: 'irl' }),
    ).toContain('charterPath is not that document');

    // (c) the target is a phase record, not the charter (no **Status header)
    expect(
      relocationClaimFaults({ id: 'CFS-048', charterPath: phaseRecord, reason: 'agentiq' }).join(' | '),
    ).toContain('phase record, not the charter');

    // (d) the reason does not name the pack the document actually lives in
    expect(
      relocationClaimFaults({ id: 'CFS-048', charterPath: filed, reason: 'lives in the agentiq pack' }),
    ).toContain("reason does not name the 'irl' pack it lives in");

    // (e) a fully correct claim yields NO faults — otherwise (a)–(d) prove
    //     nothing but that the function always complains.
    expect(
      relocationClaimFaults({ id: 'CFS-048', charterPath: filed, reason: 'the irl pack' }),
    ).toEqual([]);
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
      expect(hasExpired(ex), `${ex.id} IS now filed in the foundation — delete its entry`).toBe(false);
    }

    // Proven, not assumed: expiry fires for a filed id and not for an unfiled
    // one. This is the clause that retired the CFS-045/048 exceptions on
    // 2026-07-28; if it stopped working nothing else would notice.
    expect(hasExpired({ id: 'CFS-048', charterPath: 'x', reason: 'y' })).toBe(true);
    expect(hasExpired({ id: 'CFS-999', charterPath: 'x', reason: 'y' })).toBe(false);
  });
});
