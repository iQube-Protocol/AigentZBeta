"use client";

/**
 * MyWorkbenchTab — PRIVATE working surface for the persona.
 *
 * 2026-05-26 differentiation (per operator): myWorkbench is for
 * PRIVATE confidential work — partner briefs, internal reports,
 * decks pre-share, drafts that haven't decided whether they want
 * to be public yet. myCanvas (the sister surface) is for PUBLIC
 * publishing (KNYT Pulse / Qriptopian Pulse).
 *
 * Functionally identical to MyCanvasTab — same list/create/edit
 * affordances, same backing /api/mycanvas/entries endpoint. The
 * `surface='workbench'` prop drives:
 *
 *   - default visibility on create = 'private' (vs 'invited' for canvas)
 *   - metaJson stamp { surface: 'workbench' } so the list filter
 *     keeps the two surfaces' entries separate
 *   - URL param consumer reads ?draft= (vs ?remix= for canvas)
 *
 * Specialist artifact dispatch in AigentMeWelcomeSplitTab routes
 * 'partner-brief' / 'myworkbench-draft' artifacts here via
 *   /codex/viewer?slug=metame&tab=my-workbench&draft=<encoded JSON>
 */

import { MyCanvasTab } from "./MyCanvasTab";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function MyWorkbenchTab(props: Props) {
  return <MyCanvasTab {...props} surface="workbench" />;
}

export default MyWorkbenchTab;
