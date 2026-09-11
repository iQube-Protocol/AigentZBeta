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

  it('has THREE arms — cold / manual / discovered (Aletheon three-arm design)', () => {
    expect(src).toMatch(/export type ExpP2Arm = 'cold' \| 'manual' \| 'discovered'/);
    // manual arm draws from the editable hand-authored baseline
    expect(src).toMatch(/arm === 'manual'[\s\S]*?fetchManualLibrary\(\)/);
    // aggregate reports BOTH deltas: does curation help (vs cold) + does discovery beat manual
    expect(src).toMatch(/deltaVsCold/);
    expect(src).toMatch(/deltaVsManual/);
  });

  it('ablation drops one discovered root and measures degradation (causal load-bearing)', () => {
    // fetchDiscoveredLibrary supports excludeIndex (drop-one-root)
    expect(src).toMatch(/excludeIndex\?: number/);
    expect(src).toMatch(/items\.filter\(\(_, i\) => i !== excludeIndex\)/);
    // degradation = fullMean − ablatedMean (positive ⇒ the root is load-bearing)
    expect(src).toMatch(/degradation: fullMean !== null && ablatedMean !== null \? round2\(fullMean - ablatedMean\)/);
  });

  it('claim-analysis uses a COMMON reference (the earned library) so arms are comparable', () => {
    const fn = src.slice(src.indexOf('export async function expP2ClaimAnalysisStep'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toMatch(/fetchDiscoveredLibrary\(\)/);
    expect(body).toMatch(/CONSISTENT|CONTRADICTING|OUTSIDE/);
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
