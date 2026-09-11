/**
 * Generate Pack ≠ implementation complete (2026-08-18, operator-directed
 * lifecycle correction).
 *
 * The prior `onPackGenerated` callback in DevCommandCenterTab.tsx (2026-07-13
 * "Auto-pass to Validate" fix) fast-forwarded the session straight to
 * `consequence_validation` and mounted the Validation capsule the instant an
 * Implementation Pack was generated — before any actual implementation had
 * happened. Generating a pack is an ARTIFACT-PRODUCTION event INSIDE the
 * Implementation stage, not implementation completion. This file pins the
 * corrected behavior via source-scanning of the callback (the established
 * pattern for this component — see devon-ui-phase-c-actor-stream.test.ts —
 * since DevCommandCenterTab is not rendered via React Testing Library
 * anywhere in this repo).
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const TAB_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/triad/components/codex/tabs/DevCommandCenterTab.tsx'),
  'utf-8',
);
const IMPLEMENTATION_LAYOUT_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/layouts/ImplementationLayout.tsx'),
  'utf-8',
);

function extractOnPackGeneratedBody(source: string): string {
  const start = source.indexOf('onPackGenerated={(briefMarkdown, pack) => {');
  expect(start, 'onPackGenerated callback not found — has it been renamed/restructured?').toBeGreaterThan(-1);
  // Balanced-brace extraction from the callback's opening `{` to its match.
  const bodyStart = source.indexOf('{', start + 'onPackGenerated={(briefMarkdown, pack) =>'.length);
  let depth = 0;
  let i = bodyStart;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(bodyStart, i + 1);
}

const callback = extractOnPackGeneratedBody(TAB_SOURCE);

describe('1/3/5 — pack generation never advances the stage or mounts another capsule', () => {
  it('the callback never calls advanceStage, STAGE_ORDER, or canAdvance', () => {
    expect(callback).not.toMatch(/advanceStage\(/);
    expect(callback).not.toMatch(/STAGE_ORDER/);
    expect(callback).not.toMatch(/canAdvance\(/);
  });

  it('the callback never mounts another capsule (no engageCapsuleAndMount call)', () => {
    expect(callback).not.toMatch(/engageCapsuleAndMount\(/);
  });

  it('the callback never assigns session.stage', () => {
    expect(callback).not.toMatch(/stage:\s*["'`]/);
  });

  it('the fast-forward loop and its trigger condition are gone from the whole file, not just renamed', () => {
    expect(TAB_SOURCE).not.toMatch(/consequence_validation.*\n.*while\s*\(canAdvance/);
    expect(TAB_SOURCE).not.toMatch(/if \(next\.stage === "consequence_validation"\) engageCapsuleAndMount\("validation"\)/);
  });
});

describe('2 — generatedPack and implementationBrief are persisted on the session', () => {
  it('the callback writes implementationBrief from the generated markdown', () => {
    expect(callback).toMatch(/implementationBrief:\s*briefMarkdown/);
  });

  it('the callback writes generatedPack, falling back to the existing one, never discarding it', () => {
    expect(callback).toMatch(/generatedPack:\s*pack\s*\?\?\s*s\.generatedPack\s*\?\?\s*null/);
  });

  it('the folded constitutional decision logic is preserved (Decide capsule may have been skipped)', () => {
    expect(callback).toMatch(/constitutionalDecision:\s*foldedDecision/);
    expect(callback).toMatch(/rawDecision\.mechanism/);
  });

  it('the pack-generated observation event still fires', () => {
    expect(callback).toMatch(/devImplementationPackGeneratedEvent\(\)/);
  });

  it('the session write still happens (setSession is called with the built next state)', () => {
    expect(callback).toMatch(/setSession\(next\)/);
  });
});

describe('4 — Dispatch remains available immediately after generation', () => {
  it("the Implementation capsule's render condition depends only on activeCapsuleId, never session.stage", () => {
    const idx = TAB_SOURCE.indexOf('activeCapsuleId === "implementation"');
    expect(idx).toBeGreaterThan(-1);
    const guardLine = TAB_SOURCE.slice(TAB_SOURCE.lastIndexOf('\n', idx) , idx + 40);
    expect(guardLine).not.toMatch(/session\.stage/);
  });

  it("ImplementationLayout's Dispatch-to-Claude button is gated on local dispatching state only, never session.stage", () => {
    const btnIdx = IMPLEMENTATION_LAYOUT_SOURCE.indexOf('onClick={dispatchToClaude}');
    expect(btnIdx).toBeGreaterThan(-1);
    const nearby = IMPLEMENTATION_LAYOUT_SOURCE.slice(btnIdx, btnIdx + 120);
    expect(nearby).toMatch(/disabled=\{dispatching\}/);
    expect(nearby).not.toMatch(/session\.stage/);
  });
});

describe('6 — the governed stage-advance mechanism itself is untouched elsewhere', () => {
  it('handleApproveProposal still walks STAGE_ORDER/advanceStage/canAdvance for real, explicit approvals', () => {
    const idx = TAB_SOURCE.indexOf('const handleApproveProposal');
    expect(idx).toBeGreaterThan(-1);
    const fn = TAB_SOURCE.slice(idx, idx + 600);
    expect(fn).toMatch(/applyStageProposal\(session, proposal\)/);
    expect(fn).toMatch(/canAdvance\(next\)/);
    expect(fn).toMatch(/advanceStage\(next\)/);
  });

  it('STAGE_ORDER and advanceStage are still imported/used generically elsewhere in the file (not orphaned)', () => {
    const occurrences = (TAB_SOURCE.match(/STAGE_ORDER\.indexOf/g) ?? []).length;
    expect(occurrences).toBeGreaterThan(0);
    const advanceOccurrences = (TAB_SOURCE.match(/advanceStage\(/g) ?? []).length;
    expect(advanceOccurrences).toBeGreaterThan(0);
  });
});

describe('No governed implementation-complete transition exists yet (documented gap, not fabricated)', () => {
  it('Phase D status polling drives only ActorEvents, never a DevLoopState.stage or session mutation', () => {
    const pollIdx = IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const pollExecutionStatus');
    expect(pollIdx).toBeGreaterThan(-1);
    const pollFn = IMPLEMENTATION_LAYOUT_SOURCE.slice(pollIdx, pollIdx + 3000);
    expect(pollFn).toMatch(/onActorEvent\?\./);
    expect(pollFn).not.toMatch(/setSession\(/);
    expect(pollFn).not.toMatch(/advanceStage\(/);
  });
});
