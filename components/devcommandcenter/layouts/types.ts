"use client";

import type { DevLoopState, DevLoopStage } from "@/types/devCommandCenter";
import type { StageProposal } from "@/services/devCommandCenter";

export type DevCapsuleId =
  | "project-overview"
  | "intent"
  | "context"
  | "gap-analysis"
  | "consequence-canvas"
  | "decision"
  | "implementation"
  | "validation"
  | "remediation"
  | "deployment-authorization";

export type DevLayoutId =
  | "stack"
  | DevCapsuleId
  | "terminal"
  | "github"
  | "devtools"
  | "linear"
  | "model-routes";

export const CAPSULE_LAYOUT: Record<DevCapsuleId, DevLayoutId> = {
  "project-overview": "project-overview",
  intent: "intent",
  context: "context",
  "gap-analysis": "gap-analysis",
  "consequence-canvas": "consequence-canvas",
  decision: "decision",
  implementation: "implementation",
  validation: "validation",
  remediation: "remediation",
  "deployment-authorization": "deployment-authorization",
};

export interface DevLayoutProps {
  session: DevLoopState;
  onDismiss: () => void;
  onAdvanceStage: () => void;
  pendingProposal?: StageProposal | null;
  onApproveProposal?: () => void;
  onDismissProposal?: () => void;
  /** Records a receipt returned by a constitutional route into the session —
   *  the fix for the receipt bug (nothing ever mutated session.receipts). */
  onReceipt?: (receipt: { id: string; actionType: string }) => void;
}

/**
 * Capability Evidence projection from the dev-loop session (CFS-029) — the
 * ONE place the session's Context Pack / Gap Analysis / Consequence Canvas
 * fold into the evidence shape. Used by both the Decision capsule and the
 * Implementation pack call so the two stages ground on identical evidence.
 */
export function evidenceFromSession(session: DevLoopState) {
  return {
    existing: (session.gapAnalysis?.existing ?? []).map((e) => ({
      name: e.name,
      path: e.location,
      disposition: e.reuseStrategy,
    })),
    missing: (session.gapAnalysis?.missing ?? []).map((m) => ({
      name: m.name,
      path: m.suggestedLocation,
      complexity: m.estimatedComplexity,
      dependencies: m.dependencies,
    })),
    contextAssets: (session.contextPack?.items ?? []).map((i) => ({
      title: i.title,
      path: i.sourcePath,
      signal: i.reuseSignal,
    })),
    ...(session.gapAnalysis ? { reusePercent: Math.round(session.gapAnalysis.reuseRatio * 100) } : {}),
    boundaries: (session.consequenceCanvas?.shouldNeverHappen ?? []).map((c) => c.description),
  };
}
