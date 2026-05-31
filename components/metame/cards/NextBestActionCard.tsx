"use client";

/**
 * NextBestActionCard — single NBE rendered as an actionable card.
 *
 * Aigent Me Phase 3. Per PRD v0.2 §9.2 (Runtime cards → Next Best Action
 * Card): recommended action, rationale, source cartridge, effort,
 * impact, available actions.
 *
 * Two presentations:
 *   - compact (for stacking inside BriefCard / MoveForwardCard)
 *   - hero    (for "Move this forward" — single big action)
 *
 * The card itself does NOT execute — it surfaces the action and emits an
 * `onAct` callback. Phase 6 wires the actual artifact creation /
 * specialist routing behind that callback.
 */

import React from "react";
import {
  ArrowRight,
  Pencil,
  Sparkles,
  Users,
  Zap,
  ShieldAlert,
  X,
  Check,
} from "lucide-react";
import { PreflightByline, PreflightChip } from "@/components/metame/cards/PreflightByline";
import type { PreflightContext } from "@/services/capabilities/preflight";

export interface NextBestActionData {
  id: string;
  label: string;
  /**
   * Optional LLM-rewritten contextual title. When set, renders in place
   * of `label` on the card. Sourced from nbaContextualTitles[id] in the
   * brief / move-forward LLM-rerank output — the LLM is instructed to
   * rewrite generic catalogue labels using the operator's actual
   * ventures, partners, goals, and stage (e.g. "Coordinate with Marketa"
   * → "Ask Marketa for a Metaiye Media partner proposal on Operation
   * metaWill launch"). Falls through to `label` when the LLM didn't
   * emit a title (no Anthropic key, low-context candidate, etc.).
   */
  contextualTitle?: string | null;
  rationale: string;
  cartridge: string;
  effort: "light" | "standard" | "deep";
  impact: "low" | "medium" | "high";
  approvalRequired: boolean;
  specialist: "marketa" | "quill" | "kn0w1" | "aigent-z" | "aigent-c" | "aigent-nakamoto" | null;
  suggestedArtifact: string | null;
}

interface Props {
  action: NextBestActionData;
  variant?: "compact" | "hero";
  /** Click handler for the "Act" button. Phase 6 wires execution. */
  onAct?: (action: NextBestActionData) => void;
  /**
   * When true, the action has already been queued as an IntentQube
   * (handler short-circuits server-side). The Act button is replaced
   * with a non-clickable "Queued" badge so the operator gets explicit
   * feedback that their click landed — fixes the previous regression
   * where Act stayed enabled but did nothing until the tab remounted.
   */
  queued?: boolean;
  /** Hero variant only — renders an inline X that lets the user clear
   *  the whole move-forward bundle (topAction + alternates) so the
   *  right pane doesn't pile up. Re-firing the chip re-opens it. */
  onDismiss?: () => void;
  /**
   * Hero variant only — Capability Gateway pre-flight result for the
   * move-forward bundle that contains this NBA. Surfaces as a
   * "🔍 researched" chip in the header + a small byline under the title.
   * Lives on the move-forward parent shape, not on the per-NBA shape,
   * so callers thread it explicitly to the hero card.
   */
  preflightContext?: PreflightContext | null;
  /**
   * Optional ≤200-char compose / action prompt hint produced by the LLM
   * rerank pass. Renders as an italic "aigentMe's take" line under the
   * rationale and is forwarded to `onAct` so callers can seed
   * composerInitialPrompt when Act maps to a compose modal.
   */
  promptHint?: string | null;
  theme?: "light" | "dark";
}

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  mvl: "MVL",
};

const SPECIALIST_LABELS: Record<string, string> = {
  marketa: "Marketa",
  quill: "Quill",
  kn0w1: "Kn0w1",
  "aigent-z": "Aigent Z",
  "aigent-c": "Aigent C",
  "aigent-nakamoto": "Aigent Nakamoto",
};

const EFFORT_CHIP: Record<NextBestActionData["effort"], string> = {
  light: "Light",
  standard: "Standard",
  deep: "Deep",
};

const IMPACT_CHIP: Record<NextBestActionData["impact"], { label: string; ring: string }> = {
  low:    { label: "Low impact",    ring: "border-slate-700 text-slate-300" },
  medium: { label: "Medium impact", ring: "border-violet-700/60 text-violet-200" },
  high:   { label: "High impact",   ring: "border-violet-500/70 text-violet-100 bg-violet-500/10" },
};

export function NextBestActionCard({
  action,
  variant = "compact",
  onAct,
  queued = false,
  onDismiss,
  preflightContext,
  promptHint,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const isHero = variant === "hero";
  const surfaceClass = isDark
    ? "bg-slate-900/40 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const chipClass = isDark
    ? "border-slate-700 text-slate-300"
    : "border-slate-300 text-slate-600";
  const buttonClass = isDark
    ? "bg-violet-500/20 hover:bg-violet-500/30 border-violet-500/40 text-violet-200"
    : "bg-violet-100 hover:bg-violet-200 border-violet-300 text-violet-800";

  const impact = IMPACT_CHIP[action.impact];

  return (
    <div
      className={`rounded-lg border ${isHero ? "p-5" : "p-4"} ${surfaceClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Sparkles className={`w-3.5 h-3.5 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              {CARTRIDGE_LABELS[action.cartridge] ?? action.cartridge}
            </span>
            {action.specialist && (
              <>
                <span className={`text-xs ${mutedClass}`}>·</span>
                <Users className={`w-3 h-3 ${mutedClass}`} />
                <span className={`text-xs ${mutedClass}`}>
                  Coordinate with{" "}
                  {SPECIALIST_LABELS[action.specialist] ?? action.specialist}
                </span>
              </>
            )}
            {isHero && <PreflightChip preflight={preflightContext} theme={theme} />}
          </div>
          <h4 className={`${isHero ? "text-lg" : "text-base"} font-semibold leading-tight`}>
            {action.contextualTitle && action.contextualTitle.trim().length > 0
              ? action.contextualTitle
              : action.label}
          </h4>
          {isHero && <PreflightByline preflight={preflightContext} theme={theme} />}
          <p className={`text-sm mt-1 ${mutedClass}`}>{action.rationale}</p>
          {promptHint && promptHint.trim().length > 0 && (
            <p
              className={`text-xs mt-2 italic leading-snug ${
                isDark ? "text-violet-200/80" : "text-violet-700"
              }`}
              title="aigentMe's take — used as the starting frame when you Act"
            >
              <span className="not-italic font-medium opacity-70 mr-1">
                aigentMe&rsquo;s take:
              </span>
              {promptHint}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`px-2 py-0.5 text-[11px] rounded-full border ${chipClass}`}>
              <Zap className="w-3 h-3 inline -mt-0.5 mr-0.5" />
              {EFFORT_CHIP[action.effort]}
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] rounded-full border ${impact.ring}`}
            >
              {impact.label}
            </span>
            {action.approvalRequired && (
              <span className={`px-2 py-0.5 text-[11px] rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10`}>
                <ShieldAlert className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                Approval required
              </span>
            )}
            {action.suggestedArtifact && (
              <span className={`px-2 py-0.5 text-[11px] rounded-full border ${chipClass}`}>
                <Pencil className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                {action.suggestedArtifact}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          {onAct && !queued && (
            <button
              onClick={() => onAct(action)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium transition ${buttonClass}`}
            >
              Act
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          {queued && (
            <span
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium ${
                isDark
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-emerald-500/40 bg-emerald-50 text-emerald-700"
              }`}
              title="Queued as an IntentQube — awaiting review / execution"
            >
              <Check className="w-3 h-3" />
              Queued
            </span>
          )}
          {isHero && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss next best action"
              title="Close move-forward bundle"
              className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-colors ${
                isDark
                  ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default NextBestActionCard;
