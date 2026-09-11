"use client";

/**
 * MyWorkbenchTab — PRIVATE working surface for the persona.
 *
 * Layout:
 *   1. WorkbenchLedger (top) — Pills & Artifacts ledger across every
 *      Capsule. The historical view: every CTA Acted on, every
 *      artifact drafted, with state chips and resume links.
 *   2. Private drafts list (below) — the existing MyCanvasTab in
 *      surface='workbench' mode (partner briefs, internal reports,
 *      decks pre-share). Functionally unchanged.
 *
 * 2026-05-26 differentiation (per operator): myWorkbench is for
 * PRIVATE confidential work — partner briefs, internal reports,
 * decks pre-share, drafts that haven't decided whether they want
 * to be public yet. myCanvas (the sister surface) is for PUBLIC
 * publishing (KNYT Pulse / Qriptopian Pulse).
 *
 * The ledger layered on top (2026-05-27) makes myWorkbench the
 * canonical home for in-flight + completed CTAs and orphan
 * compose-strip drafts, so the active aigentMe Capsules can stay
 * focused on current engagement.
 */

import { MyCanvasTab } from "./MyCanvasTab";
import { WorkbenchLedger } from "@/components/metame/workbench/WorkbenchLedger";
import { CohortMetricsCard } from "@/components/metame/workbench/CohortMetricsCard";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function MyWorkbenchTab(props: Props) {
  return (
    <div className="space-y-6">
      <WorkbenchLedger personaId={props.personaId} theme={props.theme} />
      <CohortMetricsCard personaId={props.personaId} theme={props.theme} />
      <MyCanvasTab {...props} surface="workbench" />
    </div>
  );
}

export default MyWorkbenchTab;
