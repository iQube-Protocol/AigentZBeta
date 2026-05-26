"use client";

/**
 * MyWorkbenchTab — sister surface to MyCanvasTab. Mirrors the same
 * affordances (list / create / edit / delete entries) but scoped to
 * 'work-in-progress' content rather than publish-ready output.
 *
 * 2026-05-26: stubbed alongside myCanvas at the operator's request
 * ('this should be a sub-tab of myCanvas menu item and function like
 * the myCanvas section as planned'). The PRD distinction between
 * myCanvas (publishable output) and myWorkbench (active development)
 * needs operator confirmation; until then, this surface mirrors
 * MyCanvasTab so the affordance is registered and clickable. When
 * the spec lands we can branch on entryType / metaJson to filter or
 * customise the editor.
 */

import { MyCanvasTab } from "./MyCanvasTab";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function MyWorkbenchTab(props: Props) {
  // Until the PRD distinction is captured in a spec doc, the
  // workbench surface IS the canvas surface — the operator sees the
  // same affordances. Add a tag filter (e.g. 'workbench') and a
  // distinct heading later when the differentiation is settled.
  return <MyCanvasTab {...props} />;
}

export default MyWorkbenchTab;
