"use client";

/**
 * PublishingLayout — aigentMe's compact Publishing capsule (Publishing +
 * Engagement, §3: "aigentMe should remain the conversational Agent
 * interface... Both use the same PublicationQube state").
 *
 * FAN-OUT, NOT A FORK: mounts the EXACT SAME `RuntimePublishingPanel`
 * Runtime's workbench uses (components/metame/runtime/RuntimeQubeTalkDrawer.tsx)
 * — same /api/qubetalk/publications* routes, same PublicationQube state. No
 * separate aigentMe-only publishing implementation, mirroring how
 * ConversationsLayout reuses QubeTalkInboxTab verbatim.
 *
 * Deliberately NOT a natural-language publish-intent parser ("Publish this
 * to LinkedIn") — CLAUDE.md's own instruction against fake NLP routing
 * applies here exactly as it did for the messaging increment's own §13
 * deferral. This is a real, working compact surface; the conversational
 * seam is a known, explicit limitation, not a demo shortcut.
 *
 * DIS template id: `publishing-layout-v1`.
 */

import React from "react";
import dynamic from "next/dynamic";
import { Radio } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import type { RightPaneLayoutDefinition, RightPaneLayoutProps } from "./types";

const RuntimePublishingPanel = dynamic(
  () => import("@/components/metame/runtime/RuntimeQubeTalkDrawer").then((m) => m.RuntimePublishingPanel),
  { ssr: false, loading: () => <span className="text-[10px] text-slate-500">Loading publications…</span> },
);

function PublishingLayoutComponent(props: RightPaneLayoutProps) {
  const { theme = "dark", onRequestLayout } = props;

  return (
    <LayoutShell
      surfaceId="publishing"
      disTemplateId="publishing-layout-v1"
      theme={theme}
      headerIcon={<Radio className="h-3.5 w-3.5" />}
      headerEyebrow="QubeTalk"
      headerTitle="Publishing"
      onDismiss={() => onRequestLayout?.("stack")}
      dismissLabel="Close publishing"
      body={<RuntimePublishingPanel />}
    />
  );
}

export const PublishingLayout: RightPaneLayoutDefinition = {
  id: "publishing",
  label: "Publishing",
  component: PublishingLayoutComponent,
  disTemplateId: "publishing-layout-v1",
};
