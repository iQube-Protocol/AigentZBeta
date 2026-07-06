"use client";

import type { DevLoopState, DevLoopStage } from "@/types/devCommandCenter";
import type { StageProposal } from "@/services/devCommandCenter";

export type DevCapsuleId =
  | "project-overview"
  | "intent"
  | "context"
  | "gap-analysis"
  | "consequence-canvas"
  | "implementation"
  | "validation";

export type DevLayoutId =
  | "stack"
  | DevCapsuleId
  | "terminal"
  | "github"
  | "devtools"
  | "linear";

export const CAPSULE_LAYOUT: Record<DevCapsuleId, DevLayoutId> = {
  "project-overview": "project-overview",
  intent: "intent",
  context: "context",
  "gap-analysis": "gap-analysis",
  "consequence-canvas": "consequence-canvas",
  implementation: "implementation",
  validation: "validation",
};

export interface DevLayoutProps {
  session: DevLoopState;
  onDismiss: () => void;
  onAdvanceStage: () => void;
  pendingProposal?: StageProposal | null;
  onApproveProposal?: () => void;
  onDismissProposal?: () => void;
}
