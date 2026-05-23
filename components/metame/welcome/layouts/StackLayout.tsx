"use client";

/**
 * StackLayout — Phase 1 right-pane behavior preserved exactly.
 *
 * Wraps `WelcomeRightPane` with no visual change. This is the Slice 0
 * compatibility seam: when `activeLayoutId === 'stack'` the operator
 * sees the same pane they've always seen — cards stack in a single
 * column, every chip appends to the stack.
 *
 * Subsequent slices add intent-specific layouts (Brief, DecisionBoard,
 * VentureCockpit, Composer, Approval, Ledger) but `stack` remains the
 * default and the safe fallback whenever no other layout claims the pane.
 *
 * DIS template id: `stack-layout-v1`. Mobile shape: `scrolled-stack`.
 * See codexes/packs/agentiq/items/dis/aigentme-phase-2.dis.json.
 */

import React from "react";
import { WelcomeRightPane } from "@/components/metame/welcome/WelcomeRightPane";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

function StackLayoutComponent(props: RightPaneLayoutProps) {
  // Slice 0: identity passthrough. `onRequestLayout` is reserved for
  // future layouts to route back; the stack itself never needs it
  // because it is the default — no return path required.
  const { onRequestLayout: _ignored, ...rest } = props;
  return <WelcomeRightPane {...rest} />;
}

export const StackLayout: RightPaneLayoutDefinition = {
  id: "stack",
  label: "Stack",
  component: StackLayoutComponent,
  disTemplateId: "stack-layout-v1",
};
