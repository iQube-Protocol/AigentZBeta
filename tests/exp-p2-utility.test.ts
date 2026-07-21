/**
 * EXP-P2 utility — pins the experiment's integrity properties (source-level so the
 * test never imports the DB/grounding chain):
 *  - the library under test is the DISCOVERED invariants (buildInvariantSlice,
 *    statuses 'proposed') — never presupposed canon;
 *  - the judge is BLIND (no arm label, no library shown) — it cannot reward
 *    restatement of the library;
 *  - the cold arm gets the task alone;
 *  - the aggregate reports discovered − cold.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'services', 'experiments', 'expP2Utility.ts'), 'utf8');

describe('EXP-P2 utility discipline', () => {
  it('library under test = discovered invariants (proposed), via the grounding seam', () => {
    expect(src).toMatch(/buildInvariantSlice\(\{ domains: \[domain\], statuses: \['proposed'\]/);
    // never canonical — the utility claim must not presuppose ratification
    expect(src).not.toMatch(/statuses: \['canonical'\]/);
  });

  it('discovered arm grounds in the library; cold arm gets the task alone', () => {
    // cold path: user = task.prompt (no library block)
    expect(src).toMatch(/let user = task\.prompt;/);
    // discovered path builds the library block only when arm === 'discovered'
    expect(src).toMatch(/if \(arm === 'discovered'\)[\s\S]*?libraryBlock\(lib\)/);
  });

  it('the judge is BLIND — the judge prompt never includes the invariant library', () => {
    const judge = src.slice(src.indexOf('export async function expP2JudgeStep'));
    const body = judge.slice(0, judge.indexOf('\n}\n'));
    expect(body).not.toMatch(/libraryBlock|fetchDiscoveredLibrary|FS-/);
    // it scores against the rubric only
    expect(body).toMatch(/RUBRIC:/);
  });

  it('empty library fails the discovered arm loudly (promote invariants first)', () => {
    expect(src).toMatch(/discovered FS invariant library is empty/);
  });

  it('aggregate reports discovered − cold', () => {
    expect(src).toMatch(/discoveredMean - coldMean/);
  });
});
