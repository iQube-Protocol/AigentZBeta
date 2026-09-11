"use client";

/**
 * ConversationsLayout — aigentMe's Conversations capsule (QubeTalk
 * Fast-Follow, priority step 3).
 *
 * Deliberately thin: it mounts the EXISTING QubeTalkInboxTab
 * (components/composer/QubeTalkInboxTab.tsx) inside the standard
 * LayoutShell chrome, scoped with `domainFilter="aigentme"`. That
 * component already documents itself as "one shared store, filtered per
 * surface" and is reused as-is by the Locker tab and several other
 * surfaces with their own domainFilter — this is the SAME reuse, never a
 * second messaging surface. Building a bespoke conversation list/detail
 * here would duplicate the channel list, message thread, shared-artifact
 * list, and RelationshipQube summary panel QubeTalkInboxTab already
 * implements against the real QubeTalk API.
 *
 * DIS template id: `conversations-layout-v1`.
 */

import React from "react";
import dynamic from "next/dynamic";
import { MessagesSquare } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import type { RightPaneLayoutDefinition, RightPaneLayoutProps } from "./types";

const QubeTalkInboxTab = dynamic(() => import("@/components/composer/QubeTalkInboxTab"), {
  ssr: false,
  loading: () => <span className="text-[10px] text-slate-500">Loading conversations…</span>,
});

function ConversationsLayoutComponent(props: RightPaneLayoutProps) {
  const { theme = "dark", onRequestLayout } = props;

  return (
    <LayoutShell
      surfaceId="conversations"
      disTemplateId="conversations-layout-v1"
      theme={theme}
      headerIcon={<MessagesSquare className="h-3.5 w-3.5" />}
      headerEyebrow="QubeTalk"
      headerTitle="Conversations"
      onDismiss={() => onRequestLayout?.("stack")}
      dismissLabel="Close conversations"
      body={<QubeTalkInboxTab domainFilter="aigentme" />}
    />
  );
}

export const ConversationsLayout: RightPaneLayoutDefinition = {
  id: "conversations",
  label: "Conversations",
  component: ConversationsLayoutComponent,
  disTemplateId: "conversations-layout-v1",
};
