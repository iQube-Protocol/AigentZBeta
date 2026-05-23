"use client";

/**
 * Right-pane layout registry types (Phase 2, Slice 0).
 *
 * Introduces the `RightPaneLayout` seam without changing any pixel.
 * Today only `StackLayout` exists — it wraps the current `WelcomeRightPane`
 * verbatim. Subsequent slices (1+) add intent-specific layouts:
 * BriefLayout, DecisionBoardLayout, VentureCockpitLayout, ComposerLayout,
 * ApprovalLayout, LedgerLayout.
 *
 * Contract: each layout mounts atomically, owns its own data hooks, returns
 * JSX, and unmounts cleanly when the next layout is selected. The default
 * layout id is 'stack' so behavior is identical to Phase 1 until an
 * activator (chip click, NBE disposition, server event) selects another.
 *
 * Design Intent Spec: codexes/packs/agentiq/items/dis/aigentme-phase-2.dis.json
 * Handbook section: codexes/packs/agentiq/items/OPERATORS_HANDBOOK.md §8a / §8b
 */

import type { ComponentType } from "react";
import type { WelcomeRightPaneProps } from "@/components/metame/welcome/WelcomeRightPane";

export type RightPaneLayoutId =
  | "stack"
  | "brief"
  | "decision-board"
  | "venture-cockpit"
  | "composer"
  | "approval-interrupt"
  | "ledger";

/**
 * For Slice 0 the layout props equal the existing WelcomeRightPane props
 * verbatim. Later slices may narrow this per-layout (a Brief layout
 * doesn't need the artifact list, for example), but Slice 0 preserves the
 * exact contract so the swap is invisible.
 */
export type RightPaneLayoutProps = WelcomeRightPaneProps & {
  /**
   * Caller may pass a request to switch layouts back (e.g. from a layout's
   * own dismiss X). Slice 0 only uses 'stack', but the prop is wired now so
   * future layouts can return cleanly without each one re-implementing the
   * switcher.
   */
  onRequestLayout?: (id: RightPaneLayoutId) => void;
};

export interface RightPaneLayoutDefinition {
  id: RightPaneLayoutId;
  /** Human-readable label — surfaced in DVN receipts + parity reports. */
  label: string;
  /** The component that renders this layout. */
  component: ComponentType<RightPaneLayoutProps>;
  /** Maps to the DIS template id (`stack-layout-v1`, etc). */
  disTemplateId: string;
}
