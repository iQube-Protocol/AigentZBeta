/**
 * Step-up risk→grade binding canaries — holder-control level 3.
 *
 * PRD-PAG-001 Amendment A §A.6 (ratified 2026-07-27). The table in
 * `services/passport/stepUpPolicy.ts` IS the source of truth
 * (inv.engineering.036); these tests PIN it so any drift is a build failure,
 * per the source-of-truth parity discipline.
 */

import { describe, it, expect } from 'vitest';
import { readSource, importAuthority } from './_lib/sourceAuthority';
import {
  GRADE_RANK,
  STEP_UP_POLICY,
  requiredGradeFor,
  satisfies,
  type ConsequenceClass,
  type HolderProofGrade,
} from '@/services/passport/stepUpPolicy';

const ALL_GRADES = Object.keys(GRADE_RANK) as HolderProofGrade[];
const ALL_CLASSES = Object.keys(STEP_UP_POLICY) as ConsequenceClass[];

describe('the risk→grade table is pinned', () => {
  it('THE table — any change here is a policy change and must be deliberate', () => {
    expect(STEP_UP_POLICY).toEqual({
      read: 'captcha',
      write: 'captcha',
      delegation_grant: 'passkey',
      money_moving: 'world_id',
      consolidation: 'world_id',
    });
  });

  it('the grade order is pinned: captcha < passkey < world_id', () => {
    expect(GRADE_RANK.captcha).toBeLessThan(GRADE_RANK.passkey);
    expect(GRADE_RANK.passkey).toBeLessThan(GRADE_RANK.world_id);
  });

  it('world_id is UNIQUELY top-ranked — nothing else may satisfy a money-moving requirement', () => {
    // The shipped money gate (hasVerifiedWorldIdPassport) checks World ID
    // specifically. A second proof ranked at world_id's level would silently
    // widen that gate.
    for (const grade of ALL_GRADES) {
      if (grade === 'world_id') continue;
      expect(GRADE_RANK[grade], `${grade} ranks at or above world_id`).toBeLessThan(
        GRADE_RANK.world_id,
      );
    }
  });

  it('money-moving requires world_id — pinned by CLAUDE.md and the shipped gate', () => {
    expect(requiredGradeFor('money_moving')).toBe('world_id');
    expect(satisfies('captcha', requiredGradeFor('money_moving'))).toBe(false);
    expect(satisfies('passkey', requiredGradeFor('money_moving'))).toBe(false);
    expect(satisfies('operator_attestation', requiredGradeFor('money_moving'))).toBe(false);
    expect(satisfies('world_id', requiredGradeFor('money_moving'))).toBe(true);
  });

  it('ordinary access never requires a passkey — enrolment is optional for it (the charter rule)', () => {
    expect(satisfies('captcha', requiredGradeFor('read'))).toBe(true);
    expect(satisfies('captcha', requiredGradeFor('write'))).toBe(true);
  });
});

describe('monotonicity — a higher grade always satisfies a lower requirement', () => {
  it('holds across the full grade × requirement matrix', () => {
    for (const proof of ALL_GRADES) {
      for (const required of ALL_GRADES) {
        const expected = GRADE_RANK[proof] >= GRADE_RANK[required];
        expect(
          satisfies(proof, required),
          `satisfies(${proof}, ${required}) disagrees with the rank order`,
        ).toBe(expected);
      }
    }
  });

  it('every grade satisfies itself, and world_id satisfies everything', () => {
    for (const grade of ALL_GRADES) {
      expect(satisfies(grade, grade)).toBe(true);
      expect(satisfies('world_id', grade)).toBe(true);
    }
  });

  it('every consequence class resolves to a grade the rank order knows', () => {
    for (const cls of ALL_CLASSES) {
      expect(ALL_GRADES).toContain(requiredGradeFor(cls));
    }
  });
});

describe('composition, not forking', () => {
  it('the grade type composes the existing PersonhoodProofType — no parallel ladder', () => {
    // Structural: the module imports the ladder's type rather than re-listing
    // proof types as its own enum.
    const graph = importAuthority(readSource('services/passport/stepUpPolicy.ts'));
    const ladderImport = graph.records.find((r) => r.specifier.includes('personhoodProof'));
    expect(ladderImport, 'stepUpPolicy no longer composes personhoodProof').toBeTruthy();
    expect(ladderImport?.names).toContain('PersonhoodProofType');
  });

  it('touches no protected spine file', () => {
    const graph = importAuthority(readSource('services/passport/stepUpPolicy.ts'));
    for (const r of graph.records) {
      expect(r.specifier).not.toMatch(/getActivePersona|evaluateAccess|personaSessionToken/);
    }
  });
});
