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
import AgentWalletDrawer from "@/components/AgentWalletDrawer";
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
function composeKindForSuggestedArtifact(artifactType: string): ComposeKind | null {
  const t = artifactType.toLowerCase();
  if (/(email|outreach|gmail|note to|reply|message)/.test(t)) {
    return /(marketa|campaign send)/.test(t) ? 'marketa' : 'gmail';
  }
  if (/(meeting|calendar|event|invite|sync\b)/.test(t)) return 'event';
  if (/(slide|deck|presentation|pitch)/.test(t)) return 'slides';
  if (/(sheet|spreadsheet|tracker|csv|table)/.test(t)) return 'sheet';
  if (/(doc|brief|memo|proposal|article|outline|narrative|write-up|writeup|spec|plan)/.test(t)) return 'doc';
  return null;
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

  // Wallet drawer.
  const [walletOpen, setWalletOpen] = useState(false);

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
    Record<string, { intentId: string; status: string; queueMessage: string }>
  >({});

  // Accordion: which right-pane config section is expanded.
  const [expandedSectionId, setExpandedSectionId] = useState<SectionId | null>(null);

  // Phase 2 Slice 0: right-pane layout selector. Defaults to 'stack' so
  // behavior is identical to Phase 1 — `StackLayout` wraps the existing
  // WelcomeRightPane verbatim. Slices 1+ add intent-specific layouts
  // (brief, decision-board, venture-cockpit, composer, approval, ledger)
  // and the activator chips set this state to route the pane.
  // DIS: codexes/packs/agentiq/items/dis/aigentme-phase-2.dis.json
  const [activeLayoutId, setActiveLayoutId] = useState<RightPaneLayoutId>(DEFAULT_LAYOUT_ID);

  // Phase 2 Slice 7 — server-driven chip set.
  // Null = use the cold-open static fallback below. Each /api/assistant/*
  // response may carry a `quickChips: NbeQuickChip[]` envelope; when it
  // does, the strip swaps to that set for the next turn. The fetch
  // helpers (fetchBrief / fetchMoveForward / fetchVentureProgress) read
  // the envelope and call setServerChips(). Server emission is the
  // follow-on slice — this slot makes the swap point ready.
  const [serverChips, setServerChips] = useState<NbeQuickChip[] | null>(null);

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
    // Phase 2 Slice 1: 'brief-me' now selects the BriefLayout AND fires
    // the fetch. The layout owns the rendering; the stack no longer
    // accumulates a brief card.
    if (ctaId === 'brief-me') {
      setActiveLayoutId('brief');
      void fetchBrief();
      return;
    }
    // Move-forward + venture-progress request their intent-layouts.
    // Until Slices 2 + 3 land, the registry falls back to StackLayout
    // so the cards still render in the stack; once the layouts ship,
    // these calls activate them automatically.
    if (ctaId === 'move-this-forward') {
      setActiveLayoutId('decision-board');
      void fetchMoveForward();
      return;
    }
    if (ctaId === 'review-venture-progress') {
      setActiveLayoutId('venture-cockpit');
      void fetchVentureProgress();
      return;
    }
  }, [fetchBrief, fetchMoveForward, fetchVentureProgress]);

  const handleWizardSaved = useCallback((saved: ExperienceModelCardData) => {
    setExpModel(saved);
    void fetchReceipts();
  }, [fetchReceipts]);

  // ── Approval / NBE flow ────────────────────────────────────────────
  const handleNbeAct = useCallback((action: NextBestActionData) => {
    if (queuedIntents[action.id]) return;
    // Short-circuit: the "update goals" NBE opens the goals editor directly
    // rather than going through the generic approval → intent path.
    if (action.id === 'metame.update-experience-goals') {
      setGoalsEditorOpen(true);
      return;
    }
    // Stage-advance NBE → POST /api/assistant/stage-progression directly.
    if (action.id === 'metame.advance-stage') {
      void (async () => {
        try {
          await personaFetch('/api/assistant/stage-progression', {
            personaIdHint: personaId,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger: 'nbe' }),
          });
          void fetchReceipts();
        } catch { /* surfaced through stale state */ }
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
      setPendingApprovalNbe(null);
      // Foreground layout remains as-is; approval overlay unmounts.
      void fetchReceipts();
      // Phase 2 B.3 — also refresh the cockpit so the just-queued
      // intent appears in Active Work without the operator needing
      // to wait for the next 20s poll. Silent mode keeps the
      // existing surface mounted.
      void fetchVentureProgress({ silent: true });

      // Workspace-flavoured NBEs (gmail/doc/event/etc.) hand off to the
      // corresponding compose modal so the user can actually do the action
      // they just approved. Without this the queue grows but nothing happens.
      const composeKind = composeKindForAction(action);
      if (composeKind) {
        // Move D — when the rerank emitted a prompt hint for this NBA,
        // seed the composer with it. Otherwise leave the form blank,
        // matching the chip-driven openComposeByKind() flow below.
        setComposerInitialPrompt(handoffHint && handoffHint.trim().length > 0 ? handoffHint : null);
        setComposerKind(composeKind);
        setActiveLayoutId('composer');
        setPendingApprovalHint(null);
      } else {
        setPendingApprovalHint(null);
        // No compose hand-off — scroll the right pane to the freshly queued
        // card so the state change is obvious. The approval card has just
        // unmounted; without this scroll the user often misses the queue
        // indicator (which renders in the queued-intents zone above).
        window.setTimeout(() => {
          const el = document.querySelector(`[data-queued-nbe-id="${action.id}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
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
  }, [pendingApprovalNbe, pendingApprovalHint, personaId, fetchReceipts, fetchVentureProgress]);

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

  const handleComposeGmailDraft = useCallback(async (input: { to: string; subject: string; bodyText: string; cc?: string; bcc?: string }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'gmail-draft', destination: 'gmail', title: input.subject, connectorInput: input }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts]);

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
      body: JSON.stringify({ artifactType: 'calendar-block', destination: 'calendar', title: input.summary, connectorInput: input }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts]);

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
      body: JSON.stringify({ artifactType: 'google-doc', destination: 'drive', title: input.title, connectorInput: input }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts]);

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
      body: JSON.stringify({ artifactType: 'slide-outline', destination: 'drive', title: input.title, connectorInput: input }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts]);

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
      body: JSON.stringify({ artifactType: 'google-sheet', destination: 'drive', title: input.title, connectorInput: input }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts]);

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

  const handleComposeMarketa = useCallback(async (input: { to: string; subject: string; bodyText: string; cc?: string; bcc?: string; fromName?: string; campaignId?: string; cohortId?: string }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifactType: 'marketa-email', destination: 'runtime', title: input.subject, connectorInput: input }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10)); autoOpenArtifact(data);
    void fetchReceipts();
  }, [personaId, fetchReceipts]);

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
  }, [personaId, fetchReceipts]);

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
      // Auto-select the recommended specialist if none is selected yet,
      // so the operator lands on a primed composer instead of an empty
      // canvas. They can still pick another from the roster.
      setSelectedSpecialistId((prev) => prev ?? payload.topSpecialistId);
    } catch (err) {
      setSpecialistRecommendationError(err instanceof Error ? err.message : String(err));
    } finally {
      setSpecialistRecommendationLoading(false);
    }
  }, [personaId]);

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
  const [composerKind, setComposerKind] = useState<ComposeKind | null>(null);
  // Optional pre-baked aigentMe draft prompt — when set, the inline
  // compose form pre-fills its AI prompt textarea AND auto-fires the
  // draft on mount so the operator lands on a populated form. Used by
  // the SpecialistsLayout suggested-artifact buttons.
  const [composerInitialPrompt, setComposerInitialPrompt] = useState<string | null>(null);

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
  // Compose footer / copilot bridge now routes ALL compose intents
  // through the Phase 2 ComposerLayout — no popup modals over the
  // right pane. The compose form hosts inline in the layout's body;
  // submit creates the artifact + clears composerKind so the same
  // surface flips to the draft preview with Send draft → Phase 2
  // ApprovalLayout overlay (the unified HITL gate).
  const openComposeByKind = useCallback((kind: ComposeKind) => {
    // Clear any prior auto-draft prompt — manual chip-fired composer
    // opens should land on an empty form, not re-run a previous draft.
    setComposerInitialPrompt(null);
    setComposerKind(kind);
    setActiveLayoutId('composer');
  }, []);

  // SpecialistsLayout suggested-artifact button → open ComposerLayout
  // with a pre-baked aigentMe draft prompt so the inline form
  // auto-populates. No-op when the artifact label doesn't map to any
  // compose surface (e.g. "Strategy memo PDF" — we leave the chip
  // non-clickable and the operator can ask the specialist to refine).
  const handleUseSuggestedArtifact = useCallback((
    artifactType: string,
    response: import('@/components/metame/cards/SpecialistResponseCard').SpecialistResponseData,
  ) => {
    const kind = composeKindForSuggestedArtifact(artifactType);
    if (!kind) return;
    const prompt = buildPromptForSuggestedArtifact(artifactType, response);
    setComposerInitialPrompt(prompt);
    setComposerKind(kind);
    setActiveLayoutId('composer');
  }, []);

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
  const copilotQuickPrompts = useMemo(() => {
    const dispatchFor = (chip: NbeQuickChip) => () => {
      if (!chip.layoutDispatch) return;
      const { activate, fetch: fetchKind } = chip.layoutDispatch;
      setActiveLayoutId(activate);
      switch (fetchKind) {
        case 'brief':            void fetchBrief(); break;
        case 'move-forward':     void fetchMoveForward(); break;
        case 'venture-progress': void fetchVentureProgress(); break;
        case 'receipts':         void fetchReceipts(); break;
        case null: case undefined: /* no fetch */ break;
      }
      if (chip.layoutDispatch.composerKind) {
        // Chip-driven composer opens land on an empty form — only the
        // suggested-artifact path sets composerInitialPrompt.
        setComposerInitialPrompt(null);
        setComposerKind(chip.layoutDispatch.composerKind);
      }
    };

    if (serverChips && serverChips.length > 0) {
      return serverChips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        prompt: chip.copilotPrompt ?? "",
        skipInference: !chip.copilotPrompt,
        onSelect: dispatchFor(chip),
      }));
    }

    return [
      {
        id: 'brief',
        label: 'Brief me',
        prompt: 'Give me my daily brief.',
        onSelect: () => {
          setActiveLayoutId('brief');
          void fetchBrief();
        },
      },
      {
        id: 'move',
        label: 'Move forward',
        prompt: 'What is the next best action I should take right now?',
        onSelect: () => {
          setActiveLayoutId('decision-board');
          void fetchMoveForward();
        },
      },
      {
        id: 'venture',
        label: 'Venture progress',
        prompt: 'Where am I on my venture progress?',
        onSelect: () => {
          setActiveLayoutId('venture-cockpit');
          void fetchVentureProgress();
        },
      },
      {
        id: 'ask-specialists',
        label: 'Ask specialists',
        // The copilot prompt frames the specialist roster so the LLM
        // knows what's available; the right pane mounts the Phase 2
        // SpecialistsLayout and fires the server-side recommender so
        // the operator lands on a primed consultation surface.
        prompt: 'Which specialist should I consult right now — Marketa, Quill, Kn0w1, Aigent Z, Aigent C, Aigent Nakamoto, Moneypenny, or metaYe — and why?',
        onSelect: () => {
          setActiveLayoutId('specialists');
          void fetchSpecialistRecommendation();
        },
      },
    ];
  }, [serverChips, fetchBrief, fetchMoveForward, fetchVentureProgress, fetchReceipts, fetchSpecialistRecommendation]);

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
              quickPrompts={copilotQuickPrompts}
              promptPlaceholder="Ask aigentMe — brief, move forward, draft an email…"
              agent={{ id: 'aigent-me', name: 'aigentMe' }}
              agentSubtitle="metaMe · personal assistant"
              personaId={personaId}
              groundContext={copilotGroundContext}
              onClose={() => undefined}
            />
          </div>

          {/* ── RIGHT: dynamic surface (50/50 with the copilot). ── */}
          <div className="lg:w-1/2 w-full h-full min-h-0 relative">
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
              const ApprovalOverlayLayout = (pendingApprovalNbe || secondTierApproval)
                ? getLayout('approval-interrupt').component
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
              {ApprovalOverlayLayout && <ApprovalOverlayLayout {...layoutProps} />}
              </>
              );
            })()}
            {/* Floating compose strip — pinned to bottom of right pane. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 px-3 z-30">
              <div className="pointer-events-auto">
                <ComposeQuickActionsStrip
                  onOpen={openComposeByKind}
                  onWalletOpen={() => setWalletOpen(true)}
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
        onOpenChange={setGoalsEditorOpen}
        personaId={personaId}
        onSaved={() => {
          // Re-fetch the bootstrap so the right pane reflects new goal count.
          void fetchReceipts();
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
      <AgentWalletDrawer
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        agent={{ id: 'aigent-me', name: 'aigentMe' }}
      />
    </>
  );
}

export default AigentMeWelcomeSplitTab;
