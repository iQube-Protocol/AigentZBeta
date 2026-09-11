"use client";

/**
 * VentureReportBriefLayout — Phase 2 Slice 6 (Deliberation).
 *
 * Right-pane workspace for assembling a venture report via deliberation.
 * Operator scopes purpose, period, scope, disclosure, emphasis, etc.
 * System assembles platform-native evidence and marks completion.
 * Operator reviews and approves brief, then initiates draft generation.
 *
 * DIS template id: `venture-report-brief-layout-v1`.
 */

import React, { useCallback, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit2,
  Sparkles,
} from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";
import type {
  DeliberationBrief,
  VentureReportBriefSpec,
} from "@/types/deliberativeArtifact";

interface VentureReportBriefLayoutProps extends RightPaneLayoutProps {
  deliberationBrief?: DeliberationBrief;
  deliberationLoading?: boolean;
  deliberationError?: string | null;
  assembledEvidenceCount?: number;
  onUpdateBriefSpec?: (updates: Record<string, unknown>) => void;
  onGenerateReport?: () => void;
  onDismissBrief?: () => void;
}

function VentureReportBriefLayoutComponent(
  props: VentureReportBriefLayoutProps
) {
  const {
    theme = "dark",
    deliberationBrief,
    deliberationLoading,
    deliberationError,
    assembledEvidenceCount,
    onUpdateBriefSpec,
    onGenerateReport,
    onDismissBrief,
    onRequestLayout,
  } = props;

  const isDark = theme === "dark";
  const spec = deliberationBrief?.briefSpec as VentureReportBriefSpec | undefined;
  const isComplete = deliberationBrief?.isComplete ?? false;
  const unresolvedQuestions = deliberationBrief?.unresolvedQuestions ?? [];
  // 'custom' is a category, not the operator's actual words — show/edit the
  // real sentence (customPurpose) for that category, the canonical keyword
  // otherwise. Editing always writes back through handleSaveField's own
  // canonical-vs-custom normalization, so re-saving the displayed sentence
  // unchanged round-trips correctly.
  const purposeDisplayValue = spec?.purpose === "custom" ? (spec?.customPurpose ?? "") : (spec?.purpose ?? "");

  // Local UI state for editing specific fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>("");

  const handleDismiss = useCallback(() => {
    onDismissBrief?.();
    onRequestLayout?.("stack");
  }, [onDismissBrief, onRequestLayout]);

  const handleEditField = useCallback(
    (field: string, currentValue: unknown) => {
      setEditingField(field);
      setTempValue(String(currentValue ?? ""));
    },
    []
  );

  const CANONICAL_PURPOSES = ["internal", "partner", "investor", "product", "full"] as const;

  const handleSaveField = useCallback(
    (field: string) => {
      // Purpose is a closed category (VentureReportBriefSpec.purpose), never
      // free text — writing the raw sentence into it directly was a schema
      // mismatch (2026-09-04 fix). A canonical keyword is saved as-is; any
      // other free-text purpose statement is normalized to the 'custom'
      // category with the operator's own sentence preserved in
      // customPurpose, never discarded and never crammed into the enum.
      if (field === "purpose") {
        const trimmed = tempValue.trim();
        const canonical = CANONICAL_PURPOSES.find((p) => p === trimmed.toLowerCase());
        onUpdateBriefSpec?.(
          canonical
            ? { purpose: canonical, customPurpose: undefined }
            : { purpose: trimmed ? "custom" : undefined, customPurpose: trimmed || undefined }
        );
      } else {
        onUpdateBriefSpec?.({
          [field]: tempValue || undefined,
        });
      }
      setEditingField(null);
      setTempValue("");
    },
    [onUpdateBriefSpec, tempValue]
  );

  const handleGenerateClick = useCallback(() => {
    if (isComplete) {
      onGenerateReport?.();
    }
  }, [isComplete, onGenerateReport]);

  const boxClass = isDark
    ? "border-slate-800 bg-slate-900/40"
    : "border-slate-200 bg-white";
  const labelClass = isDark ? "text-slate-400" : "text-slate-600";
  const valueClass = isDark ? "text-slate-100" : "text-slate-900";

  return (
    <LayoutShell
      surfaceId="venture-report-brief"
      disTemplateId="venture-report-brief-layout-v1"
      theme={theme}
      headerIcon={<BarChart3 className="h-3.5 w-3.5" />}
      headerEyebrow="Deliberation"
      headerTitle="Venture Report Brief"
      onDismiss={handleDismiss}
      dismissLabel="Close brief"
      body={
        deliberationLoading && !deliberationBrief ? (
          <BriefSkeleton isDark={isDark} />
        ) : deliberationError && !deliberationBrief ? (
          <BriefErrorState message={deliberationError} isDark={isDark} />
        ) : deliberationBrief ? (
          <div className="space-y-5 lg:space-y-6">
            {/* Generation error — deliberationError was previously only
                rendered by the `!deliberationBrief` branch above, so once a
                brief existed (always true here) a report-generation failure
                was recorded in state but never shown to the operator
                (2026-09-04 fix). */}
            {deliberationError && (
              <div
                className={`rounded-lg border p-4 ${
                  isDark ? "border-rose-500/40 bg-rose-500/5" : "border-rose-200 bg-rose-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className={`text-sm leading-relaxed ${isDark ? "text-rose-300/90" : "text-rose-700"}`}>
                    {deliberationError}
                  </p>
                </div>
              </div>
            )}
            {/* Completeness indicator */}
            <div
              className={`rounded-lg border p-4 ${
                isComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <div className="flex items-start gap-3">
                {isComplete ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3
                    className={`text-sm font-semibold mb-1 ${
                      isComplete
                        ? "text-emerald-200"
                        : "text-amber-200"
                    }`}
                  >
                    {isComplete
                      ? "Brief is complete"
                      : "Brief needs more information"}
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {isComplete
                      ? "All required fields are set. You can generate the report now."
                      : unresolvedQuestions.length > 0
                        ? `${unresolvedQuestions.length} question${unresolvedQuestions.length !== 1 ? "s" : ""} remaining`
                        : "Answer the questions below to proceed."}
                  </p>
                </div>
              </div>
            </div>

            {/* Unresolved questions section */}
            {unresolvedQuestions.length > 0 && (
              <div
                className={`rounded-lg border p-4 lg:p-5 ${boxClass} space-y-3`}
              >
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
                  Questions from AigentMe
                </h3>
                <ul className="space-y-2">
                  {unresolvedQuestions.map((q, idx) => (
                    <li
                      key={idx}
                      className={`text-sm leading-relaxed flex items-start gap-2 ${valueClass}`}
                    >
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">
                        •
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Brief specification fields */}
            <div
              className={`rounded-lg border p-4 lg:p-5 ${boxClass} space-y-4`}
            >
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
                Report Scope
              </h3>

              {/* Purpose */}
              <div className="space-y-2">
                <label
                  className={`text-xs font-medium ${labelClass}`}
                >
                  Purpose
                </label>
                {editingField === "purpose" ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      placeholder="internal, partner, investor, product, custom"
                      className={`flex-1 text-sm px-3 py-2 rounded border ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-slate-100"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                    />
                    <button
                      onClick={() => handleSaveField("purpose")}
                      className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                        isDark
                          ? "bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
                          : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                      }`}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEditField("purpose", purposeDisplayValue)}
                    className={`w-full text-left px-3 py-2 rounded border flex items-center justify-between ${
                      spec?.purpose
                        ? isDark
                          ? "border-slate-700 bg-slate-800/60 text-slate-100"
                          : "border-slate-300 bg-slate-50 text-slate-900"
                        : labelClass
                    } text-sm hover:bg-slate-700/50 transition-colors`}
                  >
                    <span>{purposeDisplayValue || "Not set"}</span>
                    <Edit2 className="h-3.5 w-3.5 opacity-60" />
                  </button>
                )}
              </div>

              {/* Period */}
              <div className="space-y-2">
                <label
                  className={`text-xs font-medium ${labelClass}`}
                >
                  Reporting Period
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="date"
                      value={spec?.periodStart || ""}
                      onChange={(e) =>
                        onUpdateBriefSpec?.({
                          periodStart: e.target.value || undefined,
                        })
                      }
                      className={`w-full text-sm px-3 py-2 rounded border ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-slate-100"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                      placeholder="Start"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={spec?.periodEnd || ""}
                      onChange={(e) =>
                        onUpdateBriefSpec?.({
                          periodEnd: e.target.value || undefined,
                        })
                      }
                      className={`w-full text-sm px-3 py-2 rounded border ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-slate-100"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                      placeholder="End"
                    />
                  </div>
                </div>
              </div>

              {/* Disclosure */}
              <div className="space-y-2">
                <label
                  className={`text-xs font-medium ${labelClass}`}
                >
                  Disclosure Level
                </label>
                <select
                  value={spec?.disclosure || ""}
                  onChange={(e) =>
                    onUpdateBriefSpec?.({
                      disclosure: e.target.value || undefined,
                    })
                  }
                  className={`w-full text-sm px-3 py-2 rounded border ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-slate-100"
                      : "border-slate-300 bg-white text-slate-900"
                  }`}
                >
                  <option value="">Select disclosure level</option>
                  <option value="internal">Internal</option>
                  <option value="partner">Partner</option>
                  <option value="investor">Investor</option>
                  <option value="public">Public</option>
                </select>
              </div>

              {/* Scope items */}
              <div className="space-y-2">
                <label
                  className={`text-xs font-medium ${labelClass}`}
                >
                  Areas in Scope
                </label>
                <p
                  className={`text-xs ${labelClass} mb-2`}
                >
                  {spec?.scope && spec.scope.length > 0
                    ? `${spec.scope.join(", ")}`
                    : "No areas selected yet"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "product",
                    "bridges",
                    "pilots",
                    "partnerships",
                    "research",
                    "commercial",
                  ].map((area) => {
                    const isSelected = spec?.scope?.includes(area);
                    return (
                      <button
                        key={area}
                        onClick={() => {
                          const current = spec?.scope || [];
                          const updated = isSelected
                            ? current.filter((s) => s !== area)
                            : [...current, area];
                          onUpdateBriefSpec?.({
                            scope: updated.length > 0 ? updated : undefined,
                          });
                        }}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          isSelected
                            ? isDark
                              ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                              : "border-violet-300 bg-violet-50 text-violet-800"
                            : isDark
                              ? "border-slate-700 bg-slate-800/40 text-slate-300 hover:text-slate-100 hover:bg-slate-800/60"
                              : "border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Evidence assembly summary */}
            {assembledEvidenceCount !== undefined && (
              <div
                className={`rounded-lg border p-4 lg:p-5 ${boxClass} space-y-2`}
              >
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
                  Platform Evidence
                </h3>
                <p className={`text-sm ${valueClass}`}>
                  {assembledEvidenceCount} evidence items assembled from activity
                  receipts, objectives, deployments, and capability registry.
                </p>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerateClick}
              disabled={!isComplete}
              className={`w-full py-3 rounded-lg border font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                isComplete
                  ? isDark
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : isDark
                    ? "border-slate-700 bg-slate-800/40 text-slate-500 cursor-not-allowed"
                    : "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Generate Report
            </button>
          </div>
        ) : (
          <BriefEmptyState isDark={isDark} />
        )
      }
    />
  );
}

function BriefSkeleton({ isDark }: { isDark: boolean }) {
  const skel = isDark ? "bg-slate-800/60" : "bg-slate-200/80";
  return (
    <div className="space-y-5" aria-busy="true">
      <div className={`rounded-lg border p-4 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start gap-3">
          <div className={`h-5 w-5 rounded-full ${skel}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-3 w-24 rounded ${skel}`} />
            <div className={`h-3 w-32 rounded ${skel}`} />
          </div>
        </div>
      </div>
      <div className={`rounded-lg border p-4 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
        <div className="space-y-3">
          <div className={`h-3 w-16 rounded ${skel}`} />
          <div className={`h-3 w-full rounded ${skel}`} />
          <div className={`h-3 w-11/12 rounded ${skel}`} />
        </div>
      </div>
    </div>
  );
}

function BriefEmptyState({ isDark }: { isDark: boolean }) {
  const muted = isDark ? "text-slate-400" : "text-slate-600";
  return (
    <div
      className={`rounded-lg border p-5 lg:p-6 ${
        isDark
          ? "border-slate-700/60 bg-slate-900/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <BarChart3
          className={`h-5 w-5 mt-0.5 ${
            isDark ? "text-blue-300" : "text-blue-700"
          }`}
        />
        <div>
          <h3 className="text-sm font-semibold mb-1">
            Assembling report brief
          </h3>
          <p className={`text-xs leading-relaxed ${muted}`}>
            AigentMe is gathering evidence from your platform activities and
            preparing the deliberation workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

function BriefErrorState({ message, isDark }: { message: string; isDark: boolean }) {
  const box = isDark ? "border-rose-500/40 bg-rose-500/5" : "border-rose-200 bg-rose-50";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box}`}>
      <h3
        className={`text-sm font-semibold mb-1 ${
          isDark ? "text-rose-200" : "text-rose-800"
        }`}
      >
        Brief unavailable
      </h3>
      <p
        className={`text-xs leading-relaxed ${
          isDark ? "text-rose-300/80" : "text-rose-700"
        }`}
      >
        {message}
      </p>
    </div>
  );
}

export const VentureReportBriefLayout: RightPaneLayoutDefinition = {
  id: "venture-report-brief",
  label: "Venture Report Brief",
  component: VentureReportBriefLayoutComponent,
  disTemplateId: "venture-report-brief-layout-v1",
};
