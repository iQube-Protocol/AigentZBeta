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
    // The prompt now resolves through `handleResolved`, which notifies the
    // host of the CHOICE and then calls this same `handleDismiss` (2026-08-02
    // — see "the closing ceremony's other two halves" below). The invariant
    // this canary guards is unchanged: there is still exactly ONE dismiss
    // path, and it is still the generic gateway.
    expect(code).toMatch(/body=\{<AigentMeFocusDispositionPrompt onResolved=\{handleResolved\} \/>\}/);
    const dismissBodies = code.match(/onRequestLayout\?\.\("stack"\)/g) ?? [];
    expect(dismissBodies.length, 'a second dismiss call site would be a parallel path').toBe(1);
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
    // `onResolved` now carries the recorded disposition (2026-08-02) so the
    // host can respond to WHAT was chosen. The ordering invariant is the same:
    // it must be downstream of the ok-check, never unconditional.
    const resolvedIdx = body.indexOf('onResolved?.(recorded)');
    expect(throwIdx).toBeGreaterThan(-1);
    expect(resolvedIdx).toBeGreaterThan(-1);
    expect(resolvedIdx, 'onResolved must run after the ok-check throw, not before it').toBeGreaterThan(throwIdx);
  });
});

/**
 * The closing ceremony's other two halves (operator direction, 2026-08-02):
 *
 *   > "The new Focus in capsule in the aigentMe should close once a choice has
 *   > been made. Also once selected this modal does not need to render again so
 *   > the observer needs to note if this has been answered and the copilot
 *   > should respond to the user based on the choice they have made."
 *
 * Closing was already fixed (the dismiss-path canary above). Two things were
 * still missing, and both are failures of the same kind — the principal makes
 * a sovereign decision and the system behaves as though nothing happened:
 *
 *   1. NOTHING IS SAID. `onResolved` took no argument, so even a host that
 *      wanted to respond could not know WHAT was chosen. "Central to my
 *      ExperienceQube" and "not part of my experience" are opposite
 *      instructions; an acknowledgement fitting both fits neither.
 *
 *   2. THE QUESTION CAN COME BACK. The server disposition is the source of
 *      truth and the effect refuses to re-open once it reads one — but the
 *      read and the write are separate round trips. A re-run before the POST
 *      lands reads `null` and re-opens a capsule just answered, which reads to
 *      the principal as their answer not having registered.
 */
describe('the focus check-in is answered once, and answering it is heard', () => {
  it('the disposition prompt reports WHICH disposition was recorded, taken from the server', () => {
    const src = stripComments(readSource(DISPOSITION_PROMPT));
    expect(src).toMatch(/onResolved\?:\s*\(disposition:\s*string\)\s*=>\s*void/);
    // The server's value, not the button's — if they differ, the durable
    // record is what the companion must speak about.
    expect(src).toContain('onResolved?.(recorded)');
    expect(src).toMatch(/const recorded\s*=\s*typeof json\?\.disposition === 'string'/);
  });

  it('recording a choice both notifies the host AND closes — never one without the other', () => {
    const src = stripComments(readSource(MONEYPENNY_FOCUS_LAYOUT));
    const at = src.indexOf('const handleResolved');
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, at + 400);
    const notifyAt = body.indexOf('onFocusDispositionRecorded?.(disposition)');
    const closeAt = body.indexOf('handleDismiss()');
    expect(notifyAt).toBeGreaterThan(-1);
    expect(closeAt).toBeGreaterThan(-1);
    expect(
      notifyAt,
      'closing first unmounts this component before the notification runs',
    ).toBeLessThan(closeAt);
    // The prompt is wired to the resolving path, not the bare dismiss.
    expect(src).toContain('onResolved={handleResolved}');
    expect(src).not.toContain('onResolved={handleDismiss}');
  });

  it('the host answers the decision with a real companion turn that names the choice', () => {
    const src = stripComments(readSource(TAB_FILE));
    const at = src.indexOf('const handleFocusDispositionRecorded');
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, at + 1200);
    expect(body).toContain('setAutoPrompt(');
    // `[observed]` is this file's convention for "tell the companion what
    // happened and let it answer" — never a canned line recited at the user.
    expect(body).toContain('[observed]');
    expect(body, 'the chosen disposition must reach the prompt').toContain('${disposition}');
    // Keyed by the answer, so changing the answer is a NEW turn rather than a
    // duplicate that gets de-duplicated away.
    expect(body).toContain('auto-moneypenny-focus-recorded-${disposition}');
    expect(body).toContain('focusDispositionAnsweredRef.current = true');
  });

  it('the handler is actually threaded to the layout, not merely defined', () => {
    const src = stripComments(readSource(TAB_FILE));
    expect(src).toContain('onFocusDispositionRecorded: handleFocusDispositionRecorded');
  });

  it('a settled question is never asked again, whatever a slower read says', () => {
    const src = stripComments(readSource(TAB_FILE));
    expect(src).toContain('const focusDispositionAnsweredRef = useRef(false)');
    // The guard runs BEFORE the fetch — a guard after the round trip would
    // still race the write it exists to survive.
    const guardAt = src.indexOf('if (focusDispositionAnsweredRef.current) return;');
    expect(guardAt).toBeGreaterThan(-1);
    const fetchAt = src.indexOf("personaFetch('/api/journey/moneypenny-horizen/aigentme/disposition'");
    expect(fetchAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(fetchAt);
    // A prior answer read from the server is just as settled as one made now.
    expect(src).toContain('if (json?.disposition != null) focusDispositionAnsweredRef.current = true;');
  });

  it('the auto-open prompt and the answered prompt are distinct turns', () => {
    const src = stripComments(readSource(TAB_FILE));
    expect(src).toContain("id: 'auto-moneypenny-focus-disposition'");
    expect(src).toContain('auto-moneypenny-focus-recorded-');
  });
});
