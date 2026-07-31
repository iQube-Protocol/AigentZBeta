"use client";

/**
 * ExpandedNBEPill — the protocol Pill (compact action unit) once it
 * has been acted on. Renders as a state-coloured card with the
 * drafted artifact and any external-action approval gate nested
 * inside.
 *
 * Linear flow:
 *   Act on CTA → Pill flips to Queued (blue)
 *   → artifact drafted via composer / dispatcher → renders here
 *   → if connector externalises, SecondTierApprovalCard renders next
 *     to its artifact → operator approves & sends
 *   → all artifacts sent, OR operator clicks Mark complete
 *   → Pill flips to Complete (green).
 *
 * The Mission Recommendation / specialist response no longer lives
 * here — that belongs to the dedicated Ask Specialists Capsule. Each
 * action template (Brief, Move forward, Venture progress, Ask
 * Specialists) is its own bounded surface; mixing specialist guidance
 * into the Brief Pill produced the cognitive-load problem the
 * operator flagged.
 */

import React, { useState } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronUp, X, Users, Sparkles, CheckSquare } from "lucide-react";
import type { NextBestActionData } from "@/components/metame/cards/NextBestActionCard";
import { ArtifactCard, type ArtifactCardData } from "@/components/metame/cards/ArtifactCard";
import { SecondTierApprovalCard } from "@/components/metame/cards/SecondTierApprovalCard";

export interface ExpandedNBEPillQueuedState {
  intentId: string;
  status: string;
  queueMessage: string;
  /**
   * Operator-applied terminal flag — flips the pill to the green
   * "complete" state without needing an actual connector-success
   * signal. Useful in alpha when execution is mocked (Phase 5/6
   * specialist routing not live yet) and the operator needs explicit
   * control over pill lifecycle.
   */
  manuallyComplete?: boolean;
}

export interface ExpandedNBEPillSecondTier {
  artifactId: string;
  connectorId: string;
  connectorLabel: string;
  summary: string;
  detail?: string;
  submitting: boolean;
  error: string | null;
}

/**
 * Intent Chain breadcrumb — present when this pill is part of a chain
 * (spec §8). Surfaces the chain's current position so the user can
 * click through to the ChainDetailDrawer for full step history.
 */
export interface ExpandedNBEPillChainBreadcrumb {
  chain_id: string;
  chain_label: string;
  step_index: number;     // 1-based
  total_steps: number;
  step_label: string;
}

interface Props {
  action: NextBestActionData;
  queued: ExpandedNBEPillQueuedState;
  /** Artifacts whose intentId matches `queued.intentId`. */
  artifacts: ArtifactCardData[];
  /** Active second-tier approval, if it targets an artifact in this pill. */
  secondTierApproval?: ExpandedNBEPillSecondTier | null;
  actionPendingArtifactId?: string | null;
  actionErrors?: Record<string, string>;
  onDismissQueued: () => void;
  onSendArtifact: (artifactId: string) => void;
  onDismissArtifact: (artifactId: string) => void;
  onApproveSecondTier?: () => void;
  onCancelSecondTier?: () => void;
  /** Operator-driven complete flip — surfaces a "Mark complete" button
   *  in the pill header so the user can advance pill state to green
   *  even when no artifact-level execution signal has fired. */
  onMarkComplete?: () => void;
  /** Intent-chain breadcrumb. Present when this pill is part of a chain.
   *  Renders at the top of the pill as a clickable link that opens the
   *  ChainDetailDrawer via onChainBreadcrumbClick. */
  chainBreadcrumb?: ExpandedNBEPillChainBreadcrumb;
  onChainBreadcrumbClick?: (chain_id: string) => void;
  theme?: "light" | "dark";
}

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  mvl: "metaMe Venture Lab",
};

const SPECIALIST_LABELS: Record<string, string> = {
  marketa: "Marketa",
  quill: "Quill",
  kn0w1: "Kn0w1",
  "aigent-z": "Aigent Z",
  "aigent-c": "Aigent C",
  "aigent-nakamoto": "Aigent Nakamoto",
};

/**
 * Pill lifecycle, kept deliberately simple:
 *
 *   Internal action (action.approvalRequired === false)
 *     Act + first-tier approve → Green (Complete) immediately.
 *     There is no Blue state for internal moves — the first-tier
 *     approval IS the only gate, so once it's granted the work is
 *     done from the operator's perspective.
 *
 *   External action (action.approvalRequired === true)
 *     Act + first-tier approve → Blue (Queued)
 *       awaiting the artifact to be drafted, then the second-tier
 *       approval gate, then connector execution.
 *     Artifact status flips to 'sent' / 'published' (DVN receipt) →
 *       Green (Complete).
 *
 *   manuallyComplete on the queued state overrides either path —
 *   the operator can flip a Blue pill to Green via the Mark complete
 *   header button when execution is mocked / blocked.
 */
function isPillComplete(
  action: NextBestActionData,
  queued: ExpandedNBEPillQueuedState,
  artifacts: ArtifactCardData[],
): boolean {
  if (queued.manuallyComplete) return true;
  // Internal action — green the moment it lands in the queue.
  if (!action.approvalRequired) return true;
  // External action — green only when every drafted artifact has
  // shipped externally.
  if (artifacts.length === 0) return false;
  return artifacts.every((a) => a.status === "sent" || a.status === "published");
}

export function ExpandedNBEPill({
  action,
  queued,
  artifacts,
  secondTierApproval,
  actionPendingArtifactId,
  actionErrors,
  onDismissQueued,
  onSendArtifact,
  onDismissArtifact,
  onApproveSecondTier,
  onCancelSecondTier,
  onMarkComplete,
  chainBreadcrumb,
  onChainBreadcrumbClick,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const complete = isPillComplete(action, queued, artifacts);
  // Collapse / expand body so the operator can hide the artifact +
  // approval detail and keep just the header chip when the bundle
  // grows long. Header (state + label + intent id + controls) stays
  // visible always; only the body content collapses.
  const [expanded, setExpanded] = useState(true);

  // Border + accent tokens for queued (blue) vs complete (green).
  // Background opacity is bumped so the Pill reads as a distinct card
  // inside its parent Capsule rather than blending into the slate
  // surface as a header strip.
  const borderClass = complete
    ? isDark
      ? "border-emerald-500/60 bg-emerald-500/[0.08] shadow-sm shadow-emerald-500/5"
      : "border-emerald-400 bg-emerald-50"
    : isDark
      ? "border-sky-500/60 bg-sky-500/[0.10] shadow-sm shadow-sky-500/5"
      : "border-sky-400 bg-sky-50";

  const headerAccent = complete
    ? isDark ? "text-emerald-200" : "text-emerald-800"
    : isDark ? "text-sky-200" : "text-sky-800";

  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const stateLabel = complete ? "Complete" : "Queued";
  const StateIcon = complete ? CheckCircle2 : Check;

  return (
    <div
      className={`rounded-xl border ${borderClass} p-3 space-y-3`}
      data-pill-intent-id={queued.intentId}
      data-pill-nbe-id={action.id}
      data-pill-state={complete ? "complete" : "queued"}
      data-pill-chain-id={chainBreadcrumb?.chain_id}
    >
      {/* Intent Chain breadcrumb (spec §8) — present when this pill is
          part of a chain. Click opens the ChainDetailDrawer. */}
      {chainBreadcrumb && (
        <button
          type="button"
          onClick={() => onChainBreadcrumbClick?.(chainBreadcrumb.chain_id)}
          className={`group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] transition-colors ${
            isDark
              ? "bg-violet-500/10 ring-1 ring-violet-500/30 text-violet-200 hover:bg-violet-500/20"
              : "bg-violet-50 ring-1 ring-violet-200 text-violet-700 hover:bg-violet-100"
          }`}
          aria-label={`Open chain ${chainBreadcrumb.chain_label}`}
          title={`Step ${chainBreadcrumb.step_index} of ${chainBreadcrumb.total_steps}: ${chainBreadcrumb.step_label}`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-violet-400">↳</span>
            <span className="truncate font-medium">{chainBreadcrumb.chain_label}</span>
          </span>
          <span className="shrink-0 tabular-nums opacity-80">
            Step {chainBreadcrumb.step_index}/{chainBreadcrumb.total_steps}
          </span>
        </button>
      )}

      {/* Pill header — state badge + label + mark complete + dismiss */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 text-xs uppercase tracking-wider mb-0.5 ${headerAccent}`}>
            <StateIcon className="w-3.5 h-3.5" />
            <span className="font-medium">{stateLabel}</span>
            <span className={mutedClass}>·</span>
            <span className={mutedClass}>
              {CARTRIDGE_LABELS[action.cartridge] ?? action.cartridge}
            </span>
            {action.specialist && (
              <>
                <span className={mutedClass}>·</span>
                <Users className={`w-3 h-3 ${mutedClass}`} />
                <span className={mutedClass}>
                  {SPECIALIST_LABELS[action.specialist] ?? action.specialist}
                </span>
              </>
            )}
          </div>
          <h4 className={`text-base font-semibold leading-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            {action.contextualTitle && action.contextualTitle.trim().length > 0
              ? action.contextualTitle
              : action.label}
          </h4>
          <p className={`text-sm mt-1 ${mutedClass}`}>{queued.queueMessage}</p>
          <p className={`text-[11px] mt-1.5 ${mutedClass}`}>
            intent: <span className="font-mono">{queued.intentId.slice(0, 8)}…</span>
            {" · status: "}
            <span className="font-mono">{complete ? "complete" : queued.status}</span>
          </p>
        </div>
        <div className="flex items-start gap-1 shrink-0">
          {!complete && onMarkComplete && (
            <button
              onClick={onMarkComplete}
              title="Mark this pill complete — flips to green"
              aria-label="Mark complete"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition ${
                isDark
                  ? "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                  : "border-emerald-400 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              Mark complete
            </button>
          )}
          <button
            onClick={onDismissQueued}
            className="p-1 rounded hover:bg-slate-800/40"
            aria-label="Dismiss"
            title="Dismiss this Pill"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-slate-800/40"
            aria-label={expanded ? "Collapse Pill body" : "Expand Pill body"}
            aria-expanded={expanded}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Drafted artifact(s) — each with optional second-tier approval gate.
          When the parent Pill is Complete (either manuallyComplete or
          via every artifact already sent), force the ArtifactCard's
          status to 'sent' for rendering so its "View in Drive / Gmail
          / Calendar" link surfaces. ArtifactCard hides the link when
          status === 'draft' AND actionConnectorId is set (to push the
          operator toward Send rather than Open) — but a completed
          pill means the work is done; the operator wants the link.
          Hidden when the operator collapses the Pill via the chevron. */}
      {expanded && artifacts.map((artifact) => {
        const showSecondTier = secondTierApproval?.artifactId === artifact.artifactId;
        const renderArtifact: ArtifactCardData = complete && artifact.status === "draft"
          ? { ...artifact, status: "sent" }
          : artifact;
        return (
          <div key={artifact.artifactId} data-artifact-id={artifact.artifactId} className="space-y-2">
            <ArtifactCard
              data={renderArtifact}
              onAction={() => onSendArtifact(artifact.artifactId)}
              onDismiss={() => onDismissArtifact(artifact.artifactId)}
              actionPending={actionPendingArtifactId === artifact.artifactId}
              actionError={actionErrors?.[artifact.artifactId]}
              theme={theme}
            />
            {showSecondTier && secondTierApproval && onApproveSecondTier && onCancelSecondTier && (
              <SecondTierApprovalCard
                connectorLabel={secondTierApproval.connectorLabel}
                summary={secondTierApproval.summary}
                detail={secondTierApproval.detail}
                submitting={secondTierApproval.submitting}
                error={secondTierApproval.error}
                onApprove={onApproveSecondTier}
                onCancel={onCancelSecondTier}
                theme={theme}
              />
            )}
          </div>
        );
      })}

      {/* Footer state hint — wording reflects which path got us to green */}
      {expanded && complete && (
        <div className={`text-[11px] flex items-center gap-1.5 ${isDark ? "text-emerald-300/80" : "text-emerald-700"}`}>
          <Sparkles className="w-3 h-3" />
          {action.approvalRequired
            ? "Externalised — receipt issued. Pill complete."
            : "Internal action — completed on approval."}
        </div>
      )}
    </div>
  );
}

export default ExpandedNBEPill;
