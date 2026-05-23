"use client";

/**
 * Right-pane layout registry (Phase 2, Slice 0).
 *
 * One canonical map from `RightPaneLayoutId` to its component +
 * DIS template id. Slices 1+ register additional layouts here.
 *
 * Resolver contract: `getLayout(id)` returns the definition for `id`,
 * falling back to `stack` when the id is unknown. Unknown ids never
 * crash the pane — the operator always sees something coherent.
 */

import { StackLayout } from "./StackLayout";
import { BriefLayout } from "./BriefLayout";
import { DecisionBoardLayout } from "./DecisionBoardLayout";
import { VentureCockpitLayout } from "./VentureCockpitLayout";
import { ComposerLayout } from "./ComposerLayout";
import { ApprovalLayout } from "./ApprovalLayout";
import { LedgerLayout } from "./LedgerLayout";
import type { RightPaneLayoutDefinition, RightPaneLayoutId } from "./types";

const REGISTRY: Record<RightPaneLayoutId, RightPaneLayoutDefinition> = {
  "stack":              StackLayout,
  "brief":              BriefLayout,
  "decision-board":     DecisionBoardLayout,
  "venture-cockpit":    VentureCockpitLayout,
  "composer":           ComposerLayout,
  "approval-interrupt": ApprovalLayout,
  "ledger":             LedgerLayout,
};

export function getLayout(id: RightPaneLayoutId | string | null | undefined): RightPaneLayoutDefinition {
  if (!id) return StackLayout;
  return (REGISTRY as Record<string, RightPaneLayoutDefinition>)[id] ?? StackLayout;
}

export const DEFAULT_LAYOUT_ID: RightPaneLayoutId = "stack";

export type { RightPaneLayoutDefinition, RightPaneLayoutId } from "./types";
