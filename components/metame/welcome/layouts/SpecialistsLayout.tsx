"use client";

/**
 * SpecialistsLayout — Phase 2 dedicated specialist-querying surface.
 *
 * Renders five stacked sections inside LayoutShell:
 *   1. aigentMe recommendation card (server-driven, activation-aware)
 *   2. Roster strip — all 8 specialists with availability gating
 *   3. Active specialist focus card (or activation CTA when gated)
 *   4. Composer (textarea + suggested prompts + send)
 *   5. Response thread — current session SpecialistResponseCard stack
 *      followed by prior consultations from activity_receipts
 *
 * Activation gating mirrors the cockpit pattern: specialists whose
 * source cartridge isn't switched on render as "needs activation" with
 * an explicit upgrade path, never silently hidden.
 *
 * DIS template id: `specialists-layout-v1`.
 */
import React, { useMemo } from "react";
import {
  Bot,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
  Users,
  ArrowRightLeft,
  AlertCircle,
  Search,
} from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import { accent } from "./accentTokens";
import { SpecialistResponseCard } from "@/components/metame/cards/SpecialistResponseCard";
import { PreflightByline, PreflightChip } from "@/components/metame/cards/PreflightByline";
import { MicButton } from "@/components/ui/MicButton";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";
import type { SpecialistId } from "@/services/agents/specialistRouter";
import type {
  SpecialistRecommendation,
  SpecialistRosterEntry,
} from "@/services/orchestration/specialistRecommender";

const PROMPT_TEMPLATES_BY_SPECIALIST: Partial<Record<SpecialistId, string[]>> = {
  marketa: [
    "Draft a partner proposal for…",
    "What's the strongest outreach play for…",
    "Frame a campaign brief targeting…",
  ],
  quill: [
    "Pitch an editorial angle on…",
    "Outline an article brief for…",
    "What's the issue-planning move for…",
  ],
  kn0w1: [
    "How should I shape the next KNYT mission around…",
    "Where does this fit in PCS knowledge economics?",
    "Frame this for the KNYT world arc on…",
  ],
  metaye: [
    "What's the governance posture on…",
    "How do civic primitives apply to…",
    "Frame this against Sovereign Cybernetic Polity…",
  ],
  moneypenny: [
    "Price this in Q¢ economics for…",
    "What's the micro-transaction model for…",
    "Sketch a payment ops flow for…",
  ],
  "aigent-nakamoto": [
    "What's the decentralisation posture on…",
    "How do Qripto protocols handle…",
    "Frame this for ecosystem policy on…",
  ],
  "aigent-z": [
    "What does the platform say about…",
    "How should I configure the system for…",
    "Walk me through the system path for…",
  ],
  "aigent-c": [
    "How does the customer journey go for…",
    "What's the AgentiQ OS builder take on…",
    "Frame this for an onboarding flow that…",
  ],
};

function SpecialistsLayoutComponent(props: RightPaneLayoutProps) {
  const { theme = "dark", specialistsLayout: state, onRequestLayout } = props;
  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  // The tab owns all state; the layout is a controlled render. When
  // state isn't wired (during the brief window before bootstrap), we
  // show a minimal placeholder instead of crashing.
  if (!state) {
    return (
      <LayoutShell
        surfaceId="specialists"
        disTemplateId="specialists-layout-v1"
        theme={theme}
        headerIcon={<Users className="h-3.5 w-3.5" />}
        headerEyebrow="Specialists"
        headerTitle="Coordinating…"
        onDismiss={() => onRequestLayout?.("stack")}
        dismissLabel="Close specialists"
        body={
          <div className={`text-xs ${mutedClass} flex items-center gap-2`}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading specialist surface…
          </div>
        }
      />
    );
  }

  const selectedSpecialist = state.selectedSpecialistId
    ? state.recommendation?.roster.find((r) => r.id === state.selectedSpecialistId) ?? null
    : null;
  const activeSpecialistResponse = state.selectedSpecialistId
    ? state.sessionResponses[state.selectedSpecialistId] ?? null
    : null;

  const headerActions = (
    <div className="flex items-center gap-1.5">
      <PreflightChip preflight={state.preflightContext} theme={theme} />
      {state.recommendationLoading && (
        <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="specialists"
      disTemplateId="specialists-layout-v1"
      theme={theme}
      headerIcon={<Users className="h-3.5 w-3.5" />}
      headerEyebrow="Specialists"
      headerTitle={selectedSpecialist?.label ?? "Pick a specialist"}
      headerActions={headerActions}
      onDismiss={() => onRequestLayout?.("stack")}
      dismissLabel="Close specialists"
      body={
        <div className="space-y-5">
          {/* 1 — aigentMe recommendation */}
          <RecommendationCard
            recommendation={state.recommendation}
            loading={state.recommendationLoading}
            error={state.recommendationError}
            preflight={state.preflightContext}
            isDark={isDark}
            onSelect={(id) => props.onSelectSpecialist?.(id)}
            selectedId={state.selectedSpecialistId}
          />

          {/* 2 — Roster strip */}
          <RosterStrip
            roster={state.recommendation?.roster ?? []}
            selectedId={state.selectedSpecialistId}
            isDark={isDark}
            onSelect={(id) => props.onSelectSpecialist?.(id)}
          />

          {/* 3 — Active specialist focus */}
          {selectedSpecialist && (
            <FocusCard
              entry={selectedSpecialist}
              isDark={isDark}
              onActivate={(activationId) =>
                props.onOpenActivationsForSpecialist?.(activationId)
              }
            />
          )}

          {/* 4 — Current reply (or in-flight placeholder). Rendered
              ABOVE the composer so the operator sees the response
              land directly under the focus card after hitting Send,
              with the empty composer immediately below ready for the
              next ask. */}
          {selectedSpecialist && state.askLoadingId === selectedSpecialist.id && (
            <AskingPlaceholder specialistLabel={selectedSpecialist.label} isDark={isDark} />
          )}
          {activeSpecialistResponse && state.askLoadingId !== selectedSpecialist?.id && (
            <section>
              <h4
                className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${
                  isDark ? "text-emerald-300/90" : "text-emerald-700"
                }`}
              >
                Reply
              </h4>
              <SpecialistResponseCard
                data={activeSpecialistResponse}
                theme={theme}
                onCreateArtifact={undefined}
              />
              <HandoffStrip
                roster={state.recommendation?.roster ?? []}
                currentSpecialistId={selectedSpecialist?.id ?? null}
                isDark={isDark}
                onHandoff={(target) => props.onHandoffSpecialist?.(target)}
              />
            </section>
          )}

          {/* 5 — Composer (always under the reply so the conversation
              reads top-down: focus → reply → next ask). */}
          {selectedSpecialist && selectedSpecialist.availability.status !== "needs-activation" && (
            <Composer
              specialist={selectedSpecialist}
              prompt={state.askPrompt}
              loading={state.askLoadingId === selectedSpecialist.id}
              error={state.askError}
              isDark={isDark}
              onChangePrompt={(p) => props.onSetSpecialistPrompt?.(p)}
              onSend={() => props.onAskSelectedSpecialist?.(state.askPrompt)}
            />
          )}

          {/* 6 — Prior consultations (receipts) */}
          {selectedSpecialist && (
            <PriorConsultations
              thread={state.thread}
              loading={state.threadLoading}
              isDark={isDark}
              specialistLabel={selectedSpecialist.label}
            />
          )}
        </div>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// Section components
// ─────────────────────────────────────────────────────────────────────

function RecommendationCard({
  recommendation,
  loading,
  error,
  preflight,
  isDark,
  selectedId,
  onSelect,
}: {
  recommendation: SpecialistRecommendation | null;
  loading: boolean;
  error: string | null;
  preflight?: import("@/services/capabilities/preflight").PreflightContext;
  isDark: boolean;
  selectedId: SpecialistId | null;
  onSelect: (id: SpecialistId) => void;
}) {
  const tint = accent("violet", isDark ? "dark" : "light");
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  if (loading && !recommendation) {
    return (
      <div className={`rounded-lg border p-3 ${tint.border} ${tint.fillSoft}`}>
        <div className={`text-xs ${mutedClass} flex items-center gap-2`}>
          <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
          aigentMe is picking the right specialist…
        </div>
      </div>
    );
  }
  if (error && !recommendation) {
    return (
      <div className={`rounded-lg border p-3 ${tint.border} ${tint.fillSoft}`}>
        <div className={`text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>
          Recommendation unavailable — pick a specialist below.
        </div>
      </div>
    );
  }
  if (!recommendation) return null;

  const top = recommendation.roster.find((r) => r.id === recommendation.topSpecialistId);
  if (!top) return null;
  const isSelected = selectedId === top.id;

  return (
    <div className={`rounded-lg border px-3 py-2 ${tint.border} ${tint.fillSoft}`}>
      {/* Row 1 — eyebrow (left) + actions (right-justified) */}
      <div className="flex items-center gap-2">
        <Sparkles className={`h-3.5 w-3.5 ${tint.text} shrink-0`} />
        <span className={`text-[10px] uppercase tracking-[0.16em] ${tint.text}`}>
          aigentMe suggests
        </span>
        {recommendation.llmApplied && (
          <span className={`text-[9px] uppercase tracking-wider ${mutedClass}`}>
            · llm-ranked
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => onSelect(top.id)}
            className={`text-[11px] px-2.5 py-0.5 rounded-md border transition-colors ${
              isSelected
                ? isDark
                  ? "border-violet-400 bg-violet-500/30 text-violet-100"
                  : "border-violet-500 bg-violet-100 text-violet-800"
                : isDark
                  ? "border-violet-500/40 text-violet-200 hover:bg-violet-500/10"
                  : "border-violet-300 text-violet-700 hover:bg-violet-50"
            }`}
          >
            {isSelected ? "Selected" : `Consult ${top.label}`}
          </button>
          {recommendation.alternates.length > 0 && (
            <span className={`text-[10px] ${mutedClass} whitespace-nowrap`}>
              or:{" "}
              {recommendation.alternates.map((a, i) => (
                <React.Fragment key={a.specialistId}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    onClick={() => onSelect(a.specialistId)}
                    className={`underline-offset-2 hover:underline ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                    title={a.reason}
                  >
                    {recommendation.roster.find((r) => r.id === a.specialistId)?.label ?? a.specialistId}
                  </button>
                </React.Fragment>
              ))}
            </span>
          )}
        </div>
      </div>
      {/* Row 2 — specialist name + reason inline (truncated, tooltip) */}
      <div className="flex items-baseline gap-2 mt-0.5 min-w-0">
        <span className={`text-sm font-semibold shrink-0 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          {top.label}
        </span>
        <span
          className={`text-xs truncate ${mutedClass}`}
          title={recommendation.reason}
        >
          {recommendation.reason}
        </span>
      </div>
      <PreflightByline preflight={preflight} theme={isDark ? "dark" : "light"} />
    </div>
  );
}

function RosterStrip({
  roster,
  selectedId,
  isDark,
  onSelect,
}: {
  roster: SpecialistRosterEntry[];
  selectedId: SpecialistId | null;
  isDark: boolean;
  onSelect: (id: SpecialistId) => void;
}) {
  if (roster.length === 0) {
    return (
      <div className={`text-xs italic ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        Loading roster…
      </div>
    );
  }
  return (
    <section>
      <h4
        className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${
          isDark ? "text-cyan-300/90" : "text-cyan-700"
        }`}
      >
        Roster
      </h4>
      <div className="flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory pb-1 pr-0.5">
        {roster.map((entry) => (
          <div key={entry.id} className="snap-start shrink-0">
            <RosterChip
              entry={entry}
              isSelected={selectedId === entry.id}
              isDark={isDark}
              onSelect={() => onSelect(entry.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function RosterChip({
  entry,
  isSelected,
  isDark,
  onSelect,
}: {
  entry: SpecialistRosterEntry;
  isSelected: boolean;
  isDark: boolean;
  onSelect: () => void;
}) {
  const accentKey =
    entry.availability.status === "needs-activation"
      ? "amber"
      : entry.availability.status === "active"
        ? "cyan"
        : "slate";
  const tint = accent(accentKey, isDark ? "dark" : "light");
  const ring = isSelected
    ? isDark
      ? "ring-2 ring-violet-400"
      : "ring-2 ring-violet-500"
    : "";
  const availability = entry.availability;
  const isNeedsActivation = availability.status === "needs-activation";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-2 min-w-[11rem] max-w-[14rem] backdrop-blur-sm transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${tint.border} ${tint.fillSoft} ${ring}`}
      title={availability.status === "needs-activation"
        ? `${entry.description} · Needs ${availability.activationLabel}`
        : entry.description}
    >
      {/* Row 1 — dot + label + optional locked badge */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
            entry.availability.status === "active"
              ? isDark ? "bg-cyan-300" : "bg-cyan-600"
              : entry.availability.status === "always-available"
                ? isDark ? "bg-slate-400" : "bg-slate-500"
                : isDark ? "bg-amber-300" : "bg-amber-600"
          }`}
        />
        <div className={`text-xs font-medium truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          {entry.label}
        </div>
        {availability.status === "needs-activation" && (
          <span
            className={`ml-auto text-[9px] uppercase tracking-wider shrink-0 ${
              isDark ? "text-amber-300/90" : "text-amber-700"
            }`}
            title={`Needs ${availability.activationLabel}`}
          >
            Locked
          </span>
        )}
      </div>
      {/* Rows 2-3 — description clamp-2 */}
      <p className={`text-[10px] leading-snug mt-0.5 line-clamp-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
        {entry.description}
      </p>
    </button>
  );
}

function FocusCard({
  entry,
  isDark,
  onActivate,
}: {
  entry: SpecialistRosterEntry;
  isDark: boolean;
  onActivate: (activationId: string) => void;
}) {
  const availability = entry.availability;
  const isLocked = availability.status === "needs-activation";
  // Active-agent banner uses emerald so it's visually distinct from
  // the violet "aigentMe suggests" recommendation card sitting above
  // it. Locked specialists still surface in amber so the activation
  // gate reads urgent.
  const tint = accent(isLocked ? "amber" : "emerald", isDark ? "dark" : "light");
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  return (
    <div className={`rounded-lg border p-3 ${tint.border} ${tint.fillSoft}`}>
      <div className="flex items-center gap-2 mb-1">
        <Bot className={`h-4 w-4 ${tint.text}`} />
        <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          {entry.label}
        </span>
        <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
          ·{" "}
          {availability.status === "active"
            ? "active"
            : availability.status === "always-available"
              ? "platform"
              : "locked"}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${mutedClass}`}>{entry.description}</p>
      {availability.status === "needs-activation" && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <AlertCircle className={`h-3 w-3 ${isDark ? "text-amber-300" : "text-amber-700"}`} />
          <span className={`text-xs ${isDark ? "text-amber-300" : "text-amber-700"}`}>
            Activate {availability.activationLabel} to consult {entry.label}.
          </span>
          <button
            type="button"
            onClick={() => onActivate(availability.activationId)}
            className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
              isDark
                ? "border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                : "border-amber-400 text-amber-700 hover:bg-amber-50"
            }`}
          >
            Open Activations
          </button>
        </div>
      )}
    </div>
  );
}

function Composer({
  specialist,
  prompt,
  loading,
  error,
  isDark,
  onChangePrompt,
  onSend,
}: {
  specialist: SpecialistRosterEntry;
  prompt: string;
  loading: boolean;
  error: string | null;
  isDark: boolean;
  onChangePrompt: (p: string) => void;
  onSend: () => void;
}) {
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const templates = useMemo(
    () => PROMPT_TEMPLATES_BY_SPECIALIST[specialist.id] ?? [],
    [specialist.id],
  );
  const sendDisabled = loading || prompt.trim().length === 0;
  return (
    <section>
      <h4
        className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${
          isDark ? "text-emerald-300/90" : "text-emerald-700"
        }`}
      >
        Ask {specialist.label}
      </h4>
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {templates.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChangePrompt(t)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                isDark
                  ? "border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-200"
                  : "border-slate-300 text-slate-600 hover:border-emerald-500/40 hover:text-emerald-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => onChangePrompt(e.target.value)}
          placeholder={`Ask ${specialist.label}…`}
          rows={3}
          className={`w-full text-sm rounded-md p-2 pr-10 border ${
            isDark
              ? "bg-slate-900/60 border-slate-700 text-slate-100 placeholder:text-slate-500"
              : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
          }`}
        />
        <div className="absolute top-1 right-1">
          <MicButton
            onTranscript={(text) =>
              onChangePrompt(prompt ? `${prompt.trimEnd()} ${text}` : text)
            }
            size="sm"
            theme={isDark ? "dark" : "light"}
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 gap-2">
        {error ? (
          <span className={`text-xs ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</span>
        ) : (
          <span className={`text-[10px] ${mutedClass}`}>
            aigentMe coordinates the call; receipts log every consultation.
          </span>
        )}
        <button
          type="button"
          disabled={sendDisabled}
          onClick={onSend}
          className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-md border transition-colors ${
            sendDisabled
              ? isDark
                ? "border-slate-700 text-slate-500 cursor-not-allowed"
                : "border-slate-300 text-slate-400 cursor-not-allowed"
              : isDark
                ? "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                : "border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Send
        </button>
      </div>
    </section>
  );
}

function HandoffStrip({
  roster,
  currentSpecialistId,
  isDark,
  onHandoff,
}: {
  roster: SpecialistRosterEntry[];
  currentSpecialistId: SpecialistId | null;
  isDark: boolean;
  onHandoff: (target: SpecialistId) => void;
}) {
  if (!currentSpecialistId) return null;
  const others = roster.filter(
    (r) => r.id !== currentSpecialistId && r.availability.status !== "needs-activation",
  );
  if (others.length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <ArrowRightLeft className={`h-3 w-3 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
      <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-700"}`}>
        Hand off to
      </span>
      {others.slice(0, 4).map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onHandoff(entry.id)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            isDark
              ? "border-slate-700 text-slate-300 hover:border-violet-500/40 hover:text-violet-200"
              : "border-slate-300 text-slate-600 hover:border-violet-500/40 hover:text-violet-700"
          }`}
          title={`Re-ask the same question to ${entry.label}`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

function AskingPlaceholder({
  specialistLabel,
  isDark,
}: {
  specialistLabel: string;
  isDark: boolean;
}) {
  // In-flight feedback: the moment the operator hits Send, the
  // composer prompt clears and this placeholder lands in the reply
  // slot so they see *something* responding to the click. Replaced by
  // the real SpecialistResponseCard the instant the request resolves.
  const tint = accent("emerald", isDark ? "dark" : "light");
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  return (
    <section>
      <h4
        className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${
          isDark ? "text-emerald-300/90" : "text-emerald-700"
        }`}
      >
        Reply
      </h4>
      <div className={`rounded-lg border p-4 ${tint.border} ${tint.fillSoft}`}>
        <div className={`flex items-center gap-2 text-sm ${mutedClass}`}>
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Asking {specialistLabel}…</span>
        </div>
      </div>
    </section>
  );
}

function PriorConsultations({
  thread,
  loading,
  isDark,
  specialistLabel,
}: {
  thread: NonNullable<RightPaneLayoutProps["specialistsLayout"]>["thread"];
  loading: boolean;
  isDark: boolean;
  specialistLabel: string;
}) {
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  if (loading && thread.length === 0) {
    return (
      <section>
        <h4 className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${mutedClass}`}>
          Prior consultations
        </h4>
        <div className={`text-xs ${mutedClass} flex items-center gap-2`}>
          <Loader2 className="h-3 w-3 animate-spin" /> Loading thread…
        </div>
      </section>
    );
  }
  if (thread.length === 0) {
    return (
      <section>
        <h4 className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${mutedClass}`}>
          Prior consultations
        </h4>
        <p className={`text-xs italic ${mutedClass}`}>
          No prior consultations with {specialistLabel} on this persona.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h4 className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${mutedClass}`}>
        Prior consultations · {thread.length}
      </h4>
      <ul className="space-y-1.5">
        {thread.map((entry) => (
          <li
            key={entry.receiptId}
            className={`rounded-md border p-2 text-xs ${
              isDark ? "border-slate-700/60 bg-slate-900/30" : "border-slate-200 bg-white"
            }`}
            title={entry.summary}
          >
            <div className="flex items-start gap-2">
              <Search className={`h-3 w-3 mt-0.5 shrink-0 ${mutedClass}`} />
              <div className="flex-1 min-w-0">
                <p className={`leading-snug truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {entry.summary}
                </p>
                <div className={`text-[10px] mt-0.5 ${mutedClass} flex items-center gap-1 flex-wrap`}>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  <span>·</span>
                  <span>{entry.activeCartridge}</span>
                  {entry.fromHandoff && (
                    <>
                      <span>·</span>
                      <span className={isDark ? "text-violet-300" : "text-violet-700"}>
                        <ChevronRight className="h-2.5 w-2.5 inline -mt-0.5" /> hand-off
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const SpecialistsLayout: RightPaneLayoutDefinition = {
  id: "specialists",
  label: "Specialists",
  component: SpecialistsLayoutComponent,
  disTemplateId: "specialists-layout-v1",
};
