"use client";

/**
 * MyLedgerTab — the persona's personal ledger across canvas + workspace
 * artifacts.
 *
 * Replaces the former MyWorkbenchTab's ledger-on-top-of-canvas layout
 * with a dedicated tab. Renders:
 *   1. WorkbenchLedger — Pills & Artifacts ledger across every Capsule
 *      (Brief, Move-forward, Venture progress, Specialists). Every CTA
 *      Acted on, every artifact drafted, with state chips and resume
 *      links. The historical view.
 *   2. CohortMetricsCard — venture/cohort-level metrics rollup so the
 *      operator can see drift between intent + outcome at a glance.
 *
 * The private-drafts list that used to sit underneath this view now
 * lives in its own tab (myWorkspace). Keeping the ledger separate makes
 * it the canonical audit / history surface without the in-progress
 * drafts crowding it out.
 *
 * 2026-05-29 split: this is the third tab under the new `myartifacts`
 * group (myCanvas / myWorkspace / myLedger).
 */

import { WorkbenchLedger } from "@/components/metame/workbench/WorkbenchLedger";
import { CohortMetricsCard } from "@/components/metame/workbench/CohortMetricsCard";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function MyLedgerTab(props: Props) {
  return (
    <div className="space-y-6 p-4">
      <WorkbenchLedger personaId={props.personaId} theme={props.theme} />
      <CohortMetricsCard personaId={props.personaId} theme={props.theme} />
    </div>
  );
}

export default MyLedgerTab;
