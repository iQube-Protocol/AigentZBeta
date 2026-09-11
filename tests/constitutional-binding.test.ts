/**
 * Constitutional Binding canaries — CFS-053 §8.
 *
 *   A constitutional mechanism is not complete until it is bound to an
 *   observable event, produces an observable consequence, emits constitutional
 *   proof, and its absence is detectable through mutation.
 *
 * WHY THIS FILE EXISTS. On 2026-07-27 eight defects were found in one session
 * that looked unrelated and were one shape: a mechanism that was present, whose
 * intent was correct, whose implementation appeared complete, and which could
 * never fire. Nothing errored in any of them. NONE was found by reading; all
 * eight were found by mutation — by breaking the thing on purpose and observing
 * that nothing objected.
 *
 *   1. 56 of 92 config icon names were unregistered; the map fell through to a
 *      blank Circle for months (invoked, no consequence — CB-2).
 *   2. CLAUDE.md named `tests/persona-spine-fetch.test.ts` as the enforcement of
 *      a PARAMOUNT rule. The file did not exist (CB-1).
 *   3. `types/research.ts` said FINDING_LIFECYCLE's order was "pinned by
 *      canary". Nothing pinned it (CB-1).
 *   4. `createGovernanceReceipt` had ZERO call sites since Phase 0A — no
 *      constitutional amendment had ever produced a receipt (CB-1/3/6/7).
 *   5. `commitDocument` replaced by a literal: the helper stayed defined and
 *      every canary asserting it was PRESENT still passed (CB-5/7).
 *   6. `resolveIdentity` replaced by a literal, hours later, same shape (CB-5/7).
 *   7. A canary requiring "at least four" degrading conditions where there were
 *      five: deleting one still passed (CB-5).
 *   8. A canary asserting a section CONTAINED "Rejected", satisfied by a table
 *      header while the whole section had been deleted (CB-5).
 *
 * A specification about mechanisms that were never invoked, which was itself
 * never invoked, would be the defect performing itself. So this file is the
 * binding, and every assertion below is written to die when the property it
 * names dies — asserting the CALL and not the symbol, the STRUCTURE and not the
 * substring, EACH item and not a count. Those three corrections are defects 5-8
 * turned into a house style.
 *
 * NOT TESTED HERE, because it does not exist and this pass does not build it:
 * any mutation-testing harness. CB-5 is a reporting obligation plus the two
 * static canaries below, which catch its two commonest modes without one.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROOT = process.cwd();
const SPEC_PATH = 'codexes/packs/irl/foundation/CFS-053_constitutional-binding.md';
const spec = readSource(SPEC_PATH);

/** Markdown is hard-wrapped and partly quoted, so a sentence may straddle a
 *  line break AND carry a `>` continuation marker. Prose assertions run over
 *  this normalisation, never the raw file — otherwise a purely cosmetic rewrap
 *  fails a canary, which is the false-red that gets canaries ignored. */
const flat = (md: string): string => md.replace(/^[ \t]*>[ \t]?/gm, '').replace(/\s+/g, ' ');

// ───────────────────────────────────────────────────────────────────────────
// The registry of constitutional mechanisms and the canary that binds each.
//
// Deliberately hand-maintained and deliberately SMALL. A registry that tried to
// enumerate every mechanism in the tree would be a stale duplicate of the tree
// (`inv.engineering.036`); its admission rule is CFS-053 §8.1, and its parity
// with the specification's own table is checked below so the two cannot drift.
//
// It lives HERE rather than in a service module because it has exactly one
// consumer. A registry service read by nobody would be a CB-6 violation inside
// the enforcement of CB-6.
// ───────────────────────────────────────────────────────────────────────────

type Scope = 'exported' | 'module';

interface BoundMechanism {
  /** The symbol whose invocation is the observable event. */
  readonly symbol: string;
  /** The file that declares it. */
  readonly declaredIn: string;
  /** 'exported' — a caller anywhere counts. 'module' — the caller must be in
   *  the declaring file, because the symbol is module-private and a same-named
   *  export elsewhere must not be able to satisfy it. (Exactly the case with
   *  the readiness route's `resolveIdentity`, which shares its name with
   *  services/identity/identityResolver.ts.) */
  readonly scope: Scope;
  /** The canary that binds it. Must exist and must mention the symbol. */
  readonly canary: string;
  /** The incident that put it on the register (CFS-053 §1). */
  readonly defect: number;
}

const BOUND_MECHANISMS: readonly BoundMechanism[] = [
  {
    symbol: 'createGovernanceReceipt',
    declaredIn: 'services/governance/governanceReceiptHelper.ts',
    scope: 'exported',
    canary: 'tests/governance-ratification.test.ts',
    defect: 4,
  },
  {
    symbol: 'resolveIdentity',
    declaredIn: 'app/api/ops/dvn/readiness/route.ts',
    scope: 'module',
    canary: 'tests/anchoring-readiness.test.ts',
    defect: 6,
  },
  {
    symbol: 'getIconComponent',
    declaredIn: 'app/triad/components/codex/iconMap.ts',
    scope: 'exported',
    canary: 'tests/capability-artefact-home.test.ts',
    defect: 1,
  },
  {
    symbol: 'personaFetch',
    declaredIn: 'utils/personaSpine.tsx',
    scope: 'exported',
    canary: 'tests/persona-spine-fetch.test.ts',
    defect: 2,
  },
];

/** Source roots scanned for call sites. `tests/` is excluded on purpose: a test
 *  calling a mechanism proves the test runs, not that the platform invokes it —
 *  which is precisely how defect 4 survived. */
const SOURCE_ROOTS = ['app', 'services', 'components', 'utils', 'hooks', 'lib', 'packages', 'types', 'data'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude', 'dist', 'build', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (extname(name) === '.ts' || extname(name) === '.tsx') out.push(full);
  }
  return out;
}

let allSources: string[] | null = null;
function sourceFiles(): string[] {
  if (allSources) return allSources;
  const out: string[] = [];
  for (const root of SOURCE_ROOTS) walk(join(ROOT, root), out);
  allSources = out;
  return out;
}

/**
 * Remove the DECLARATION of `symbol` from `src`, so that what remains can only
 * match on a genuine use.
 *
 * This is the correction defects 5 and 6 forced: asserting that the symbol is
 * present is satisfied by the declaration alone, which is exactly what survives
 * when a call is replaced by a literal.
 */
function withoutDeclaration(src: string, symbol: string): string {
  return src
    .replace(new RegExp(`(export\\s+)?(default\\s+)?(async\\s+)?function\\s+${symbol}\\s*[(<]`, 'g'), ' DECL(')
    .replace(new RegExp(`(export\\s+)?(const|let|var)\\s+${symbol}\\s*[:=]`, 'g'), ' DECL=');
}

/** Files (repo-relative) in which `symbol` appears in CALL position. */
function callSites(symbol: string, files: string[]): string[] {
  const call = new RegExp(`\\b${symbol}\\s*\\(`);
  const found: string[] = [];
  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Cheap pre-filter first: comment-stripping every file in the tree costs a
    // full TS parse, and the overwhelming majority never mention the symbol.
    if (!raw.includes(symbol)) continue;
    // Prose is not a call site — a module header documenting the mechanism must
    // not satisfy its own binding (the grep-vs-comment defect class).
    const code = withoutDeclaration(stripComments(raw), symbol);
    if (call.test(code)) found.push(file.slice(ROOT.length + 1));
  }
  return found;
}

// ───────────────────────────────────────────────────────────────────────────
// §8.1 — CB-1, CB-6, CB-7: a registered mechanism has a live binding
// ───────────────────────────────────────────────────────────────────────────

describe('CB-1/6/7 — every registered constitutional mechanism is bound', () => {
  it('the registry is not empty (a vacuous registry would pass everything below)', () => {
    // Defect 7's correction as a house rule: a check whose subject can vanish
    // must assert that the subject exists before asserting anything about it.
    expect(BOUND_MECHANISMS.length, 'the mechanism registry is empty').toBeGreaterThan(0);
  });

  for (const m of BOUND_MECHANISMS) {
    it(`${m.symbol} — declared, called, and its canary exists (defect ${m.defect})`, () => {
      // (1) The declaration is where the registry says it is.
      const declared = stripComments(readSource(m.declaredIn));
      const declares = new RegExp(
        `(export\\s+)?(default\\s+)?(async\\s+)?function\\s+${m.symbol}\\s*[(<]` +
          `|(export\\s+)?(const|let|var)\\s+${m.symbol}\\s*[:=]`,
      );
      expect(
        declares.test(declared),
        `${m.symbol} is not declared in ${m.declaredIn} — the registry has drifted from the tree`,
      ).toBe(true);

      // (2) CB-7: it is CALLED somewhere that is not its own declaration.
      //     This is the assertion that would have caught defect 4 with no
      //     reading and no runtime, and the one that dies when a mutation
      //     replaces a call with a literal (defects 5 and 6).
      const scanned = m.scope === 'module' ? [join(ROOT, m.declaredIn)] : sourceFiles();
      const sites = callSites(m.symbol, scanned);
      expect(
        sites,
        `${m.symbol} is defined but never called${m.scope === 'module' ? ' in its own module' : ''} — ` +
          'definition without invocation is not implementation (CB-7), and an unused constitutional ' +
          'mechanism is a constitutional defect (CB-6). This is defect ' +
          `${m.defect}'s shape returning.`,
      ).not.toEqual([]);

      // (3) CB-1 limb (b): the canary this registry names must exist and must
      //     actually be about the mechanism. A binding that points at nothing
      //     is defect 2 wearing a registry entry.
      expect(
        existsSync(join(ROOT, m.canary)),
        `${m.symbol}'s canary ${m.canary} does not exist — a named enforcement that is not there is ` +
          'the defect this file exists to abolish',
      ).toBe(true);
      expect(
        readSource(m.canary),
        `${m.canary} no longer mentions ${m.symbol} — it has stopped being that mechanism's binding`,
      ).toContain(m.symbol);
    });
  }

  it('the registry and CFS-053 §8.1 are the same set (docs-mirror parity)', () => {
    // The table in the specification cannot be derived from this array, so it
    // gets a parity check rather than being trusted (`inv.engineering.036`).
    const from = spec.indexOf('Registered at v1.0');
    expect(from, 'CFS-053 §8.1 registry table not found').toBeGreaterThan(-1);
    const table = spec.slice(from, spec.indexOf('**Why defect 5', from));
    const documented = [...table.matchAll(/^\| `([A-Za-z0-9_]+)` \|/gm)].map((x) => x[1]);
    expect(documented.length, 'no rows parsed from the §8.1 table — the parity check would be vacuous')
      .toBeGreaterThan(0);
    expect(
      [...documented].sort(),
      'the specification and the registry disagree about which mechanisms are registered',
    ).toEqual(BOUND_MECHANISMS.map((m) => m.symbol).sort());
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §8.2 — CB-1 limb (b): named enforcement must exist
// ───────────────────────────────────────────────────────────────────────────

describe('CB-1 — no constitutional text names an enforcement that does not exist', () => {
  /** The constitutional corpus + the agent constitution + the type contracts.
   *  DELIBERATELY NOT codexes/packs/agentiq/updates/**: those are dated session
   *  records and forward-looking plans, several of which name tests as work to
   *  be done. Scanning them would produce the false-red that teaches people to
   *  ignore a canary — and this one guards the rule that made defect 2 possible
   *  for months. */
  function claimingFiles(): string[] {
    const files = ['CLAUDE.md'];
    for (const dir of ['codexes/packs/irl/foundation', 'types']) {
      for (const name of readdirSync(join(ROOT, dir))) {
        if (name.endsWith('.md') || name.endsWith('.ts')) files.push(`${dir}/${name}`);
      }
    }
    return files;
  }

  it('every tests/*.test.ts path named in the constitutional corpus resolves', () => {
    const REF = /tests\/[A-Za-z0-9._@-]+\.test\.ts/g;
    const dangling: string[] = [];
    let claims = 0;

    for (const file of claimingFiles()) {
      const src = readSource(file);
      for (const line of src.split('\n')) {
        // An unchecked checklist item is a PLAN, not a claim of enforcement.
        if (/^\s*[-*]\s*\[ \]/.test(line)) continue;
        for (const match of line.matchAll(REF)) {
          claims += 1;
          if (!existsSync(join(ROOT, match[0]))) dangling.push(`${file} → ${match[0]}`);
        }
      }
    }

    // Defect 7's correction: prove the subject exists before asserting about it.
    expect(claims, 'no enforcement references found at all — the canary would pass vacuously')
      .toBeGreaterThan(20);
    expect(
      dangling,
      'these constitutional texts name a canary that does not exist. A documented, unenforced rule ' +
        'accumulates violations behind it silently — that is defect 2 (CLAUDE.md named ' +
        'tests/persona-spine-fetch.test.ts for months before it was written) and defect 3 ' +
        '(types/research.ts claimed FINDING_LIFECYCLE was "pinned by canary" when nothing pinned it). ' +
        'Either write the canary or stop claiming it:\n' +
        dangling.join('\n'),
    ).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §8.3/§8.5 — CB-5 is recorded as an obligation with a resolvable table
// ───────────────────────────────────────────────────────────────────────────

describe('CB-5 — the mutation obligation is stated, not merely alluded to', () => {
  it('the specification carries a mutation table with a row per registered mechanism', () => {
    const from = spec.indexOf('### §8.5 Mutation table');
    expect(from, 'CFS-053 §8.5 (the mutation table) is gone').toBeGreaterThan(-1);
    const table = spec.slice(from, spec.indexOf('## §9', from));
    const rows = [...table.matchAll(/^\| M(\d+) \| (.+?) \| (.+?) \| (.+?) \|$/gm)];
    // Each row must name a mutation, the canary it must break, AND its result.
    // A table of mutations with no expected failure is a list of things someone
    // typed; a table with no results is a plan to test rather than a test.
    expect(
      rows.length,
      'the mutation table has fewer rows than there are registered mechanisms — every registered ' +
        'mechanism needs a stated mutation, or CB-5 is an exhortation',
    ).toBeGreaterThanOrEqual(BOUND_MECHANISMS.length);
    for (const [, n, mutation, expected, result] of rows) {
      expect(mutation.trim().length, `M${n} states no mutation`).toBeGreaterThan(10);
      expect(expected.trim().length, `M${n} names no canary that must fail`).toBeGreaterThan(5);
      // Defect 8's correction: assert the VALUE, not that a cell is non-empty.
      // "killed" or an explicit, named survival — never a blank or a dash.
      expect(
        result.trim(),
        `M${n} records no outcome — an unrun mutation must say so, not sit blank`,
      ).toMatch(/killed|SURVIVED/);
    }
  });

  it('records that a surviving canary is a defect, not a pass', () => {
    // The load-bearing sentence. Without it §8.5 reads as a checklist somebody
    // filled in, rather than the standard defects 5-8 established.
    expect(
      flat(spec),
      'CFS-053 no longer states that a canary surviving its mutation is a defect — that sentence IS ' +
        'CB-5; the table without it is decoration',
    ).toMatch(/Any row that does not fail is a defect in the canary, not a pass/);
  });

  it('does not claim a mutation harness this repo does not have', () => {
    // CS-001's drift defect: a constitutional text that reads as a shipped
    // system. There is no Stryker, no mutation runner, no CI mutation stage.
    const pkg = JSON.parse(readSource('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const harness = Object.keys(deps).filter((d) => d.includes('stryker'));
    expect(harness, 'a mutation harness has been added — CFS-053 §9 must stop saying there is none')
      .toEqual([]);
    expect(spec).toContain('**No mutation-testing harness.**');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §8.4 — the specification itself is bound: reachable, recorded, and pinned
// ───────────────────────────────────────────────────────────────────────────

describe('CFS-053 is itself bound to an observable act', () => {
  /** The seven clauses, restated independently of the file being checked — the
   *  idiom the Law XVI canary uses. The test carries its own statement of the
   *  ruling, so a drifted document fails rather than redefining the family. */
  const CB = [
    'Mechanisms must be bound to observable events',
    'Observable events must produce observable consequences',
    'Observable consequences must emit receipts',
    'Receipts must be attributable',
    'Every constitutional canary must fail under mutation',
    'Unused constitutional mechanisms are constitutional defects',
    'Definition without invocation is not implementation',
  ];

  it('states CB-1…CB-7 verbatim and in order', () => {
    const from = spec.indexOf('## §4 The CB invariant family');
    expect(from, 'CFS-053 §4 is gone').toBeGreaterThan(-1);
    const table = spec.slice(from, spec.indexOf('## §5', from));
    const stated = [...table.matchAll(/^\| \*\*CB-(\d)\*\* \| (.+?) \|/gm)].map((m) => [m[1], m[2].trim()]);
    expect(stated.length, 'no CB rows parsed — the parity check would be vacuous').toBe(7);
    for (let i = 0; i < CB.length; i += 1) {
      expect(stated[i][0], `CB row ${i + 1} is out of order`).toBe(String(i + 1));
      expect(
        stated[i][1],
        `CB-${i + 1} has drifted from the operator's ruling of 2026-07-27`,
      ).toContain(CB[i]);
    }
  });

  it('bounds CB-3/CB-4 rather than leaving them unfalsifiable', () => {
    // The most important decision in the document. Without the boundary, CB-3
    // demands a receipt from an icon map, and a rule that cannot be satisfied
    // is a rule everyone learns to skip — which is defect 2's mechanism applied
    // to the specification itself.
    expect(
      flat(spec),
      'CFS-053 no longer bounds CB-3/CB-4 to state transitions of record — the family becomes ' +
        'unfalsifiable and will be ignored',
    ).toMatch(/CB-3 and CB-4 bind only the subset of constitutional mechanisms that effect a \*state transition of record\*/);
    // …and it must still be recognisable as the invariant it restates, or it
    // is a second source of truth for the same rule (`inv.engineering.036`).
    expect(flat(spec), 'the CB-3 boundary no longer defers to inv.engineering.040').toContain(
      'inv.engineering.040',
    );
  });

  it('records that the boundary is a recommendation the ruling did not state', () => {
    // Epistemic honesty (CLAUDE.md): a scope decision made by an agent must not
    // read as operator-ratified text.
    expect(
      flat(spec),
      'the §5 boundary has stopped declaring itself a recommendation — an agent-authored narrowing ' +
        'presented as a ruling is exactly the drift this corpus guards against',
    ).toMatch(/The operator's ruling did not state this boundary\. What follows is a recommendation/);
  });

  it('does not add Law XVII, and does not touch the crystal (Law XI)', () => {
    const constitution = readSource('codexes/packs/irl/foundation/CFS-009_development-constitution.md');
    const laws = [...constitution.matchAll(/^## Law ([IVX]+) — /gm)].map((m) => m[1]);
    expect(
      laws[laws.length - 1],
      'a Law XVII has been added — amending the constitution is an operator act under Law XI, and ' +
        'CFS-053 §10.1 prepares the text precisely so an agent does not apply it',
    ).toBe('XVI');
    expect(spec).toContain('**No Law XVII.**');
    // The crystal block is supplied for the operator, never applied.
    const seed = readSource('codexes/packs/irl/foundation/canonical-invariants.seed.json');
    expect(
      seed.includes('CFS-053'),
      'CFS-053 has entered the seed crystal — that is an operator act (Law XI); §10.2 supplies the block',
    ).toBe(false);
  });

  it('is reachable — registered in the pack and recorded on the amendment ledger', () => {
    // CB-1 performed on the specification. An unregistered constitutional
    // document is a mechanism nothing can invoke.
    const collections = readSource('codexes/packs/irl/collections.json');
    expect(JSON.parse(collections)).toBeTruthy();
    expect(
      collections,
      'CFS-053 is not registered in the IRL pack — an unreachable constitutional document is the ' +
        'defect this document defines',
    ).toContain('foundation/CFS-053_constitutional-binding.md');

    const ledger = readSource('codexes/packs/polity-core/items/AMENDMENT_RECORDS.md');
    const row = ledger.split('\n').find((l) => l.includes('Constitutional Binding (CFS-053)'));
    expect(row, 'CFS-053 is not on the constitutional register').toBeTruthy();
    // Structure, not substring — defect 8's correction. The row must point back
    // at the full text, or it is a stub that says a thing happened.
    expect(row!, 'the register row does not point at the specification').toContain(SPEC_PATH);
  });

  it('every clause is traceable to an incident, or marked as an extrapolation', () => {
    // The document's worth is that it names eight concrete defects found in one
    // day. A version of it that had shed its evidence table would be doctrine.
    const from = spec.indexOf('## §1 The evidence base');
    expect(from, 'CFS-053 §1 (the evidence base) is gone').toBeGreaterThan(-1);
    const evidence = spec.slice(from, spec.indexOf('## §2', from));
    const rows = [...evidence.matchAll(/^\| \*\*(\d)\*\* \| /gm)].map((m) => Number(m[1]));
    expect(rows, 'the eight worked defects are no longer recorded, in order').toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    // Each row must carry a file path, so a reader can go and look.
    for (const line of evidence.split('\n').filter((l) => /^\| \*\*\d\*\* \|/.test(l))) {
      expect(line, `an evidence row names no location: ${line.slice(0, 60)}…`).toMatch(
        /`[a-zA-Z0-9_./[\]@-]+\.(ts|tsx|md)`/,
      );
    }
    // And the extrapolation marker must survive, or unevidenced claims start
    // reading as evidence-backed ones.
    expect(spec, 'the [extrapolation] marker is gone — unevidenced clauses now read as evidenced')
      .toContain('**[extrapolation]**');
  });
});
