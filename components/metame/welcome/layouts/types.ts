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
import type { ComposeKind } from "@/components/metame/copilot/ComposeQuickActionsStrip";

export type RightPaneLayoutId =
  | "stack"
  | "brief"
  | "decision-board"
  | "venture-cockpit"
  | "composer"
  | "approval-interrupt"
  | "ledger"
  | "kpi-detail";

/**
 * Compose handler shapes — each onCreate matches the corresponding
 * legacy modal's contract verbatim so the inline form continues to
 * call into the same artifact-creation path. Passed down through
 * layoutProps so ComposerLayout can mount the right inline form.
 */
export interface ComposerHandlers {
  onCreateGmail?: (input: { to: string; subject: string; bodyText: string; cc?: string; bcc?: string }) => Promise<void>;
  onDraftGmail?: (prompt: string) => Promise<{ to: string; cc: string; bcc: string; subject: string; bodyText: string; rationale: string; source: 'llm' | 'template' }>;
  onCreateCalendar?: (input: unknown) => Promise<void>;
  onDraftCalendar?: (prompt: string) => Promise<unknown>;
  onCreateDoc?: (input: unknown) => Promise<void>;
  onDraftDoc?: (prompt: string) => Promise<unknown>;
  onCreateSheet?: (input: unknown) => Promise<void>;
  onDraftSheet?: (prompt: string) => Promise<unknown>;
  onCreateSlides?: (input: unknown) => Promise<void>;
  onDraftSlides?: (prompt: string) => Promise<unknown>;
  onCreateMarketa?: (input: unknown) => Promise<void>;
  onDraftMarketa?: (prompt: string) => Promise<unknown>;
}

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
  /**
   * Slice 4: which compose kind ComposerLayout should render inline
   * (Email / Event / Doc / Sheet / Slides / Marketa). Null when the
   * layout is mounted in artifact-preview-only mode.
   */
  composerKind?: ComposeKind | null;
  composerHandlers?: ComposerHandlers;
  /**
   * B.1: selected KPI id for the KpiDetailLayout. The cockpit chip
   * onClick sets this + activates 'kpi-detail'.
   */
  selectedKpiId?: string | null;
  /** Cockpit-side chip click handler — sets selectedKpiId + activates 'kpi-detail'. */
  onSelectKpi?: (kpiId: string) => void;
  /** Fired after a KPI manual value save so the cockpit re-fetches. */
  onKpiEdited?: () => void;
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
