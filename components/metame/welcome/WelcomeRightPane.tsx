"use client";

/**
 * WelcomeRightPane — the right-hand surface of the aigentMe split tab.
 *
 * Compact layout:
 *   ┌─────────────────────────────────────┐
 *   │ Identity row (always)               │
 *   │ Primary CTA pills (always)          │
 *   │ Live cards (when present)           │
 *   │ Config accordion (single-open)      │
 *   │   • Experience model                │
 *   │   • Specialists                     │
 *   │   • Cartridges                      │
 *   │   • Google Workspace                │
 *   │   • Active context                  │
 *   │   • Activity receipts               │
 *   └─────────────────────────────────────┘
 *
 * Live cards (brief, NBE, approval, artifacts) are always visible when
 * their state is populated — they're not part of the accordion.
 *
 * The parent (split tab) owns all state; this component is a pure renderer.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Sparkles, Zap, Layers, BarChart3, Plus, Users,
  ChevronDown, ChevronUp, Loader2, EyeOff,
} from "lucide-react";
import { MicButton } from "@/components/ui/MicButton";
import { personaFetch } from "@/utils/personaSpine";
import { PersonalGuideSetupWizard } from "@/components/metame/setup/PersonalGuideSetupWizard";
import { ALIGNMENT_LABEL, type AlignmentState, type PersonalGuideData } from "@/types/experienceGuide";
import {
  ExperienceModelCard,
  type ExperienceModelCardData,
} from "@/components/metame/cards/ExperienceModelCard";
import { BriefCard, type BriefCardData } from "@/components/metame/cards/BriefCard";
import { VentureProgressCard, type VentureProgressData } from "@/components/metame/cards/VentureProgressCard";
import { NextBestActionCard, type NextBestActionData } from "@/components/metame/cards/NextBestActionCard";
import { ApprovalCard, type ApprovalCardAction, type ApprovalQueuedState } from "@/components/metame/cards/ApprovalCard";
import { ArtifactCard, type ArtifactCardData } from "@/components/metame/cards/ArtifactCard";
import type { IqubeKind } from "@/components/metame/cards/IqubeContextDisclosure";
import type { StageEvaluation } from "@/services/strategy/stageProgression";
import { StageProgressionChip } from "@/components/metame/welcome/StageProgressionChip";
import { SecondTierApprovalCard } from "@/components/metame/cards/SecondTierApprovalCard";
import { SpecialistResponseCard, type SpecialistResponseData } from "@/components/metame/cards/SpecialistResponseCard";
import { ActivityReceiptCard, type ActivityReceiptData } from "@/components/metame/cards/ActivityReceiptCard";
import { QuickLinksCard } from "@/components/metame/cards/QuickLinksCard";
import { GoogleConnectionsPanel } from "@/components/metame/connections/GoogleConnectionsPanel";
import type { SectionId } from "./useAigentMeCopilotBridge";

interface Specialist {
  id: string;
  label: string;
  description: string;
  homeCartridge: string;
  canAsk: { enabled: boolean; status: "available" | "preview" };
}

interface PrimaryCta {
  id: string;
  label: string;
  enabled: boolean;
  status: "available" | "preview";
}

const CTA_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "brief-me": Zap,
  "move-this-forward": Sparkles,
  "set-up-experience-model": Layers,
  "review-venture-progress": BarChart3,
  "create-something": Plus,
  "coordinate-follow-ups": Users,
};

interface Props {
  theme?: "light" | "dark";
  personaId?: string;

  /** Identity / bootstrap. */
  displayLabel?: string;
  ctas: PrimaryCta[];
  specialists: Specialist[];
  isAdmin?: boolean;

  /** Live cards. */
  brief: BriefCardData | null;
  briefLoading: boolean;
  briefError: string | null;
  ventureProgress: VentureProgressData | null;
  ventureProgressLoading: boolean;
  ventureProgressError: string | null;
  moveForwardResult: {
    cartridge: string;
    topAction: NextBestActionData | null;
    alternates: NextBestActionData[];
    topActionReason?: string | null;
  } | null;
  moveForwardLoading: boolean;
  pendingApproval: NextBestActionData | null;
  submittingApproval: boolean;
  approvalError: string | null;
  artifacts: ArtifactCardData[];
  actionPendingArtifactId: string | null;
  actionErrors: Record<string, string>;
  secondTierApproval: {
    artifactId: string;
    connectorId: string;
    connectorLabel: string;
    summary: string;
    detail?: string;
    submitting: boolean;
    error: string | null;
  } | null;
  specialistResponses: Record<string, SpecialistResponseData>;
  specialistLoading: Record<string, boolean>;
  specialistErrors: Record<string, string>;
  queuedIntents: Record<string, { intentId: string; status: string; queueMessage: string }>;

  /** Below-fold sections. */
  expModel: ExperienceModelCardData | null;
  expModelLoading: boolean;
  /** Stage progression — drives the compact chip in the identity row. */
  stageEval?: StageEvaluation | null;
  receipts: ActivityReceiptData[];
  receiptsLoading: boolean;
  receiptsPersonaLabel: string | null;

  /** Accordion state. */
  expandedSectionId: SectionId | null;
  setExpandedSectionId: (id: SectionId | null) => void;

  /** iQubes currently in play (for approval/specialist disclosure cards). */
  usingIqubes: IqubeKind[];

  /** Action handlers. */
  onCtaClick: (ctaId: string) => void;
  onNbeAct: (action: NextBestActionData) => void;
  onApprovalApprove: () => void;
  onApprovalCancel: () => void;
  onSendArtifact: (artifactId: string) => void;
  onDismissArtifact: (artifactId: string) => void;
  onApproveSecondTier: () => void;
  onCancelSecondTier: () => void;
  onDismissSpecialist: (nbeId: string) => void;
  onDismissQueued: (nbeId: string) => void;
  /** Per-bundle dismiss handlers — clear the loaded brief / venture /
   *  move-forward state so the action space doesn't pile up. Re-firing
   *  the chip re-issues the request and re-renders the bundle. */
  onDismissBrief?: () => void;
  onDismissVenture?: () => void;
  onDismissMoveForward?: () => void;
  onAskSpecialist: (specialistId: string, prompt: string) => void;
  askSpecialistOpenId: string | null;
  askSpecialistPrompt: string;
  askSpecialistLoadingId: string | null;
  askSpecialistResponses: Record<string, SpecialistResponseData>;
  askSpecialistErrors: Record<string, string>;
  setAskSpecialistOpenId: (id: string | null) => void;
  setAskSpecialistPrompt: (prompt: string) => void;

  /** Ref slots so the parent / bridge can scroll cards into view. */
  briefRef?: React.RefObject<HTMLDivElement>;
  nbeRef?: React.RefObject<HTMLDivElement>;
  approvalRef?: React.RefObject<HTMLDivElement>;
  artifactRef?: React.RefObject<HTMLDivElement>;
}

function toApprovalAction(nbe: NextBestActionData): ApprovalCardAction {
  return {
    nbeId: nbe.id,
    label: nbe.label,
    rationale: nbe.rationale,
    cartridge: nbe.cartridge,
    approvalRequired: nbe.approvalRequired,
    specialist: nbe.specialist,
    suggestedArtifact: nbe.suggestedArtifact,
  };
}

const GUIDE_CHIP_BG: Record<AlignmentState, string> = {
  aligned:  'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  drifting: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  at_risk:  'bg-orange-500/10 border-orange-500/30 text-orange-300',
  repair:   'bg-rose-500/10 border-rose-500/30 text-rose-300',
};

function PersonalGuideChip({ personaId }: { personaId?: string }) {
  const [guide, setGuide] = useState<PersonalGuideData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!personaId) { setLoaded(true); return; }
    let cancelled = false;
    personaFetch('/api/assistant/experience-guide', { personaIdHint: personaId })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { configured?: boolean; guide?: PersonalGuideData | null } | null) => {
        if (cancelled) return;
        setGuide(data?.guide ?? null);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [personaId]);

  if (!loaded) return null;

  return (
    <>
      {guide ? (
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 hover:brightness-110 ${GUIDE_CHIP_BG[guide.alignmentState]}`}
          title={`ExperienceGuide alignment: ${ALIGNMENT_LABEL[guide.alignmentState]} — click to open`}
        >
          ExpGuide: {ALIGNMENT_LABEL[guide.alignmentState]}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          title="Set up your personal ExperienceGuide"
          className="text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
        >
          Set up ExpGuide
        </button>
      )}
      <PersonalGuideSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initial={guide}
        onSaved={(g) => setGuide(g)}
      />
    </>
  );
}

function PersonaQubeBadge({ using, theme = "dark" }: { using: IqubeKind[]; theme?: "light" | "dark" }) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
    : "bg-emerald-50 border-emerald-200 text-emerald-700";
  const tooltip =
    `Using: ${using.join(", ")} · Not shared: confidential strategy notes / private investor data / unreleased IP unless approved`;
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 cursor-help ${surfaceClass}`}
    >
      <Layers className="w-3 h-3" />
      <span>Using {using.join(" + ")}</span>
    </span>
  );
}

/**
 * Surface-level relabels for primary CTAs so the copy reflects current
 * persona state (e.g. "Update" when the ExperienceModel is already configured).
 * The bootstrap API is the source of truth for `label`; this only overrides
 * for known ids when we have local state to refine the wording.
 */
function labelForCta(cta: PrimaryCta, expModel: ExperienceModelCardData | null): string {
  if (cta.id === "set-up-experience-model" && expModel?.configured) {
    return "Update my ExperienceModel";
  }
  if (cta.id === "move-this-forward") {
    return "Move goals forward";
  }
  return cta.label;
}

export function WelcomeRightPane(props: Props) {
  const {
    theme = "dark",
    personaId,
    displayLabel,
    ctas,
    specialists,
    isAdmin,
    brief, briefLoading, briefError,
    ventureProgress, ventureProgressLoading, ventureProgressError,
    moveForwardResult, moveForwardLoading,
    pendingApproval, submittingApproval, approvalError,
    artifacts, actionPendingArtifactId, actionErrors, secondTierApproval,
    specialistResponses, specialistLoading, specialistErrors, queuedIntents,
    expModel, expModelLoading, stageEval,
    receipts, receiptsLoading, receiptsPersonaLabel,
    expandedSectionId, setExpandedSectionId,
    usingIqubes,
    onCtaClick, onNbeAct, onApprovalApprove, onApprovalCancel,
    onSendArtifact, onDismissArtifact, onApproveSecondTier, onCancelSecondTier,
    onDismissSpecialist, onDismissQueued,
    onDismissBrief, onDismissVenture, onDismissMoveForward,
    onAskSpecialist, askSpecialistOpenId, askSpecialistPrompt, askSpecialistLoadingId,
    askSpecialistResponses, askSpecialistErrors,
    setAskSpecialistOpenId, setAskSpecialistPrompt,
    briefRef, nbeRef, approvalRef, artifactRef,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-emerald-300" : "text-emerald-700";

  const toggleSection = useCallback((id: SectionId) => {
    setExpandedSectionId(expandedSectionId === id ? null : id);
  }, [expandedSectionId, setExpandedSectionId]);

  const visibleCtas = ctas.filter((c) => !c.id.startsWith("ask-"));

  const topAction = moveForwardResult?.topAction ?? null;
  const alternates = moveForwardResult?.alternates ?? [];

  return (
    <div className="h-full overflow-y-auto px-4 py-3 pb-24 space-y-3">
      {/* ── Operational badges carousel ────────────────────────────
          The 'Welcome, <persona>' label was moved up to the cartridge
          header (CodexPanelDynamic right cluster) so it's pinned and
          always visible. This carousel is now reserved for operational
          badges only (ExperienceQube, PersonalGuide, PersonaQube,
          stage progression). */}
      <div className="relative flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">
        {expModel && (
          <span
            title={
              expModel.configured
                ? `ExperienceQube active${expModel.meta?.experienceName ? ` — ${expModel.meta.experienceName}` : ""}`
                : "Set up your Experience Model"
            }
            className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
              expModel.configured
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}
          >
            {expModel.configured
              ? (expModel.meta?.experienceName || "ExpQube active")
              : "Setup Exp Model"}
          </span>
        )}
        <PersonalGuideChip personaId={personaId} />
        <PersonaQubeBadge using={usingIqubes} theme={theme} />
        <StageProgressionChip evaluation={stageEval ?? null} />
      </div>

      {/* ── Primary CTA pills ────────────────────────────────────── */}
      {visibleCtas.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {visibleCtas.map((cta) => {
            const Icon = CTA_ICON_MAP[cta.id] ?? Sparkles;
            const isPreview = cta.status === "preview";
            const violetAccent = isDark ? "text-violet-300" : "text-violet-600";
            return (
              <button
                key={cta.id}
                type="button"
                onClick={() => onCtaClick(cta.id)}
                disabled={!cta.enabled || isPreview}
                title={isPreview ? "Coming in a later phase of the alpha" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition w-full ${
                  isPreview || !cta.enabled
                    ? isDark
                      ? "bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                    : isDark
                      ? "bg-slate-800/60 border-slate-700 hover:bg-slate-800 hover:border-violet-500/40 text-slate-100"
                      : "bg-white border-slate-200 hover:bg-slate-50 hover:border-violet-400 text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${cta.enabled && !isPreview ? violetAccent : mutedClass}`} />
                <span className="text-sm font-medium leading-snug truncate flex-1">{labelForCta(cta, expModel)}</span>
                {isPreview && (
                  <span className={`ml-auto text-[9px] uppercase tracking-wider ${mutedClass} opacity-60`}>
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Live cards: brief / venture / NBE / approval / artifacts ── */}
      {pendingApproval && (
        <div ref={approvalRef}>
          <ApprovalCard
            action={toApprovalAction(pendingApproval)}
            onApprove={onApprovalApprove}
            onCancel={onApprovalCancel}
            submitting={submittingApproval}
            error={approvalError}
            using={usingIqubes}
            theme={theme}
          />
        </div>
      )}

      {/* Queued intents — re-render ApprovalCard in confirmed state. */}
      {Object.entries(queuedIntents).map(([nbeId, queued]) => {
        const nbe = (moveForwardResult?.topAction?.id === nbeId
          ? moveForwardResult.topAction
          : moveForwardResult?.alternates.find((a) => a.id === nbeId)) ?? null;
        if (!nbe) return null;
        return (
          <div key={`queued-${nbeId}`} data-queued-nbe-id={nbeId}>
            <ApprovalCard
              action={toApprovalAction(nbe)}
              onApprove={() => undefined}
              onCancel={() => onDismissQueued(nbeId)}
              queued={queued as ApprovalQueuedState}
              using={usingIqubes}
              theme={theme}
            />
          </div>
        );
      })}

      {(brief || briefLoading || briefError) && (
        <div ref={briefRef}>
          <BriefCard
            data={brief}
            loading={briefLoading}
            error={briefError}
            onActOnNbe={onNbeAct}
            onDismiss={onDismissBrief}
            theme={theme}
          />
        </div>
      )}

      {(ventureProgress || ventureProgressLoading || ventureProgressError) && (
        <VentureProgressCard
          data={ventureProgress}
          loading={ventureProgressLoading}
          error={ventureProgressError}
          onDismiss={onDismissVenture}
          theme={theme}
        />
      )}

      {topAction && !queuedIntents[topAction.id] && (
        <div ref={nbeRef}>
          {moveForwardResult?.topActionReason && (
            <div className="mb-1.5 px-3 py-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 text-[11px] text-violet-200 flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
              <span><span className="text-slate-400">Why this:</span> {moveForwardResult.topActionReason}</span>
            </div>
          )}
          <NextBestActionCard
            action={topAction}
            onAct={onNbeAct}
            onDismiss={onDismissMoveForward}
            theme={theme}
            variant="hero"
          />
        </div>
      )}
      {alternates.length > 0 && (
        <div className="space-y-2">
          {alternates.filter((a) => !queuedIntents[a.id]).map((alt) => (
            <NextBestActionCard
              key={alt.id}
              action={alt}
              onAct={onNbeAct}
              theme={theme}
            />
          ))}
        </div>
      )}
      {moveForwardLoading && (
        <div className={`text-xs flex items-center gap-2 ${mutedClass}`}>
          <Loader2 className="w-3 h-3 animate-spin" /> Finding next best action…
        </div>
      )}

      {/* Specialist responses linked to NBEs */}
      {Object.entries(specialistResponses).map(([nbeId, sp]) => (
        <SpecialistResponseCard
          key={nbeId}
          data={sp}
          using={usingIqubes}
          onDismiss={() => onDismissSpecialist(nbeId)}
          theme={theme}
        />
      ))}
      {Object.entries(specialistLoading)
        .filter(([, loading]) => loading)
        .map(([nbeId]) => (
          <div key={nbeId} className={`text-xs flex items-center gap-2 ${mutedClass}`}>
            <Loader2 className="w-3 h-3 animate-spin" /> Consulting specialist…
          </div>
        ))}
      {Object.entries(specialistErrors).map(([nbeId, err]) => (
        <p key={`err-${nbeId}`} className={`text-xs ${isDark ? "text-rose-400" : "text-rose-600"}`}>
          Specialist failed: {err}
        </p>
      ))}

      {artifacts.length > 0 && (
        <div ref={artifactRef} className="space-y-2">
          {artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.artifactId}
              data={artifact}
              onAction={() => onSendArtifact(artifact.artifactId)}
              onDismiss={() => onDismissArtifact(artifact.artifactId)}
              actionPending={actionPendingArtifactId === artifact.artifactId}
              actionError={actionErrors[artifact.artifactId]}
              theme={theme}
            />
          ))}
        </div>
      )}

      {secondTierApproval && (
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

      {/* ── Below-fold accordion ─────────────────────────────────── */}
      <div className={`pt-2 mt-1 border-t ${isDark ? "border-slate-800/50" : "border-slate-200"} space-y-2`}>
        <AccordionRow
          id="experience"
          title="Experience model"
          summary={expModel?.configured ? expModel.meta?.experienceName ?? "Configured" : "Not configured"}
          expanded={expandedSectionId === "experience"}
          onToggle={() => toggleSection("experience")}
          theme={theme}
        >
          <ExperienceModelCard
            data={expModel}
            loading={expModelLoading}
            onEdit={() => onCtaClick("set-up-experience-model")}
            theme={theme}
          />
        </AccordionRow>

        <AccordionRow
          id="specialists"
          title="Specialists"
          summary={`${specialists.length} available`}
          expanded={expandedSectionId === "specialists"}
          onToggle={() => toggleSection("specialists")}
          theme={theme}
        >
          <SpecialistsGrid
            specialists={specialists}
            askOpenId={askSpecialistOpenId}
            askPrompt={askSpecialistPrompt}
            askLoadingId={askSpecialistLoadingId}
            askResponses={askSpecialistResponses}
            askErrors={askSpecialistErrors}
            setOpenId={setAskSpecialistOpenId}
            setPrompt={setAskSpecialistPrompt}
            onAsk={onAskSpecialist}
            theme={theme}
          />
        </AccordionRow>

        <AccordionRow
          id="cartridges"
          title="Open a cartridge"
          summary="KNYT · Marketa · AgentiQ · Venture Lab"
          expanded={expandedSectionId === "cartridges"}
          onToggle={() => toggleSection("cartridges")}
          theme={theme}
        >
          <QuickLinksCard personaId={personaId} theme={theme} />
        </AccordionRow>

        <AccordionRow
          id="google"
          title="Google Workspace"
          summary="Gmail · Calendar · Drive · Docs · Sheets · Slides"
          expanded={expandedSectionId === "google"}
          onToggle={() => toggleSection("google")}
          theme={theme}
        >
          <GoogleConnectionsPanel isAdmin={!!isAdmin} theme={theme} />
        </AccordionRow>

        <AccordionRow
          id="receipts"
          title="Activity receipts"
          summary={receiptsLoading ? "Loading…" : receipts.length > 0 ? `${receipts.length} recent` : "No activity yet"}
          expanded={expandedSectionId === "receipts"}
          onToggle={() => toggleSection("receipts")}
          theme={theme}
        >
          {receipts.length === 0 ? (
            <p className={`text-xs ${mutedClass}`}>
              No activity yet. Brief, move-forward, compose, approve — every action shows up here.
            </p>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => (
                <ActivityReceiptCard key={r.id} data={r} personaDisplayLabel={receiptsPersonaLabel} theme={theme} />
              ))}
            </div>
          )}
        </AccordionRow>
      </div>
    </div>
  );
}

// ── Accordion row ────────────────────────────────────────────────────
function AccordionRow({
  id, title, summary, expanded, onToggle, theme, children,
}: {
  id: SectionId;
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  theme: "light" | "dark";
  children: React.ReactNode;
}) {
  const isDark = theme === "dark";
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <section
      data-section-id={id}
      className={`rounded-lg border ${isDark ? "border-slate-800/60 bg-slate-900/30" : "border-slate-200 bg-white/40"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] uppercase tracking-wider ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>{title}</div>
          {!expanded && (
            <div className={`text-[11px] mt-0.5 truncate ${isDark ? "text-slate-400" : "text-slate-600"}`}>{summary}</div>
          )}
        </div>
        <Chevron className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-slate-400" : "text-slate-600"}`} />
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

// ── Specialists grid (inline asks) ────────────────────────────────────
function SpecialistsGrid({
  specialists, askOpenId, askPrompt, askLoadingId, askResponses, askErrors,
  setOpenId, setPrompt, onAsk, theme,
}: {
  specialists: Specialist[];
  askOpenId: string | null;
  askPrompt: string;
  askLoadingId: string | null;
  askResponses: Record<string, SpecialistResponseData>;
  askErrors: Record<string, string>;
  setOpenId: (id: string | null) => void;
  setPrompt: (prompt: string) => void;
  onAsk: (specialistId: string, prompt: string) => void;
  theme: "light" | "dark";
}) {
  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className="grid grid-cols-2 gap-2">
      {specialists.map((s) => {
        const isOpen = askOpenId === s.id;
        const isLoading = askLoadingId === s.id;
        const response = askResponses[s.id];
        const errMsg = askErrors[s.id];
        const isPreview = s.canAsk.status === "preview";
        return (
          <div
            key={s.id}
            className={`rounded-md border text-xs ${isDark ? "border-slate-700/60 bg-slate-800/40" : "border-slate-200 bg-white"}`}
          >
            <div className="px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>{s.label}</span>
                {isPreview && <span className="text-[9px] uppercase opacity-60">soon</span>}
              </div>
              <p className={`text-[10px] mt-0.5 ${mutedClass} line-clamp-2`}>{s.description}</p>
              {!isPreview && (
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                  className={`mt-1.5 text-[10px] uppercase tracking-wider ${isDark ? "text-emerald-300 hover:text-emerald-200" : "text-emerald-700 hover:text-emerald-600"}`}
                >
                  {isOpen ? "Close" : "Ask"}
                </button>
              )}
            </div>
            {isOpen && !isPreview && (
              <div className={`px-2 py-1.5 border-t ${isDark ? "border-slate-700/60" : "border-slate-200"} space-y-1.5`}>
                <div className="relative">
                  <textarea
                    value={askPrompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={`Ask ${s.label}…`}
                    rows={2}
                    className={`w-full text-[11px] rounded p-1.5 pr-9 border ${isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
                  />
                  <div className="absolute top-0.5 right-0.5">
                    <MicButton
                      onTranscript={(text) =>
                        setPrompt(askPrompt ? `${askPrompt.trimEnd()} ${text}` : text)
                      }
                      size="sm"
                      theme={isDark ? "dark" : "light"}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onAsk(s.id, askPrompt)}
                  className={`text-[10px] px-2 py-0.5 rounded border ${isDark ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" : "border-emerald-600/40 text-emerald-700 hover:bg-emerald-50"}`}
                >
                  {isLoading ? "Asking…" : "Send"}
                </button>
                {errMsg && <p className={`text-[10px] ${isDark ? "text-rose-400" : "text-rose-600"}`}>{errMsg}</p>}
                {response && (
                  <div className={`text-[11px] mt-1 ${mutedClass}`}>
                    <div className={`font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>{response.title}</div>
                    <p className="mt-0.5">{response.summary}</p>
                    {response.recommendations && response.recommendations.length > 0 && (
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {response.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
