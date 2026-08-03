/**
 * Resolution → invariant loop canaries.
 *
 * The operating principle (operator, 2026-08-03): *"A resolved problem is not
 * complete until the resolution has been converted into reusable development
 * knowledge."* Three outputs per resolution — the record, the candidate
 * invariant, the canary — and:
 *
 *   > "Without the canary, the invariant is advisory prose. Without the
 *   >  invariant, the canary is an isolated test whose purpose will eventually
 *   >  be forgotten."
 *
 * These canaries run against the REAL registry on disk, not fixtures — the
 * registry IS the evidence (OS-9: a canary must be written against real
 * evidence, not against the assumptions of the code it guards). Where a
 * negative case is needed, a real record is CLONED and mutated, so the mutation
 * is checked against a shape that actually exists.
 *
 * The suite deliberately does NOT assert that the milestone-close check is
 * clear of warnings. `CI-2026-08-03-FREEZE-POPULATION-DISCLOSURE-001` is an
 * operator-named candidate whose enforcement point is still being built, and
 * making its warning fail the build would push the honest state out of the
 * registry — which is the opposite of what the loop is for. Blockers fail;
 * warnings and questions are surfaced.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANDIDATE_INVARIANTS_DIR,
  RESOLUTION_RECORDS_DIR,
  buildRegistryReport,
  checkReferentialIntegrity,
  declaredCanaryPaths,
  loadRegistry,
  runMilestoneCloseCheck,
  validateCandidateInvariant,
  validateResolutionRecord,
} from '@/services/invariants/resolutionRecords';
import {
  AGENT_MAX_STAGE,
  RECURRENCE_CLASS_TRIGGERS,
  RESOLUTION_TRIGGERS,
  atOrAbove,
  ladderRank,
} from '@/types/resolutionRecords';
import { COMPLETION_LIFECYCLE, mapCompletionStage } from '@/types/capabilityCompletion';

const REPO_ROOT = process.cwd();
const registry = loadRegistry(REPO_ROOT);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('the registry exists and is where it says it is', () => {
  it('both directories are present at the one authoritative location', () => {
    expect(existsSync(join(REPO_ROOT, RESOLUTION_RECORDS_DIR))).toBe(true);
    expect(existsSync(join(REPO_ROOT, CANDIDATE_INVARIANTS_DIR))).toBe(true);
  });

  it('holds the seeded resolutions and candidates', () => {
    expect(registry.records.length).toBeGreaterThan(0);
    expect(registry.candidates.length).toBeGreaterThan(0);
  });
});

describe('every record on disk validates', () => {
  it('resolution records', () => {
    for (const r of registry.records) {
      const result = validateResolutionRecord(r);
      expect(
        result.valid,
        `${(r as { resolutionId?: string }).resolutionId ?? '(unnamed)'}: ${result.issues.map((i) => `${i.path} ${i.message}`).join('; ')}`,
      ).toBe(true);
    }
  });

  it('candidate invariants', () => {
    for (const c of registry.candidates) {
      const result = validateCandidateInvariant(c);
      expect(
        result.valid,
        `${(c as { candidateId?: string }).candidateId ?? '(unnamed)'}: ${result.issues.map((i) => `${i.path} ${i.message}`).join('; ')}`,
      ).toBe(true);
    }
  });

  it('every cross-reference resolves in both directions', () => {
    const issues = checkReferentialIntegrity(registry);
    expect(issues.map((i) => `${i.path}: ${i.message}`)).toEqual([]);
  });
});

describe('output 3 — every claimed canary resolves on disk', () => {
  // The CAN-CCR-5 discipline, applied here: a canary path that does not exist
  // is a claim of protection that nothing provides. This is the check that
  // would have caught a renamed or deleted test file silently retiring an
  // invariant's only enforcement.
  it('no resolution record or candidate names a canary that is not there', () => {
    const missing = declaredCanaryPaths(registry).filter((p) => !existsSync(join(REPO_ROOT, p)));
    expect(missing, `canary paths that do not resolve on disk: ${missing.join(', ')}`).toEqual([]);
  });

  it('every claimed canary path is repo-relative, never absolute', () => {
    const absolute = declaredCanaryPaths(registry).filter((p) => p.startsWith('/'));
    expect(absolute).toEqual([]);
  });
});

describe('the ladder is REUSED, not forked', () => {
  // inv.engineering.036/037. The loop deliberately has no lifecycle vocabulary
  // of its own: it rides COMPLETION_LIFECYCLE (CCR-001 §9). If a third ladder
  // ever appears, this is where it shows up.
  it('every status in the registry is a COMPLETION_LIFECYCLE stage', () => {
    const stages = new Set<string>(COMPLETION_LIFECYCLE);
    for (const r of registry.records) expect(stages.has(r.status), `${r.resolutionId} status '${r.status}'`).toBe(true);
    for (const c of registry.candidates) expect(stages.has(c.status), `${c.candidateId} status '${c.status}'`).toBe(true);
  });

  it('the reused ladder still projects onto the seed-crystal vocabulary', () => {
    // If CCR-001's projection were redefined, this loop's statuses would start
    // meaning something different to the crystal without anything erroring.
    expect(mapCompletionStage('candidate')).toBe('proposed');
    expect(mapCompletionStage('validated')).toBe('validated');
    expect(mapCompletionStage('ratified')).toBe('canonical');
  });

  it('ladderRank orders the ladder and refuses to rank `deprecated`', () => {
    expect(ladderRank('observed')).toBeLessThan(ladderRank('candidate'));
    expect(ladderRank('candidate')).toBeLessThan(ladderRank('validated'));
    expect(ladderRank('validated')).toBeLessThan(ladderRank('ratified'));
    expect(ladderRank('deprecated')).toBe(-1);
    expect(atOrAbove('deprecated', 'observed')).toBe(false);
  });
});

describe('an anecdote cannot become doctrine', () => {
  it('nothing in the registry is ratified or canonical without a named operator act', () => {
    for (const c of registry.candidates) {
      if (atOrAbove(c.status, 'ratified')) {
        expect(
          c.ratifiedSource,
          `${c.candidateId} is '${c.status}' — above the agent ceiling '${AGENT_MAX_STAGE}' — with no ratifiedSource`,
        ).toBeTruthy();
      } else {
        expect(c.ratifiedSource, `${c.candidateId} names a ratification that has not happened`).toBeNull();
      }
    }
  });

  it('a candidate self-promoted to `ratified` is REFUSED', () => {
    /*
     * Mutation over a REAL record: the exact edit an agent would make to
     * declare its own lesson canon.
     *
     * Selects an UNRATIFIED candidate deliberately (2026-08-03). It used to
     * take `candidates[0]`, which silently became a validly-ratified record
     * once the operator ratified ACTOR-SUBJECT-OWNER — so the mutation kept
     * that record's legitimate `ratifiedSource` and the test stopped
     * exercising self-promotion at all. A canary keyed to array position is
     * a canary that can quietly stop testing its own subject.
     */
    const unratified = registry.candidates.find((c) => c.ratifiedSource === null);
    expect(unratified, 'no unratified candidate left to attempt self-promotion with').toBeDefined();
    const broken = clone(unratified!);
    broken.status = 'ratified';
    const result = validateCandidateInvariant(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'ratifiedSource')).toBe(true);
  });

  it('a candidate at `validated` on a single occurrence is a BLOCKER', () => {
    const single = registry.candidates.find((c) => c.occurrences.length === 1);
    expect(single, 'the registry no longer holds a single-occurrence candidate to mutate').toBeDefined();
    const broken = clone(single!);
    broken.status = 'validated';
    const { clear, findings } = runMilestoneCloseCheck({ records: registry.records, candidates: [broken] });
    expect(clear).toBe(false);
    expect(findings.some((f) => f.severity === 'blocker' && f.message.includes('single occurrence'))).toBe(true);
  });

  it('recurrence is DERIVED from recorded occurrences, never asserted', () => {
    // The operator's signal that distinguishes a real invariant from an
    // anecdote. Each occurrence must name a distinct site with its own
    // evidence, so one incident cannot inflate itself into three.
    const strongest = registry.candidates.find((c) => c.candidateId === 'CI-2026-08-03-ACTOR-SUBJECT-OWNER-001');
    expect(strongest, 'the actor/subject/owner candidate is missing from the registry').toBeDefined();
    expect(strongest!.occurrences.length).toBeGreaterThanOrEqual(3);
    expect(new Set(strongest!.occurrences.map((o) => o.site)).size).toBe(strongest!.occurrences.length);
    for (const o of strongest!.occurrences) expect(o.evidence.length).toBeGreaterThan(0);
  });
});

describe('the milestone-close check', () => {
  it('reports no BLOCKER against the registry as committed', () => {
    const { clear, findings } = runMilestoneCloseCheck(registry);
    const blockers = findings.filter((f) => f.severity === 'blocker');
    expect(blockers.map((f) => `${f.subjectId}: ${f.message}`)).toEqual([]);
    expect(clear).toBe(true);
  });

  /*
   * RETIRED DELIBERATELY, 2026-08-03 — as this test's own failure message
   * instructed ("if the freeze-disclosure enforcement point landed, retire
   * this expectation deliberately rather than deleting the check").
   *
   * It landed the same session: CI-2026-08-03-FREEZE-POPULATION-DISCLOSURE-001
   * was recorded with NO canary as the live example of the gap, and acquired
   * one when the freeze-package amendment shipped (commit f9024e6d5). That is
   * the loop working, so the registry no longer contains a canary-less
   * candidate to point at.
   *
   * The CHECK still matters and must not be deleted with the example. It is
   * now exercised against a synthetic candidate, so it tests the check's
   * capability rather than a passing state of the data — the same reason
   * OS-9 rejects canaries written against the author's assumptions.
   */
  it('flags a candidate with NO canary — an invariant without one is advisory prose', () => {
    // Modelled on a candidate that is genuinely still AT `candidate` — the
    // check reasons about candidates, and a ratified record is a different
    // subject. (Same array-position fragility as the self-promotion test.)
    const real = registry.candidates.find((c) => c.status === 'candidate');
    expect(real, 'registry has no candidate-stage record to model a synthetic one on').toBeDefined();
    const synthetic = { ...real!, candidateId: 'CI-SYNTHETIC-NO-CANARY-001', canaries: [] };
    const { findings } = runMilestoneCloseCheck({ ...registry, candidates: [synthetic] });
    expect(
      findings.some((f) => f.subjectId === synthetic.candidateId && f.message.includes('advisory prose')),
    ).toBe(true);
  });

  it('does not warn when that same candidate HAS a canary — the check discriminates', () => {
    // Guards the retirement above: if the check warned unconditionally it
    // would pass the test above while telling the operator nothing.
    const withCanary = registry.candidates.find((c) => c.canaries.length > 0);
    expect(withCanary, 'no canary-bearing candidate to check against').toBeDefined();
    const { findings } = runMilestoneCloseCheck({ ...registry, candidates: [withCanary!] });
    expect(
      findings.some((f) => f.subjectId === withCanary!.candidateId && f.message.includes('advisory prose')),
    ).toBe(false);
  });

  it('a recurrence-class resolution with nothing executable protecting it is a BLOCKER', () => {
    // The strongest rule in the loop: a defect that already came back, with no
    // canary anywhere, blocks the milestone.
    const recurred = registry.records.find((r) => RECURRENCE_CLASS_TRIGGERS.includes(r.trigger));
    expect(recurred, 'the registry no longer holds a recurrence-class resolution').toBeDefined();
    const broken = clone(recurred!);
    broken.canaries = [];
    const strippedCandidates = registry.candidates
      .filter((c) => broken.candidateInvariants.includes(c.candidateId))
      .map((c) => ({ ...clone(c), canaries: [] }));
    const { clear, findings } = runMilestoneCloseCheck({ records: [broken], candidates: strippedCandidates });
    expect(clear).toBe(false);
    expect(findings.some((f) => f.severity === 'blocker' && f.message.includes('advisory prose'))).toBe(true);
  });

  it('a resolution at `candidate` with no compressed rule is a BLOCKER', () => {
    const broken = clone(registry.records[0]);
    broken.candidateInvariants = [];
    const { clear, findings } = runMilestoneCloseCheck({ records: [broken], candidates: [] });
    expect(clear).toBe(false);
    expect(findings.some((f) => f.message.includes('never compressed into a reusable rule'))).toBe(true);
  });

  it('the uncaptured question is asked with a COMPUTED answer set, never as a slogan', () => {
    // MS-7 / OS-9 — a mechanism that always says the same thing is inert. With
    // no candidate docs the question is not asked at all; with some, it names
    // them.
    const silent = runMilestoneCloseCheck(registry, []);
    expect(silent.findings.some((f) => f.severity === 'question')).toBe(false);

    const asked = runMilestoneCloseCheck(registry, ['codexes/packs/agentiq/updates/2026-08-03_some-doc.md']);
    const question = asked.findings.find((f) => f.severity === 'question');
    expect(question).toBeDefined();
    expect(question!.message).toContain('2026-08-03_some-doc.md');
    // A question is not a blocker: it needs a human answer, not a build failure.
    expect(asked.clear).toBe(true);
  });
});

describe('cadence — the loop is milestone-triggered, never commit-triggered', () => {
  it('every record names one of the ten operator-enumerated triggers', () => {
    for (const r of registry.records) {
      expect(RESOLUTION_TRIGGERS.includes(r.trigger), `${r.resolutionId} trigger '${r.trigger}'`).toBe(true);
    }
  });

  it('no record is triggered by a bare commit or push', () => {
    // The operator was explicit: "Do not do this on every push." There is no
    // per-commit trigger in the vocabulary, and this pins that absence.
    expect((RESOLUTION_TRIGGERS as readonly string[]).some((t) => /commit|push|merge/.test(t))).toBe(false);
  });
});

describe('the registry MINES the update docs rather than duplicating them', () => {
  it('every sourceDoc a record cites exists on disk', () => {
    const missing = [...new Set(registry.records.flatMap((r) => r.sourceDocs))].filter(
      (p) => !existsSync(join(REPO_ROOT, p)),
    );
    expect(missing, `sourceDocs that do not resolve: ${missing.join(', ')}`).toEqual([]);
  });

  it('the observer-state doc is cited, not re-stated — OS-1..OS-9 stay in one place', () => {
    const OBSERVER_DOC = 'codexes/packs/agentiq/updates/2026-08-03_observer-state-invariants.md';
    expect(registry.records.some((r) => r.sourceDocs.includes(OBSERVER_DOC))).toBe(true);
  });
});

describe('the report is DERIVED from the registry', () => {
  it('totals, open resolutions and validated invariants all agree with the records', () => {
    const report = buildRegistryReport(registry);
    expect(report.totals.resolutions).toBe(registry.records.length);
    expect(report.totals.candidates).toBe(registry.candidates.length);
    expect(report.totals.candidatesWithoutCanary).toBe(
      registry.candidates.filter((c) => c.canaries.length === 0).length,
    );
    expect(report.candidateInvariants.length + report.validatedInvariants.length).toBe(registry.candidates.length);
    expect(report.openResolutions.every((r) => !atOrAbove(r.status, 'validated'))).toBe(true);
  });

  it('unresolved recurrence risks are exactly the unprotected shapes that already recurred', () => {
    const report = buildRegistryReport(registry);
    for (const risk of report.unresolvedRecurrenceRisks) {
      const c = registry.candidates.find((x) => x.candidateId === risk.candidateId)!;
      expect(c.canaries.length).toBe(0);
    }
  });
});
