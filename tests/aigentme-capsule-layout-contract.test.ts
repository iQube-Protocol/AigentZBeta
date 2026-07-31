/**
 * aigentMe Capsule ↔ Layout Contract — dismiss-path canary.
 *
 * CLAUDE.md's "aigentMe Capsule ↔ Layout Contract" requires `activeCapsuleId`
 * and `activeLayoutId` to stay in lockstep. The ENGAGE side already has a
 * single gateway (`engageCapsuleAndMount`) that sets both atomically. The
 * DISMISS side did not: every layout's own dismiss handler (BriefLayout,
 * DecisionBoardLayout, VentureCockpitLayout, SpecialistsLayout,
 * MoneyPennyFocusLayout) calls only `onRequestLayout('stack')`, so
 * `activeCapsuleId` was left claiming a Capsule was still engaged after the
 * operator had already been returned to the stack/manual fallback.
 *
 * Bug fix (2026-07-31): "Focus check-in capsule doesn't auto-close on
 * selection." `requestLayout` now also clears `activeCapsuleId` whenever the
 * transition is TO 'stack' FROM that capsule's own dedicated layout (per
 * `CAPSULE_LAYOUT`) — scoped so an unrelated template's own 'stack' landing
 * (ledger, approval-interrupt, composer) never clears a different engaged
 * Capsule.
 *
 * A full render-harness test of `AigentMeWelcomeSplitTab` would need to mock
 * its entire bootstrap fetch graph (persona spine, brief, receipts, stage
 * progression, etc.) for no added assurance over asserting the actual guard
 * clause landed — this repo's established pattern for that tradeoff
 * (`tests/companion-1-1-quicklinks.test.ts` et al.) is a source-authority
 * canary via `stripComments` + a targeted structural assertion, used here.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const TAB_FILE = 'app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx';
const MONEYPENNY_FOCUS_LAYOUT = 'components/metame/welcome/layouts/MoneyPennyFocusLayout.tsx';
const DISPOSITION_PROMPT = 'components/journey/AigentMeFocusDispositionPrompt.tsx';

describe('aigentMe Capsule ↔ Layout Contract — dismiss path clears both states', () => {
  it('requestLayout clears activeCapsuleId when leaving that capsule\'s own dedicated layout', () => {
    const code = stripComments(readSource(TAB_FILE));
    expect(code).toMatch(
      /if \(next === 'stack'\)\s*\{\s*setActiveCapsuleId\(\(cur\) => \(cur && CAPSULE_LAYOUT\[cur\] === prev \? null : cur\)\);\s*\}/,
    );
  });

  it('the guard sits inside the same setActiveLayoutId updater that scrolls the artifact into view — one requestLayout gateway, not a parallel one', () => {
    const code = stripComments(readSource(TAB_FILE));
    const requestLayoutMatch = code.match(/const requestLayout = useCallback\(\s*\(next: RightPaneLayoutId\) => \{([\s\S]*?)\n  \},\s*\[\],?\s*\);/);
    expect(requestLayoutMatch, 'requestLayout definition not found — did the function get renamed or restructured?').not.toBeNull();
    const body = requestLayoutMatch![1];
    expect(body).toContain('setActiveLayoutId((prev) => {');
    expect(body).toContain("setActiveCapsuleId((cur) => (cur && CAPSULE_LAYOUT[cur] === prev ? null : cur));");
  });

  it('the CAPSULE_LAYOUT mapping used by the guard is the SAME one engageCapsuleAndMount uses — no second, hand-copied map', () => {
    const code = stripComments(readSource(TAB_FILE));
    const definitions = code.match(/const CAPSULE_LAYOUT: Record<CapsuleId, RightPaneLayoutId> = \{/g) ?? [];
    expect(definitions.length, 'exactly one CAPSULE_LAYOUT definition — a second copy would drift').toBe(1);
  });

  it('MoneyPennyFocusLayout still dismisses through the generic onRequestLayout("stack") gateway — no parallel dismiss path', () => {
    // The fix lives entirely in the shared `requestLayout` gateway in the
    // parent tab, so every existing layout (including this one) gets it for
    // free without changing their own dismiss call sites.
    const code = stripComments(readSource(MONEYPENNY_FOCUS_LAYOUT));
    expect(code).toMatch(/onRequestLayout\?\.\("stack"\)/);
    expect(code).toMatch(/body=\{<AigentMeFocusDispositionPrompt onResolved=\{handleDismiss\} \/>\}/);
  });

  it('AigentMeFocusDispositionPrompt fires onResolved only after a successful, server-confirmed disposition write', () => {
    // Guards against the "silent POST failure looks like it just didn't
    // close" failure mode the operator brief flagged: onResolved must be
    // downstream of the `!res.ok` throw, never called unconditionally.
    const code = stripComments(readSource(DISPOSITION_PROMPT));
    const chooseMatch = code.match(/const choose = useCallback\(\s*async \(value: string\) => \{([\s\S]*?)\n {4}\},/);
    expect(chooseMatch, 'choose() definition not found').not.toBeNull();
    const body = chooseMatch![1];
    const throwIdx = body.indexOf('throw new Error');
    const resolvedIdx = body.indexOf('onResolved?.()');
    expect(throwIdx).toBeGreaterThan(-1);
    expect(resolvedIdx).toBeGreaterThan(-1);
    expect(resolvedIdx, 'onResolved must run after the ok-check throw, not before it').toBeGreaterThan(throwIdx);
  });
});
