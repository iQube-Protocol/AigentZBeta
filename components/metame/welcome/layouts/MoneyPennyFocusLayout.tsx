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
  const { theme = "dark", onRequestLayout, onFocusDispositionRecorded, focusAgentSlug, focusAgentLabel } = props;

  const handleDismiss = useCallback(() => {
    onRequestLayout?.("stack");
  }, [onRequestLayout]);

  /**
   * A recorded choice is not the same act as a dismissal, and conflating them
   * is what left the ceremony half-finished: the capsule closed and nothing
   * else happened. Closing is what both share; telling the host WHAT was
   * chosen is what only this path does.
   *
   * Order matters — the host is told first, then the layout unmounts. Closing
   * first would tear this component down before the notification ran.
   */
  const handleResolved = useCallback(
    (disposition: string) => {
      onFocusDispositionRecorded?.(disposition);
      handleDismiss();
    },
    [onFocusDispositionRecorded, handleDismiss],
  );

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
      body={
        <AigentMeFocusDispositionPrompt
          agentSlug={focusAgentSlug}
          agentLabel={focusAgentLabel}
          onResolved={handleResolved}
        />
      }
    />
  );
}

export const MoneyPennyFocusLayout: RightPaneLayoutDefinition = {
  id: "moneypenny-focus",
  label: "Focus check-in",
  component: MoneyPennyFocusLayoutComponent,
  disTemplateId: "moneypenny-focus-layout-v1",
};
