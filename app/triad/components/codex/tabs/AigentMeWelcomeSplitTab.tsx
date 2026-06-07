"use client";

/**
 * AigentMeWelcomeSplitTab — split-screen variant of the aigentMe welcome surface.
 *
 * Layout (vs. classic AigentMeWelcomeTab which is single-column):
 *
 *   ┌─────────────────────────┬────────────────────────────┐
 *   │                         │  Identity row              │
 *   │   SmartTriadCopilot     │  Primary CTA pills         │
 *   │   (embedded, persistent)│  Live cards (brief / NBE / │
 *   │                         │   approval / artifact)     │
 *   │   Compose strip in      │  Config accordion          │
 *   │   footerContent slot:   │   (one-open-at-a-time):    │
 *   │   Email · Event · Doc · │    Experience model        │
 *   │   Sheet · Slides ·      │    Specialists             │
 *   │   Marketa               │    Cartridges              │
 *   │                         │    Google Workspace        │
 *   │                         │    Activity receipts       │
 *   └─────────────────────────┴────────────────────────────┘
 *
 * AG-UI bridge: useAigentMeCopilotBridge() registers CopilotKit actions
 * so the user can drive the right pane from the copilot (open compose
 * modals, fire CTAs, expand sections, focus cards) and exposes T1-safe
 * readables back to the copilot.
 *
 * Spine contract: every fetch uses personaFetch; no personaId is ever
 * serialised into request bodies. Receipts payloads carry T1 personaDisplayLabel.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  coerceKpisToRichShape,
  type KpiRecord,
  type KpiSource,
} from "@/services/strategy/kpiTypes";
import { ACTIVATION_CATALOG } from "@/data/activation-catalog";
import {
  getActiveCartridge,
  tryOpenInMountedCartridge,
} from "@/services/cartridge/CartridgePresenceRegistry";
import { ActiveKpisEditor } from "@/components/metame/setup/ActiveKpisEditor";
import {
  usePersonaSpine,
  personaFetch,
  PersonaSpineGate,
} from "@/utils/personaSpine";
import { SmartTriadCopilotLayer } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";
import { useCartridgeAdminGrants } from "@/app/hooks/useCartridgeAdminGrants";
// RequestAdminAccessButton now mounted inside WelcomeRightPane (right-
// pane badge carousel). Import removed when the left-strip chip
// moved out per 2026-05-26 operator feedback.

import {
  ExperienceModelCard,
  type ExperienceModelCardData,
} from "@/components/metame/cards/ExperienceModelCard";
import { ExperienceModelSetupWizard } from "@/components/metame/setup/ExperienceModelSetupWizard";
import { ExperienceGoalsEditor } from "@/components/metame/setup/ExperienceGoalsEditor";
import type { BriefCardData } from "@/components/metame/cards/BriefCard";
import type { VentureProgressData } from "@/components/metame/cards/VentureProgressCard";
import type { NextBestActionData } from "@/components/metame/cards/NextBestActionCard";
import type { SpecialistResponseData } from "@/components/metame/cards/SpecialistResponseCard";
import type { ArtifactCardData } from "@/components/metame/cards/ArtifactCard";
import type { ActivityReceiptData } from "@/components/metame/cards/ActivityReceiptCard";
import type { StageEvaluation } from "@/services/strategy/stageProgression";

// ComposeGmailDraftModal + sibling compose modals are now mounted
// inline by ComposerLayout (Phase 2 Slice 4). The tab no longer
// imports or mounts them directly.
// ComposeGoogleDocModal / ComposeGoogleSheetModal / ComposeSlidesModal /
// ComposeMarketaEmailModal — see comment on the Gmail import above.
// All six now mounted inline by ComposerLayout, not by this tab.

import { ComposeQuickActionsStrip, type ComposeKind } from "@/components/metame/copilot/ComposeQuickActionsStrip";
import { UploadDrawer } from "@/components/metame/uploads/UploadDrawer";
import { DownloadsMenu } from "@/components/metame/downloads/DownloadsMenu";
// WelcomeRightPane is composed by the layout registry now — `StackLayout`
// wraps it identically so Phase 1 behavior is preserved while Phase 2
// slices add intent-specific layouts alongside.
import {
  getLayout,
  DEFAULT_LAYOUT_ID,
  type RightPaneLayoutId,
} from "@/components/metame/welcome/layouts/registry";
import type { NbeQuickChip } from "@/types/orchestration";
import {
  useAigentMeCopilotBridge,
  type SectionId,
  type CardKind,
} from "@/components/metame/welcome/useAigentMeCopilotBridge";

interface Specialist {
  id: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c' | 'aigent-nakamoto' | 'moneypenny' | 'metaye';
  label: string;
  description: string;
  homeCartridge: 'cross-cutting' | 'qriptopian' | 'knyt' | 'platform' | 'protocol';
  canAsk: { enabled: boolean; status: 'available' | 'preview' };
}

interface PrimaryCta {
  id: string;
  label: string;
  enabled: boolean;
  status: 'available' | 'preview';
}

interface BootstrapSurface {
  personaSessionToken: string;
  sessionExpiresAt: string;
  displayLabel?: string;
  cartridgeFlags: { isAdmin: boolean; isPartner: boolean };
  activeCartridge: string;
  availableCartridges: Array<{ slug: string; label: string }>;
  availableSpecialists: Specialist[];
  primaryCtas: PrimaryCta[];
  experienceModel: { configured: boolean; name?: string; currentStage?: string };
  pendingApprovals: number;
  naming: {
    productLabel: string;
    knytSpecialist: string;
    qriptopianSpecialist: string;
    canonicalMediaBrand: string;
  };
}

/**
 * Phase 2 Slice 5b: no-op.
 *
 * Previously this auto-opened the newly-created artifact's locationUrl
 * (Gmail draft / Drive doc / Calendar event) in a new tab as soon as
 * the artifact landed. That broke the in-app HITL flow: operators
 * clicked "draft an email", the system created the draft in Gmail,
 * then a new tab popped open BEFORE the user even saw the in-app
 * approval card — by the time the approval sheet appeared, the
 * operator had already context-switched to Gmail.
 *
 * The Phase 1 contract (now restored) is: approve in app → execute
 * via API → ArtifactCard surfaces the `View in Gmail` link in its
 * post-send state. The user clicks the link when they want, not
 * before.
 *
 * Kept as a no-op (instead of deleted) so the six call sites in this
 * file don't need to change — they already do `setArtifacts([...])`
 * inline alongside this call, which is the only behavior we need.
 */
function autoOpenArtifact(_data: { locationUrl?: string | null; artifactType?: string }) {
  return;
}

/**
 * Map an NBE's suggested artifact (or known workspace id) to the compose
 * modal that should open right after approval. Returns null when no
 * compose hand-off makes sense — those NBEs stay queued only.
 */
/**
 * Class-wide unified dispatcher — single source of truth for
 * progressing ANY artifact (NBE Act / specialist chip / "create a
 * doc / report / deck" affordances) to the right destination.
 *
 * Routes through classifySuggestedArtifact and returns a normalised
 * dispatch instruction. Callers turn the instruction into the
 * actual surface change (open composer modal / navigate to canvas /
 * navigate to studio).
 *
 * Why this matters: operator feedback was 'the class-wide artifact
 * progression has to span specialists AND NBE Act AND the Compose
 * strip AND any "create a doc / report / deck" chips — not just
 * specialists piece-meal'. Centralising the classifier here keeps
 * every dispatch consistent so a 'create a partner brief' from any
 * surface always lands in myWorkbench, 'compose a deck' always
 * lands in the slides composer, 'generate a report' lands as a doc,
 * etc.
 */
export interface ArtifactDispatchPayload {
  /** The artifact label (e.g. 'partner-brief', 'image-prompt'). */
  artifactType: string;
  /** Title for the inferred draft prompt. */
  title: string;
  /** Summary for the inferred draft prompt. */
  summary?: string;
  /** Bulleted recommendations to seed the draft. */
  recommendations?: string[];
  /** Originating surface — used for navigation source-of-truth. */
  source: 'specialist' | 'nbe-act' | 'compose-chip' | 'chat';
  /** Optional specialist id for downstream telemetry. */
  specialistId?: string;
}

// Back-compat — kept for the few callers that explicitly want a
// ComposeKind. Prefer classifyNbeAction for new code so NBE Act
// dispatch and specialist-chip dispatch share the same router.
function composeKindForAction(action: NextBestActionData): ComposeKind | null {
  // Explicit workspace NBEs.
  if (action.id === 'metame.use-workspace-gmail') return 'gmail';
  if (action.id === 'metame.use-workspace-doc') return 'doc';
  if (action.id === 'metame.use-workspace-event') return 'event';
  // Fallback by artifact type.
  switch (action.suggestedArtifact) {
    case 'gmail-draft':   return 'gmail';
    case 'google-doc':    return 'doc';
    case 'calendar-block':return 'event';
    case 'slide-outline': return 'slides';
    default:              return null;
  }
}

/**
 * Specialist-response → ComposeKind resolver. Free-form artifact
 * labels coming back from the LLM (e.g. "Partner proposal", "Article
 * brief", "Campaign deck") are normalised to lowercase and matched
 * against keyword patterns. Returns null when no compose surface is
 * a sensible fit — the SpecialistResponseCard then renders the chip
 * as a non-clickable label.
 */
/**
 * Artifact routing — class-wide progression contract.
 *
 * Specialists emit a small set of suggestedArtifacts; the operator
 * clicks a chip on the SpecialistResponseCard and the artifact has
 * to land somewhere actionable. We have FOUR destinations:
 *
 *   1. Composer modal (gmail, event, doc, sheet, slides, marketa)
 *      — for artifacts the operator drafts inside a modal.
 *   2. myCanvas remix dialog (mycanvas-remix) — for publishing-bound
 *      artifacts that should be staged onto the persona's canvas
 *      before going to KNYT Pulse / Qriptopian Pulse.
 *   3. myWorkbench (myworkbench-draft) — for PRIVATE working
 *      artifacts (partner briefs, internal reports, decks pre-share).
 *   4. metaMe Studio (image-prompt, video-script, post-set) — for
 *      generative skills that produce media. Routes to the studio
 *      composer with a prefilled prompt.
 *
 * The classifier below maps each artifact string (often free-text
 * from the LLM) to one of the four classes. Keeping this single
 * function as the SoT means adding a new artifact type only needs a
 * regex update here + a route in handleUseSuggestedArtifact.
 */
export type SuggestedArtifactClass =
  | { kind: 'composer'; composeKind: ComposeKind }
  | { kind: 'mycanvas-remix' }
  | { kind: 'myworkbench-draft' }
  | { kind: 'studio'; skill: 'image' | 'video' | 'post-set' }
  | { kind: 'marketa-campaign' }
  | { kind: 'partner-brief' }
  | { kind: 'unknown' };

function classifySuggestedArtifact(artifactType: string): SuggestedArtifactClass {
  const t = artifactType.toLowerCase();

  // myCanvas remix — explicit publishing path. Highest specificity
  // first because 'canvas' could otherwise be caught by later regexes.
  if (/(mycanvas|canvas-remix|remix-canvas|canvas remix)/.test(t)) return { kind: 'mycanvas-remix' };

  // myWorkbench — private internal artifacts (workbench draft, partner-private).
  if (/(myworkbench|workbench-draft|workbench draft|private[- ]?draft)/.test(t)) {
    return { kind: 'myworkbench-draft' };
  }

  // Marketa campaign (different from a Marketa email — campaign is
  // the full send-pipeline; the email is just the message body).
  if (/(marketa.?campaign|campaign send|send-set|marketa send)/.test(t)) {
    return { kind: 'marketa-campaign' };
  }

  // Partner brief — Marketa private brief. Maps to a private working
  // doc the user can review with their team before sharing.
  if (/(partner.?brief)/.test(t)) {
    return { kind: 'partner-brief' };
  }

  // Studio skills — image / video / post-set generation pipelines.
  if (/(image[- ]?prompt|image[- ]?gen|hero[- ]?image|illustration)/.test(t)) {
    return { kind: 'studio', skill: 'image' };
  }
  if (/(video[- ]?script|video[- ]?gen|video[- ]?clip|trailer|motion)/.test(t)) {
    return { kind: 'studio', skill: 'video' };
  }
  if (/(post[- ]?set|social[- ]?posts|tweet[- ]?thread)/.test(t)) {
    return { kind: 'studio', skill: 'post-set' };
  }

  // Standard composer surfaces — preserve the existing classifier.
  if (/(email|outreach|gmail|note to|reply|message)/.test(t)) {
    return { kind: 'composer', composeKind: /(marketa|campaign send)/.test(t) ? 'marketa' : 'gmail' };
  }
  if (/(meeting|calendar|event|invite|sync\b)/.test(t)) return { kind: 'composer', composeKind: 'event' };
  if (/(slide|deck|presentation|pitch)/.test(t)) return { kind: 'composer', composeKind: 'slides' };
  if (/(sheet|spreadsheet|tracker|csv|table)/.test(t)) return { kind: 'composer', composeKind: 'sheet' };
  if (/(doc|brief|memo|proposal|article|outline|narrative|write-up|writeup|spec|plan|venture[- ]?report)/.test(t)) {
    return { kind: 'composer', composeKind: 'doc' };
  }

  return { kind: 'unknown' };
}

// Back-compat helpers — kept as thin wrappers around classifySuggestedArtifact
// so existing callers (if any) don't break. Prefer the classifier in new code.
function composeKindForSuggestedArtifact(artifactType: string): ComposeKind | null {
  const cls = classifySuggestedArtifact(artifactType);
  return cls.kind === 'composer' ? cls.composeKind : null;
}

function isMyCanvasRemixArtifact(artifactType: string): boolean {
  return classifySuggestedArtifact(artifactType).kind === 'mycanvas-remix';
}

/**
 * Build the inferred draft prompt the ComposerLayout fires on mount.
 * Combines the specialist response's title + summary + top
 * recommendations + chosen artifact into a single, concrete brief so
 * the modal's draft handler can produce a populated form.
 */
function buildPromptForSuggestedArtifact(
  artifactType: string,
  response: import('@/components/metame/cards/SpecialistResponseCard').SpecialistResponseData,
): string {
  const lines: string[] = [];
  lines.push(`Draft a ${artifactType.toLowerCase()} that operationalises ${response.specialistLabel}'s recommendation: "${response.title}".`);
  if (response.summary) lines.push(`Context: ${response.summary}`);
  const topRecs = response.recommendations.slice(0, 4);
  if (topRecs.length > 0) {
    lines.push(`Key points to cover:`);
    for (const r of topRecs) lines.push(`- ${r}`);
  }
  lines.push(`Keep it concrete, action-oriented, and ready for the operator to review, edit, and send.`);
  return lines.join('\n');
}

/**
 * NBE-action variant of the directive-style prompt builder. Used by
 * the post-approve flow when the LLM rerank did NOT emit a
 * nbaPromptHints entry for the action — without this, the composer
 * modal would open empty and the operator would have to type a prompt
 * manually. With this fallback the modal always auto-populates from
 * the action's own label + rationale, mirroring the prompt shape
 * buildPromptForSuggestedArtifact emits for specialist chips so the
 * doc-draft / sheet-draft / slides-draft endpoints all produce
 * useful drafts.
 *
 * Operator: 'the act button is no longer auto populating the
 * generate/composer modal. None of them are. this part of the
 * workflow broke.' — this builder restores the autopopulate.
 */
function buildPromptForNbeAction(
  artifactType: string,
  action: NextBestActionData,
  liveContext?: { experienceName?: string | null; primaryGoal?: string | null } | null,
): string {
  const kind = artifactType.toLowerCase() || 'doc';
  const lines: string[] = [];
  lines.push(`Draft a ${kind} that operationalises this next-best action: "${action.label}".`);
  // Prefer live context (experience name / primary goal from the brief) over the
  // static catalog rationale so the draft is specific to what the operator is
  // actually working on rather than a generic template.
  const contextLine = liveContext?.experienceName
    ? `Context: Tailored for "${liveContext.experienceName}". ${action.rationale || ''}`
    : liveContext?.primaryGoal
    ? `Context: Focused on goal — "${liveContext.primaryGoal}". ${action.rationale || ''}`
    : action.rationale
    ? `Context: ${action.rationale}`
    : null;
  if (contextLine) lines.push(contextLine.trim());
  if (action.cartridge) lines.push(`Cartridge: ${action.cartridge}.`);
  if (action.suggestedArtifact) lines.push(`Artifact type requested: ${action.suggestedArtifact}.`);
  lines.push(`Keep it concrete, action-oriented, and ready for the operator to review, edit, and send.`);
  return lines.join('\n');
}

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
  isPartner?: boolean;
  personaId?: string;
  density?: 'narrow' | 'wide';
}

export function AigentMeWelcomeSplitTab({ theme = 'dark', personaId, isAdmin }: Props) {
  const spine = usePersonaSpine({ personaIdHint: personaId });

  // ── Core bootstrap + sub-surface state ─────────────────────────────
  const [data, setData] = useState<BootstrapSurface | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  const [expModel, setExpModel] = useState<ExperienceModelCardData | null>(null);
  const [expModelLoading, setExpModelLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [stageEval, setStageEval] = useState<StageEvaluation | null>(null);

  const [brief, setBrief] = useState<BriefCardData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [moveForwardResult, setMoveForwardResult] = useState<{
    cartridge: string;
    topAction: NextBestActionData | null;
    alternates: NextBestActionData[];
    topActionReason?: string | null;
    nbaContextualTitles?: Record<string, string>;
    nbaPromptHints?: Record<string, string>;
    preflightContext?: import("@/services/capabilities/preflight").PreflightContext;
  } | null>(null);
  const [moveForwardLoading, setMoveForwardLoading] = useState(false);

  const [ventureProgress, setVentureProgress] = useState<VentureProgressData | null>(null);
  const [ventureProgressLoading, setVentureProgressLoading] = useState(false);
  // Phase 2 B.3 — timestamp of the most recent successful venture
  // progress fetch. Surfaced in the cockpit header as "Synced Ns ago"
  // so the operator can see freshness at a glance.
  const [ventureLastSyncedAt, setVentureLastSyncedAt] = useState<Date | null>(null);
  const [ventureProgressError, setVentureProgressError] = useState<string | null>(null);

  const [specialistResponses, setSpecialistResponses] = useState<Record<string, SpecialistResponseData>>({});
  const [specialistLoading, setSpecialistLoading] = useState<Record<string, boolean>>({});
  const [specialistErrors, setSpecialistErrors] = useState<Record<string, string>>({});

  const [artifacts, setArtifacts] = useState<ArtifactCardData[]>(() => {
    if (typeof window === 'undefined' || !personaId) return [];
    try {
      const raw = window.sessionStorage.getItem(`aigentme:split:artifacts:${personaId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ArtifactCardData[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !personaId) return;
    try {
      window.sessionStorage.setItem(
        `aigentme:split:artifacts:${personaId}`,
        JSON.stringify(artifacts),
      );
    } catch { /* quota — silently degrade */ }
  }, [artifacts, personaId]);

  const [actionPendingArtifactId, setActionPendingArtifactId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [secondTierApproval, setSecondTierApproval] = useState<{
    artifactId: string;
    connectorId: string;
    connectorLabel: string;
    summary: string;
    detail?: string;
    submitting: boolean;
    error: string | null;
  } | null>(null);

  // Upload drawer — opens via the Upload icon in the compose strip.
  // Drives /api/uploads (persona_uploads + Supabase Storage) and the
  // parse-on-upload indexer that backs chat-context attach + email
  // attachment + iqube embed flows.
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  // Downloads menu — opens via the Download icon in the compose strip.
  // Lets the operator grab the VentureQube JSON schema (+ runbooks) to
  // share with their off-platform agent. The agent prepares content
  // that uploads cleanly back through the Upload icon next to it.
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  // Compose modal open/close booleans.
  // Phase 2 Slice 4: compose-modal open booleans removed. The single
  // composerKind state below drives ComposerLayout's inline form host
  // — no separate popup-modal open flags needed.

  // Per-specialist inline Ask state.
  const [askSpecialistOpenId, setAskSpecialistOpenId] = useState<string | null>(null);
  const [askSpecialistPrompt, setAskSpecialistPrompt] = useState("");
  const [askSpecialistLoadingId, setAskSpecialistLoadingId] = useState<string | null>(null);
  const [askSpecialistResponses, setAskSpecialistResponses] = useState<Record<string, SpecialistResponseData>>({});
  const [askSpecialistErrors, setAskSpecialistErrors] = useState<Record<string, string>>({});

  // Phase 2 — SpecialistsLayout state. Recommendation comes from
  // /api/assistant/specialist-recommend; thread comes from
  // /api/assistant/specialist-thread (reads activity_receipts).
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<
    import("@/services/agents/specialistRouter").SpecialistId | null
  >(null);
  const [specialistRecommendation, setSpecialistRecommendation] = useState<
    import("@/services/orchestration/specialistRecommender").SpecialistRecommendation | null
  >(null);
  const [specialistRecommendationLoading, setSpecialistRecommendationLoading] = useState(false);
  const [specialistRecommendationError, setSpecialistRecommendationError] = useState<string | null>(null);
  const [specialistRecommendationPreflight, setSpecialistRecommendationPreflight] = useState<
    import("@/services/capabilities/preflight").PreflightContext | undefined
  >(undefined);
  const [specialistThread, setSpecialistThread] = useState<
    NonNullable<import("@/components/metame/welcome/layouts/types").RightPaneLayoutProps["specialistsLayout"]>["thread"]
  >([]);
  const [specialistThreadLoading, setSpecialistThreadLoading] = useState(false);

  // Activity receipts.
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsPersonaLabel, setReceiptsPersonaLabel] = useState<string | null>(null);

  // Goals editor (short-circuits the `metame.update-experience-goals` NBE).
  const [goalsEditorOpen, setGoalsEditorOpen] = useState(false);

  // Approval + queued intents.
  const [pendingApprovalNbe, setPendingApprovalNbe] = useState<NextBestActionData | null>(null);
  // Move D — when Act fires on an NBA that carries a `promptHint`, we
  // stash it here so the post-approval composer hand-off can seed
  // composerInitialPrompt with the LLM's "aigentMe's take" framing.
  const [pendingApprovalHint, setPendingApprovalHint] = useState<string | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [queuedIntents, setQueuedIntents] = useState<
    Record<string, { intentId: string; status: string; queueMessage: string; manuallyComplete?: boolean }>
  >({});
  // Session registry of NBA definitions for every NBE the operator has
  // Acted on. Survives brief / move-forward refetches so the Brief
  // Capsule can render expanded Pills even after the source NBA is no
  // longer in brief.nextBestActions. Keyed by NBE id.
  const [actedNbeRegistry, setActedNbeRegistry] = useState<
    Record<string, NextBestActionData>
  >({});

  // Active Capsule template — one engaged at a time. Each Capsule
  // (Brief, Move forward, Venture progress, Ask specialists) is its
  // own bounded surface; the operator engages one, completes their
  // work, then moves to the next. Previous Capsules collapse into
  // the session-history strip and can be restored by click.
  type CapsuleId = "brief" | "move-forward" | "venture-progress" | "ask-specialists";
  // CANONICAL Capsule → Layout mapping. Every Capsule template owns
  // exactly one dedicated foreground layout. Activating a Capsule MUST
  // mount its layout (both states stay in lockstep) — otherwise the
  // operator lands on the stack/manual fallback while activeCapsuleId
  // claims a Capsule is engaged. This was the 2026-05-28 Ask Specialists
  // regression: the chip set activeCapsuleId but not activeLayoutId, so
  // the specialist response + suggested-artifact CTAs rendered on the
  // manual surface instead of inside the Capsule.
  //
  // DO NOT activate a Capsule without also setting its layout. Always
  // route through `engageCapsuleAndMount` below. If you add a fifth
  // Capsule, extend this mapping AND the type union.
  const CAPSULE_LAYOUT: Record<CapsuleId, RightPaneLayoutId> = {
    "brief": "brief",
    "move-forward": "decision-board",
    "venture-progress": "venture-cockpit",
    "ask-specialists": "specialists",
  };
  const [activeCapsuleId, setActiveCapsuleId] = useState<CapsuleId | null>(null);
  const [capsuleHistory, setCapsuleHistory] = useState<CapsuleId[]>([]);
  const engageCapsule = useCallback((next: CapsuleId) => {
    setActiveCapsuleId((cur) => {
      if (cur === next) return cur;
      if (cur) {
        // Push the previous Capsule into history (dedup so the strip
        // doesn't accumulate duplicate entries when bouncing between
        // two templates).
        setCapsuleHistory((h) => (h[h.length - 1] === cur ? h : [...h.filter((x) => x !== cur), cur]));
      }
      // Drop `next` from history so it doesn't appear in both places.
      setCapsuleHistory((h) => h.filter((x) => x !== next));
      return next;
    });
  }, []);

  // Accordion: which right-pane config section is expanded.
  const [expandedSectionId, setExpandedSectionId] = useState<SectionId | null>(null);

  // Phase 2 Slice 0: right-pane layout selector. Defaults to 'stack' so
  // behavior is identical to Phase 1 — `StackLayout` wraps the existing
  // WelcomeRightPane verbatim. Slices 1+ add intent-specific layouts
  // (brief, decision-board, venture-cockpit, composer, approval, ledger)
  // and the activator chips set this state to route the pane.
  // DIS: codexes/packs/agentiq/items/dis/aigentme-phase-2.dis.json
  const [activeLayoutId, setActiveLayoutId] = useState<RightPaneLayoutId>(DEFAULT_LAYOUT_ID);

  // Capsule activator — engages the Capsule AND mounts its canonical
  // dedicated layout in one atomic call. Every Capsule chip (left-pane
  // handleCtaClick AND chat-copilot quickPrompt onSelect) MUST route
  // through this helper. Calling engageCapsule alone leaves
  // activeLayoutId pinned to whatever it was (often 'stack'), and the
  // operator lands on the manual-fallback surface while activeCapsuleId
  // claims a Capsule is engaged — the 2026-05-28 Ask Specialists
  // regression. The mapping lives in CAPSULE_LAYOUT above; if you add a
  // fifth Capsule, extend the mapping and the type union (not this
  // helper).
  const engageCapsuleAndMount = useCallback((next: CapsuleId) => {
    engageCapsule(next);
    setActiveLayoutId(CAPSULE_LAYOUT[next]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engageCapsule]);

  // Phase 2 Slice 7 — server-driven chip set.
  // Null = use the cold-open static fallback below. Each /api/assistant/*
  // response may carry a `quickChips: NbeQuickChip[]` envelope; when it
  // does, the strip swaps to that set for the next turn. The fetch
  // helpers (fetchBrief / fetchMoveForward / fetchVentureProgress) read
  // the envelope and call setServerChips(). Server emission is the
  // follow-on slice — this slot makes the swap point ready.
  const [serverChips, setServerChips] = useState<NbeQuickChip[] | null>(null);

  // LLM-suggested layouts from the most recent chat turn. Keyed by the
  // 12 chip target ids; value is the promptHint to seed the layout
  // with when the operator clicks the highlighted chip. Cleared on the
  // next chat turn (the copilot fires onSuggestedLayouts([]) when no
  // pattern matched, which we treat as authoritative).
  type ChipTargetId =
    | 'brief' | 'decision-board' | 'venture-cockpit' | 'specialists'
    | 'gmail' | 'event' | 'doc' | 'sheet' | 'slides' | 'marketa'
    | 'upload' | 'download';
  const [suggestedLayoutHints, setSuggestedLayoutHints] = useState<
    Partial<Record<ChipTargetId, string>>
  >({});
  const handleSuggestedLayouts = useCallback(
    (hints: Array<{ layoutId: ChipTargetId; promptHint: string }>) => {
      const next: Partial<Record<ChipTargetId, string>> = {};
      for (const h of hints) next[h.layoutId] = h.promptHint;
      setSuggestedLayoutHints(next);
    },
    [],
  );
  // After the operator engages a Capsule (or opens a composer / drawer)
  // the matching chip's highlight clears so the strip returns to neutral
  // FOR THAT CHIP. Other un-clicked suggestions stay pulsing — the
  // operator may have intended to act on more than one (e.g. draft an
  // email AND consult Marketa). They clear via: clicking the chip,
  // clicking the Clear button on the compose strip, or the next chat
  // turn replacing the whole map.
  const consumeSuggestion = useCallback((id: ChipTargetId) => {
    setSuggestedLayoutHints((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Manual clear for the compose strip's "Clear" button — wipes every
  // compose-class suggestion (Email / Event / Doc / Sheet / Slides /
  // Marketa + Upload / Download) so the strip can return to its idle
  // COMPOSE badge. Capsule-class suggestions (Brief / Move / Venture /
  // Specialists) are left intact since they live on a different strip
  // with its own affordances.
  const clearComposeSuggestions = useCallback(() => {
    setSuggestedLayoutHints((prev) => {
      const composeIds: ChipTargetId[] = [
        'gmail', 'event', 'doc', 'sheet', 'slides', 'marketa', 'upload', 'download',
      ];
      const next = { ...prev };
      let mutated = false;
      for (const id of composeIds) {
        if (id in next) { delete next[id]; mutated = true; }
      }
      return mutated ? next : prev;
    });
  }, []);

  // Mirror Clear for the left strip's capsule chips — wipes only the
  // 4 capsule-class suggestions (Brief / Decision Board / Venture
  // Cockpit / Specialists). Surfaces in the copilot quick-prompt strip
  // as a "Clear" pill that appears only while any capsule chip is
  // pulsing. Leaves compose suggestions intact (they have their own
  // Clear affordance on the right strip).
  const clearCapsuleSuggestions = useCallback(() => {
    setSuggestedLayoutHints((prev) => {
      const capsuleIds: ChipTargetId[] = [
        'brief', 'decision-board', 'venture-cockpit', 'specialists',
      ];
      const next = { ...prev };
      let mutated = false;
      for (const id of capsuleIds) {
        if (id in next) { delete next[id]; mutated = true; }
      }
      return mutated ? next : prev;
    });
  }, []);

  // Phase 2 Slice 5: ApprovalLayout is INTERRUPT class — when a pending
  // approval arrives it overlays whatever layout is foreground. The
  // foreground layout stays mounted underneath so user context is
  // preserved. Driven by `pendingApprovalNbe !== null` directly; no
  // activeLayoutId swap needed.

  // Refs for the copilot to scroll cards into view.
  const briefRef = useRef<HTMLDivElement>(null);
  const nbeRef = useRef<HTMLDivElement>(null);
  const approvalRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);

  // Phase 2 Slice 4 polish: wrap setActiveLayoutId so that a transition
  // back to 'stack' from any non-stack layout — most importantly the
  // composer — auto-scrolls the just-created artifact into view. The
  // ArtifactCard with the `Send draft` button can otherwise sit below
  // the fold in a long stack and the operator misses the approval gate.
  const requestLayout = useCallback(
    (next: RightPaneLayoutId) => {
      setActiveLayoutId((prev) => {
        if (prev !== 'stack' && next === 'stack' && artifactRef.current) {
          // Two RAFs: first lets React commit the layout swap, second
          // lets the stack paint so the artifact section has a real
          // bounding box before we scroll into view.
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              artifactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          });
        }
        return next;
      });
    },
    [],
  );

  // ── Bootstrap fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (spine.status !== 'ready' && spine.status !== 'refreshing') return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    setBootstrapLoading(true);
    setBootstrapError(null);

    personaFetch('/api/assistant/bootstrap', { personaIdHint: personaId, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `bootstrap failed (${res.status})`);
        }
        return res.json() as Promise<BootstrapSurface>;
      })
      .then((surface) => { if (!cancelled) setData(surface); })
      .catch((err) => {
        if (cancelled) return;
        setBootstrapError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setBootstrapLoading(false);
      });

    return () => { cancelled = true; controller.abort(); clearTimeout(timeoutId); };
  }, [spine.status, personaId]);

  // ── ExperienceModel + receipts parallel fetch ──────────────────────
  useEffect(() => {
    if (spine.status !== 'ready' && spine.status !== 'refreshing') return;
    let cancelled = false;

    setExpModelLoading(true);
    personaFetch('/api/assistant/experience-model', { personaIdHint: personaId })
      .then(async (res) => {
        if (!res.ok) throw new Error(`experience-model fetch failed (${res.status})`);
        return res.json() as Promise<ExperienceModelCardData>;
      })
      .then((d) => { if (!cancelled) setExpModel(d); })
      .catch(() => { if (!cancelled) setExpModel({ configured: false, meta: null, blakSummary: null, updatedAt: null }); })
      .finally(() => { if (!cancelled) setExpModelLoading(false); });

    // Stage progression — drives the chip in the right-pane identity row.
    personaFetch('/api/assistant/stage-progression', { personaIdHint: personaId })
      .then(async (res) => {
        if (!res.ok) return;
        const d = (await res.json()) as { evaluation: StageEvaluation | null };
        if (!cancelled) setStageEval(d.evaluation ?? null);
      })
      .catch(() => undefined);

    setReceiptsLoading(true);
    personaFetch('/api/assistant/receipts?limit=25', { personaIdHint: personaId })
      .then(async (res) => {
        if (!res.ok) return;
        const d = (await res.json()) as { receipts: ActivityReceiptData[]; personaDisplayLabel: string | null };
        if (!cancelled) {
          setReceipts(d.receipts ?? []);
          setReceiptsPersonaLabel(d.personaDisplayLabel ?? null);
        }
      })
      .catch(() => { /* best-effort */ })
      .finally(() => { if (!cancelled) setReceiptsLoading(false); });

    return () => { cancelled = true; };
  }, [spine.status, personaId]);

  // ── Fetchers ────────────────────────────────────────────────────────
  const fetchBrief = useCallback(async (briefType: 'daily' | 'project' | 'cartridge' = 'daily') => {
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    try {
      const res = await personaFetch('/api/assistant/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefType }),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `brief failed (${res.status})`);
      }
      const payload = (await res.json()) as BriefCardData & { quickChips?: NbeQuickChip[] };
      setBrief(payload);
      // Phase 2 Slice 7: server-driven chip set. When the response
      // carries a quickChips envelope, swap the strip for the next turn.
      if (Array.isArray(payload.quickChips)) setServerChips(payload.quickChips);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : String(err));
    } finally {
      setBriefLoading(false);
    }
  }, [personaId]);

  const fetchMoveForward = useCallback(async (cartridge?: string) => {
    setMoveForwardLoading(true);
    setMoveForwardResult(null);
    try {
      const res = await personaFetch('/api/assistant/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cartridge ? { cartridge } : {}),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `move-forward failed (${res.status})`);
      }
      const payload = (await res.json()) as {
        cartridge: string;
        topAction: NextBestActionData | null;
        alternates: NextBestActionData[];
        topActionReason?: string | null;
        nbaContextualTitles?: Record<string, string>;
        nbaPromptHints?: Record<string, string>;
        preflightContext?: import("@/services/capabilities/preflight").PreflightContext;
        quickChips?: NbeQuickChip[];
      };
      setMoveForwardResult(payload);
      if (Array.isArray(payload.quickChips)) setServerChips(payload.quickChips);
    } catch {
      setMoveForwardResult({ cartridge: cartridge ?? 'metame', topAction: null, alternates: [] });
    } finally {
      setMoveForwardLoading(false);
    }
  }, [personaId]);

  const fetchVentureProgress = useCallback(async (opts?: { silent?: boolean }) => {
    // Phase 2 B.3 — silent mode lets background polls + post-mutation
    // refreshes update in place without flashing the loading skeleton.
    // Chip-driven fetches still set loading so the operator sees the
    // surface acknowledge their click.
    const silent = !!opts?.silent;
    if (!silent) {
      setVentureProgressLoading(true);
      setVentureProgressError(null);
      setVentureProgress(null);
    }
    try {
      const res = await personaFetch('/api/assistant/venture-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `venture-progress failed (${res.status})`);
      }
      const payload = (await res.json()) as VentureProgressData & { quickChips?: NbeQuickChip[] };
      setVentureProgress(payload);
      setVentureLastSyncedAt(new Date());
      if (Array.isArray(payload.quickChips)) setServerChips(payload.quickChips);
    } catch (err) {
      if (!silent) {
        setVentureProgressError(err instanceof Error ? err.message : String(err));
      }
      // Silent polls swallow errors — the operator already has the
      // last good snapshot on screen and a transient error shouldn't
      // wipe the cockpit.
    } finally {
      if (!silent) setVentureProgressLoading(false);
    }
  }, [personaId]);

  const fetchReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const res = await personaFetch('/api/assistant/receipts?limit=25', { personaIdHint: personaId });
      if (!res.ok) throw new Error(`receipts fetch failed (${res.status})`);
      const data = (await res.json()) as { receipts: ActivityReceiptData[]; count: number; personaDisplayLabel: string | null };
      setReceipts(data.receipts ?? []);
      setReceiptsPersonaLabel(data.personaDisplayLabel ?? null);
    } catch {
      setReceipts([]);
      setReceiptsPersonaLabel(null);
    } finally {
      setReceiptsLoading(false);
    }
  }, [personaId]);

  const handleCtaClick = useCallback((ctaId: string) => {
    if (ctaId === 'set-up-experience-model') { setWizardOpen(true); return; }
    // Each Capsule chip engages exactly one Capsule. Previous
    // Capsule (if any) is pushed to the session-history strip via
    // engageCapsule so the operator can return to it later. Sibling
    // template state is cleared so the stack pane never shows two
    // Capsules side-by-side — only the newly-engaged one renders.
    if (ctaId === 'brief-me') {
      engageCapsuleAndMount('brief');
      setVentureProgress(null);
      setVentureProgressError(null);
      setVentureProgressLoading(false);
      setMoveForwardResult(null);
      setMoveForwardLoading(false);
      void fetchBrief();
      return;
    }
    if (ctaId === 'move-this-forward') {
      engageCapsuleAndMount('move-forward');
      setBrief(null);
      setBriefError(null);
      setBriefLoading(false);
      setVentureProgress(null);
      setVentureProgressError(null);
      setVentureProgressLoading(false);
      void fetchMoveForward();
      return;
    }
    if (ctaId === 'review-venture-progress') {
      engageCapsuleAndMount('venture-progress');
      setBrief(null);
      setBriefError(null);
      setBriefLoading(false);
      setMoveForwardResult(null);
      setMoveForwardLoading(false);
      void fetchVentureProgress();
      return;
    }
    if (ctaId === 'ask-specialists') {
      engageCapsuleAndMount('ask-specialists');
      setBrief(null);
      setBriefError(null);
      setBriefLoading(false);
      setVentureProgress(null);
      setVentureProgressError(null);
      setVentureProgressLoading(false);
      setMoveForwardResult(null);
      setMoveForwardLoading(false);
      // Recommendation fetch is fired by the effect below that watches
      // activeCapsuleId. We can't call fetchSpecialistRecommendation
      // directly here because it's declared further down the component
      // body and would TDZ-error this useCallback's dep array.
      return;
    }
  }, [fetchBrief, fetchMoveForward, fetchVentureProgress, engageCapsuleAndMount]);

  const handleWizardSaved = useCallback((saved: ExperienceModelCardData) => {
    setExpModel(saved);
    void fetchReceipts();
  }, [fetchReceipts]);

  // ── Approval / NBE flow ────────────────────────────────────────────
  const handleNbeAct = useCallback((action: NextBestActionData) => {
    if (queuedIntents[action.id]) return;
    // Capture the NBA definition into the session registry so the
    // brief Capsule can still render this Pill even if a subsequent
    // brief refetch drops the NBA from its nextBestActions list, or
    // if the Pill came from a different surface (move-forward,
    // venture-progress). Without this, only NBAs currently in
    // brief.nextBestActions render — so a user who acted on 3 CTAs
    // sees only the ones the brief still lists.
    setActedNbeRegistry((prev) =>
      prev[action.id] ? prev : { ...prev, [action.id]: action },
    );
    // Short-circuit: the "update goals" NBE opens the goals editor
    // directly rather than going through the generic approval → intent
    // path. Lifecycle feedback: register a queued intent immediately
    // (manuallyComplete=false) so the Pill flips Blue while the editor
    // is open; the editor's onSaved callback then flips it to Green so
    // the operator sees the work landed. Without this the Pill stayed
    // pending and the operator had no signal the save succeeded.
    if (action.id === 'metame.update-experience-goals') {
      const optimisticIntentId = `update-goals-${Date.now()}`;
      setQueuedIntents((prev) => ({
        ...prev,
        [action.id]: {
          intentId: optimisticIntentId,
          status: 'in_progress',
          queueMessage: 'Editing active ExperienceGoals…',
          manuallyComplete: false,
        },
      }));
      setActedNbeRegistry((prev) =>
        prev[action.id] ? prev : { ...prev, [action.id]: action },
      );
      setGoalsEditorOpen(true);
      return;
    }
    // Stage-advance NBE → POST /api/assistant/stage-progression directly.
    // Surface immediate visual feedback: register a queued intent
    // (manuallyComplete so the Pill flips straight to Green per the
    // internal-action lifecycle), refresh receipts + brief so the new
    // stage context propagates.
    if (action.id === 'metame.advance-stage') {
      const optimisticIntentId = `stage-advance-${Date.now()}`;
      setQueuedIntents((prev) => ({
        ...prev,
        [action.id]: {
          intentId: optimisticIntentId,
          status: 'complete',
          queueMessage: 'Stage advance requested — refreshing context.',
          manuallyComplete: true,
        },
      }));
      setActedNbeRegistry((prev) =>
        prev[action.id] ? prev : { ...prev, [action.id]: action },
      );
      void (async () => {
        try {
          await personaFetch('/api/assistant/stage-progression', {
            personaIdHint: personaId,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger: 'nbe' }),
          });
          void fetchReceipts();
          void fetchBrief();
        } catch (err) {
          // Surface failure inline by reverting the optimistic pill
          // and stashing the error on the queue entry.
          const msg = err instanceof Error ? err.message : String(err);
          setQueuedIntents((prev) => {
            const cur = prev[action.id];
            if (!cur || cur.intentId !== optimisticIntentId) return prev;
            return {
              ...prev,
              [action.id]: { ...cur, status: 'failed', queueMessage: `Stage advance failed: ${msg}`, manuallyComplete: false },
            };
          });
        }
      })();
      return;
    }
    setApprovalError(null);
    setPendingApprovalNbe(action);
    // Move D — look up the per-NBA prompt hint emitted by the LLM
    // rerank pass (lives on either the brief or the move-forward
    // result, depending on which surface fired the Act). When the
    // approval flow hands off to a compose modal, this seeds
    // composerInitialPrompt so the form lands populated.
    const hint =
      brief?.nbaPromptHints?.[action.id] ??
      moveForwardResult?.nbaPromptHints?.[action.id] ??
      null;
    setPendingApprovalHint(hint && hint.trim().length > 0 ? hint.trim() : null);
    // Phase 2 Slice 5: ApprovalLayout overlays the current layout
    // automatically via the render — see the right-pane wrapper below.
    // We don't swap `activeLayoutId` so the foreground stays mounted.
    // Scroll the approval card into view — the right pane scrolls
    // independently and the modal would otherwise appear above the fold.
    window.requestAnimationFrame(() => {
      approvalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [queuedIntents, personaId, fetchReceipts, brief, moveForwardResult]);

  const handleApprovalCancel = useCallback(() => {
    setPendingApprovalNbe(null);
    setPendingApprovalHint(null);
    setApprovalError(null);
    // Foreground layout remains as-is; the approval overlay unmounts.
  }, []);

  const handleApprovalApprove = useCallback(async () => {
    if (!pendingApprovalNbe) return;
    const action = pendingApprovalNbe;
    setSubmittingApproval(true);
    setApprovalError(null);
    try {
      const res = await personaFetch('/api/assistant/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nbeId: action.id, cartridge: action.cartridge }),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `intent create failed (${res.status})`);
      }
      const intentData = (await res.json()) as { intentId: string; status: string; queueMessage: string };
      setQueuedIntents((prev) => ({
        ...prev,
        [action.id]: { intentId: intentData.intentId, status: intentData.status, queueMessage: intentData.queueMessage },
      }));
      const handoffHint = pendingApprovalHint;

      // Intent Chain Orchestrator (commit 7): if a chain template's
      // triggered_by_nbe includes this action's id, dispatch a chain
      // instance now so the rest of the flow (compose → submit →
      // review → send → follow-up) carries chain_id through to
      // completion. Best-effort — 404 (no matching template) is
      // expected for NBEs without a chain authored, and we don't
      // want to interrupt the existing intent flow.
      try {
        const chainRes = await personaFetch('/api/intent-chains/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initiating_nbe_id: action.id,
            cartridge: action.cartridge,
            nbe_seed: { handoffHint: handoffHint ?? null, label: action.label, rationale: action.rationale },
            context_seed: { intent_id: intentData.intentId },
          }),
          personaIdHint: personaId,
        });
        if (chainRes.ok) {
          const chainBody = (await chainRes.json()) as { chain_id?: string };
          if (chainBody.chain_id) {
            setChainsByIntent((prev) => ({ ...prev, [intentData.intentId]: chainBody.chain_id! }));
          }
        }
      } catch {
        // Best-effort — chain dispatch failure must not break the intent flow.
      }
      setPendingApprovalNbe(null);
      // Foreground layout remains as-is; approval overlay unmounts.
      void fetchReceipts();
      // Phase 2 B.3 — refresh the cockpit so the just-queued intent
      // appears in Active Work without waiting for the next 20s poll.
      // Gated on the active Capsule: only fetch when the operator is
      // actually engaged in the Venture Capsule — otherwise the
      // populated state causes the VentureProgressCard to render in
      // the stack pane alongside the Brief Capsule (the regression
      // the operator just flagged).
      if (activeCapsuleId === 'venture-progress') {
        void fetchVentureProgress({ silent: true });
      }

      // Class-wide artifact dispatch — same router every other surface
      // (specialist chips, future "create a doc / report / deck"
      // chips) uses, so approved NBE actions land in the right
      // destination automatically:
      //   workspace gmail / doc / sheet / slides / event → composer modal
      //   partner-brief / report → myWorkbench (private)
      //   article / mycanvas-remix → myCanvas (public publishing)
      //   image-prompt / video-script / post-set → metaMe Studio
      //   marketa-campaign → marketa composer
      //
      // 2026-05-26 regression-restore: the previous unification
      // routed ALL composer-class artifacts through dispatchArtifact's
      // buildPromptFromPayload step, which auto-fired a draft with a
      // synthetic title+rationale prompt. That broke the alpha doc
      // generation flow — the modal opened but the draft never
      // populated correctly (the synthetic prompt isn't structured
      // like the rerank's nbaPromptHints and the doc-draft endpoint
      // didn't produce useful output). For composer destinations we
      // now use the EXACT same path that worked before Phase F.1:
      //   - setComposerInitialPrompt(handoffHint || null)
      //   - setComposerKind(<kind>)
      //   - setActiveLayoutId('composer')
      // Modal's existing useEffect handles the auto-fire when
      // handoffHint is present; otherwise the operator types a
      // prompt and clicks Draft — same as alpha. Non-composer
      // destinations (canvas / workbench / studio / marketa-campaign)
      // still go through dispatchArtifact since those are NEW paths
      // and aren't affected by the regression.
      setPendingApprovalHint(null);
      const artifactType = action.suggestedArtifact ?? '';
      const cls = classifySuggestedArtifact(artifactType);

      if (cls.kind === 'composer' || cls.kind === 'unknown') {
        // Composer destinations (including legacy id-based ones that
        // classifier returns 'unknown' on). Always seed the composer
        // with SOMETHING — handoffHint when the LLM rerank emitted
        // one, otherwise the directive fallback built from the
        // action's own label + rationale. Without this fallback the
        // modal opens empty when the rerank doesn't produce a hint
        // (which is most of the time in alpha) and the operator has
        // to type a prompt manually — the autopopulate regression.
        const composeKind =
          cls.kind === 'composer' ? cls.composeKind : composeKindForAction(action);
        if (composeKind) {
          const seedPrompt =
            handoffHint && handoffHint.trim().length > 0
              ? handoffHint
              : buildPromptForNbeAction(artifactType, action, brief?.context);
          setComposerInitialPrompt(seedPrompt);
          setComposerKind(composeKind);
          // Bind the composer to this queued intent so the drafted
          // artifact nests inside the Pill instead of going orphan.
          setComposerSourceIntentId(intentData.intentId);
          // No more setActiveLayoutId('composer') — swapping the
          // layout away from the active Capsule (Brief / Move-forward
          // / Venture) hides every other Pill in the bundle and
          // collapses the Capsule view. The composer needs to open
          // as an overlay on top of the active Capsule so the rest
          // of the Pills remain visible and the operator can return
          // to the Capsule after composing. ComposerOverlayLayout
          // mounts on top of ForegroundLayout when composerKind !==
          // null; see the layout overlay block in render below.
        } else {
          // True no-handoff NBE — scroll to the queued card so the
          // state change is visible.
          window.setTimeout(() => {
            const el = document.querySelector(`[data-queued-nbe-id="${action.id}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      } else {
        // Non-composer destinations (canvas / workbench / studio /
        // marketa-campaign) — route through the dispatcher.
        dispatchArtifact({
          artifactType,
          title: action.label,
          summary: action.rationale,
          source: 'nbe-act',
        });
      }

      if (action.specialist) {
        const nbeId = action.id;
        const specialistId = action.specialist;
        setSpecialistLoading((prev) => ({ ...prev, [nbeId]: true }));
        setSpecialistErrors((prev) => { const next = { ...prev }; delete next[nbeId]; return next; });
        void (async () => {
          try {
            const res2 = await personaFetch('/api/assistant/ask-agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ specialistId, intentId: intentData.intentId, cartridge: action.cartridge }),
              personaIdHint: personaId,
            });
            if (!res2.ok) {
              const body = await res2.json().catch(() => ({}));
              throw new Error(body?.detail || body?.error || `ask-agent failed (${res2.status})`);
            }
            const sp = (await res2.json()) as SpecialistResponseData;
            setSpecialistResponses((prev) => ({ ...prev, [nbeId]: sp }));
          } catch (err) {
            setSpecialistErrors((prev) => ({ ...prev, [nbeId]: err instanceof Error ? err.message : String(err) }));
          } finally {
            setSpecialistLoading((prev) => { const next = { ...prev }; delete next[nbeId]; return next; });
          }
        })();
      }
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingApproval(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingApprovalNbe, pendingApprovalHint, personaId, fetchReceipts, fetchVentureProgress, activeCapsuleId]);

  // Parent IntentQube id for the composer flow. Set when the composer
  // is opened in response to an Act on a queued NBE; threaded into
  // /api/assistant/create-artifact via `sourceIntentId` so the drafted
  // artifact nests inside its parent Pill instead of falling through
  // to the orphan-artifact bucket. Declared HERE (above the compose
  // handlers) so its binding exists by the time their useCallback
  // dependency arrays are evaluated — declaring it further down in
  // the file alongside composerKind put it in the TDZ at render time
  // and crashed the cartridge with "can't access lexical declaration
  // before initialization".
  //
  // Persisted alongside composerKind + composerInitialPrompt (see
  // those state hooks for the rationale) so the artifact that
  // eventually surfaces still nests inside the Pill the operator
  // originally Acted from, even if they sub-tab-navigate mid-compose.
  const [composerSourceIntentId, setComposerSourceIntentId] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !personaId) return null;
    try {
      const raw = window.sessionStorage.getItem(`aigentme:split:composerSourceIntentId:${personaId}`);
      return raw ? (JSON.parse(raw) as string | null) : null;
    } catch { return null; }
  });

  // Intent Chain Orchestrator (spec §7, commit 7) — track dispatched
  // chain_id per intent_id so when a compose/approve step completes
  // we can advance the right chain. Best-effort; map is empty when no
  // chain template matched the NBE at dispatch time.
  const [chainsByIntent, setChainsByIntent] = useState<Record<string, string>>({});
  useEffect(() => {
    if (typeof window === 'undefined' || !personaId) return;
    try {
      if (composerSourceIntentId === null) {
        window.sessionStorage.removeItem(`aigentme:split:composerSourceIntentId:${personaId}`);
      } else {
        window.sessionStorage.setItem(
          `aigentme:split:composerSourceIntentId:${personaId}`,
          JSON.stringify(composerSourceIntentId),
        );
      }
    } catch { /* quota — silently degrade */ }
  }, [composerSourceIntentId, personaId]);

  // ── Compose handlers — all 6 mirror the classic tab pattern ────────
  const handleDraftEmail = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.error || `draft-email failed (${res.status})`);
    }
    return (await res.json()) as { to: string; cc: string; bcc: string; subject: string; bodyText: string; rationale: string; source: 'llm' | 'template' };
  }, [personaId]);

  const handleComposeGmailDraft = useCallback(async (input: { to: string; subject: string; bodyText: string; cc?: string; bcc?: string; attachmentUploadIds?: string[] }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'gmail-draft', destination: 'gmail', title: input.subject, connectorInput: input, sourceIntentId: composerSourceIntentId }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts, composerSourceIntentId]);

  const handleDraftEvent = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.error || `draft-event failed (${res.status})`);
    }
    return (await res.json()) as { summary: string; description: string; startIso: string; endIso: string; timeZone: string; attendeeEmails: string[]; rationale: string; source: 'llm' | 'template' };
  }, [personaId]);

  const handleComposeCalendarEvent = useCallback(async (input: { summary: string; description: string; startIso: string; endIso: string; timeZone: string; attendeeEmails: string[] }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'calendar-block', destination: 'calendar', title: input.summary, connectorInput: input, sourceIntentId: composerSourceIntentId }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts, composerSourceIntentId]);

  const handleDraftDoc = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-doc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.error || `draft-doc failed (${res.status})`);
    }
    return (await res.json()) as { title: string; bodyText: string; shareSuggestions: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }>; rationale: string; source: 'llm' | 'template' };
  }, [personaId]);

  const handleComposeGoogleDoc = useCallback(async (input: { title: string; bodyText: string; shareSuggestions: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }> }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'google-doc', destination: 'drive', title: input.title, connectorInput: input, sourceIntentId: composerSourceIntentId }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();

    // Intent Chain Orchestrator (commit 7): advance the chain's
    // compose step. The advancer transitions to the next RPC step
    // (typically /api/marketa/propose) which emits proposal_drafted
    // and progresses the chain via the inline listener hook. The
    // brief artifact now exists; the chain submits it on the user's
    // behalf, then surfaces the review step as a queued pill.
    // Best-effort — never blocks the artifact flow.
    if (composerSourceIntentId) {
      const chainId = chainsByIntent[composerSourceIntentId];
      if (chainId) {
        try {
          await personaFetch(`/api/intent-chains/${chainId}/complete-step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              artifact_id: (data as ArtifactCardData & { id?: string }).id,
              title: input.title,
            }),
            personaIdHint: personaId,
          });
        } catch {
          // Chain advance failure surfaces in orchestration_events;
          // the artifact already created so we don't reflect here.
        }
      }
    }
  }, [personaId, fetchReceipts, composerSourceIntentId, chainsByIntent]);

  const handleDraftSlides = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-slides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.error || `draft-slides failed (${res.status})`);
    }
    return (await res.json()) as { title: string; outline: string[]; sections: Array<{ title: string; bullets: string[]; diagramConcept?: string }>; rationale: string; source: 'llm' | 'template' };
  }, [personaId]);

  const handleComposeSlides = useCallback(async (input: { title: string; outline: string[]; sections?: Array<{ title: string; bullets: string[]; diagramConcept?: string }> }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'slide-outline', destination: 'drive', title: input.title, connectorInput: input, sourceIntentId: composerSourceIntentId }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts, composerSourceIntentId]);

  const handleDraftSheet = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-sheet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.error || `draft-sheet failed (${res.status})`);
    }
    return (await res.json()) as { title: string; sheetName: string; rows: string[][]; rationale: string; source: 'llm' | 'template' };
  }, [personaId]);

  const handleComposeGoogleSheet = useCallback(async (input: { title: string; sheetName: string; rows: string[][] }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'google-sheet', destination: 'drive', title: input.title, connectorInput: input, sourceIntentId: composerSourceIntentId }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts, composerSourceIntentId]);

  const handleDraftMarketa = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-marketa-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.error || `draft-marketa-email failed (${res.status})`);
    }
    return (await res.json()) as { to: string; cc: string; bcc: string; subject: string; bodyText: string; rationale: string; source: 'llm' | 'template' };
  }, [personaId]);

  const handleComposeMarketa = useCallback(async (input: { to: string; subject: string; bodyText: string; cc?: string; bcc?: string; fromName?: string; campaignId?: string; cohortId?: string; attachmentUploadIds?: string[] }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'marketa-email', destination: 'runtime', title: input.subject, connectorInput: input, sourceIntentId: composerSourceIntentId }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts, composerSourceIntentId]);

  // ── Artifact externalisation flow ──────────────────────────────────
  const handleDismissArtifact = useCallback((artifactId: string) => {
    setArtifacts((prev) => prev.filter((a) => a.artifactId !== artifactId));
    setActionErrors((prev) => {
      if (!(artifactId in prev)) return prev;
      const next = { ...prev }; delete next[artifactId]; return next;
    });
  }, []);

  const executeArtifactAction = useCallback(async (artifact: ArtifactCardData, approvalToken?: string): Promise<void> => {
    if (!artifact.actionConnectorId) return;
    setActionPendingArtifactId(artifact.artifactId);
    setActionErrors((prev) => {
      if (!(artifact.artifactId in prev)) return prev;
      const next = { ...prev }; delete next[artifact.artifactId]; return next;
    });
    try {
      const res = await personaFetch('/api/connectors/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId: artifact.actionConnectorId,
          input: artifact.actionInput ?? {},
          sourceIntentId: artifact.intentId ?? undefined,
          cartridge: 'metame',
          ...(approvalToken ? { approvalToken } : {}),
        }),
        personaIdHint: personaId,
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403 && body?.code === 'requires-approval') {
        setSecondTierApproval({
          artifactId: artifact.artifactId,
          connectorId: artifact.actionConnectorId,
          connectorLabel: artifact.actionConnectorLabel || 'Confirm external action',
          summary: artifact.title,
          detail: body.reason || undefined,
          submitting: false,
          error: null,
        });
        return;
      }
      if (!res.ok || body?.ok === false) {
        const msg = body?.reason || body?.detail || body?.error || `execute failed (${res.status})`;
        setActionErrors((prev) => ({ ...prev, [artifact.artifactId]: msg }));
        if (secondTierApproval && secondTierApproval.artifactId === artifact.artifactId) {
          setSecondTierApproval({ ...secondTierApproval, submitting: false, error: msg });
        }
        return;
      }
      setArtifacts((prev) => prev.map((a) => a.artifactId === artifact.artifactId ? { ...a, status: 'sent' } : a));
      setSecondTierApproval((prev) => prev && prev.artifactId === artifact.artifactId ? null : prev);
      void fetchReceipts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionErrors((prev) => ({ ...prev, [artifact.artifactId]: msg }));
      if (secondTierApproval && secondTierApproval.artifactId === artifact.artifactId) {
        setSecondTierApproval({ ...secondTierApproval, submitting: false, error: msg });
      }
    } finally {
      setActionPendingArtifactId(null);
    }
  }, [personaId, secondTierApproval, fetchReceipts]);

  const handleSendArtifact = useCallback((artifactId: string) => {
    const artifact = artifacts.find((a) => a.artifactId === artifactId);
    if (!artifact) return;
    void executeArtifactAction(artifact);
  }, [artifacts, executeArtifactAction]);

  const handleApproveSecondTier = useCallback(() => {
    if (!secondTierApproval) return;
    const artifact = artifacts.find((a) => a.artifactId === secondTierApproval.artifactId);
    if (!artifact) return;
    setSecondTierApproval({ ...secondTierApproval, submitting: true, error: null });
    void (async () => {
      try {
        const res = await personaFetch('/api/assistant/approve-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectorId: secondTierApproval.connectorId,
            sourceIntentId: artifact.intentId ?? undefined,
            cartridge: 'metame',
          }),
          personaIdHint: personaId,
        });
        const json = await res.json().catch(() => ({} as { approvalToken?: string; detail?: string; error?: string }));
        if (!res.ok || !json.approvalToken) {
          const msg = json.detail || json.error || `approve-action failed (${res.status})`;
          setSecondTierApproval({ ...secondTierApproval, submitting: false, error: msg });
          return;
        }
        await executeArtifactAction(artifact, json.approvalToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSecondTierApproval({ ...secondTierApproval, submitting: false, error: msg });
      }
    })();
  }, [secondTierApproval, artifacts, executeArtifactAction, personaId]);

  const handleCancelSecondTier = useCallback(() => setSecondTierApproval(null), []);

  const handleDismissSpecialist = useCallback((nbeId: string) => {
    setSpecialistResponses((prev) => { const next = { ...prev }; delete next[nbeId]; return next; });
    setSpecialistErrors((prev) => { const next = { ...prev }; delete next[nbeId]; return next; });
  }, []);

  const handleDismissQueued = useCallback((nbeId: string) => {
    setQueuedIntents((prev) => { const next = { ...prev }; delete next[nbeId]; return next; });
  }, []);

  // Mark complete — flips a queued pill to the green "complete" state
  // without needing a real connector-success signal. In alpha (where
  // Phase 5/6 specialist routing isn't live yet) this gives the
  // operator explicit lifecycle control. When real execution lands the
  // pill will auto-flip on the artifact status check; this manual
  // path stays as a fallback.
  const handleMarkPillComplete = useCallback((nbeId: string) => {
    setQueuedIntents((prev) => {
      const cur = prev[nbeId];
      if (!cur) return prev;
      return { ...prev, [nbeId]: { ...cur, manuallyComplete: true } };
    });
  }, []);

  const handleAskSpecialist = useCallback(async (
    specialistId: string,
    prompt: string,
    handoff?: { fromSpecialistId: string; priorTitle?: string; priorReceiptId?: string },
  ) => {
    const key = specialistId;
    setAskSpecialistLoadingId(key);
    setAskSpecialistErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    try {
      const res = await personaFetch('/api/assistant/ask-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialistId,
          ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
          ...(handoff ? { handoff } : {}),
        }),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `ask-agent failed (${res.status})`);
      }
      const sp = (await res.json()) as SpecialistResponseData;
      setAskSpecialistResponses((prev) => ({ ...prev, [key]: sp }));
      setAskSpecialistPrompt("");
      void fetchReceipts();
    } catch (err) {
      setAskSpecialistErrors((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setAskSpecialistLoadingId(null);
    }
  }, [personaId, fetchReceipts, composerSourceIntentId]);

  // Phase 2 — SpecialistsLayout fetchers + handlers.
  const fetchSpecialistRecommendation = useCallback(async (query?: string) => {
    if (!personaId) return;
    setSpecialistRecommendationLoading(true);
    setSpecialistRecommendationError(null);
    try {
      const res = await personaFetch('/api/assistant/specialist-recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query ? { query } : {}),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `specialist-recommend failed (${res.status})`);
      }
      const payload = (await res.json()) as
        import("@/services/orchestration/specialistRecommender").SpecialistRecommendation
        & { preflightContext?: import("@/services/capabilities/preflight").PreflightContext };
      setSpecialistRecommendation(payload);
      setSpecialistRecommendationPreflight(payload.preflightContext);
      // Auto-select the top specialist so the operator lands on the right
      // consultation card immediately. Only advances if nothing is selected yet.
      setSelectedSpecialistId((prev) => prev ?? payload.topSpecialistId);
      // Auto-ask the specialist with the seed query so the response card
      // populates immediately — with it come the suggested artifact chips
      // (gmail-draft, marketa-email, etc.) the operator actually needs to act.
      // Pre-populate the textarea with the query so the operator sees what
      // was asked on their behalf rather than landing on an empty input.
      // Only fires on the initial chip-click invocation when a query is present
      // and no response exists yet for this specialist.
      if (query && payload.topSpecialistId && !askSpecialistResponses[payload.topSpecialistId]) {
        setAskSpecialistPrompt(query);
        void handleAskSpecialist(payload.topSpecialistId, query);
      }
    } catch (err) {
      setSpecialistRecommendationError(err instanceof Error ? err.message : String(err));
    } finally {
      setSpecialistRecommendationLoading(false);
    }
  }, [personaId, handleAskSpecialist, askSpecialistResponses]);

  const fetchSpecialistThread = useCallback(async (
    specialistId: import("@/services/agents/specialistRouter").SpecialistId,
  ) => {
    if (!personaId) return;
    setSpecialistThreadLoading(true);
    try {
      const res = await personaFetch(
        `/api/assistant/specialist-thread?specialistId=${specialistId}&limit=20`,
        { personaIdHint: personaId },
      );
      if (!res.ok) {
        setSpecialistThread([]);
        return;
      }
      const payload = (await res.json()) as {
        entries: NonNullable<import("@/components/metame/welcome/layouts/types").RightPaneLayoutProps["specialistsLayout"]>["thread"];
      };
      setSpecialistThread(payload.entries ?? []);
    } catch {
      setSpecialistThread([]);
    } finally {
      setSpecialistThreadLoading(false);
    }
  }, [personaId]);

  const handleSelectSpecialist = useCallback((
    id: import("@/services/agents/specialistRouter").SpecialistId,
  ) => {
    setSelectedSpecialistId(id);
    setAskSpecialistPrompt("");
    void fetchSpecialistThread(id);
  }, [fetchSpecialistThread]);

  const handleAskSelectedSpecialist = useCallback((prompt: string) => {
    if (!selectedSpecialistId) return;
    void handleAskSpecialist(selectedSpecialistId, prompt);
  }, [selectedSpecialistId, handleAskSpecialist]);

  const handleHandoffSpecialist = useCallback((
    target: import("@/services/agents/specialistRouter").SpecialistId,
  ) => {
    if (!selectedSpecialistId || selectedSpecialistId === target) return;
    const prior = askSpecialistResponses[selectedSpecialistId];
    // Inherit the previous prompt verbatim; the route prefixes it
    // with a hand-off note so the receiving specialist sees framing.
    const carriedPrompt = askSpecialistPrompt.trim() || prior?.title || 'continue this consultation';
    setSelectedSpecialistId(target);
    void fetchSpecialistThread(target);
    void handleAskSpecialist(target, carriedPrompt, {
      fromSpecialistId: selectedSpecialistId,
      priorTitle: prior?.title,
    });
  }, [selectedSpecialistId, askSpecialistResponses, askSpecialistPrompt, fetchSpecialistThread, handleAskSpecialist]);

  const handleOpenActivationsForSpecialist = useCallback((_activationId: string) => {
    // Deep-link the operator to the cartridge's Activations top-nav
    // tab via the canonical CartridgePresenceRegistry. The mounted
    // cartridge's setTab callback (registered by CodexPanelDynamic
    // through useCartridgePresence) switches the surface directly,
    // no URL navigation required.
    const active = getActiveCartridge();
    if (active) {
      const switched = tryOpenInMountedCartridge({
        cartridgeId: active.cartridgeId,
        tab: 'activations',
      });
      if (switched) return;
    }
    // Fallback: if the registry has no active cartridge (mount race or
    // standalone embed), surface the Experience accordion in the
    // stack layout so the operator still lands on something coherent.
    setActiveLayoutId('stack');
    setExpandedSectionId('experience');
  }, []);

  // Phase 2 Slice 4: which compose form ComposerLayout should render
  // inline. Null when the layout is preview-only.
  //
  // Persisted to sessionStorage so the composer survives sub-tab
  // navigation (TabRenderer fully unmounts AigentMeWelcomeSplitTab when
  // the operator switches to Strategy / NBE / Analysis / etc., the way
  // it does for any codex sub-tab). Same pattern as `artifacts` above.
  // On remount, the modal re-mounts via composerKind + auto-redrafts
  // from composerInitialPrompt; the operator's typed field edits are
  // still lost (modal local state) — that lift is a follow-up.
  const [composerKind, setComposerKind] = useState<ComposeKind | null>(() => {
    if (typeof window === 'undefined' || !personaId) return null;
    try {
      const raw = window.sessionStorage.getItem(`aigentme:split:composerKind:${personaId}`);
      return raw ? (JSON.parse(raw) as ComposeKind | null) : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !personaId) return;
    try {
      if (composerKind === null) {
        window.sessionStorage.removeItem(`aigentme:split:composerKind:${personaId}`);
      } else {
        window.sessionStorage.setItem(
          `aigentme:split:composerKind:${personaId}`,
          JSON.stringify(composerKind),
        );
      }
    } catch { /* quota — silently degrade */ }
  }, [composerKind, personaId]);
  // Optional pre-baked aigentMe draft prompt — when set, the inline
  // compose form pre-fills its AI prompt textarea AND auto-fires the
  // draft on mount so the operator lands on a populated form. Used by
  // the SpecialistsLayout suggested-artifact buttons.
  const [composerInitialPrompt, setComposerInitialPrompt] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !personaId) return null;
    try {
      const raw = window.sessionStorage.getItem(`aigentme:split:composerInitialPrompt:${personaId}`);
      return raw ? (JSON.parse(raw) as string | null) : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !personaId) return;
    try {
      if (composerInitialPrompt === null) {
        window.sessionStorage.removeItem(`aigentme:split:composerInitialPrompt:${personaId}`);
      } else {
        window.sessionStorage.setItem(
          `aigentme:split:composerInitialPrompt:${personaId}`,
          JSON.stringify(composerInitialPrompt),
        );
      }
    } catch { /* quota — silently degrade */ }
  }, [composerInitialPrompt, personaId]);

  // Clear the composer's parent-intent binding whenever the composer
  // is dismissed (composerKind flips to null on backdrop click,
  // onCreate success, overlay X). Without this, a subsequent
  // compose-strip draft could inherit the prior Pill's intent id and
  // appear nested in a stale Pill.
  useEffect(() => {
    if (composerKind === null) setComposerSourceIntentId(null);
  }, [composerKind]);

  // Phase 2 B.1: selected KPI for KpiDetailLayout. The cockpit chip's
  // onClick sets this + activates 'kpi-detail'.
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null);

  // Phase 2 B.2 (2/2): selected intent for ActiveWorkDetailLayout.
  // ActivityChip onClick sets this + activates 'active-work-detail'.
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);

  // Phase 2 B.1 polish: KPI editor mounted on the aigentMe tab so it
  // can be opened directly from the cockpit's "Edit KPIs" affordance,
  // not just from the Strategy tab. Same component, same persistence.
  const [kpisEditorOpen, setKpisEditorOpen] = useState(false);

  // ── AG-UI bridge: copilot → right pane ─────────────────────────────
  // Compose footer / copilot bridge routes ALL compose intents
  // through the composer overlay. The compose form hosts inline in
  // the overlay; submit creates the artifact + clears composerKind so
  // the overlay unmounts and the active Capsule remains visible
  // underneath (Brief / Move forward / Venture).
  const openComposeByKind = useCallback((kind: ComposeKind, promptHint?: string | null) => {
    // Chat-suggested composer chips carry a promptHint derived from the
    // operator's last message; when present we pre-fill the inline form
    // (composerInitialPrompt) so the LLM-draft fires immediately on
    // mount. Manual chip clicks pass no hint → empty form.
    setComposerInitialPrompt(promptHint && promptHint.trim().length > 0 ? promptHint.trim() : null);
    setComposerKind(kind);
    // No more setActiveLayoutId('composer') — the overlay handles
    // rendering on top of whatever foreground layout is active. The
    // previous double-call mounted the composer twice (once via the
    // foreground swap, once via the overlay), leaving an unresponsive
    // second modal stuck behind the first when the operator closed it.
  }, []);

  // SpecialistsLayout suggested-artifact button → open ComposerLayout
  // with a pre-baked aigentMe draft prompt so the inline form
  // auto-populates. No-op when the artifact label doesn't map to any
  // compose surface (e.g. "Strategy memo PDF" — we leave the chip
  // non-clickable and the operator can ask the specialist to refine).
  // Class-wide artifact dispatcher — the single SoT every surface
  // calls when the operator wants to progress an artifact. Specialist
  // chips, NBE Act buttons, future "create a doc / report / deck"
  // chips all funnel through here so a partner-brief always lands in
  // myWorkbench, a deck always in the slides composer, an image
  // always at the metaMe Studio, etc.
  const dispatchArtifact = useCallback((payload: ArtifactDispatchPayload) => {
    const cls = classifySuggestedArtifact(payload.artifactType);

    const encodedPayload = encodeURIComponent(
      JSON.stringify({
        source: payload.source,
        specialistId: payload.specialistId,
        title: payload.title,
        summary: payload.summary,
        recommendations: payload.recommendations,
      }),
    );

    // Build a doc-ready prompt for composer surfaces from whatever
    // context the caller supplied. Matches the shape
    // buildPromptForSuggestedArtifact used to build, but adapted to
    // run off a plain payload instead of a SpecialistResponseData.
    const buildPromptFromPayload = (): string => {
      const lines: string[] = [];
      lines.push(`# ${payload.title}`);
      if (payload.summary) lines.push('', payload.summary);
      if (payload.recommendations && payload.recommendations.length > 0) {
        lines.push('', '## Recommendations');
        for (const r of payload.recommendations) lines.push(`- ${r}`);
      }
      lines.push('', `## Artifact requested`, `- ${payload.artifactType}`);
      if (payload.source === 'specialist' && payload.specialistId) {
        lines.push('', `_via ${payload.specialistId}_`);
      }
      return lines.join('\n');
    };

    switch (cls.kind) {
      case 'mycanvas-remix':
        // Public publishing path — KNYT Pulse / Qriptopian Pulse.
        try {
          const url = `/codex/viewer?slug=metame&tab=mycanvas&remix=${encodedPayload}`;
          if (typeof window !== 'undefined') window.location.assign(url);
        } catch { /* best-effort */ }
        return;

      case 'myworkbench-draft':
      case 'partner-brief':
        // PRIVATE working surface — partner briefs, internal reports,
        // decks pre-share. Per operator: 'myWorkbench is for private
        // confidential work — emails, partner-briefs, reports, decks'.
        try {
          const url = `/codex/viewer?slug=metame&tab=my-workbench&draft=${encodedPayload}`;
          if (typeof window !== 'undefined') window.location.assign(url);
        } catch { /* best-effort */ }
        return;

      case 'marketa-campaign':
        setComposerInitialPrompt(buildPromptFromPayload());
        setComposerKind('marketa');
        // Composer overlay handles rendering on top of the active
        // Capsule — no foreground layout swap (the swap was causing
        // the brief / venture to vanish on Act and then re-appear
        // wrongly when the overlay closed).
        return;

      case 'studio':
        try {
          const promptText = buildPromptFromPayload();
          const skillParam =
            cls.skill === 'image' ? 'image' :
            cls.skill === 'video' ? 'video' :
            'post-set';
          const url = `/codex/viewer?slug=metame&tab=studio&skill=${encodeURIComponent(skillParam)}&prompt=${encodeURIComponent(promptText)}`;
          if (typeof window !== 'undefined') window.location.assign(url);
        } catch { /* best-effort */ }
        return;

      case 'composer':
        setComposerInitialPrompt(buildPromptFromPayload());
        setComposerKind(cls.composeKind);
        // Composer overlay handles rendering on top of the active
        // Capsule — no foreground layout swap.
        return;

      case 'unknown':
      default:
        // Silent no-op for novel labels from the LLM. The chip stays
        // visible but the click is benign.
        return;
    }
  }, [setComposerInitialPrompt, setComposerKind, setActiveLayoutId]);

  // Specialist-chip entry point. 2026-05-26 regression-restore: for
  // COMPOSER destinations we use the alpha buildPromptForSuggestedArtifact()
  // path that worked end-to-end before Phase F.1 — directive prompts
  // produce richer doc drafts than the synthetic markdown the unified
  // dispatcher emits. For non-composer destinations (canvas /
  // workbench / studio / marketa-campaign) we still funnel through
  // dispatchArtifact since those are new paths.
  const handleUseSuggestedArtifact = useCallback((
    artifactType: string,
    response: import('@/components/metame/cards/SpecialistResponseCard').SpecialistResponseData,
  ) => {
    const cls = classifySuggestedArtifact(artifactType);
    if (cls.kind === 'composer') {
      const prompt = buildPromptForSuggestedArtifact(artifactType, response);
      setComposerInitialPrompt(prompt);
      setComposerKind(cls.composeKind);
      // Composer overlay handles rendering on top of the active Capsule.
      return;
    }
    // Non-composer destinations route through the unified dispatcher.
    dispatchArtifact({
      artifactType,
      title: response.title,
      summary: response.summary,
      recommendations: response.recommendations,
      source: 'specialist',
      specialistId: response.specialistId,
    });
  }, [dispatchArtifact]);

  const focusCard = useCallback((kind: CardKind) => {
    const refMap: Record<CardKind, React.RefObject<HTMLDivElement>> = {
      brief: briefRef, nbe: nbeRef, approval: approvalRef, artifact: artifactRef,
    };
    refMap[kind].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const usingIqubes = useMemo<('PersonaQube' | 'ExperienceQube' | 'IntentQube')[]>(() =>
    expModel?.configured ? ['PersonaQube', 'ExperienceQube'] : ['PersonaQube'],
  [expModel?.configured]);

  const latestArtifact = artifacts[0] ?? null;
  const activeCartridges = (data?.availableCartridges ?? []).map((c) => c.slug);

  /**
   * Phase F.2 — CONTEXTUAL Request alpha access recommendation.
   *
   * Scans the brief.nextBestActions + moveForwardResult.alternates
   * for any NBA whose target cartridge ISN'T in the persona's active
   * set. Returns the first such cartridge (slug + display label) so
   * the RequestAccessChip in the right-pane carousel can surface it
   * with the appropriate framing.
   *
   * Returns null when:
   *   - no NBAs are loaded yet
   *   - every NBA's cartridge IS in the active set
   *   - the persona is a global admin (covered by chip's render gate)
   *
   * Normalises cartridge slugs the same way RequestAccessChip used
   * to (knyt -> knyt-codex, qriptopian -> qripto) so the compare
   * doesn't false-fire on slug-form mismatches.
   */
  const recommendedAccessCartridge = useMemo<
    { slug: string; label: string } | null
  >(() => {
    const normaliseToCartridge = (s: string): string => {
      if (s === 'knyt') return 'knyt-codex';
      if (s === 'qriptopian') return 'qripto';
      return s;
    };
    const labelFor = (slug: string): string => {
      switch (slug) {
        case 'knyt-codex':  return 'KNYT';
        case 'qripto':      return 'The Qriptopian';
        case 'marketa':     return 'Marketa';
        case 'venture-lab': return 'metaMe Venture Lab';
        case 'agentiq-os':  return 'AgentiQ OS';
        case 'metame':      return 'metaMe';
        default:            return slug;
      }
    };
    const activeSet = new Set(activeCartridges.map(normaliseToCartridge));
    // Don't suggest a cartridge the persona is ALREADY on. Pull
    // candidates from both surfaces; brief first, moveForward
    // alternates second.
    const candidates: string[] = [];
    for (const nba of brief?.nextBestActions ?? []) {
      if (typeof nba.cartridge === 'string') candidates.push(normaliseToCartridge(nba.cartridge));
    }
    if (moveForwardResult?.topAction?.cartridge) {
      candidates.push(normaliseToCartridge(moveForwardResult.topAction.cartridge));
    }
    for (const alt of moveForwardResult?.alternates ?? []) {
      if (typeof alt.cartridge === 'string') candidates.push(normaliseToCartridge(alt.cartridge));
    }
    // metaMe and the always-on platform cartridges aren't gated;
    // never recommend requesting access to them.
    const skip = new Set(['metame', 'agentiq-os']);
    for (const slug of candidates) {
      if (skip.has(slug)) continue;
      if (!activeSet.has(slug)) {
        return { slug, label: labelFor(slug) };
      }
    }
    return null;
  }, [brief, moveForwardResult, activeCartridges]);

  // Phase 2 B.1 3/3 — load the persona's active activation ids so the
  // copilot bridge can expose the available KPI sources filtered to
  // what's currently switched on.
  const [activeActivationIds, setActiveActivationIds] = useState<string[]>([]);
  useEffect(() => {
    if (!personaId) return;
    let cancelled = false;
    void personaFetch('/api/assistant/activations', { personaIdHint: personaId })
      .then((r) => r.json())
      .then((d: { activations?: Array<{ id: string; status: string }> }) => {
        if (cancelled) return;
        const ids = (d.activations ?? [])
          .filter((a) => a.status === 'active')
          .map((a) => a.id);
        setActiveActivationIds(ids);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [personaId]);

  // Phase 2 B.3 — live cockpit sync.
  //
  // Background polls `fetchVentureProgress({ silent: true })` on a 20s
  // cadence while the operator is on a cockpit-related layout AND the
  // tab is visible. Pauses immediately on `document.hidden`; resumes
  // on the next visibility-change event. Silent mode means the
  // skeleton never flashes — the cockpit updates in place.
  //
  // Mutation paths (KPI edit, intent action, NBE approval) already
  // call `fetchVentureProgress()` synchronously after their writes;
  // this polling layer covers everything else (cartridge-side events
  // that wrote a receipt without going through the cockpit). Phase 3
  // replaces polling with a Supabase realtime subscription on
  // `dvn_receipt_events` filtered to the persona.
  useEffect(() => {
    if (!personaId) return;
    const isCockpitLayout =
      activeLayoutId === 'venture-cockpit' ||
      activeLayoutId === 'kpi-detail' ||
      activeLayoutId === 'active-work-detail';
    if (!isCockpitLayout) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchVentureProgress({ silent: true });
    }, 20_000);

    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        void fetchVentureProgress({ silent: true });
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      window.clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [personaId, activeLayoutId, fetchVentureProgress]);

  // Phase 2 B.1 3/3 — KPI mutation handlers passed to the copilot
  // bridge. Reuse the same /api/assistant/experience-model path the
  // editor uses; refresh venture-progress after each save so the
  // cockpit picks up the change.
  const handleAddKpi = useCallback(
    async (input: { name: string; target: string; source: KpiSource; unit?: string }): Promise<{ ok: true; id: string } | { ok: false; reason: string }> => {
      if (!personaId) return { ok: false, reason: 'No active persona' };
      try {
        const modelRes = await personaFetch('/api/assistant/experience-model', { personaIdHint: personaId });
        const model = await modelRes.json();
        const current = coerceKpisToRichShape(model?.activeKpis);
        const id = `kpi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        // Pull metric label from catalog when activation-bound.
        let unit = input.unit;
        let metricClass: 'activity' | 'outcome' | 'standing' = 'activity';
        if (input.source.kind === 'activation' && input.source.activationId && input.source.metric) {
          const entry = ACTIVATION_CATALOG.find((e) => e.id === input.source.activationId);
          const metric = entry?.metrics?.find((m) => m.metric === input.source.metric);
          if (metric) {
            unit = unit ?? metric.defaultUnit;
            metricClass = metric.class ?? 'activity';
          }
        }
        const record: KpiRecord = {
          id,
          name: input.name,
          target: input.target,
          current: null,
          unit,
          trend: 'unknown',
          lastUpdatedAt: null,
          source: input.source,
          class: metricClass,
        };
        const next = { ...current, [id]: record };
        const saveRes = await personaFetch('/api/assistant/experience-model', {
          personaIdHint: personaId,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blak: { activeKpis: next } }),
        });
        if (!saveRes.ok) {
          const body = await saveRes.json().catch(() => ({}));
          return { ok: false, reason: body?.detail || body?.error || `save failed (${saveRes.status})` };
        }
        void fetchVentureProgress();
        return { ok: true, id };
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : String(err) };
      }
    },
    [personaId, fetchVentureProgress],
  );

  const handleSetKpiValue = useCallback(
    async (input: { kpiId: string; current: number }): Promise<{ ok: true } | { ok: false; reason: string }> => {
      if (!personaId) return { ok: false, reason: 'No active persona' };
      try {
        const modelRes = await personaFetch('/api/assistant/experience-model', { personaIdHint: personaId });
        const model = await modelRes.json();
        const current = coerceKpisToRichShape(model?.activeKpis);
        const existing = current[input.kpiId];
        if (!existing) return { ok: false, reason: `KPI '${input.kpiId}' not found.` };
        if (existing.source.kind !== 'manual') {
          return { ok: false, reason: `KPI '${existing.name}' has a non-manual source; values resolve automatically.` };
        }
        const next = {
          ...current,
          [input.kpiId]: {
            ...existing,
            current: input.current,
            lastUpdatedAt: new Date().toISOString(),
          },
        };
        const saveRes = await personaFetch('/api/assistant/experience-model', {
          personaIdHint: personaId,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blak: { activeKpis: next } }),
        });
        if (!saveRes.ok) {
          const body = await saveRes.json().catch(() => ({}));
          return { ok: false, reason: body?.detail || body?.error || `save failed (${saveRes.status})` };
        }
        void fetchVentureProgress();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : String(err) };
      }
    },
    [personaId, fetchVentureProgress],
  );

  const handleRemoveKpi = useCallback(
    async (kpiId: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      if (!personaId) return { ok: false, reason: 'No active persona' };
      try {
        const modelRes = await personaFetch('/api/assistant/experience-model', { personaIdHint: personaId });
        const model = await modelRes.json();
        const current = coerceKpisToRichShape(model?.activeKpis);
        if (!current[kpiId]) return { ok: false, reason: `KPI '${kpiId}' not found.` };
        const next = { ...current };
        delete next[kpiId];
        const saveRes = await personaFetch('/api/assistant/experience-model', {
          personaIdHint: personaId,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blak: { activeKpis: next } }),
        });
        if (!saveRes.ok) {
          const body = await saveRes.json().catch(() => ({}));
          return { ok: false, reason: body?.detail || body?.error || `save failed (${saveRes.status})` };
        }
        void fetchVentureProgress();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : String(err) };
      }
    },
    [personaId, fetchVentureProgress],
  );

  const handleOpenKpiDetail = useCallback((kpiId: string) => {
    setSelectedKpiId(kpiId);
    setActiveLayoutId('kpi-detail');
  }, []);

  // Phase 2 B.2 (2/2) — ActiveWork chip click handler.
  const handleSelectActiveWork = useCallback((intentId: string) => {
    setSelectedIntentId(intentId);
    setActiveLayoutId('active-work-detail');
  }, []);

  // T1-safe KPI snapshot for the copilot readable.
  const copilotActiveKpis = useMemo(() => {
    const rows = ventureProgress?.activeKpis ?? [];
    return rows.map((kpi) => {
      const entry = kpi.source.kind === 'activation' && kpi.source.activationId
        ? ACTIVATION_CATALOG.find((e) => e.id === kpi.source.activationId)
        : null;
      const sourceLabel =
        kpi.source.kind === 'manual'
          ? 'Manual'
          : entry
            ? `${entry.label} → ${kpi.source.metric ?? '—'}`
            : 'Unknown';
      return {
        id: kpi.id,
        name: kpi.name,
        target: kpi.target,
        current: kpi.current,
        unit: kpi.unit,
        trend: kpi.trend,
        class: kpi.class,
        sourceKind: kpi.source.kind,
        sourceLabel,
        unresolvedReason: kpi.unresolvedReason ?? null,
      };
    });
  }, [ventureProgress?.activeKpis]);

  // Available KPI sources — union of metrics across the persona's
  // ACTIVE activations. Inactive activations are omitted so the
  // copilot only sees options that will resolve.
  const copilotAvailableKpiSources = useMemo(() => {
    const set = new Set(activeActivationIds);
    const out: Array<{
      activationId: string;
      activationLabel: string;
      metric: string;
      metricLabel: string;
      metricClass: 'activity' | 'outcome' | 'standing';
      defaultUnit?: string;
    }> = [];
    for (const entry of ACTIVATION_CATALOG) {
      if (!set.has(entry.id)) continue;
      for (const m of entry.metrics ?? []) {
        out.push({
          activationId: entry.id,
          activationLabel: entry.label,
          metric: m.metric,
          metricLabel: m.label,
          metricClass: m.class ?? 'activity',
          defaultUnit: m.defaultUnit,
        });
      }
    }
    return out;
  }, [activeActivationIds]);

  // 2026-05-26 chief-of-staff: feed admin grant scope into the
  // copilot's readable bundle so the LLM biases recommendations
  // toward admin-tier moves when the persona qualifies. Hook resolves
  // server-side via the spine — never trusts a client claim.
  const adminGrants = useCartridgeAdminGrants();

  useAigentMeCopilotBridge({
    openCompose: openComposeByKind,
    fireCta: handleCtaClick,
    // Phase 2 Slice 6: expanding the receipts section requests the
    // LedgerLayout. Other section expansions still toggle the
    // accordion in StackLayout (they're config sub-sections, not
    // intent layouts).
    expandSection: (id) => {
      if (id === 'receipts') {
        setActiveLayoutId('ledger');
        return;
      }
      setExpandedSectionId(id);
    },
    focusCard,
    addKpi: handleAddKpi,
    setKpiValue: handleSetKpiValue,
    removeKpi: handleRemoveKpi,
    openKpiDetail: handleOpenKpiDetail,
    readable: {
      activeBrief: {
        hasBrief: !!brief,
        briefType: brief?.briefType ?? null,
        primaryGoal: brief?.context?.primaryGoal ?? null,
        experienceName: brief?.context?.experienceName ?? null,
        currentStage: brief?.context?.currentStage ?? null,
        topPriorities: brief?.topPriorities ?? [],
        nextBestActions: (brief?.nextBestActions ?? []).map((a) => ({
          id: a.id,
          label: a.label,
          rationale: a.rationale,
          cartridge: a.cartridge,
          effort: a.effort,
          impact: a.impact,
          approvalRequired: a.approvalRequired,
          suggestedArtifact: a.suggestedArtifact ?? null,
        })),
      },
      pendingApproval: { has: !!pendingApprovalNbe, cartridge: pendingApprovalNbe?.cartridge ?? null },
      experienceModelStatus: {
        configured: !!expModel?.configured,
        stage: (expModel?.meta?.currentStage as string | null) ?? null,
        primaryGoal: (expModel?.meta?.primaryGoal as string | null) ?? null,
      },
      activeCartridges,
      cartridgeAdminGrants: {
        isGlobalAdmin: adminGrants.isGlobalAdmin,
        adminCartridges: Array.from(adminGrants.cartridgeSlugs),
      },
      latestArtifact: {
        kind: latestArtifact?.artifactType ?? null,
        title: latestArtifact?.title ?? null,
        status: latestArtifact?.status ?? null,
      },
      nextBestActionsCount: (moveForwardResult?.alternates.length ?? 0) + (moveForwardResult?.topAction ? 1 : 0),
      expandedSectionId,
      receiptsCount: receipts.length,
      activeKpis: copilotActiveKpis,
      availableKpiSources: copilotAvailableKpiSources,
    },
  });

  // T1-safe snapshot of what the right pane is currently showing —
  // forwarded into the copilot via `groundContext` and threaded into
  // the /api/codex/chat POST body so the chat LLM grounds its
  // narrative in the same rows the right pane is rendering. Replaces
  // the prior behaviour where the chat had no idea what brief / NBAs
  // were on screen and would invent generic `[Priority 1]` /
  // `[Action 1]` placeholders. Null fields are omitted by the route.
  const copilotGroundContext = useMemo(() => {
    const brief_ = brief
      ? {
          briefType: brief.briefType,
          primaryGoal: brief.context?.primaryGoal ?? null,
          experienceName: brief.context?.experienceName ?? null,
          currentStage: brief.context?.currentStage ?? null,
          activeCartridges: brief.context?.activeCartridges ?? [],
          topPriorities: brief.topPriorities ?? [],
          nextBestActions: (brief.nextBestActions ?? []).map((a) => ({
            id: a.id,
            label: a.label,
            contextualTitle: brief.nbaContextualTitles?.[a.id] ?? null,
            rationale: a.rationale,
            cartridge: a.cartridge,
            effort: a.effort,
            impact: a.impact,
            approvalRequired: a.approvalRequired,
            suggestedArtifact: a.suggestedArtifact ?? null,
            promptHint: brief.nbaPromptHints?.[a.id] ?? null,
          })),
        }
      : null;
    const moveForward_ = moveForwardResult
      ? {
          cartridge: moveForwardResult.cartridge,
          topActionReason: moveForwardResult.topActionReason ?? null,
          topAction: moveForwardResult.topAction
            ? {
                id: moveForwardResult.topAction.id,
                label: moveForwardResult.topAction.label,
                contextualTitle:
                  moveForwardResult.nbaContextualTitles?.[moveForwardResult.topAction.id] ?? null,
                rationale: moveForwardResult.topAction.rationale,
                cartridge: moveForwardResult.topAction.cartridge,
                impact: moveForwardResult.topAction.impact,
                suggestedArtifact: moveForwardResult.topAction.suggestedArtifact ?? null,
                promptHint:
                  moveForwardResult.nbaPromptHints?.[moveForwardResult.topAction.id] ?? null,
              }
            : null,
          alternates: (moveForwardResult.alternates ?? []).map((a) => ({
            id: a.id,
            label: a.label,
            contextualTitle: moveForwardResult.nbaContextualTitles?.[a.id] ?? null,
            rationale: a.rationale,
            cartridge: a.cartridge,
            impact: a.impact,
            promptHint: moveForwardResult.nbaPromptHints?.[a.id] ?? null,
          })),
        }
      : null;
    return {
      brief: brief_,
      moveForward: moveForward_,
      experienceModel: {
        configured: !!expModel?.configured,
        stage: (expModel?.meta?.currentStage as string | null) ?? null,
        primaryGoal: (expModel?.meta?.primaryGoal as string | null) ?? null,
      },
      activeCartridges,
      pendingApproval: pendingApprovalNbe
        ? { id: pendingApprovalNbe.id, label: pendingApprovalNbe.label, cartridge: pendingApprovalNbe.cartridge }
        : null,
      queuedIntentIds: Object.keys(queuedIntents ?? {}),
    };
  }, [brief, moveForwardResult, expModel, activeCartridges, pendingApprovalNbe, queuedIntents]);

  // ── Render ──────────────────────────────────────────────────────────
  // Static seed prompts for the copilot (the right pane's CTAs are
  // still the canonical entry point; these just teach the copilot what
  // it can do on this surface).
  // Phase 2 Slice 7 — dual-dispatch chip strip.
  //
  // Each chip carries TWO surfaces of intent:
  //   1) the copilot — `prompt` is submitted as a user turn so the
  //      narrative continues in chat (existing behavior).
  //   2) the right pane — `onSelect` switches the active layout AND
  //      fires the matching data fetch so the workbench is ready by
  //      the time the copilot's response lands.
  //
  // Cold-open static set below. When the server returns a
  // `quickChips: NbeQuickChip[]` envelope on a `/api/assistant/*`
  // response, the strip swaps to that set (via setServerChips). The
  // mapper below converts an NbeQuickChip's `layoutDispatch` into the
  // local onSelect closure so the right-pane dispatch stays generic
  // on the server side.
  // 2026-05-26 sequencing fix — chips now expose two callbacks:
  //   - onSelect runs synchronously on click. It only switches the
  //     right-pane layout to its loading skeleton.
  //   - onDispatchOnSend runs async inside handleSend, BEFORE the chat
  //     POST. It performs the actual right-pane fetch. By the time the
  //     LLM call goes out, brief / moveForward / venture state has
  //     landed in the parent and the groundContext snapshot is fresh.
  // Effect: clicking "Brief me" no longer races the chat ahead of the
  // brief — the prompt loads into the input, the right pane shows a
  // skeleton, the user can edit, and Send fires both panes in sync.
  // Derived context query for specialist recommendation — used as the implicit
  // query when the operator clicks a specialist chip without having typed
  // anything yet. Derived from the most specific available piece of context
  // so the right pane lands on the right specialist rather than a generic pick.
  const implicitSpecialistQuery = useMemo(() => {
    const name = brief?.context?.experienceName;
    if (name && name.length <= 80) return name;
    const goal = brief?.context?.primaryGoal ?? (expModel?.meta?.primaryGoal as string | undefined);
    if (goal && typeof goal === 'string' && goal.length <= 100) return goal;
    return activeCartridges[0] ?? null;
  }, [brief, expModel, activeCartridges]);

  // When the Ask Specialists capsule becomes active and no specialist
  // response has loaded yet, seed the right pane with a recommendation
  // fetch. This used to live inside handleCtaClick but referencing
  // fetchSpecialistRecommendation there caused a TDZ error (it's a const
  // declared further down the component). Effect-based seeding keeps
  // the declaration order legal and still fires on chip click.
  // Per-activation seed gate. Without this, dismissing a capsule's data
  // (e.g. closing the Move forward NBAs via onDismissMoveForward, which
  // nulls moveForwardResult) re-triggers the auto-seed effects below
  // because their guards rely on `<result> === null` to decide whether
  // to fetch. Result: the dismissed CTAs re-appear instantly — a loop
  // the operator can't escape without leaving the capsule entirely.
  //
  // The ref tracks the capsuleId we last seeded for. When activeCapsuleId
  // changes (capsule swap or close), the ref clears so the next activation
  // gets one fresh seed. Within a single activation, the effect runs at
  // most once even if the data state oscillates.
  const seededCapsuleRef = useRef<string | null>(null);
  useEffect(() => {
    if (seededCapsuleRef.current !== null && seededCapsuleRef.current !== activeCapsuleId) {
      seededCapsuleRef.current = null;
    }
  }, [activeCapsuleId]);

  useEffect(() => {
    if (activeCapsuleId !== 'ask-specialists') return;
    if (seededCapsuleRef.current === 'ask-specialists') return;
    if (specialistRecommendation) return;
    if (specialistRecommendationLoading) return;
    seededCapsuleRef.current = 'ask-specialists';
    void fetchSpecialistRecommendation(implicitSpecialistQuery ?? undefined);
  }, [activeCapsuleId, specialistRecommendation, specialistRecommendationLoading, fetchSpecialistRecommendation, implicitSpecialistQuery]);

  // Same capsule-mount seed for Move forward and Venture progress so
  // restoring those Capsules from history (or arriving via a quick
  // prompt) repopulates the right pane the same way the left-pane
  // chip click does. Without these, navigating back to a previously
  // engaged Capsule shows whatever stale state happened to be in
  // memory — or nothing at all on a fresh mount.
  useEffect(() => {
    if (activeCapsuleId !== 'move-forward') return;
    if (seededCapsuleRef.current === 'move-forward') return;
    if (moveForwardResult) return;
    if (moveForwardLoading) return;
    seededCapsuleRef.current = 'move-forward';
    void fetchMoveForward();
  }, [activeCapsuleId, moveForwardResult, moveForwardLoading, fetchMoveForward]);

  useEffect(() => {
    if (activeCapsuleId !== 'venture-progress') return;
    if (seededCapsuleRef.current === 'venture-progress') return;
    if (ventureProgress) return;
    if (ventureProgressLoading) return;
    seededCapsuleRef.current = 'venture-progress';
    void fetchVentureProgress();
  }, [activeCapsuleId, ventureProgress, ventureProgressLoading, fetchVentureProgress]);

  const copilotQuickPrompts = useMemo(() => {
    const layoutDispatchFor = (chip: NbeQuickChip) => () => {
      if (!chip.layoutDispatch) return;
      const { activate } = chip.layoutDispatch;
      setActiveLayoutId(activate);
      if (chip.layoutDispatch.composerKind) {
        // Chip-driven composer opens land on an empty form — only the
        // suggested-artifact path sets composerInitialPrompt.
        setComposerInitialPrompt(null);
        setComposerKind(chip.layoutDispatch.composerKind);
      }
    };
    const fetchDispatchFor = (chip: NbeQuickChip) => async () => {
      if (!chip.layoutDispatch) return;
      const { fetch: fetchKind } = chip.layoutDispatch;
      switch (fetchKind) {
        case 'brief':            await fetchBrief(); break;
        case 'move-forward':     await fetchMoveForward(); break;
        case 'venture-progress': await fetchVentureProgress(); break;
        case 'receipts':         await fetchReceipts(); break;
        case null: case undefined: /* no fetch */ break;
      }
    };

    if (serverChips && serverChips.length > 0) {
      return serverChips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        prompt: chip.copilotPrompt ?? "",
        skipInference: !chip.copilotPrompt,
        onSelect: layoutDispatchFor(chip),
        // fetchDispatchFor ignores editedPrompt for server chips (the
        // fetch kind drives what to load, not the input text).
        onDispatchOnSend: (_editedPrompt: string) => fetchDispatchFor(chip)(),
      }));
    }

    // 2026-05-26 follow-up: the Request alpha access chip moved out
    // of the left chip strip and into the right-pane badge carousel
    // (WelcomeRightPane.RequestAccessChip). The left strip is for
    // generative quick prompts; manual / admin affordances belong on
    // the right. The controlled modal mount in this tab is no longer
    // driven from here, but stays mounted at the tab root so the
    // legacy uncontrolled trigger (if any future surface uses it)
    // still works.

    return [
      {
        id: 'brief',
        label: 'Brief me',
        prompt: 'Give me my daily brief.',
        highlight: 'brief' in suggestedLayoutHints,
        onSelect: () => {
          engageCapsuleAndMount('brief');
          consumeSuggestion('brief');
        },
        onDispatchOnSend: async (_editedPrompt: string) => { await fetchBrief(); },
      },
      {
        id: 'move',
        label: 'Move forward',
        prompt: 'What is the next best action I should take right now?',
        highlight: 'decision-board' in suggestedLayoutHints,
        onSelect: () => {
          engageCapsuleAndMount('move-forward');
          consumeSuggestion('decision-board');
        },
        onDispatchOnSend: async (_editedPrompt: string) => { await fetchMoveForward(); },
      },
      {
        id: 'venture',
        label: 'Venture progress',
        prompt: 'Where am I on my venture progress?',
        highlight: 'venture-cockpit' in suggestedLayoutHints,
        onSelect: () => {
          engageCapsuleAndMount('venture-progress');
          consumeSuggestion('venture-cockpit');
        },
        onDispatchOnSend: async (_editedPrompt: string) => { await fetchVentureProgress(); },
      },
      {
        id: 'ask-specialists',
        label: 'Ask specialists',
        prompt: 'Which specialist should I consult right now — Marketa, Quill, Kn0w1, Aigent Z, Aigent C, Aigent Nakamoto, Moneypenny, or metaYe — and why?',
        highlight: 'specialists' in suggestedLayoutHints,
        onSelect: () => {
          engageCapsuleAndMount('ask-specialists');
          // When a chat-driven hint exists, prefer it over the implicit
          // experience query so the right pane focuses on what the
          // operator actually just said.
          const hinted = suggestedLayoutHints.specialists;
          void fetchSpecialistRecommendation(hinted || implicitSpecialistQuery || undefined);
          consumeSuggestion('specialists');
        },
        stickyOnSend: true,
        onDispatchOnSend: async (editedPrompt: string) => {
          await fetchSpecialistRecommendation(editedPrompt || undefined);
        },
      },
    ];
  }, [serverChips, suggestedLayoutHints, consumeSuggestion, fetchBrief, fetchMoveForward, fetchVentureProgress, fetchReceipts, fetchSpecialistRecommendation, engageCapsuleAndMount, implicitSpecialistQuery]);

  // Context-inferred quick chips — derived from live brief/experience data.
  // Each chip routes through the canonical engageCapsuleAndMount gateway and
  // carries a context-specific seedPrompt the operator can edit before Send.
  // Only produced when there's enough context to make the chip specific
  // (experience name or primary goal) — cold/empty state shows nothing here.
  const inferredQuickPrompts = useMemo(() => {
    // Don't double-up when server chips are already driving the strip.
    if (serverChips && serverChips.length > 0) return [];

    const chips: Array<{
      id: string;
      label: string;
      prompt: string;
      seedPrompt: string;
      stickyOnSend: boolean;
      onSelect: () => void;
      onDispatchOnSend: (editedPrompt: string) => Promise<void>;
    }> = [];

    // Derive the most specific entity name available so the seed reads
    // "Draft Marketa outreach for Lamina 1" rather than something generic.
    const experienceName = brief?.context?.experienceName ?? null;
    const primaryGoal = brief?.context?.primaryGoal ?? (expModel?.meta?.primaryGoal as string | null ?? null);
    const cartridge = activeCartridges[0] ?? null;

    // Build Marketa seed — preference order: experience name > primary goal > cartridge name.
    // Skip if none available (cold state shows no inferred chip).
    let marketaSeed: string | null = null;
    if (experienceName && experienceName.length <= 60) {
      marketaSeed = `Draft Marketa partner outreach for ${experienceName}`;
    } else if (primaryGoal && primaryGoal.length <= 80) {
      marketaSeed = `Draft Marketa outreach: ${primaryGoal}`;
    } else if (cartridge) {
      marketaSeed = `Draft Marketa partner outreach for ${cartridge}`;
    }

    if (marketaSeed) {
      chips.push({
        id: 'marketa-inferred',
        label: 'Draft with Marketa',
        // prompt (sent as chat turn) mirrors the seed so the LLM narrates
        // the same intent the right-pane recommender is acting on.
        prompt: marketaSeed,
        seedPrompt: marketaSeed,
        // Sticky: subsequent chat turns refine Marketa's recommendation
        // as the operator adds detail (specific partner, deal size, etc.).
        stickyOnSend: true,
        onSelect: () => {
          engageCapsuleAndMount('ask-specialists');
          // Fire the recommendation fetch with the seed prompt on click so
          // Marketa is already surfaced in the right pane the moment the
          // operator lands there — no need to hit Send first.
          void fetchSpecialistRecommendation(marketaSeed || undefined);
        },
        onDispatchOnSend: async (editedPrompt: string) => {
          // Re-fire with the edited prompt on Send so the recommendation
          // tracks the operator's refined ask (specific partner, etc.).
          await fetchSpecialistRecommendation(editedPrompt || marketaSeed || undefined);
        },
      });
    }

    return chips;
  }, [serverChips, brief, expModel, activeCartridges, engageCapsuleAndMount, fetchSpecialistRecommendation, implicitSpecialistQuery]);

  return (
    <>
      <PersonaSpineGate state={spine}>
        <div className="h-[calc(100vh-96px)] flex flex-col lg:flex-row gap-2 px-2 pr-3 overflow-hidden">
          {/* ── LEFT: persistent copilot (50/50 with the right pane —
              the right pane is the busier surface and deserves
              equal width; the metaVatar rendering layer reads the
              copilot's getBoundingClientRect via the
              --metaavatar-copilot-w CSS variable so it rescales
              automatically when this changes). ─────────────────── */}
          <div className="lg:w-1/2 w-full h-full min-h-0 flex flex-col">
            <SmartTriadCopilotLayer
              isOpen
              variant="panel"
              quickPrompts={[...copilotQuickPrompts, ...inferredQuickPrompts]}
              promptPlaceholder="Ask aigentMe — brief, move forward, draft an email…"
              agent={{ id: 'aigent-me', name: 'aigentMe' }}
              agentSubtitle="metaMe · personal assistant"
              personaId={personaId}
              groundContext={copilotGroundContext}
              onSuggestedLayouts={handleSuggestedLayouts}
              onClearHighlights={clearCapsuleSuggestions}
              onClose={() => undefined}
            />
          </div>

          {/* ── RIGHT: dynamic surface (50/50 with the copilot). ── */}
          <div className="lg:w-1/2 w-full h-full min-h-0 relative">
            {/* RequestAdminAccessButton now mounted inside the
                right-pane badge carousel (WelcomeRightPane
                RequestAccessChip) — operator feedback: manual /
                admin affordances belong on the right, not in the
                generative quick-prompt strip. */}
            {bootstrapLoading && !data && (
              <div className="h-full flex items-center justify-center text-sm opacity-60">
                Loading aigentMe…
              </div>
            )}
            {bootstrapError && !data && (
              <div className="h-full flex items-center justify-center text-sm text-rose-400 px-4 text-center">
                {bootstrapError}
              </div>
            )}
            {data && (() => {
              // Phase 2: route the foreground pane through the layout registry.
              // ApprovalLayout (interrupt class) overlays the foreground when a
              // pending approval exists — it absolute-positions itself so the
              // foreground stays mounted underneath, preserving context.
              const foreground = getLayout(activeLayoutId);
              const ForegroundLayout = foreground.component;
              // Overlay mounts for EITHER pending approval shape:
              //   - pendingApprovalNbe → NBE that requires approval
              //   - secondTierApproval → external-action confirm
              // Phase 2 Slice 5b: second-tier is no longer rendered
              // inline in the stack; it lives in this same overlay so
              // the operator's flow stays in-app for every gate.
              //
              // Capsule-folded follow-up: when the artifact awaiting
              // second-tier approval was drafted from a queued NBE
              // (intent id matches an entry in queuedIntents), the
              // SecondTierApprovalCard renders inline inside the
              // emerald capsule next to its artifact — the operator
              // sees Queued → Recommendation → Artifact → Approve & send
              // as one continuous unit. Mounting the overlay too would
              // double-render the same gate; suppress it in that case.
              // The overlay still handles orphan artifacts (no matching
              // capsule) and every NBE approval.
              const secondTierInCapsule = (() => {
                if (!secondTierApproval) return false;
                const artifact = artifacts.find(
                  (a) => a.artifactId === secondTierApproval.artifactId,
                );
                // Specialists capsule renders the inline SecondTierApprovalCard
                // for any of its drafted artifacts (which carry no intentId
                // because composerSourceIntentId is unset on the chip path).
                // Suppress the overlay so the operator doesn't see a popup
                // AND an inline card competing for the same approval.
                if (activeLayoutId === 'specialists' && !artifact?.intentId) {
                  return true;
                }
                const queuedIntentIds = new Set(
                  Object.values(queuedIntents).map((q) => q.intentId),
                );
                return !!(artifact?.intentId && queuedIntentIds.has(artifact.intentId));
              })();
              const ApprovalOverlayLayout =
                pendingApprovalNbe || (secondTierApproval && !secondTierInCapsule)
                  ? getLayout('approval-interrupt').component
                  : null;
              // Composer overlays the active Capsule when composerKind
              // is set — never swaps the foreground layout, so the
              // Brief / Move-forward / Venture Capsule remains intact
              // and the operator can return to it after composing.
              const ComposerOverlayLayout =
                composerKind && activeLayoutId !== 'composer'
                  ? getLayout('composer').component
                  : null;
              // Single source of truth for layout inputs — passed identically
              // to foreground and overlay.
              const layoutProps = {
                onRequestLayout: requestLayout,
                theme,
                personaId,
                displayLabel: spine.displayLabel ?? data.displayLabel,
                ctas: data.primaryCtas,
                specialists: data.availableSpecialists,
                isAdmin: isAdmin ?? data.cartridgeFlags?.isAdmin,
                // Phase E follow-up: pass admin grants + active
                // cartridges into the right-pane chip carousel.
                isGlobalAdmin: adminGrants.isGlobalAdmin,
                hasCartridgeAdminGrant: adminGrants.cartridgeSlugs.size > 0,
                activeCartridges,
                // Phase F.2 — CONTEXTUAL Request access nudge. Only
                // populated when a brief/move-forward NBA targets a
                // cartridge the persona isn't on. The chip in
                // WelcomeRightPane renders nothing when this is null.
                recommendedAccessCartridgeSlug: recommendedAccessCartridge?.slug ?? null,
                recommendedAccessCartridgeLabel: recommendedAccessCartridge?.label ?? null,
                brief,
                briefLoading,
                briefError,
                ventureProgress,
                ventureProgressLoading,
                ventureProgressError,
                moveForwardResult,
                moveForwardLoading,
                pendingApproval: pendingApprovalNbe,
                submittingApproval,
                approvalError,
                artifacts,
                actionPendingArtifactId,
                actionErrors,
                secondTierApproval,
                specialistResponses,
                specialistLoading,
                specialistErrors,
                queuedIntents,
                expModel,
                expModelLoading,
                stageEval,
                receipts,
                receiptsLoading,
                receiptsPersonaLabel,
                expandedSectionId,
                setExpandedSectionId,
                usingIqubes,
                onCtaClick: handleCtaClick,
                onNbeAct: handleNbeAct,
                onApprovalApprove: handleApprovalApprove,
                onApprovalCancel: handleApprovalCancel,
                onSendArtifact: handleSendArtifact,
                onDismissArtifact: handleDismissArtifact,
                onApproveSecondTier: handleApproveSecondTier,
                onCancelSecondTier: handleCancelSecondTier,
                onDismissSpecialist: handleDismissSpecialist,
                onDismissQueued: handleDismissQueued,
                onMarkPillComplete: handleMarkPillComplete,
                actedNbeRegistry,
                activeCapsuleId,
                capsuleHistory,
                onEngageCapsule: engageCapsule,
                onDismissBrief: () => {
                  setBrief(null);
                  setBriefError(null);
                  setBriefLoading(false);
                  // Phase 2 Slice 1: dismissing the brief returns the
                  // pane to the default stack layout so the operator
                  // doesn't sit on an empty BriefLayout.
                  setActiveLayoutId('stack');
                },
                onBriefVariantChange: (briefType) => { void fetchBrief(briefType); },
                onDismissVenture: () => {
                  setVentureProgress(null);
                  setVentureProgressError(null);
                  setVentureProgressLoading(false);
                },
                onDismissMoveForward: () => {
                  setMoveForwardResult(null);
                  setMoveForwardLoading(false);
                },
                onAskSpecialist: handleAskSpecialist,
                askSpecialistOpenId,
                askSpecialistPrompt,
                askSpecialistLoadingId,
                askSpecialistResponses,
                askSpecialistErrors,
                setAskSpecialistOpenId,
                setAskSpecialistPrompt,
                briefRef,
                nbeRef,
                approvalRef,
                artifactRef,
                // Phase 2 Slice 4: ComposerLayout reads composerKind
                // to decide whether to render the inline compose form.
                // After a successful create the wrapped handlers flip
                // composerKind → null so the layout transitions to
                // draft-preview without surface switching.
                composerKind,
                selectedKpiId,
                selectedIntentId,
                onSelectKpi: (kpiId: string) => {
                  setSelectedKpiId(kpiId);
                  setActiveLayoutId('kpi-detail');
                },
                onSelectActiveWork: handleSelectActiveWork,
                onKpiEdited: () => { void fetchVentureProgress({ silent: true }); },
                onIntentEdited: () => { void fetchVentureProgress({ silent: true }); },
                // Phase 2 B.3 — live sync header indicator + manual force.
                ventureLastSyncedAt,
                onForceSync: () => { void fetchVentureProgress({ silent: true }); },
                // KPI editor entry point — header button + empty-state CTA.
                onEditKpis: () => setKpisEditorOpen(true),
                // Phase 2 — SpecialistsLayout state bundle.
                specialistsLayout: {
                  selectedSpecialistId,
                  recommendation: specialistRecommendation,
                  recommendationLoading: specialistRecommendationLoading,
                  recommendationError: specialistRecommendationError,
                  sessionResponses: askSpecialistResponses,
                  thread: specialistThread,
                  threadLoading: specialistThreadLoading,
                  askPrompt: askSpecialistPrompt,
                  askLoadingId: askSpecialistLoadingId,
                  askError: selectedSpecialistId ? (askSpecialistErrors[selectedSpecialistId] ?? null) : null,
                  preflightContext: specialistRecommendationPreflight,
                },
                onSelectSpecialist: handleSelectSpecialist,
                onAskSelectedSpecialist: handleAskSelectedSpecialist,
                onSetSpecialistPrompt: setAskSpecialistPrompt,
                onHandoffSpecialist: handleHandoffSpecialist,
                onOpenActivationsForSpecialist: handleOpenActivationsForSpecialist,
                onUseSuggestedArtifact: handleUseSuggestedArtifact,
                // Pre-baked aigentMe draft prompt for the ComposerLayout
                // when the operator fired a suggested-artifact button.
                // Cleared by every non-suggested-artifact composer open
                // path so the next composer mount starts empty unless a
                // suggested-artifact explicitly seeded a prompt.
                composerInitialPrompt,
                // ComposerLayout's X / Cancel calls this to clear the
                // overlay state so the composer unmounts. Without it,
                // the dismiss only swapped foreground layouts — a
                // no-op when the composer is mounted as an overlay
                // on top of the active Capsule.
                onComposerClose: () => setComposerKind(null),
                composerHandlers: {
                  onCreateGmail: async (input) => {
                    await handleComposeGmailDraft(input);
                    setComposerKind(null);
                  },
                  onDraftGmail: handleDraftEmail,
                  onCreateCalendar: async (input) => {
                    await handleComposeCalendarEvent(input as Parameters<typeof handleComposeCalendarEvent>[0]);
                    setComposerKind(null);
                  },
                  onDraftCalendar: handleDraftEvent,
                  onCreateDoc: async (input) => {
                    await handleComposeGoogleDoc(input as Parameters<typeof handleComposeGoogleDoc>[0]);
                    setComposerKind(null);
                  },
                  onDraftDoc: handleDraftDoc,
                  onCreateSheet: async (input) => {
                    await handleComposeGoogleSheet(input as Parameters<typeof handleComposeGoogleSheet>[0]);
                    setComposerKind(null);
                  },
                  onDraftSheet: handleDraftSheet,
                  onCreateSlides: async (input) => {
                    await handleComposeSlides(input as Parameters<typeof handleComposeSlides>[0]);
                    setComposerKind(null);
                  },
                  onDraftSlides: handleDraftSlides,
                  onCreateMarketa: async (input) => {
                    await handleComposeMarketa(input as Parameters<typeof handleComposeMarketa>[0]);
                    setComposerKind(null);
                  },
                  onDraftMarketa: handleDraftMarketa,
                },
              };
              return (
              <>
              <ForegroundLayout {...layoutProps} />
              {ComposerOverlayLayout && (
                <div className="absolute inset-0 z-30 flex md:items-center md:justify-center">
                  <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={() => setComposerKind(null)}
                  />
                  <div className="relative z-10 w-full md:max-w-2xl md:mx-4 max-h-[90%] overflow-auto">
                    <ComposerOverlayLayout {...layoutProps} />
                  </div>
                </div>
              )}
              {ApprovalOverlayLayout && <ApprovalOverlayLayout {...layoutProps} />}
              </>
              );
            })()}
            {/* Floating compose strip — pinned to bottom of right pane. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 px-3 z-30">
              <div className="pointer-events-auto">
                <ComposeQuickActionsStrip
                  onOpen={(kind) => {
                    // When the chat copilot suggested this compose kind on the
                    // last turn, ride the captured promptHint into the inline
                    // composer form so the operator's intent (e.g. "draft an
                    // outreach email to Lamina 1") drives the auto-draft.
                    const hint = suggestedLayoutHints[kind];
                    openComposeByKind(kind, hint ?? null);
                    consumeSuggestion(kind);
                  }}
                  onUploadOpen={() => {
                    setUploadDrawerOpen(true);
                    consumeSuggestion('upload');
                  }}
                  onDownloadsOpen={() => {
                    setDownloadsOpen(true);
                    consumeSuggestion('download');
                  }}
                  onClearSuggestions={clearComposeSuggestions}
                  suggested={{
                    gmail:    'gmail'    in suggestedLayoutHints,
                    event:    'event'    in suggestedLayoutHints,
                    doc:      'doc'      in suggestedLayoutHints,
                    sheet:    'sheet'    in suggestedLayoutHints,
                    slides:   'slides'   in suggestedLayoutHints,
                    marketa:  'marketa'  in suggestedLayoutHints,
                    upload:   'upload'   in suggestedLayoutHints,
                    download: 'download' in suggestedLayoutHints,
                  }}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        </div>
      </PersonaSpineGate>

      {/* ── Modals (mounted at root, single source of truth) ─────── */}
      <ExperienceGoalsEditor
        open={goalsEditorOpen}
        onOpenChange={(open) => {
          // When the editor closes WITHOUT saving (operator hit X /
          // cancelled), clear the optimistic queued Pill so the brief
          // doesn't sit on a Blue chip forever. The save path handles
          // its own completion via onSaved below.
          setGoalsEditorOpen(open);
          if (!open) {
            setQueuedIntents((prev) => {
              const cur = prev['metame.update-experience-goals'];
              if (!cur || cur.manuallyComplete) return prev;
              const next = { ...prev };
              delete next['metame.update-experience-goals'];
              return next;
            });
          }
        }}
        personaId={personaId}
        onSaved={() => {
          // Flip the queued Pill to Green so the operator sees the
          // save landed, then re-fetch receipts + venture progress
          // (where Operational Goals lives) so the count chip on the
          // Venture Capsule reflects the new state without a manual
          // refresh.
          setQueuedIntents((prev) => {
            const cur = prev['metame.update-experience-goals'];
            if (!cur) return prev;
            return { ...prev, ['metame.update-experience-goals']: { ...cur, manuallyComplete: true, status: 'completed', queueMessage: 'ExperienceGoals updated.' } };
          });
          void fetchReceipts();
          void fetchVentureProgress({ silent: true });
          void fetchBrief();
        }}
      />
      <ExperienceModelSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initial={expModel?.meta ? {
          experienceName: expModel.meta.experienceName ?? undefined,
          experienceType: expModel.meta.experienceType as never,
          primaryGoal: expModel.meta.primaryGoal ?? undefined,
          activeCartridges: expModel.meta.activeCartridges as never,
          currentStage: expModel.meta.currentStage as never,
          confidentialityDefault: expModel.meta.confidentialityDefault as never,
          progressModel: expModel.meta.progressModel,
        } : undefined}
        onSaved={handleWizardSaved}
      />
      {/* Phase 2 B.1 polish: KPI editor mount. Opened from the cockpit
          header "Edit KPIs" button + the empty-state CTA when the
          persona has no rich KPIs declared yet. Save triggers a silent
          venture-progress refetch so the cockpit picks up the change. */}
      <ActiveKpisEditor
        open={kpisEditorOpen}
        onOpenChange={setKpisEditorOpen}
        personaId={personaId}
        onSaved={() => { void fetchVentureProgress({ silent: true }); }}
      />
      {/* Phase 2 Slice 4: Compose popups removed. All six compose
          surfaces (Email / Event / Doc / Sheet / Slides / Marketa)
          now render INLINE inside ComposerLayout via its `inline=true`
          host mode. Activator: openComposeByKind(kind) sets
          activeLayoutId='composer' + composerKind, the layout mounts
          the matching form, submit creates the artifact then flips
          composerKind→null so the same layout shows the draft
          preview with Send draft → unified ApprovalLayout overlay. */}
      <UploadDrawer
        open={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        personaId={personaId}
        theme={theme}
      />
      <DownloadsMenu
        open={downloadsOpen}
        onClose={() => setDownloadsOpen(false)}
        theme={theme}
      />
    </>
  );
}

export default AigentMeWelcomeSplitTab;
