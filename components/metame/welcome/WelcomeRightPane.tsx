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
import { RequestAdminAccessButton } from "@/components/metame/admin/RequestAdminAccessButton";
import { ALIGNMENT_LABEL, type AlignmentState, type PersonalGuideData } from "@/types/experienceGuide";
import {
  ExperienceModelCard,
  type ExperienceModelCardData,
} from "@/components/metame/cards/ExperienceModelCard";
import { BriefCard, type BriefCardData } from "@/components/metame/cards/BriefCard";
import { ExpandedNBEPill } from "@/components/metame/cards/ExpandedNBEPill";
import { VentureProgressCard, type VentureProgressData } from "@/components/metame/cards/VentureProgressCard";
import { NextBestActionCard, type NextBestActionData } from "@/components/metame/cards/NextBestActionCard";
import { ApprovalCard, type ApprovalCardAction, type ApprovalQueuedState } from "@/components/metame/cards/ApprovalCard";
import { ArtifactCard, type ArtifactCardData } from "@/components/metame/cards/ArtifactCard";
import type { IqubeKind } from "@/components/metame/cards/IqubeContextDisclosure";
import { PreflightByline } from "@/components/metame/cards/PreflightByline";
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
  "ask-specialists": Users,
  "create-something": Plus,
  "coordinate-follow-ups": Users,
};

/**
 * Public prop type — exported so the layout registry (Phase 2, Slice 0+)
 * can compose-route through this component without re-declaring the shape.
 * Kept in lock-step with the local `Props` interface; alias is intentional
 * so a future per-layout narrowing doesn't ripple back into this file.
 */
export type WelcomeRightPaneProps = Props;

interface Props {
  theme?: "light" | "dark";
  personaId?: string;

  /** Identity / bootstrap. */
  displayLabel?: string;
  ctas: PrimaryCta[];
  specialists: Specialist[];
  isAdmin?: boolean;
  /**
   * Spine-resolved admin grants. Drives the Request alpha access
   * chip's render gate (hidden when the persona already holds any
   * admin grant). When undefined, chip falls back to permissive
   * mode (visible) so legacy callers don't get a regression.
   */
  isGlobalAdmin?: boolean;
  hasCartridgeAdminGrant?: boolean;
  /**
   * Cartridge slugs the persona currently has active. Retained for
   * future surfaces; the Request access chip itself no longer reads
   * this directly — it relies on the contextual recommendation
   * computed by the parent.
   */
  activeCartridges?: string[];
  /**
   * CONTEXTUAL trigger for the Request alpha access chip. When the
   * parent detects that one of the persona's brief/move-forward
   * NBAs targets a cartridge the persona isn't activated on, it
   * passes the recommended slug here and the chip surfaces.
   * Undefined = no recommendation = chip hidden.
   */
  recommendedAccessCartridgeSlug?: string | null;
  recommendedAccessCartridgeLabel?: string | null;

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
    nbaPromptHints?: Record<string, string>;
    preflightContext?: import("@/services/capabilities/preflight").PreflightContext;
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
  /**
   * Optional artifact router — when a specialist response card's
   * "Suggested artifacts" chip is clicked, this fires with the
   * artifact label + the originating response. Same shape as the
   * SpecialistsLayout consumer (handleUseSuggestedArtifact in the
   * tab) so both surfaces wire to the identical handler.
   */
  onUseSuggestedArtifact?: (
    artifactType: string,
    response: SpecialistResponseData,
  ) => void;
  queuedIntents: Record<string, { intentId: string; status: string; queueMessage: string; manuallyComplete?: boolean }>;
  /**
   * Session registry of NBA definitions for every NBE the operator has
   * Acted on this session. Lets the Brief Capsule render expanded
   * Pills whose NBA is no longer in brief.nextBestActions (e.g. after
   * a brief refetch or for NBAs queued from move-forward / venture).
   */
  actedNbeRegistry?: Record<string, NextBestActionData>;
  /**
   * The Capsule template currently engaged. Only one Capsule renders
   * at a time; the others are accessible via the session-history
   * strip rendered above the active Capsule.
   */
  activeCapsuleId?: "brief" | "move-forward" | "venture-progress" | "ask-specialists" | null;
  /** Past Capsules — clickable chips to switch back into. */
  capsuleHistory?: ReadonlyArray<"brief" | "move-forward" | "venture-progress" | "ask-specialists">;
  /** Switch the active Capsule (also pushes the current one into history). */
  onEngageCapsule?: (id: "brief" | "move-forward" | "venture-progress" | "ask-specialists") => void;

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
  /** Operator-driven complete flip on a queued NBE pill. Threads
   *  through to ExpandedNBEPill's "Mark complete" header button so the
   *  user can advance pill state to green without waiting on real
   *  execution. */
  onMarkPillComplete?: (nbeId: string) => void;
  /** Per-bundle dismiss handlers — clear the loaded brief / venture /
   *  move-forward state so the action space doesn't pile up. Re-firing
   *  the chip re-issues the request and re-renders the bundle. */
  onDismissBrief?: () => void;
  /**
   * Phase 2 Slice 1: BriefLayout's variant switcher (Today / Project /
   * Cartridge) calls this to re-fetch the brief in the selected scope.
   * StackLayout ignores it. Optional so non-brief callers don't break.
   */
  onBriefVariantChange?: (briefType: "daily" | "project" | "cartridge") => void;
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

/**
 * RequestAccessChip — pulse-highlighted CONTEXTUAL affordance in the
 * right-pane badge carousel.
 *
 * 2026-05-26 contextual rewrite: the alpha render-by-default behaviour
 * was noisy. Operator: 'don't render by default. It should be
 * contextual. If a user wants to launch an activity that requires a
 * capability in another cartridge — e.g. monitor more than one
 * venture — they should be recommended upgrading to that cartridge.'
 *
 * The chip now renders ONLY when `recommendedCartridgeSlug` is set.
 * The parent surface computes that slug by scanning the brief / move-
 * forward NBAs for actions whose target cartridge isn't in the
 * persona's active cartridges. When something IS recommended, the
 * chip label includes the cartridge name so the operator knows
 * exactly what they're being asked to request.
 *
 * Still self-contained: mounts its own modal in controlled mode,
 * dismiss persists in sessionStorage scoped to the recommended slug
 * so dismissing 'Venture Lab' doesn't hide a later 'Marketa' nudge.
 */
function RequestAccessChip({
  recommendedCartridgeSlug,
  recommendedCartridgeLabel,
  isGlobalAdmin,
  hasCartridgeAdminGrant,
}: {
  /** Slug to surface in the chip + modal. Undefined => render nothing. */
  recommendedCartridgeSlug?: string | null;
  /** Human label for the recommendation chip. Falls back to slug. */
  recommendedCartridgeLabel?: string | null;
  isGlobalAdmin: boolean;
  hasCartridgeAdminGrant: boolean;
}) {
  const dismissKey = recommendedCartridgeSlug
    ? `metame.requestAccessChip.dismissed.${recommendedCartridgeSlug}`
    : null;
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !dismissKey) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(window.sessionStorage.getItem(dismissKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  // Render gate: only when there's a contextual recommendation AND
  // the persona doesn't already have an admin/access path AND they
  // haven't dismissed this specific recommendation for the session.
  if (!recommendedCartridgeSlug) return null;
  if (isGlobalAdmin || hasCartridgeAdminGrant) return null;
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined' && dismissKey) {
      try { window.sessionStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
    }
  };

  const displayLabel = recommendedCartridgeLabel ?? recommendedCartridgeSlug;

  return (
    <>
      <span
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 bg-emerald-500/15 text-emerald-100 border-emerald-400/60 shadow-[0_0_0_0_rgba(16,185,129,0.4)] animate-[pulse_2s_ease-in-out_infinite]"
        title={`Some recommended actions need the ${displayLabel} cartridge. Click to request alpha access.`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hover:underline focus:outline-none"
        >
          Request {displayLabel} access
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={`Dismiss ${displayLabel} access prompt`}
          title="Not now (dismiss for this session)"
          className="ml-1 text-emerald-200/80 hover:text-white"
        >
          ×
        </button>
      </span>
      <RequestAdminAccessButton
        defaultCartridgeSlug={recommendedCartridgeSlug}
        open={open}
        onOpenChange={setOpen}
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
    isGlobalAdmin = false,
    hasCartridgeAdminGrant = false,
    activeCartridges = [],
    recommendedAccessCartridgeSlug = null,
    recommendedAccessCartridgeLabel = null,
    brief, briefLoading, briefError,
    ventureProgress, ventureProgressLoading, ventureProgressError,
    moveForwardResult, moveForwardLoading,
    pendingApproval, submittingApproval, approvalError,
    artifacts, actionPendingArtifactId, actionErrors, secondTierApproval,
    specialistResponses, specialistLoading, specialistErrors, queuedIntents,
    actedNbeRegistry = {},
    activeCapsuleId = null,
    capsuleHistory = [],
    onEngageCapsule,
    onUseSuggestedArtifact,
    expModel, expModelLoading, stageEval,
    receipts, receiptsLoading, receiptsPersonaLabel,
    expandedSectionId, setExpandedSectionId,
    usingIqubes,
    onCtaClick, onNbeAct, onApprovalApprove, onApprovalCancel,
    onSendArtifact, onDismissArtifact, onApproveSecondTier, onCancelSecondTier,
    onDismissSpecialist, onDismissQueued, onMarkPillComplete,
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

  // Group artifacts by their originating intent id so each Capsule
  // (Brief, Move forward, Venture progress) can fold the artifacts
  // produced from its Pills into the matching ExpandedNBEPill.
  const artifactsByIntent = React.useMemo<Record<string, ArtifactCardData[]>>(() => {
    const map: Record<string, ArtifactCardData[]> = {};
    for (const a of artifacts) {
      if (!a.intentId) continue;
      (map[a.intentId] ??= []).push(a);
    }
    return map;
  }, [artifacts]);

  // Set of NBE ids that BriefCard now owns (renders their Pills inline).
  // These should NOT also render as standalone capsules at the top of
  // the pane — the Brief Capsule is the canonical home.
  const briefOwnedNbeIds = React.useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    for (const a of brief?.nextBestActions ?? []) ids.add(a.id);
    return ids;
  }, [brief?.nextBestActions]);

  // Same for the Move-forward bundle (top action + alternates) — those
  // Pills belong inside the move-forward Capsule.
  const moveForwardOwnedNbeIds = React.useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    if (moveForwardResult?.topAction) ids.add(moveForwardResult.topAction.id);
    for (const a of moveForwardResult?.alternates ?? []) ids.add(a.id);
    return ids;
  }, [moveForwardResult]);

  return (
    <div
      data-aigentme-right-pane="stack"
      data-aigentme-layout="stack-layout-v1"
      className="h-full overflow-y-auto px-4 py-3 pb-24 space-y-3"
    >
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
        <RequestAccessChip
          recommendedCartridgeSlug={recommendedAccessCartridgeSlug}
          recommendedCartridgeLabel={recommendedAccessCartridgeLabel}
          isGlobalAdmin={isGlobalAdmin}
          hasCartridgeAdminGrant={hasCartridgeAdminGrant}
        />
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

      {/* ── Session history strip ──────────────────────────────────
          Past Capsules render as small chips so the operator can
          jump back to any prior template without losing context.
          Empty until the operator has switched between at least
          two templates. */}
      {capsuleHistory.length > 0 && onEngageCapsule && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className={`uppercase tracking-wider ${mutedClass}`}>History</span>
          {capsuleHistory.map((id) => {
            const label =
              id === "brief" ? "Brief"
                : id === "move-forward" ? "Move forward"
                  : id === "venture-progress" ? "Venture progress"
                    : "Ask specialists";
            return (
              <button
                key={id}
                onClick={() => onEngageCapsule(id)}
                className={`px-2 py-0.5 rounded-full border transition ${
                  isDark
                    ? "border-slate-700 text-slate-300 hover:border-violet-500/60 hover:bg-slate-800/40"
                    : "border-slate-300 text-slate-700 hover:border-violet-400 hover:bg-slate-50"
                }`}
                title={`Return to ${label}`}
              >
                {label}
              </button>
            );
          })}
          {/* Bridge into the canonical Pills & Artifacts ledger so the
              operator can browse every CTA Acted on this session (and
              prior sessions) without leaving the metaMe surface. */}
          <a
            href="/codex/viewer?slug=metame&tab=my-workbench"
            target="_blank"
            rel="noopener noreferrer"
            className={`ml-auto px-2 py-0.5 rounded-full border transition ${
              isDark
                ? "border-violet-500/40 text-violet-200 hover:border-violet-400 hover:bg-violet-500/10"
                : "border-violet-300 text-violet-700 hover:border-violet-500 hover:bg-violet-50"
            }`}
            title="Open the full Pills & Artifacts ledger in myWorkbench"
          >
            View all in myWorkbench →
          </a>
        </div>
      )}

      {/* ── Live cards: only the active Capsule renders here ── */}
      {/* Phase 2 Slice 5b: the NBE-level approval card (pendingApproval)
          previously rendered inline here in the stack. It now renders
          exclusively through the ApprovalLayout overlay so the operator
          sees a single approval surface — not the Phase 2 overlay AND a
          duplicate Phase 1 inline card that required dismissing the
          overlay first to approve. Both NBE approvals AND second-tier
          external-action confirms route through ApprovalLayout. The
          overlay is mounted by AigentMeWelcomeSplitTab when either
          `pendingApprovalNbe` or `secondTierApproval` is set. */}

      {/* Queued intents — re-render ApprovalCard in confirmed state +
          fold the matching specialist response (if any) into the same
          emerald capsule so the queued action and its mission
          recommendation read as one complete unit. The NBE definition
          can come from EITHER moveForwardResult OR brief.nextBestActions
          (the brief path was missed in the alpha and caused the queued
          template to silently render nothing when an operator queued
          an NBE from the Brief surface — 2026-05-26 fix). */}
      {/* Top-of-pane queued capsule loop — only fires for queued
          Pills that aren't owned by a visible template Capsule
          (Brief / Move-forward). Each Capsule renders its own Pills
          inline; this loop catches any orphan that lost its parent. */}
      {Object.entries(queuedIntents).map(([nbeId, queued]) => {
        // The Brief Capsule and Move-forward Capsule now own the
        // expansion of their own Pills inline — don't double-render
        // them as standalone capsules at the top of the pane.
        if (briefOwnedNbeIds.has(nbeId)) return null;
        if (moveForwardOwnedNbeIds.has(nbeId)) return null;
        const fromMoveForward =
          moveForwardResult?.topAction?.id === nbeId
            ? moveForwardResult.topAction
            : moveForwardResult?.alternates.find((a) => a.id === nbeId) ?? null;
        const fromBrief = brief?.nextBestActions?.find((a) => a.id === nbeId) ?? null;
        const nbe = fromMoveForward ?? fromBrief;
        if (!nbe) return null;
        // Fold artifacts produced from this same intent into the
        // capsule. No specialist mission recommendation here — each
        // Capsule template (Brief, Move forward, Venture progress,
        // Ask Specialists) is its own bounded surface; specialist
        // guidance only renders inside the Ask Specialists Capsule.
        const capsuleArtifacts = artifacts.filter(
          (a) => a.intentId && a.intentId === queued.intentId,
        );
        const capsuleSurface = isDark
          ? "border-sky-500/50 bg-sky-500/[0.06]"
          : "border-sky-400 bg-sky-50";
        return (
          <div
            key={`queued-${nbeId}`}
            data-queued-nbe-id={nbeId}
            className={`rounded-xl border ${capsuleSurface} p-2 space-y-2`}
          >
            <ApprovalCard
              action={toApprovalAction(nbe)}
              onApprove={() => undefined}
              onCancel={() => onDismissQueued(nbeId)}
              queued={queued as ApprovalQueuedState}
              using={usingIqubes}
              theme={theme}
            />
            {capsuleArtifacts.map((artifact) => {
              const showSecondTier =
                secondTierApproval?.artifactId === artifact.artifactId;
              return (
                <div key={artifact.artifactId} data-artifact-id={artifact.artifactId} className="space-y-2">
                  <ArtifactCard
                    data={artifact}
                    onAction={() => onSendArtifact(artifact.artifactId)}
                    onDismiss={() => onDismissArtifact(artifact.artifactId)}
                    actionPending={actionPendingArtifactId === artifact.artifactId}
                    actionError={actionErrors[artifact.artifactId]}
                    theme={theme}
                  />
                  {showSecondTier && secondTierApproval && (
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
            queuedIntents={queuedIntents}
            artifactsByIntent={artifactsByIntent}
            secondTierApproval={secondTierApproval}
            actionPendingArtifactId={actionPendingArtifactId}
            actionErrors={actionErrors}
            onDismissQueued={onDismissQueued}
            onSendArtifact={onSendArtifact}
            onDismissArtifact={onDismissArtifact}
            onApproveSecondTier={onApproveSecondTier}
            onCancelSecondTier={onCancelSecondTier}
            onMarkPillComplete={onMarkPillComplete}
            actedNbeRegistry={actedNbeRegistry}
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
          onActOnNbe={onNbeAct}
          queuedIntents={queuedIntents}
          onDismiss={onDismissVenture}
          theme={theme}
        />
      )}

      {/* Move-forward Capsule — top action + alternates as a bundle.
          Queued Pills expand inline as ExpandedNBEPill (same pattern as
          the Brief Capsule) so the bundle stays intact when the
          operator Acts on one Pill. */}
      {topAction && (
        <div ref={nbeRef}>
          {moveForwardResult?.topActionReason && (
            <div className="mb-1.5 px-3 py-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 text-[11px] text-violet-200 flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
              <span><span className="text-slate-400">Why this:</span> {moveForwardResult.topActionReason}</span>
            </div>
          )}
          {queuedIntents[topAction.id] ? (
            <ExpandedNBEPill
              action={topAction}
              queued={queuedIntents[topAction.id]}
              artifacts={artifactsByIntent[queuedIntents[topAction.id].intentId] ?? []}
              secondTierApproval={
                secondTierApproval &&
                (artifactsByIntent[queuedIntents[topAction.id].intentId] ?? []).some(
                  (a) => a.artifactId === secondTierApproval.artifactId,
                )
                  ? secondTierApproval
                  : null
              }
              actionPendingArtifactId={actionPendingArtifactId}
              actionErrors={actionErrors}
              onDismissQueued={() => onDismissQueued(topAction.id)}
              onSendArtifact={(id) => onSendArtifact(id)}
              onDismissArtifact={(id) => onDismissArtifact(id)}
              onApproveSecondTier={onApproveSecondTier}
              onCancelSecondTier={onCancelSecondTier}
              onMarkComplete={
                onMarkPillComplete ? () => onMarkPillComplete(topAction.id) : undefined
              }
              theme={theme}
            />
          ) : (
            <NextBestActionCard
              action={topAction}
              onAct={onNbeAct}
              queued={false}
              onDismiss={onDismissMoveForward}
              preflightContext={moveForwardResult?.preflightContext}
              promptHint={moveForwardResult?.nbaPromptHints?.[topAction.id] ?? null}
              theme={theme}
              variant="hero"
            />
          )}
        </div>
      )}
      {alternates.length > 0 && (
        <div className="space-y-2">
          {alternates.map((alt) => {
            const queued = queuedIntents[alt.id];
            if (queued) {
              const artifactsForPill = artifactsByIntent[queued.intentId] ?? [];
              const matchedSecondTier =
                secondTierApproval &&
                artifactsForPill.some((a) => a.artifactId === secondTierApproval.artifactId)
                  ? secondTierApproval
                  : null;
              return (
                <ExpandedNBEPill
                  key={alt.id}
                  action={alt}
                  queued={queued}
                  artifacts={artifactsForPill}
                  secondTierApproval={matchedSecondTier}
                  actionPendingArtifactId={actionPendingArtifactId}
                  actionErrors={actionErrors}
                  onDismissQueued={() => onDismissQueued(alt.id)}
                  onSendArtifact={(id) => onSendArtifact(id)}
                  onDismissArtifact={(id) => onDismissArtifact(id)}
                  onApproveSecondTier={onApproveSecondTier}
                  onCancelSecondTier={onCancelSecondTier}
                  onMarkComplete={
                    onMarkPillComplete ? () => onMarkPillComplete(alt.id) : undefined
                  }
                  theme={theme}
                />
              );
            }
            return (
              <NextBestActionCard
                key={alt.id}
                action={alt}
                onAct={onNbeAct}
                promptHint={moveForwardResult?.nbaPromptHints?.[alt.id] ?? null}
                theme={theme}
              />
            );
          })}
        </div>
      )}
      {moveForwardLoading && (
        <div className={`text-xs flex items-center gap-2 ${mutedClass}`}>
          <Loader2 className="w-3 h-3 animate-spin" /> Finding next best action…
        </div>
      )}

      {/* Ask Specialists Capsule — minimal scaffold for now.
          The full template (pick a specialist → get a recommendation →
          optionally draft an artifact → linear approve/send → "ask
          another?" CTA) lands in the next pass. This placeholder
          honours the "one Capsule engaged at a time" rule so the chip
          has somewhere to land. */}
      {activeCapsuleId === "ask-specialists" && (
        <div
          className={`rounded-lg border p-5 ${
            isDark
              ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          <h3 className="text-lg font-semibold mb-1">Ask Specialists</h3>
          <p className={`text-sm ${mutedClass}`}>
            Pick a specialist to consult — Marketa for partner moves,
            Quill for editorial framing, Kn0w1 for mission shape,
            Aigent Nakamoto for tokenomics, Aigent Z for orchestration.
            Their recommendations land here and you can draft a follow-on
            artifact directly from them.
          </p>
          <p className={`text-[11px] mt-3 ${mutedClass} italic`}>
            Specialist picker + consultation flow lands in the next
            pass. The Capsule scaffold is wired so the chip + history
            strip work end-to-end.
          </p>
        </div>
      )}

      {/* Specialist responses no longer render anywhere on this surface.
          They belong to the dedicated Ask Specialists Capsule, accessed
          via the "Ask specialists" chip. Folding them into the Brief
          Pill / standalone created the cognitive-load problem the
          operator flagged — each Capsule is now its own bounded
          surface. */}

      {/* Standalone artifacts — only "true" orphans (no parent intent
          matching a queued Pill). In practice these come from the
          bottom compose strip (Email / Doc / Sheet / Slides / Marketa /
          Event) where the operator drafted something without first
          Acting on a Pill. */}
      {(() => {
        const ownedIntentIds = new Set<string>();
        for (const [nbeId, queued] of Object.entries(queuedIntents)) {
          ownedIntentIds.add(queued.intentId);
          void nbeId;
        }
        const standalone = artifacts.filter(
          (a) => !a.intentId || !ownedIntentIds.has(a.intentId),
        );
        if (standalone.length === 0) return null;
        return (
          <div ref={artifactRef} className="space-y-2">
            {standalone.map((artifact) => (
              <div key={artifact.artifactId} data-artifact-id={artifact.artifactId}>
                <ArtifactCard
                  data={artifact}
                  onAction={() => onSendArtifact(artifact.artifactId)}
                  onDismiss={() => onDismissArtifact(artifact.artifactId)}
                  actionPending={actionPendingArtifactId === artifact.artifactId}
                  actionError={actionErrors[artifact.artifactId]}
                  theme={theme}
                />
              </div>
            ))}
          </div>
        );
      })()}

      {/* Phase 2 Slice 5b: second-tier external-action approval is
          rendered through the Phase 2 ApprovalLayout overlay instead
          of inline here. Keeps the operator's flow in one place — no
          inline confirm + overlay confirm collision. The overlay is
          mounted by AigentMeWelcomeSplitTab when
          `secondTierApproval` is set. */}

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
                    <PreflightByline preflight={response.preflightContext} theme={isDark ? "dark" : "light"} />
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
