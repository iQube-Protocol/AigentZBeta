/**
 * Canonical DevOn lifecycle stage metadata (id/label/icon) — the ONE source
 * every UI surface reads instead of hand-maintaining its own copy.
 *
 * DevOn UI Refinement, Phase B1 (2026-08-15). Before this file existed,
 * `DevCommandCenterTab.tsx` and `ProjectOverviewLayout.tsx` each defined their
 * own `STAGES` array. The tab's copy had all 10 `STAGE_ORDER` stages; the
 * layout's copy had only 7 — silently missing `constitutional_decision`,
 * `remediation`, and `deployment_authorization`. A session at any of those
 * three stages rendered a broken index lookup in the layout's "Loop Stage"
 * readout. Hoisting the metadata here and having both consumers import it
 * fixes that as a side effect of deduplication, not a targeted patch — a
 * second hand-maintained array cannot silently drift from `STAGE_ORDER` again
 * because there is no longer a second array to drift.
 *
 * `STAGE_ORDER` itself (`services/devCommandCenter/devLoop.ts`) is the
 * canonical stage SEQUENCE and is unchanged by this file. This module only
 * adds the presentational label/icon pair for each stage in that sequence.
 */

import {
  Target,
  Package,
  FileSearch,
  AlertTriangle,
  Scale,
  Cpu,
  CheckCircle,
  ShieldAlert,
  Rocket,
} from "lucide-react";
import type { DevLoopStage } from "@/types/devCommandCenter";

export interface StageMeta {
  id: DevLoopStage;
  label: string;
  icon: typeof Cpu;
}

/** One entry per `STAGE_ORDER` member, in the same order. */
export const STAGES: StageMeta[] = [
  { id: "intent_capture", label: "Intent", icon: Target },
  { id: "context_assembly", label: "Context", icon: Package },
  { id: "gap_analysis", label: "Gaps", icon: FileSearch },
  { id: "consequence_modeling", label: "Consequences", icon: AlertTriangle },
  { id: "constitutional_decision", label: "Decide", icon: Scale },
  { id: "implementation", label: "Implement", icon: Cpu },
  { id: "consequence_validation", label: "Validate", icon: CheckCircle },
  { id: "remediation", label: "Remediate", icon: ShieldAlert },
  { id: "deployment_authorization", label: "Deploy Auth", icon: Rocket },
  { id: "complete", label: "Complete", icon: CheckCircle },
];

export function getStageIndex(stage: DevLoopStage): number {
  return STAGES.findIndex((s) => s.id === stage);
}
