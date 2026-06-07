"use client";

/**
 * SpecialistResponseCard — Aigent Me Phase 5.
 * Renders a structured specialist response (Marketa Partner Proposal Card,
 * Quill Editorial Recommendation Card, Kn0w1 Mission Recommendation, etc).
 *
 * Per PRD v0.2 §9.2 (Runtime cards → Specialist Request Card +
 * Partner Proposal Card + Editorial Recommendation Card).
 *
 * The Phase 5 alpha collapses these into a single card driven by the
 * SpecialistResponse shape. Each specialist's request type styles the
 * header copy; the body shape is uniform: title + summary +
 * recommendations + suggested artifacts + confidence + source badge.
 */

import React from "react";
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  Pencil,
  Loader2,
  X,
  Bot,
} from "lucide-react";
import { IqubeContextDisclosure, type IqubeKind } from "./IqubeContextDisclosure";
import { PreflightByline, PreflightChip } from "./PreflightByline";
import type { PreflightContext } from "@/services/capabilities/preflight";

export interface SpecialistResponseData {
  specialistId: "marketa" | "quill" | "kn0w1" | "aigent-z" | "aigent-c" | "aigent-nakamoto";
  specialistLabel: string;
  requestType: string;
  title: string;
  summary: string;
  recommendations: string[];
  suggestedArtifacts: string[];
  requiresApproval: boolean;
  confidence: "low" | "medium" | "high";
  source: "llm" | "template";
  generatedAt: string;
  preflightContext?: PreflightContext;
  handoffFrom?: { specialistId: SpecialistResponseData["specialistId"]; priorTitle: string };
}

interface Props {
  data: SpecialistResponseData | null;
  loading?: boolean;
  error?: string | null;
  using?: IqubeKind[];
  onDismiss?: () => void;
  /** Click an artifact chip → request Aigent Me create it. */
  onCreateArtifact?: (artifactType: string) => void;
  /**
   * When set, the "Approval required to implement" footer pill becomes
   * a button that scrolls to / opens the implement-approval surface
   * (the second-tier approval on the matching artifact, or the
   * suggested-artifact chips when no artifact has been drafted yet).
   */
  onRequestApproval?: () => void;
  theme?: "light" | "dark";
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  proposal: "Partner proposal",
  editorial_angle: "Editorial angle",
  mission_recommendation: "Mission recommendation",
  system_guidance: "Platform guidance",
  customer_journey: "Customer-journey framing",
  partner_brief: "Partner brief",
  campaign_brief: "Campaign brief",
  article_brief: "Article brief",
};

const CONFIDENCE_META: Record<
  SpecialistResponseData["confidence"],
  { label: string; ring: string }
> = {
  low:    { label: "Low confidence",    ring: "border-amber-500/40 text-amber-300 bg-amber-500/10" },
  medium: { label: "Medium confidence", ring: "border-slate-700 text-slate-300" },
  high:   { label: "High confidence",   ring: "border-violet-500/70 text-violet-100 bg-violet-500/10" },
};

export function SpecialistResponseCard({
  data,
  loading,
  error,
  using = ["PersonaQube", "ExperienceQube", "IntentQube"],
  onDismiss,
  onCreateArtifact,
  onRequestApproval,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const chipClass = isDark
    ? "border-slate-700 text-slate-300 hover:border-violet-500/60"
    : "border-slate-300 text-slate-700 hover:border-violet-400";

  // Must be declared before any early returns (Rules of Hooks).
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  if (loading) {
    return (
      <div className={`rounded-lg border p-5 ${surfaceClass}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          <span className={`text-sm ${mutedClass}`}>
            Coordinating with the specialist…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border p-5 ${surfaceClass}`}>
        <h3 className="font-semibold mb-1">Specialist consultation failed</h3>
        <p className={`text-sm ${mutedClass}`}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const conf = CONFIDENCE_META[data.confidence];
  const requestLabel = REQUEST_TYPE_LABELS[data.requestType] ?? data.requestType;
  const hasDetails = data.recommendations.length > 0;

  return (
    <div className={`rounded-lg border p-5 ${surfaceClass} space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Bot className={`w-4 h-4 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              {data.specialistLabel} · {requestLabel}
            </span>
            {data.handoffFrom && (
              <span
                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${chipClass}`}
                title={data.handoffFrom.priorTitle ? `Hand-off from ${data.handoffFrom.specialistId} — prior take: "${data.handoffFrom.priorTitle}"` : `Hand-off from ${data.handoffFrom.specialistId}`}
              >
                ← {data.handoffFrom.specialistId}
              </span>
            )}
            <PreflightChip preflight={data.preflightContext} theme={theme} />
          </div>
          <h3 className="text-lg font-semibold leading-tight">{data.title}</h3>
          <PreflightByline preflight={data.preflightContext} theme={theme} />
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {data.source === "template" && (
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${chipClass}`}
              title="Generated from the deterministic template (no live LLM key in environment)"
            >
              Template
            </span>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded hover:bg-slate-800/40"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className={`text-sm ${mutedClass}`}>{data.summary}</p>

      {/* iQube disclosure */}
      <IqubeContextDisclosure using={using} theme={theme} />

      {/* Suggested artifacts — always-visible primary CTAs so operator
          never has to expand to find the action. */}
      {data.suggestedArtifacts.length > 0 && (
        <section>
          <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Suggested next steps
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {data.suggestedArtifacts.map((a) => (
              <button
                key={a}
                onClick={() => onCreateArtifact?.(a)}
                disabled={!onCreateArtifact}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${chipClass} ${
                  onCreateArtifact ? "" : "cursor-default opacity-70"
                }`}
                title={onCreateArtifact ? "Create this artifact" : "Artifact creation lands in Phase 6"}
              >
                <Pencil className="w-3 h-3 inline -mt-0.5 mr-1" />
                {a}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Expand toggle — text recommendations only, collapsed by default */}
      {hasDetails && (
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className={`flex items-center gap-1 text-xs uppercase tracking-wider ${accentClass} hover:opacity-80 transition`}
          aria-expanded={detailsOpen}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? "" : "-rotate-90"}`}
          />
          {detailsOpen ? "Hide further recommendations" : "Show further recommendations"}
        </button>
      )}

      {/* Recommendations — behind toggle */}
      {detailsOpen && data.recommendations.length > 0 && (
        <section>
          <ul className="space-y-1.5 text-sm">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 items-start">
                <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 ${accentClass}`} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Footer */}
      <footer
        className={`flex flex-wrap items-center gap-2 text-xs ${mutedClass} pt-3 border-t border-slate-800/40`}
      >
        <span className={`px-2 py-0.5 rounded-full border ${conf.ring}`}>
          {conf.label}
        </span>
        {data.requiresApproval && (
          onRequestApproval ? (
            <button
              type="button"
              onClick={onRequestApproval}
              title="Jump to the approval gate for this recommendation"
              className="px-2 py-0.5 rounded-full border border-amber-500/60 text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 hover:border-amber-400/80 transition cursor-pointer"
            >
              Approval required to implement →
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10">
              Approval required to implement
            </span>
          )
        )}
        <span className="ml-auto flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          generated {new Date(data.generatedAt).toLocaleString()}
        </span>
      </footer>
    </div>
  );
}

export default SpecialistResponseCard;
