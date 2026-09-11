"use client";

/**
 * EngagementLayout — aigentMe's compact Engagement capsule ("show me
 * responses that need me", §3/§10).
 *
 * FAN-OUT, NOT A FORK: mounts the EXACT SAME `RuntimeEngagementPanel`
 * Runtime's workbench uses — same /api/qubetalk/engagements route, same
 * EngagementQube state.
 *
 * DIS template id: `engagement-layout-v1`.
 */

import React from "react";
import dynamic from "next/dynamic";
import { Megaphone } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import type { RightPaneLayoutDefinition, RightPaneLayoutProps } from "./types";

const RuntimeEngagementPanel = dynamic(
  () => import("@/components/metame/runtime/RuntimeQubeTalkDrawer").then((m) => m.RuntimeEngagementPanel),
  { ssr: false, loading: () => <span className="text-[10px] text-slate-500">Loading engagements…</span> },
);

function EngagementLayoutComponent(props: RightPaneLayoutProps) {
  const { theme = "dark", onRequestLayout } = props;

  return (
    <LayoutShell
      surfaceId="engagement"
      disTemplateId="engagement-layout-v1"
      theme={theme}
      headerIcon={<Megaphone className="h-3.5 w-3.5" />}
      headerEyebrow="QubeTalk"
      headerTitle="Engagement"
      onDismiss={() => onRequestLayout?.("stack")}
      dismissLabel="Close engagement"
      body={<RuntimeEngagementPanel />}
    />
  );
}

export const EngagementLayout: RightPaneLayoutDefinition = {
  id: "engagement",
  label: "Engagement",
  component: EngagementLayoutComponent,
  disTemplateId: "engagement-layout-v1",
};
