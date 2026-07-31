/**
 * Evidence Architecture & Dual Validation canaries — CFS-052 §10, enforcing
 * CFS-009 **Law XVI — Constitutional Evidence** (operator-ratified 2026-07-27).
 *
 *   Truth is discovered through research.
 *   Trust is earned through operation.
 *   Knowledge is preserved as evidence.
 *   Confidence is preserved as proof.
 *
 * WHY CANARIES AND NOT PROSE. The repo's own retrospective (IRL-017 §2.3) found
 * that its recurring defect was never missing doctrine — it was missing
 * enforcement. This amendment is unusually exposed to that failure because most
 * of what it says is ALREADY law under other names (CFS-052 §0), so the risk is
 * not that someone contradicts it loudly but that someone COLLAPSES two of its
 * distinctions quietly: Registry into Commons, evidence into proof, operational
 * validation into scientific validation. Each canary below guards one collapse.
 *
 * A live instance of exactly that class was found while writing this file:
 * `types/research.ts` claimed `FINDING_LIFECYCLE` was "pinned by canary" and
 * nothing pinned it. That gap is now closed in `tests/capability-completion.test.ts`
 * (the "map, don't unify" block), which is where the lifecycle canaries live —
 * indexed here, NOT duplicated (`inv.engineering.036`).
 *
 * NOT TESTED HERE, because it does not exist and this pass does not build it:
 * the Commons promotion flow, `MetaCommonsResource`, and six of the eight proof
 * types named in Part III.2. Asserting anything about them would be asserting
 * against a fiction.
 */

import { describe, it, expect } from 'vitest';
import { readSource } from './_lib/sourceAuthority';
import {
  COMMONS_PROOF_CLASSES,
  type CapabilityCompletionArtifact,
} from '../types/capabilityCompletion';
import {
  parseCompletionArtifact,
  validateCompletionArtifact,
} from '../services/constitutional/capabilityCompletionArtifact';

const CFS_009 = 'codexes/packs/irl/foundation/CFS-009_development-constitution.md';
const CFS_052 = 'codexes/packs/irl/foundation/CFS-052_evidence-architecture-and-dual-validation.md';

const constitution = readSource(CFS_009);
const spec = readSource(CFS_052);

// ───────────────────────────────────────────────────────────────────────────
// The Law itself
// ───────────────────────────────────────────────────────────────────────────

describe('CFS-009 Law XVI — Constitutional Evidence', () => {
  /** The four clauses, restated independently of the file being checked. This
   *  is the same idiom the domain-profile canaries use for RATIFIED_SEEDS: the
   *  test carries its own statement of the ratified decision. */
  const LAW = [
    '**Truth is discovered through research.**',
    '**Trust is earned through operation.**',
    '**Knowledge is preserved as evidence.**',
    '**Confidence is preserved as proof.**',
  ];

  it('is recorded in the constitution, verbatim and in order', () => {
    const from = constitution.indexOf('## Law XVI');
    expect(from, 'Law XVI is not in CFS-009').toBeGreaterThan(-1);

    // Read ONLY the canonical blockquote — the Law's own statement. The prose
    // beneath it legitimately re-uses the clauses as paragraph openers, and
    // scanning the whole section would let a drifted clause be "found" in a
    // later paragraph and misreport which one changed.
    const section = constitution.slice(from);
    const quoted = section
      .split('\n')
      .filter((l) => l.startsWith('> '))
      .map((l) => l.slice(2).trim())
      .filter(Boolean);

    expect(
      quoted.slice(0, LAW.length),
      'the Law XVI blockquote has drifted from the ratified text',
    ).toEqual(LAW);
  });

  it('lives among the Laws, as a Law — not as loose prose', () => {
    // The operator's instruction: give it the weight of the numbered Laws and
    // follow the existing representation exactly. A "Constitutional principle"
    // heading would be the parallel representation that instruction forbids.
    expect(constitution).toMatch(/^## Law XVI — Constitutional Evidence$/m);
    expect(constitution).toMatch(/\*\(Amendment, ratified by operator direction 2026-07-27/);
  });

  it('the Laws are a contiguous roman sequence ending at XVI', () => {
    // A dropped or renumbered Law is a constitutional defect that reads as a
    // formatting slip.
    const ROMAN = [
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
      'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI',
    ];
    const found = [...constitution.matchAll(/^## Law ([IVX]+) — /gm)].map((m) => m[1]);
    expect(found, 'the Law sequence has a gap, a duplicate, or a new terminus').toEqual(ROMAN);
  });

  it('the specification and the constitution agree on the Law', () => {
    // CFS-052 reproduces the Law; a docs mirror that cannot be derived, so it
    // gets a parity check rather than a hand-maintained duplicate.
    for (const clause of LAW) {
      expect(spec, `CFS-052 does not carry the Law clause: ${clause}`).toContain(clause);
    }
    expect(spec).toContain('CFS-009 **Law XVI — Constitutional Evidence**');
  });

  it('is registered where the pack surfaces it, and the amendment is on the ledger', () => {
    const collections = readSource('codexes/packs/irl/collections.json');
    expect(JSON.parse(collections)).toBeTruthy();
    expect(
      collections,
      'CFS-052 is not registered in the IRL pack — an unregistered constitutional document is unreachable',
    ).toContain('foundation/CFS-052_evidence-architecture-and-dual-validation.md');

    // CFS-009's own enforcement clause: amendments are recorded in the
    // polity-core ledger. An amendment that skips the ledger is a Law nobody
    // can audit the provenance of.
    const ledger = readSource('codexes/packs/polity-core/items/AMENDMENT_RECORDS.md');
    expect(ledger, 'Law XVI is not on the amendment ledger').toContain('Law XVI');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Part I — the two validation regimes stay two
// ───────────────────────────────────────────────────────────────────────────

describe('Part I — dual validation: two regimes, mapped, never unified', () => {
  it('CFS-052 names both regimes and subordinates neither', () => {
    expect(spec).toContain('Structural Invariants');
    expect(spec).toContain('Constitutional Invariants');
    expect(spec).toMatch(/Neither class is subordinate to the other/);
  });

  it('the §D.5 boundary survives the amendment — operational success never canonises a structural claim', () => {
    // The conflict the commission asked to be confirmed or refuted. If a later
    // edit softened §2.1's reconciliation into "operational evidence canonises",
    // Amendment D §D.5 and Law XI would have been amended by a side effect.
    // Whitespace-insensitive: the source is hard-wrapped markdown, so a clause
    // may legitimately straddle a line break.
    const flat = spec.replace(/\s+/g, ' ');
    expect(
      flat,
      'CFS-052 no longer records that operational success cannot canonise a structural claim',
    ).toMatch(/never sufficient to canonise a \*structural\* claim/);
    expect(flat).toMatch(/governs USE, not canonisation/);
    // And the source rule it defers to is still stated as canon.
    const audit = readSource(
      'codexes/packs/agentiq/updates/2026-07-27_horizen-workspace-phase0-audit.md',
    );
    expect(audit, 'the §D.5 canonisation rule has gone').toContain(
      'Only the Research Lab canonises',
    );
  });

  it('the lifecycle canaries are indexed, not duplicated', () => {
    // `inv.engineering.036`: one authoritative location per concern. The ladder
    // canaries live with the ladders; this file must point at them rather than
    // grow a second copy that can drift.
    const lifecycleCanaries = readSource('tests/capability-completion.test.ts');
    const GONE = 'the ladder canary this file defers to has been renamed or removed — either restore it or move the check here, but never leave the index pointing at nothing';
    expect(lifecycleCanaries, GONE).toContain(
      'FINDING_LIFECYCLE is not rewritten, extended or re-ordered',
    );
    expect(lifecycleCanaries, GONE).toContain('neither ladder absorbs the other');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Parts III + IV — Registry and Commons cannot collapse into one
// ───────────────────────────────────────────────────────────────────────────

describe('Parts III/IV — the Registry stores evidence, the Commons stores proof', () => {
  const artifact: CapabilityCompletionArtifact = parseCompletionArtifact(
    readSource('codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md'),
  );
  const clone = (): CapabilityCompletionArtifact =>
    JSON.parse(JSON.stringify(artifact)) as CapabilityCompletionArtifact;

  it('the two admission criteria are different criteria (IV.1 vs IV.2)', () => {
    // BEHAVIOURAL, not textual: the shapes themselves must disagree about what
    // admission requires, or the boundary is decorative.
    //
    // Registry admission is EXISTENCE — `registerCapability` refuses only for a
    // missing id or label, and demands no evidence of anything.
    const registry = readSource('services/constitutional/capabilityRegistry.ts');
    expect(registry).toContain("reason: 'capabilityId required'");
    expect(registry).toContain("reason: 'displayLabel required'");
    expect(
      registry,
      'the Registry has started demanding proof — admission by existence (IV.1) has collapsed into admission by proof',
    ).not.toMatch(/reason:\s*'evidence(Refs)? required'/);

    // Commons admission is PROOF — a publication record with no evidence and no
    // claim scope is refused outright.
    const bare = clone();
    bare.commons.evidenceRefs = [];
    bare.commons.claimScope = '';
    const result = validateCompletionArtifact(bare);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.path === 'commons.evidenceRefs'),
      'a Commons record with no evidence was accepted — Principle 5 requires refusal, not filtering',
    ).toBe(true);
    expect(result.issues.some((i) => i.path === 'commons.claimScope')).toBe(true);
  });

  it('III.4 regeneration — a proof carries what is needed to reach its evidence', () => {
    // "Proof SHALL be sufficient to regenerate its evidence trail." The
    // structural form of that: evidence references and lineage are REQUIRED
    // fields, not optional ones. A proof that dropped them would be a claim.
    const types = readSource('types/capabilityCompletion.ts');
    const REQUIRED = 'a proof that can omit this cannot regenerate its evidence trail (III.4)';
    expect(types, `evidenceRefs is no longer a required field — ${REQUIRED}`).toMatch(
      /evidenceRefs:\s*string\[\];/,
    );
    expect(types, `evidenceRefs has been made optional — ${REQUIRED}`).not.toMatch(/evidenceRefs\?:/);
    expect(types, `lineage is no longer a required field — ${REQUIRED}`).toMatch(/lineage:\s*\{/);
    expect(types, `lineage has been made optional — ${REQUIRED}`).not.toMatch(/lineage\?:/);

    // And on the live artifact: the trail actually leads somewhere.
    expect(artifact.commons.evidenceRefs.length).toBeGreaterThan(0);
    expect(artifact.commons.lineage.sourceReferences.length).toBeGreaterThan(0);
    expect(artifact.commons.lineage.artifactPath).toBe(artifact.identity.artifactPath);
  });

  it('III.3 compression — the Commons record is smaller than the evidence it points at', () => {
    // "Proof SHALL contain only the minimum information required to verify a
    // demonstrated proposition. Supporting evidence SHALL remain within the
    // Registry." A proof record that inlined its evidence would not be a
    // compression, and the layer above would stop being worth having.
    const commonsRecord = JSON.stringify(artifact.commons);
    const evidenceBytes = artifact.commons.evidenceRefs
      .filter((r) => r.includes('/'))
      .reduce((n, r) => {
        try {
          return n + readSource(r).length;
        } catch {
          return n;
        }
      }, 0);
    expect(evidenceBytes, 'no evidence resolved — the comparison would be vacuous').toBeGreaterThan(
      10_000,
    );
    expect(
      commonsRecord.length,
      'the Commons record is not a compression of its evidence suite (III.3)',
    ).toBeLessThan(evidenceBytes / 10);
  });

  it('nothing claims a Commons that is not built', () => {
    // CFS-052 §8 is load-bearing: a constitutional text that reads as a shipped
    // system is the CS-001 drift defect. `MetaCommonsResource` does not exist.
    expect(spec).toContain('`MetaCommonsResource` does not exist');
    expect(artifact.commons.published).toBe(false);
    expect(artifact.commons.approvalRecordRef).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The four proof classes stay the ratified four
// ───────────────────────────────────────────────────────────────────────────

describe('the four native proof classes (Amendment D §D.1)', () => {
  it('are exactly the ratified four', () => {
    expect(
      [...COMMONS_PROOF_CLASSES],
      'the four native proof classes have drifted from Amendment D §D.1 — they are the commons discriminator and are not re-decided in code',
    ).toEqual(['scientific', 'operational', 'commercial', 'constitutional']);
  });

  it('CFS-052 does not re-decide them, it defers to the ruling that set them', () => {
    expect(spec).toMatch(/EXISTS — not re-decided here/);
  });

  it('proof class and experiment class are NOT merged into one vocabulary', () => {
    // Two four-member unions that look alike and mean different things: what a
    // proof IS, versus what an experiment PRODUCES. The audit flagged them as
    // unreconciled; the constitutional answer is that they stay unreconciled,
    // because reconciling them would answer one question with the other's
    // vocabulary. Read as source rather than imported: services/experiments is
    // another workstream's live file, and this canary guards the constitutional
    // boundary, not their internals.
    const workspace = readSource('services/experiments/experimentWorkspace.ts');
    const declared = /EXPERIMENT_CLASSES\s*=\s*\[([^\]]+)\]/.exec(workspace);
    expect(declared, 'EXPERIMENT_CLASSES is no longer declared where expected').toBeTruthy();
    const experimentClasses = [...declared![1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

    expect(experimentClasses.length).toBe(4);
    expect(
      experimentClasses,
      'the experiment-class vocabulary has absorbed the proof-class vocabulary — a proof class and an experiment class answer different questions',
    ).not.toEqual([...COMMONS_PROOF_CLASSES]);
    // The distinguishing members, named so the failure diagnoses itself.
    expect(experimentClasses).toContain('hybrid');
    expect(COMMONS_PROOF_CLASSES as readonly string[]).toContain('constitutional');
    expect(experimentClasses).not.toContain('constitutional');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Part V — the knowledge stack keeps its layers
// ───────────────────────────────────────────────────────────────────────────

describe('Part V — the constitutional knowledge stack', () => {
  it('states all six layers, in order', () => {
    const LAYERS = ['Reality', 'Evidence', 'Registry', 'Proof', 'metaCommons', 'Invariant Intelligence'];
    const from = spec.indexOf('## §6 Part V');
    expect(from).toBeGreaterThan(-1);
    const section = spec.slice(from, spec.indexOf('## §7', from));
    let cursor = 0;
    for (const layer of LAYERS) {
      const at = section.indexOf(layer, cursor);
      expect(at, `knowledge-stack layer out of order or missing: ${layer}`).toBeGreaterThan(-1);
      cursor = at + layer.length;
    }
  });

  it('records that the layers are not interchangeable', () => {
    // The whole point of the stack. Without this line it reads as a data-flow
    // diagram rather than a compression sequence.
    expect(
      spec,
      'Part V no longer says the layers are not interchangeable — without that line the stack reads as a data-flow diagram rather than a compression sequence',
    ).toMatch(/derived from, but not?\s*\*{0,2}\s*interchangeable with/);
  });
});
