/**
 * Communications → People — independent list/detail scroll (2026-08-29).
 *
 * ROOT CAUSE: RuntimeQubeTalkDrawer's tab-content wrapper
 * (`min-h-0 flex-1 overflow-y-auto`) was the ONLY scroll owner for every
 * tab. RuntimePeoplePanel's two-column grid used `h-full` with neither
 * column declaring `min-h-0`/`overflow-y-auto` — a CSS grid item's default
 * `min-height: auto` lets its content grow past its row instead of
 * clipping, so the list's content pushed the whole grid taller than the
 * wrapper, which then became the effective scroll container for BOTH
 * columns at once. Scrolling to a contact below the fold dragged the
 * detail pane's rendered position away with it.
 *
 * FIX: the grid and both its columns get `min-h-0`, and the list column
 * gets its own `overflow-y-auto` (the detail column already had one) — each
 * column now owns an independent, bounded scroll region within the
 * unchanged outer drawer chrome. jsdom does not compute real layout, so
 * this is a structural (source-text) canary rather than a rendered-pixel
 * assertion — it locks in the exact classes the fix depends on so a future
 * edit can't silently drop `min-h-0` or `overflow-y-auto` from either
 * column and reintroduce the shared-scroll regression.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const RUNTIME_DRAWER = 'components/metame/runtime/RuntimeQubeTalkDrawer.tsx';

describe('RuntimePeoplePanel — list and detail columns own independent scroll regions', () => {
  it('the two-column grid itself has min-h-0, so it cannot silently grow past the drawer wrapper\'s bounded height', () => {
    const code = stripComments(readSource(RUNTIME_DRAWER));
    const fnAt = code.indexOf('function RuntimePeoplePanel(');
    expect(fnAt).toBeGreaterThan(-1);
    const returnAt = code.indexOf('return (', fnAt);
    expect(returnAt).toBeGreaterThan(-1);
    const gridLine = code.slice(returnAt, code.indexOf('\n', returnAt + 200));
    expect(code.slice(returnAt, returnAt + 400)).toMatch(/className="grid h-full min-h-0 grid-cols-1/);
  });

  it('the People list column has BOTH min-h-0 and overflow-y-auto — its own bounded, independently scrolling region', () => {
    // Comment text is a legitimate anchor here — JSX comments survive in
    // raw source (stripComments would blank the very text used to find
    // them), and a false match inside a comment would simply fail to find
    // a following <div, not silently pass over a real violation.
    const code = readSource(RUNTIME_DRAWER);
    const fnAt = code.indexOf('function RuntimePeoplePanel(');
    const listCommentAt = code.indexOf('{/* People list', fnAt);
    expect(listCommentAt).toBeGreaterThan(-1);
    const nextDivAt = code.indexOf('<div', listCommentAt);
    const listDivLine = code.slice(nextDivAt, code.indexOf('>', nextDivAt) + 1);
    expect(listDivLine).toContain('min-h-0');
    expect(listDivLine).toContain('overflow-y-auto');
  });

  it('the person-detail column has BOTH min-h-0 and overflow-y-auto — stays fixed/visible and scrolls only its own content', () => {
    const code = readSource(RUNTIME_DRAWER);
    const fnAt = code.indexOf('function RuntimePeoplePanel(');
    const detailCommentAt = code.indexOf('{/* Person detail', fnAt);
    expect(detailCommentAt).toBeGreaterThan(-1);
    const nextDivAt = code.indexOf('<div', detailCommentAt);
    const detailDivLine = code.slice(nextDivAt, code.indexOf('>', nextDivAt) + 1);
    expect(detailDivLine).toContain('min-h-0');
    expect(detailDivLine).toContain('overflow-y-auto');
  });

  it('selecting a person is a pure state update (setSelectedId) — never scrolls or otherwise mutates the list column', () => {
    const code = stripComments(readSource(RUNTIME_DRAWER));
    const handlerAt = code.indexOf('const handleSelectPerson = useCallback(');
    expect(handlerAt).toBeGreaterThan(-1);
    const handlerEnd = code.indexOf('[setSelectedId],', handlerAt);
    const handlerBody = code.slice(handlerAt, handlerEnd);
    expect(handlerBody).toContain('setSelectedId(personId)');
    expect(handlerBody).not.toMatch(/scrollTo|scrollIntoView|scrollTop\s*=/);
  });

  it('the outer drawer chrome (tab/header row) is unaffected — still flex-shrink-0, still the ONE scroll wrapper shared by every tab', () => {
    const code = stripComments(readSource(RUNTIME_DRAWER));
    expect(code).toContain('className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3"');
    expect(code).toContain('className="min-h-0 flex-1 overflow-y-auto px-4 py-4"');
  });
});
