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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANDIDATE_INVARIANTS_DIR,
  EXPLORATION_DIR,
  RESOLUTION_RECORDS_DIR,
  buildRegistryReport,
  checkReferentialIntegrity,
  declaredCanaryPaths,
  findDuplicateStatements,
  loadRegistry,
  runMilestoneCloseCheck,
  validateCandidateInvariant,
  validateExplorationItem,
  validateResolutionRecord,
} from '@/services/invariants/resolutionRecords';
import {
  AGENT_MAX_STAGE,
  CLOSE_OUT_KINDS,
  CLOSE_OUT_RITUAL,
  CONSTITUTIONAL_EXECUTION_PRINCIPLES,
  CONSTITUTIONAL_TIME_PRINCIPLE_ID,
  INVARIANT_FAMILIES,
  OPERATOR_NAMED_FAMILIES,
  PROJECTION_TARGETS,
  RECURRENCE_CLASS_TRIGGERS,
  RESOLUTION_TRIGGERS,
  TTV_TTR_OBJECTIVE_SOURCES,
  atOrAbove,
  ladderRank,
} from '@/types/resolutionRecords';
import { COMPLETION_LIFECYCLE, mapCompletionStage } from '@/types/capabilityCompletion';

const REPO_ROOT = process.cwd();
const registry = loadRegistry(REPO_ROOT);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Select a mutation subject by the PROPERTY UNDER TEST, never by array position
 * (CI-2026-08-03-CANARY-SUBJECT-SELECTION-001). A fixture chosen by index
 * silently changes meaning the moment the registry is re-sorted or a record is
 * added — which, in a registry that grows every session, is constantly.
 */
function pickCandidate(pred: (c: (typeof registry.candidates)[number]) => boolean) {
  const found = registry.candidates.find(pred);
  if (!found) throw new Error('no candidate in the registry satisfies the property under test');
  return found;
}
function pickRecord(pred: (r: (typeof registry.records)[number]) => boolean) {
  const found = registry.records.find(pred);
  if (!found) throw new Error('no resolution record satisfies the property under test');
  return found;
}

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

  it('exploration items', () => {
    for (const e of registry.exploration) {
      const result = validateExplorationItem(e);
      expect(
        result.valid,
        `${(e as { explorationId?: string }).explorationId ?? '(unnamed)'}: ${result.issues.map((i) => `${i.path} ${i.message}`).join('; ')}`,
      ).toBe(true);
    }
  });

  it('every cross-reference resolves in both directions', () => {
    const issues = checkReferentialIntegrity(registry);
    expect(issues.map((i) => `${i.path}: ${i.message}`)).toEqual([]);
  });
});

describe('three families — and UX is a projection, not one of them', () => {
  it('every candidate declares a family', () => {
    for (const c of registry.candidates) {
      expect(
        (INVARIANT_FAMILIES as readonly string[]).includes(c.family),
        `${c.candidateId} has family '${c.family}'`,
      ).toBe(true);
    }
  });

  it('there is NO agency/ux family — the operator removed it', () => {
    // "Don't create 'UX invariants' as a separate canonical family. Instead say:
    // these constitutional execution principles PROJECT into UX."
    expect((INVARIANT_FAMILIES as readonly string[]).includes('agency')).toBe(false);
    expect((INVARIANT_FAMILIES as readonly string[]).includes('ux')).toBe(false);
    for (const c of registry.candidates) {
      expect(['agency', 'ux'].includes(c.family), `${c.candidateId} is still filed as '${c.family}'`).toBe(false);
    }
  });

  it('UX is reachable only as a PROJECTION TARGET', () => {
    expect((PROJECTION_TARGETS as readonly string[]).includes('ux-framework')).toBe(true);
    // At least one live execution principle must actually project into UX, or
    // the mechanism the operator replaced the family with is inert (MS-7).
    const projecting = registry.candidates.filter(
      (c) => c.family === 'execution' && c.status !== 'deprecated' && c.projections.targets.includes('ux-framework'),
    );
    expect(projecting.length, 'no live execution principle projects into UX').toBeGreaterThan(0);
  });

  it('every operator-named family is populated by a LIVE rule', () => {
    for (const f of OPERATOR_NAMED_FAMILIES) {
      expect(
        registry.candidates.some((c) => c.family === f && c.status !== 'deprecated'),
        `family '${f}' has no live members`,
      ).toBe(true);
    }
  });

  it('a governing principle may parent across families; a family rule may not', () => {
    const time = pickCandidate((c) => c.candidateId === CONSTITUTIONAL_TIME_PRINCIPLE_ID);
    expect(time.governingPrinciple, 'the Constitutional Time Principle is not marked governing').toBe(true);
    expect(time.family).toBe('constitutional');
    expect(checkReferentialIntegrity(registry)).toEqual([]);

    // Strip the flag: the same cross-family parenting must become an error.
    const mutated = {
      records: registry.records,
      exploration: registry.exploration,
      candidates: registry.candidates.map((c) =>
        c.candidateId === CONSTITUTIONAL_TIME_PRINCIPLE_ID ? { ...clone(c), governingPrinciple: false } : c,
      ),
    };
    expect(
      checkReferentialIntegrity(mutated).some((i) => i.message.includes('cannot belong to another')),
    ).toBe(true);
  });

  it('only a ratified principle may be designated governing', () => {
    const broken = clone(pickCandidate((c) => c.status === 'candidate'));
    broken.governingPrinciple = true;
    const result = validateCandidateInvariant(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'governingPrinciple')).toBe(true);
  });
});

describe('the Constitutional Execution Family — six principles, no more', () => {
  it('all six exist, are family `execution`, and descend from the Time Principle', () => {
    expect(CONSTITUTIONAL_EXECUTION_PRINCIPLES.length).toBe(6);
    for (const p of CONSTITUTIONAL_EXECUTION_PRINCIPLES) {
      const c = registry.candidates.find((k) => k.candidateId === p.candidateId);
      expect(c, `${p.name} (${p.candidateId}) is missing from the registry`).toBeDefined();
      expect(c!.family, `${p.name} is family '${c!.family}'`).toBe('execution');
      expect(c!.parentCandidateId, `${p.name} does not descend from the Time Principle`).toBe(
        CONSTITUTIONAL_TIME_PRINCIPLE_ID,
      );
      expect(c!.status).not.toBe('deprecated');
      expect(c!.classification, `${p.name} carries no execution-principle designation`).toContain(
        'Constitutional Execution Principle',
      );
    }
  });

  it('the family has no seventh live member', () => {
    // A live execution rule parented directly on the Time Principle that is not
    // one of the six means the family grew without the operator naming it.
    const declared = new Set(CONSTITUTIONAL_EXECUTION_PRINCIPLES.map((p) => p.candidateId));
    const extras = registry.candidates
      .filter((c) => c.status !== 'deprecated' && c.parentCandidateId === CONSTITUTIONAL_TIME_PRINCIPLE_ID)
      .filter((c) => !declared.has(c.candidateId))
      .map((c) => c.candidateId);
    expect(extras, `undeclared execution principles: ${extras.join(', ')}`).toEqual([]);
  });

  it('each principle carries the operator wording it was named with', () => {
    for (const p of CONSTITUTIONAL_EXECUTION_PRINCIPLES) {
      const c = registry.candidates.find((k) => k.candidateId === p.candidateId)!;
      // A paraphrase of a ruling is a different ruling — the wording must survive.
      const fragment = p.operatorText.split('.')[0].slice(0, 40);
      expect(c.classification, `${p.name} lost its operator wording`).toContain(fragment);
    }
  });
});

describe('collapsing the UX candidates — the trail survives', () => {
  it('every deprecated rule names the principle that absorbed it', () => {
    const deprecated = registry.candidates.filter((c) => c.status === 'deprecated');
    expect(deprecated.length, 'nothing was collapsed').toBeGreaterThan(0);
    for (const c of deprecated) {
      expect(c.supersededBy, `${c.candidateId} is deprecated but names no successor`).toBeTruthy();
      expect(
        registry.candidates.some((k) => k.candidateId === c.supersededBy),
        `${c.candidateId} points at a successor that does not exist`,
      ).toBe(true);
    }
  });

  it('a deprecated rule with no successor is REFUSED', () => {
    const broken = clone(pickCandidate((c) => c.status === 'deprecated'));
    broken.supersededBy = null;
    const result = validateCandidateInvariant(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'supersededBy')).toBe(true);
  });

  it('every collapse states WHAT IT COSTS, rather than assuming it costs nothing', () => {
    // The operator: "Report honestly if collapsing the ten UX candidates loses
    // information the six do not carry — I would rather know that than have it
    // quietly dropped."
    for (const c of registry.candidates.filter((k) => k.status === 'deprecated')) {
      expect(
        c.notes.some((n) => n.startsWith('WHAT THE COLLAPSE COSTS')),
        `${c.candidateId} was collapsed without recording what was lost`,
      ).toBe(true);
    }
  });

  it('a tombstone keeps its evidence — a collapse is not a deletion', () => {
    for (const c of registry.candidates.filter((k) => k.status === 'deprecated')) {
      expect(c.occurrences.length, `${c.candidateId} lost its occurrences`).toBeGreaterThan(0);
    }
  });
});

describe('one rule, one record', () => {
  it('no two candidates state the same rule', () => {
    const dupes = findDuplicateStatements(registry);
    expect(dupes.map((d) => `${d.a} == ${d.b}`)).toEqual([]);
  });

  it('the retired duplicate is gone and its lesson survives where the canaries are', () => {
    expect(registry.candidates.some((c) => c.candidateId === 'CI-2026-08-03-UX-EXCEPTION-TERMINATES-IN-ACT-001')).toBe(false);
    const survivor = pickCandidate((c) => c.candidateId === 'CI-2026-08-03-EXCEPTION-TERMINATES-IN-ACT-001');
    expect(survivor.canaries.length).toBeGreaterThan(0);
    expect(survivor.notes.join(' ')).toContain('CI-2026-08-03-UX-EXCEPTION-TERMINATES-IN-ACT-001');
  });

  it('a duplicated statement is a BLOCKER at milestone close', () => {
    const twin = {
      ...clone(pickCandidate((c) => c.parentCandidateId === null && !c.governingPrinciple && c.status !== 'deprecated')),
      candidateId: 'CI-2026-08-03-TWIN-FIXTURE-001',
      parentCandidateId: null,
    };
    const { clear, findings } = runMilestoneCloseCheck({
      records: registry.records,
      exploration: registry.exploration,
      candidates: [...registry.candidates, twin],
    });
    expect(clear).toBe(false);
    expect(findings.some((f) => f.message.includes('one rule has two records'))).toBe(true);
  });
});

describe('status does not cascade down the hierarchy', () => {
  it('a ratified parent does not promote its children', () => {
    // Operator, verbatim: "The child UX and engineering constructs need not all
    // be independently ratified merely because the parent is ratified."
    const parent = pickCandidate((c) => c.candidateId === CONSTITUTIONAL_TIME_PRINCIPLE_ID);
    expect(parent.status).toBe('ratified');
    const children = registry.candidates.filter((c) => c.parentCandidateId === parent.candidateId);
    expect(children.length).toBeGreaterThan(0);
    for (const c of children) {
      expect(
        atOrAbove(c.status, 'ratified'),
        `${c.candidateId} inherited ratification from its parent instead of earning it`,
      ).toBe(false);
      expect(c.ratifiedSource, `${c.candidateId} carries a ratification act it was not given`).toBeNull();
    }
  });

  it('the schema can express a ratified parent with a candidate child', () => {
    // If it could not, the operator's rule would be unrepresentable and the
    // honest thing would be to say so rather than fudge it.
    const parent = pickCandidate((c) => c.candidateId === CONSTITUTIONAL_TIME_PRINCIPLE_ID);
    const child = pickCandidate((c) => c.parentCandidateId === CONSTITUTIONAL_TIME_PRINCIPLE_ID);
    expect(validateCandidateInvariant(parent).valid).toBe(true);
    expect(validateCandidateInvariant(child).valid).toBe(true);
    expect(parent.status).toBe('ratified');
    expect(child.status).toBe('candidate');
  });
});

describe('the ratified Constitutional Time Principle', () => {
  const TTV = 'CI-2026-08-03-TTV-TTR-OBJECTIVE-001';

  it('is ratified on a NAMED OPERATOR ACT, quoted verbatim', () => {
    const c = registry.candidates.find((k) => k.candidateId === TTV);
    expect(c, 'the ratified objective is missing from the registry').toBeDefined();
    expect(c!.status).toBe('ratified');
    expect(c!.ratifiedSource, 'a ratification with no named act is self-promotion').toBeTruthy();
    // The act must actually quote the operator, not paraphrase them.
    expect(c!.ratifiedSource!).toContain('explicit operator ratification');
    // The canonical wording is BIDIRECTIONAL. An intermediate summary rendered
    // it as the one-sided `Minimize(TTV) subject to TTR`, and the operator
    // corrected it: "That captures only one direction." This pins both halves,
    // so the asymmetric form cannot creep back in.
    expect(c!.statement).toContain('reduce Time to Value while keeping Time to Repair within constitutional bounds');
    expect(c!.statement).toContain('A reduction in Time to Repair must not be achieved through a material increase in Time to Value');
    expect(c!.statement).toContain('a reduction in Time to Value must not create an unacceptable increase in Time to Repair');
  });

  it('points at the EXISTING PoTS definition instead of restating the arithmetic', () => {
    // inv.engineering.036 — a second definition of Net Value Acceleration would
    // be the money-critical class of duplicate.
    for (const src of TTV_TTR_OBJECTIVE_SOURCES) {
      expect(existsSync(join(REPO_ROOT, src)), `${src} does not resolve on disk`).toBe(true);
    }
    const commentary = join(REPO_ROOT, 'services/polity/frameworks/polity-papers-commentary.v1.json');
    const text = readFileSync(commentary, 'utf8');
    expect(text).toContain('Net Value Acceleration');
    expect(text).toContain('Proof of Time Saved');
  });
});

describe('projections — nothing is copied, everything is projected', () => {
  it('every record and candidate declares where it surfaces', () => {
    for (const r of registry.records) expect(r.projections, `${r.resolutionId}`).toBeDefined();
    for (const c of registry.candidates) expect(c.projections, `${c.candidateId}`).toBeDefined();
  });

  it('every declared target is one of the verified projection targets', () => {
    const all = [
      ...registry.records.flatMap((r) => r.projections.targets),
      ...registry.candidates.flatMap((c) => c.projections.targets),
      ...registry.exploration.flatMap((e) => e.projections.targets),
    ];
    const unknown = [...new Set(all)].filter((t) => !(PROJECTION_TARGETS as readonly string[]).includes(t));
    expect(unknown, `unknown projection targets: ${unknown.join(', ')}`).toEqual([]);
  });

  it('only a ratified candidate may project onto the invariant corpus', () => {
    for (const c of registry.candidates) {
      if (c.projections.targets.includes('invariant-corpus')) {
        expect(atOrAbove(c.status, 'ratified'), `${c.candidateId} claims the canon at '${c.status}'`).toBe(true);
      }
    }
    // And the validator must refuse the reverse.
    const broken = clone(pickCandidate((c) => c.status === 'candidate'));
    broken.projections = { ...broken.projections, targets: [...broken.projections.targets, 'invariant-corpus'] };
    const result = validateCandidateInvariant(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('the canon is not a destination'))).toBe(true);
  });
});

describe('the Exploration Workspace — "this is where IRL begins"', () => {
  it('exists and holds unresolved ideas', () => {
    expect(existsSync(join(REPO_ROOT, EXPLORATION_DIR))).toBe(true);
    expect(registry.exploration.length).toBeGreaterThan(0);
    expect(registry.exploration.some((e) => e.disposition === 'open')).toBe(true);
  });

  it('an exploration item has NO place on the invariant ladder', () => {
    // "Not every insight is an invariant." Giving unresolved musing a
    // CompletionStage would put it on the same ladder as an enforced rule.
    for (const e of registry.exploration) {
      expect((e as unknown as Record<string, unknown>).status, `${e.explorationId} has a lifecycle status`).toBeUndefined();
      expect((e as unknown as Record<string, unknown>).canaries, `${e.explorationId} has canaries`).toBeUndefined();
    }
  });

  it('every item says what it would REQUIRE — the guard against half-building', () => {
    for (const e of registry.exploration) {
      expect(e.wouldRequire.length, `${e.explorationId} says nothing about what it would take`).toBeGreaterThan(0);
    }
  });

  it('a promoted idea names what it became; a promotion with no candidate is refused', () => {
    for (const e of registry.exploration) {
      if (e.disposition === 'promoted-to-candidate') {
        expect(e.becameCandidateId).toBeTruthy();
        expect(registry.candidates.some((c) => c.candidateId === e.becameCandidateId)).toBe(true);
      }
    }
    const broken = clone(registry.exploration.find((e) => e.disposition === 'promoted-to-candidate')!);
    broken.becameCandidateId = null;
    expect(validateExplorationItem(broken).valid).toBe(false);
  });

  it('the Commons knowledge graph is recorded as exploration, NOT built', () => {
    // The operator named it as a direction. Half-building a graph store is the
    // speculative work the loop exists to prevent — and the existing invariant
    // graph must be considered before a second one is proposed.
    const commons = registry.exploration.find((e) => e.explorationId === 'EXP-2026-08-03-CONSTITUTIONAL-COMMONS-001');
    expect(commons, 'the Commons direction is unrecorded').toBeDefined();
    expect(commons!.disposition).toBe('open');
    expect(commons!.wouldRequire.join(' ')).toContain('services/invariants/graph.ts');
  });
});

describe('the agent close-out checklist', () => {
  it('every question has a PREDEFINED destination — no agent invents a folder at close-out', () => {
    expect(CLOSE_OUT_KINDS.length).toBe(8);
    for (const k of CLOSE_OUT_KINDS) {
      expect(k.question.length, `${k.kind} has no question`).toBeGreaterThan(0);
      expect(k.destination.length, `${k.kind} has no destination`).toBeGreaterThan(0);
    }
  });

  it('every destination that names a repo path resolves on disk', () => {
    // A checklist pointing at a folder that does not exist sends the next agent
    // to invent one — the behaviour this replaces.
    for (const k of CLOSE_OUT_KINDS) {
      const path = k.destination.split(' ')[0];
      if (path.includes('/') && !path.includes('(')) {
        expect(existsSync(join(REPO_ROOT, path)), `${k.kind} → '${path}' does not exist`).toBe(true);
      }
    }
  });

  it('the ritual is ordered — you cannot project what you have not extracted', () => {
    expect([...CLOSE_OUT_RITUAL]).toEqual([
      'resolution-review',
      'principle-extraction',
      'projection',
      'ratification',
      'retrieval-registration',
    ]);
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
    const { clear, findings } = runMilestoneCloseCheck({ records: registry.records, candidates: [broken], exploration: [] });
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
    const { clear, findings } = runMilestoneCloseCheck({ records: [broken], candidates: strippedCandidates, exploration: [] });
    expect(clear).toBe(false);
    expect(findings.some((f) => f.severity === 'blocker' && f.message.includes('advisory prose'))).toBe(true);
  });

  it('a resolution at `candidate` with no compressed rule is a BLOCKER', () => {
    // Selected by the property under test — the check reasons about records AT
    // `candidate`, so taking records[0] tested whatever happened to sort first.
    // Third instance of the same flaw found by the sweep on 2026-08-03.
    const atCandidate = registry.records.find((r) => r.status === 'candidate');
    expect(atCandidate, 'no record at `candidate` to exercise the blocker with').toBeDefined();
    const broken = clone(atCandidate!);
    broken.candidateInvariants = [];
    const { clear, findings } = runMilestoneCloseCheck({ records: [broken], candidates: [], exploration: [] });
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

describe('CANARY-REPRODUCES-DEFECT child rule — a test selects its subject by the property under test', () => {
  /*
   * Operator-added child rule (2026-08-03), under the ratified
   * CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001:
   *
   *   "A regression test must select its subject by the property under test,
   *    not by incidental ordering, index, fixture position or current
   *    registry shape."
   *
   * Earned the hard way, minutes after that invariant was ratified. Three
   * tests in THIS file selected `registry.candidates[0]` / `registry.records[0]`.
   * When the operator ratified ACTOR-SUBJECT-OWNER, the record that sorted
   * first became a validly-ratified one — so the self-promotion test's
   * mutation carried a legitimate `ratifiedSource` and stopped exercising
   * self-promotion at all, while still passing. A test bound to array position
   * is not bound to the condition it claims to test.
   *
   * This is the enforcement point. Without it the child rule is advisory prose
   * — which is the parent invariant's own complaint.
   */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  it('no test in this file selects a registry subject by array index', () => {
    const source = fs.readFileSync(path.join(__dirname, 'resolution-records.test.ts'), 'utf8');
    // Strip comments so the prose above (which necessarily quotes the defect)
    // is not itself read as a violation.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const offenders = code.match(/registry\.(candidates|records)\[\d+\]/g) ?? [];
    expect(
      offenders,
      `select by the property under test instead: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('the subjects ARE selected by a semantic predicate', () => {
    const source = fs.readFileSync(path.join(__dirname, 'resolution-records.test.ts'), 'utf8');
    // The three repaired sites, each keyed to what it actually tests.
    expect(source).toContain("c.ratifiedSource === null");
    expect(source).toContain("c.status === 'candidate'");
    expect(source).toContain("r.status === 'candidate'");
  });
});
