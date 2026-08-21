/**
 * Article Zero / myCluster Remix — synthetic entry selection fix
 * (KNYTS Bridge campaign integration, 2026-08-21).
 *
 * ROOT CAUSE: Article Zero is prepended to `filteredEntries` and correctly
 * selected by default, but the selection model searched only persisted
 * `entries`, so the right panel stayed blank when Article Zero was active.
 *
 * FIX: Changed selection resolution from `entries.find()` to
 * `filteredEntries.find()` so synthetic entries resolve in the right panel.
 *
 * DEFENSE: Synthetic entries are marked as non-persisted and non-hydrated:
 * - No hydration API call fires for them
 * - No persist (PATCH/POST) succeeds on them
 * - No delete succeeds on them
 * - No invite succeeds on them
 *
 * ORIENTATION: Article Zero renders in a dedicated panel with onboarding
 * copy explaining myCluster, Crossing Stories, templates, and AI reshaping.
 * One clear CTA: "Start your crossing" launches the Crossing template.
 *
 * Structural/source-authority canaries — same convention as
 * tests/passport-session-grant-sequential.test.ts,
 * tests/knyts-bridge-passport-delegate-affordance.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const MYCANVAS_TAB = 'app/triad/components/codex/tabs/MyCanvasTab.tsx';

describe('Article Zero / myCluster Remix fix', () => {
  it('1. Article Zero is prepended to filteredEntries when KNYTS campaign is active', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const syntheticIdx = code.indexOf('syntheticArticleZero: CanvasEntry | null = useMemo');
    expect(syntheticIdx, 'expected syntheticArticleZero definition').toBeGreaterThan(-1);
    const syncBlock = code.slice(syntheticIdx, code.indexOf('}, [surface, campaignTag]);', syntheticIdx));
    expect(syncBlock).toContain("if (surface !== 'canvas' || campaignTag !== 'knyts-bridge-crossing') return null;");
    expect(syncBlock).toContain("id: 'synthetic:knyts-article-zero'");
    expect(syncBlock).toContain("synthetic: true");

    const filteredEntriesIdx = code.indexOf('const filteredEntries = useMemo');
    expect(filteredEntriesIdx, 'expected filteredEntries definition').toBeGreaterThan(-1);
    const filteredBlock = code.slice(filteredEntriesIdx, code.indexOf('}, [entries, surface, syntheticArticleZero]);', filteredEntriesIdx));
    expect(filteredBlock).toContain('syntheticArticleZero ? [syntheticArticleZero, ...baseEntries] : baseEntries');
  });

  it('2. Article Zero is selected by default when available (first in filtered list)', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const autoSelectIdx = code.indexOf('if (filteredEntries.length > 0)');
    expect(autoSelectIdx, 'expected auto-selection on load').toBeGreaterThan(-1);
    const autoBlock = code.slice(autoSelectIdx, code.indexOf('setSelectedId(filteredEntries[0].id);', autoSelectIdx) + 100);
    expect(autoBlock).toContain('setSelectedId(filteredEntries[0].id)');
  });

  it('3. Selection resolution searches filteredEntries, not entries — synthetic entries resolve', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const selectionIdx = code.indexOf('const selected = filteredEntries.find((e) => e.id === selectedId)');
    expect(selectionIdx, 'expected selection model to use filteredEntries').toBeGreaterThan(-1);
    expect(code).not.toContain('const selected = entries.find((e) => e.id === selectedId)');
  });

  it('4. Synthetic entry detection helper isSyntheticEntry() exists', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    expect(code).toContain('function isSyntheticEntry(entry: CanvasEntry): boolean {');
    expect(code).toContain('return entry.metaJson?.synthetic === true;');
  });

  it('5. Hydration effect skips synthetic entries — no GET /[id] for them', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const hydrationIdx = code.indexOf('// PIECE 5 of the 413 fix');
    expect(hydrationIdx, 'expected hydration effect comment').toBeGreaterThan(-1);
    const hydrationBlock = code.slice(hydrationIdx, code.indexOf('}, [personaId, selected]);', hydrationIdx));
    expect(hydrationBlock).toContain('if (isSyntheticEntry(selected)) return;');
    // Verify this guard comes BEFORE the hydration request
    const syntheticGuardIdx = hydrationBlock.indexOf('if (isSyntheticEntry(selected)) return;');
    const getCallIdx = hydrationBlock.indexOf('personaFetch(`${entriesApiBase}/${targetId}`');
    expect(syntheticGuardIdx).toBeLessThan(getCallIdx);
  });

  it('6. Save handler rejects synthetic entries — cannot PATCH them', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const handleSaveIdx = code.indexOf('const handleSave = useCallback(async () => {');
    expect(handleSaveIdx, 'expected handleSave').toBeGreaterThan(-1);
    const handleSaveBlock = code.slice(handleSaveIdx, code.indexOf('}, [personaId, selected, editorTitle, editorBody]);', handleSaveIdx));
    expect(handleSaveBlock).toContain('if (isSyntheticEntry(selected))');
    expect(handleSaveBlock).toContain('Cannot save synthetic starter entries');
  });

  it('7. Delete handler rejects synthetic entries — cannot DELETE them', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const handleDeleteIdx = code.indexOf('const handleDelete = useCallback(async (id: string) => {');
    expect(handleDeleteIdx, 'expected handleDelete').toBeGreaterThan(-1);
    const handleDeleteBlock = code.slice(handleDeleteIdx, code.indexOf('void handleDelete(id);', handleDeleteIdx) + 50);
    expect(handleDeleteBlock).toContain('if (entry && isSyntheticEntry(entry))');
    expect(handleDeleteBlock).toContain('Cannot delete synthetic starter entries');
  });

  it('8. Invite handler rejects synthetic entries — cannot POST invite', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const handleInviteIdx = code.indexOf('const handleInvite = useCallback(async (entryId: string) => {');
    expect(handleInviteIdx, 'expected handleInvite').toBeGreaterThan(-1);
    const handleInviteBlock = code.slice(handleInviteIdx, code.indexOf('endpointPath={inviteEntry', handleInviteIdx));
    expect(handleInviteBlock).toContain('if (entry && isSyntheticEntry(entry))');
    expect(handleInviteBlock).toContain('Cannot invite on synthetic starter entries');
  });

  it('9. ArticleZeroPanel renders synthetic Article Zero with onboarding copy and "Start your crossing" CTA', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    expect(code).toContain('function ArticleZeroPanel(');
    const panelIdx = code.indexOf('function ArticleZeroPanel(');
    const panelBlock = code.slice(panelIdx, code.indexOf('// ─── Experience panels', panelIdx));
    expect(panelBlock).toContain('entry: CanvasEntry');
    expect(panelBlock).toContain('canvasTemplate: CanvasTemplate');
    expect(panelBlock).toContain('onStartCrossing: () => void');
    expect(panelBlock).toContain('Welcome to myCluster');
    expect(panelBlock).toContain('Start your crossing');
    expect(panelBlock).toContain('onStartCrossing()');
  });

  it('10. Right panel renderer uses ArticleZeroPanel for isSyntheticEntry(selected)', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const rightPanelIdx = code.indexOf('{/* Right panel */}');
    expect(rightPanelIdx, 'expected right panel comment').toBeGreaterThan(-1);
    const rightPanelBlock = code.slice(rightPanelIdx, code.indexOf('error && <p className=', rightPanelIdx));
    expect(rightPanelBlock).toContain('isSyntheticEntry(selected)');
    expect(rightPanelBlock).toContain('<ArticleZeroPanel');
  });

  it('11. Synthetic Article Zero does NOT render for non-KNYTS campaigns or workspace surface', () => {
    const code = stripComments(readSource(MYCANVAS_TAB));
    const syntheticIdx = code.indexOf('const syntheticArticleZero: CanvasEntry | null = useMemo');
    const syncBlock = code.slice(syntheticIdx, code.indexOf('}, [surface, campaignTag]);', syntheticIdx));
    // Guard must reject non-KNYTS AND non-canvas
    expect(syncBlock).toContain("if (surface !== 'canvas' || campaignTag !== 'knyts-bridge-crossing') return null;");
    // The entire synthetic definition is guarded — won't render for workspace/workbench
    expect(syncBlock).not.toContain("surface === 'workspace'");
  });
});
