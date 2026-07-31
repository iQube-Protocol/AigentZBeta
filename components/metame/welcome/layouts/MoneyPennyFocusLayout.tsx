"use client";

/**
 * MoneyPennyFocusLayout — aigentMe Closing Ceremony capsule (Guided Journey
 * Runtime §24.7-§24.9).
 *
 * A temporary Welcome Capsule, not a permanent addition to the aigentMe
 * layout (§24.8 Ceremony Capsule Principle). It hosts the same
 * AigentMeFocusDispositionPrompt used by the journey's aigentMe stage, and
 * closes itself back to 'stack' the instant a disposition is recorded
 * (§24.9 Ephemeral Interface, Durable Consequence) — no further screen
 * activity is manufactured once the decision is made (§24.10).
 *
 * DIS template id: `moneypenny-focus-layout-v1`.
 */

import React, { useCallback } from "react";
import { Landmark } from "lucide-react";
import { AigentMeFocusDispositionPrompt } from "@/components/journey/AigentMeFocusDispositionPrompt";
import { LayoutShell } from "./LayoutShell";
import type { RightPaneLayoutDefinition, RightPaneLayoutProps } from "./types";

function MoneyPennyFocusLayoutComponent(props: RightPaneLayoutProps) {
  const { theme = "dark", onRequestLayout } = props;

  const handleDismiss = useCallback(() => {
    onRequestLayout?.("stack");
  }, [onRequestLayout]);

  return (
    <LayoutShell
      surfaceId="moneypenny-focus"
      disTemplateId="moneypenny-focus-layout-v1"
      theme={theme}
      headerIcon={<Landmark className="h-3.5 w-3.5" />}
      headerEyebrow="aigentMe"
      headerTitle="Focus check-in"
      onDismiss={handleDismiss}
      dismissLabel="Close"
      body={<AigentMeFocusDispositionPrompt onResolved={handleDismiss} />}
    />
  );
}

export const MoneyPennyFocusLayout: RightPaneLayoutDefinition = {
  id: "moneypenny-focus",
  label: "Focus check-in",
  component: MoneyPennyFocusLayoutComponent,
  disTemplateId: "moneypenny-focus-layout-v1",
};
