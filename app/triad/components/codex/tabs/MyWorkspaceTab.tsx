"use client";

/**
 * MyWorkspaceTab — PRIVATE work-artifact surface for the persona.
 *
 * Renders MyCanvasTab in `surface='workspace'` mode — the same drafts /
 * editor / publish UI the operator already knows, scoped to the private
 * work-artifact set (docs, reports, tools, workflows, briefs). Entries
 * created here are stamped `metaJson.surface='workspace'` so they never
 * appear in the public myCanvas list.
 *
 * Companion tabs (all three under the `myartifacts` group):
 *   - myCanvas    — public-publishable experiences
 *   - myWorkspace — THIS — private work artifacts
 *   - myLedger    — activity ledger across canvas + workspace
 *
 * Legacy `myWorkbench` content (stamped `metaJson.surface='workbench'`)
 * is treated identically to workspace at the entries-filter layer (see
 * MyCanvasTab `filteredEntries`), so existing rows surface here without
 * a data migration. A follow-up rewrite will normalise the stamp.
 */

import { MyCanvasTab } from "./MyCanvasTab";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function MyWorkspaceTab(props: Props) {
  return <MyCanvasTab {...props} surface="workspace" />;
}

export default MyWorkspaceTab;
