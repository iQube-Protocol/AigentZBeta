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
  usePersonaSpine,
  personaFetch,
  PersonaSpineGate,
} from "@/utils/personaSpine";
import { SmartTriadCopilotLayer } from "@/components/smarttriad/copilot/SmartTriadCopilotLayer";

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

import { ComposeGmailDraftModal } from "@/components/metame/connections/ComposeGmailDraftModal";
import { ComposeCalendarEventModal } from "@/components/metame/connections/ComposeCalendarEventModal";
import { ComposeGoogleDocModal } from "@/components/metame/connections/ComposeGoogleDocModal";
import { ComposeGoogleSheetModal } from "@/components/metame/connections/ComposeGoogleSheetModal";
import { ComposeSlidesModal } from "@/components/metame/connections/ComposeSlidesModal";
import { ComposeMarketaEmailModal } from "@/components/metame/connections/ComposeMarketaEmailModal";

import { ComposeQuickActionsStrip, type ComposeKind } from "@/components/metame/copilot/ComposeQuickActionsStrip";
import AgentWalletDrawer from "@/components/AgentWalletDrawer";
import { WelcomeRightPane } from "@/components/metame/welcome/WelcomeRightPane";
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

  const [brief, setBrief] = useState<BriefCardData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [moveForwardResult, setMoveForwardResult] = useState<{
    cartridge: string;
    topAction: NextBestActionData | null;
    alternates: NextBestActionData[];
  } | null>(null);
  const [moveForwardLoading, setMoveForwardLoading] = useState(false);

  const [ventureProgress, setVentureProgress] = useState<VentureProgressData | null>(null);
  const [ventureProgressLoading, setVentureProgressLoading] = useState(false);
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
  const [composeGmailOpen, setComposeGmailOpen] = useState(false);
  const [composeCalendarOpen, setComposeCalendarOpen] = useState(false);
  const [composeDocOpen, setComposeDocOpen] = useState(false);
  const [composeSheetOpen, setComposeSheetOpen] = useState(false);
  const [composeSlidesOpen, setComposeSlidesOpen] = useState(false);
  const [composeMarketaOpen, setComposeMarketaOpen] = useState(false);

  // Per-specialist inline Ask state.
  const [askSpecialistOpenId, setAskSpecialistOpenId] = useState<string | null>(null);
  const [askSpecialistPrompt, setAskSpecialistPrompt] = useState("");
  const [askSpecialistLoadingId, setAskSpecialistLoadingId] = useState<string | null>(null);
  const [askSpecialistResponses, setAskSpecialistResponses] = useState<Record<string, SpecialistResponseData>>({});
  const [askSpecialistErrors, setAskSpecialistErrors] = useState<Record<string, string>>({});

  // Activity receipts.
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsPersonaLabel, setReceiptsPersonaLabel] = useState<string | null>(null);

  // Goals editor (short-circuits the `metame.update-experience-goals` NBE).
  const [goalsEditorOpen, setGoalsEditorOpen] = useState(false);

  // Approval + queued intents.
  const [pendingApprovalNbe, setPendingApprovalNbe] = useState<NextBestActionData | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [queuedIntents, setQueuedIntents] = useState<
    Record<string, { intentId: string; status: string; queueMessage: string }>
  >({});

  // Accordion: which right-pane config section is expanded.
  const [expandedSectionId, setExpandedSectionId] = useState<SectionId | null>(null);

  // Refs for the copilot to scroll cards into view.
  const briefRef = useRef<HTMLDivElement>(null);
  const nbeRef = useRef<HTMLDivElement>(null);
  const approvalRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);

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
  const fetchBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    try {
      const res = await personaFetch('/api/assistant/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefType: 'daily' }),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `brief failed (${res.status})`);
      }
      setBrief((await res.json()) as BriefCardData);
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
      setMoveForwardResult((await res.json()) as { cartridge: string; topAction: NextBestActionData | null; alternates: NextBestActionData[] });
    } catch {
      setMoveForwardResult({ cartridge: cartridge ?? 'metame', topAction: null, alternates: [] });
    } finally {
      setMoveForwardLoading(false);
    }
  }, [personaId]);

  const fetchVentureProgress = useCallback(async () => {
    setVentureProgressLoading(true);
    setVentureProgressError(null);
    setVentureProgress(null);
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
      setVentureProgress((await res.json()) as VentureProgressData);
    } catch (err) {
      setVentureProgressError(err instanceof Error ? err.message : String(err));
    } finally {
      setVentureProgressLoading(false);
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
    if (ctaId === 'brief-me') { void fetchBrief(); return; }
    if (ctaId === 'move-this-forward') { void fetchMoveForward(); return; }
    if (ctaId === 'review-venture-progress') { void fetchVentureProgress(); return; }
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
    setApprovalError(null);
    setPendingApprovalNbe(action);
    // Scroll the approval card into view — the right pane scrolls
    // independently and the modal would otherwise appear above the fold.
    window.requestAnimationFrame(() => {
      approvalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [queuedIntents]);

  const handleApprovalCancel = useCallback(() => {
    setPendingApprovalNbe(null);
    setApprovalError(null);
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
      setPendingApprovalNbe(null);
      void fetchReceipts();

      // Workspace-flavoured NBEs (gmail/doc/event/etc.) hand off to the
      // corresponding compose modal so the user can actually do the action
      // they just approved. Without this the queue grows but nothing happens.
      const composeKind = composeKindForAction(action);
      if (composeKind) {
        openComposeByKind(composeKind);
      } else {
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
  }, [pendingApprovalNbe, personaId, fetchReceipts]);

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
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10));
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
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10));
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
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10));
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
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10));
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
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10));
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
    const data = (await res.json()) as ArtifactCardData; setArtifacts((prev) => [data, ...prev].slice(0, 10));
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

  const handleAskSpecialist = useCallback(async (specialistId: string, prompt: string) => {
    const key = specialistId;
    setAskSpecialistLoadingId(key);
    setAskSpecialistErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    try {
      const res = await personaFetch('/api/assistant/ask-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialistId, ...(prompt.trim() ? { prompt: prompt.trim() } : {}) }),
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

  // ── AG-UI bridge: copilot → right pane ─────────────────────────────
  const openComposeByKind = useCallback((kind: ComposeKind) => {
    switch (kind) {
      case "gmail":   setComposeGmailOpen(true); break;
      case "event":   setComposeCalendarOpen(true); break;
      case "doc":     setComposeDocOpen(true); break;
      case "sheet":   setComposeSheetOpen(true); break;
      case "slides":  setComposeSlidesOpen(true); break;
      case "marketa": setComposeMarketaOpen(true); break;
    }
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

  useAigentMeCopilotBridge({
    openCompose: openComposeByKind,
    fireCta: handleCtaClick,
    expandSection: setExpandedSectionId,
    focusCard,
    readable: {
      activeBrief: { hasBrief: !!brief, summary: brief?.summary ?? null },
      pendingApproval: { has: !!pendingApprovalNbe, cartridge: pendingApprovalNbe?.cartridge ?? null },
      experienceModelStatus: {
        configured: !!expModel?.configured,
        stage: (expModel?.meta?.currentStage as string | null) ?? null,
      },
      activeCartridges,
      latestArtifact: {
        kind: latestArtifact?.artifactType ?? null,
        title: latestArtifact?.title ?? null,
        status: latestArtifact?.status ?? null,
      },
      nextBestActionsCount: (moveForwardResult?.alternates.length ?? 0) + (moveForwardResult?.topAction ? 1 : 0),
      expandedSectionId,
      receiptsCount: receipts.length,
    },
  });

  // ── Render ──────────────────────────────────────────────────────────
  // Static seed prompts for the copilot (the right pane's CTAs are
  // still the canonical entry point; these just teach the copilot what
  // it can do on this surface).
  const copilotQuickPrompts = useMemo(() => [
    { id: 'brief', label: 'Brief me', prompt: 'Give me my daily brief.' },
    { id: 'move', label: 'Move forward', prompt: 'What is the next best action I should take right now?' },
    { id: 'venture', label: 'Venture progress', prompt: 'Where am I on my venture progress?' },
  ], []);

  return (
    <>
      <PersonaSpineGate state={spine}>
        <div className="h-[calc(100vh-96px)] flex flex-col lg:flex-row gap-2 px-2 pr-3 overflow-hidden">
          {/* ── LEFT: persistent copilot ─────────────────────────── */}
          <div className="lg:w-[55%] w-full h-full min-h-0 flex flex-col">
            <SmartTriadCopilotLayer
              isOpen
              variant="panel"
              quickPrompts={copilotQuickPrompts}
              promptPlaceholder="Ask aigentMe — brief, move forward, draft an email…"
              agent={{ id: 'aigent-me', name: 'aigentMe' }}
              agentSubtitle="metaMe · personal assistant"
              onClose={() => undefined}
            />
          </div>

          {/* ── RIGHT: dynamic surface ───────────────────────────── */}
          <div className="lg:w-[45%] w-full h-full min-h-0 relative">
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
            {data && (
              <WelcomeRightPane
                theme={theme}
                personaId={personaId}
                displayLabel={spine.displayLabel ?? data.displayLabel}
                ctas={data.primaryCtas}
                specialists={data.availableSpecialists}
                isAdmin={isAdmin ?? data.cartridgeFlags?.isAdmin}
                brief={brief}
                briefLoading={briefLoading}
                briefError={briefError}
                ventureProgress={ventureProgress}
                ventureProgressLoading={ventureProgressLoading}
                ventureProgressError={ventureProgressError}
                moveForwardResult={moveForwardResult}
                moveForwardLoading={moveForwardLoading}
                pendingApproval={pendingApprovalNbe}
                submittingApproval={submittingApproval}
                approvalError={approvalError}
                artifacts={artifacts}
                actionPendingArtifactId={actionPendingArtifactId}
                actionErrors={actionErrors}
                secondTierApproval={secondTierApproval}
                specialistResponses={specialistResponses}
                specialistLoading={specialistLoading}
                specialistErrors={specialistErrors}
                queuedIntents={queuedIntents}
                expModel={expModel}
                expModelLoading={expModelLoading}
                receipts={receipts}
                receiptsLoading={receiptsLoading}
                receiptsPersonaLabel={receiptsPersonaLabel}
                expandedSectionId={expandedSectionId}
                setExpandedSectionId={setExpandedSectionId}
                usingIqubes={usingIqubes}
                onCtaClick={handleCtaClick}
                onNbeAct={handleNbeAct}
                onApprovalApprove={handleApprovalApprove}
                onApprovalCancel={handleApprovalCancel}
                onSendArtifact={handleSendArtifact}
                onDismissArtifact={handleDismissArtifact}
                onApproveSecondTier={handleApproveSecondTier}
                onCancelSecondTier={handleCancelSecondTier}
                onDismissSpecialist={handleDismissSpecialist}
                onDismissQueued={handleDismissQueued}
                onAskSpecialist={handleAskSpecialist}
                askSpecialistOpenId={askSpecialistOpenId}
                askSpecialistPrompt={askSpecialistPrompt}
                askSpecialistLoadingId={askSpecialistLoadingId}
                askSpecialistResponses={askSpecialistResponses}
                askSpecialistErrors={askSpecialistErrors}
                setAskSpecialistOpenId={setAskSpecialistOpenId}
                setAskSpecialistPrompt={setAskSpecialistPrompt}
                briefRef={briefRef}
                nbeRef={nbeRef}
                approvalRef={approvalRef}
                artifactRef={artifactRef}
              />
            )}
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
      <ComposeGmailDraftModal
        open={composeGmailOpen}
        onClose={() => setComposeGmailOpen(false)}
        onCreate={handleComposeGmailDraft}
        onDraftWithAigentMe={handleDraftEmail}
        theme={theme}
      />
      <ComposeCalendarEventModal
        open={composeCalendarOpen}
        onClose={() => setComposeCalendarOpen(false)}
        onCreate={handleComposeCalendarEvent}
        onDraftWithAigentMe={handleDraftEvent}
        theme={theme}
      />
      <ComposeGoogleDocModal
        open={composeDocOpen}
        onClose={() => setComposeDocOpen(false)}
        onCreate={handleComposeGoogleDoc}
        onDraftWithAigentMe={handleDraftDoc}
        theme={theme}
      />
      <ComposeSlidesModal
        open={composeSlidesOpen}
        onClose={() => setComposeSlidesOpen(false)}
        onCreate={handleComposeSlides}
        onDraftWithAigentMe={handleDraftSlides}
        theme={theme}
      />
      <ComposeMarketaEmailModal
        open={composeMarketaOpen}
        onClose={() => setComposeMarketaOpen(false)}
        onCreate={handleComposeMarketa}
        onDraftWithAigentMe={handleDraftMarketa}
        theme={theme}
      />
      <ComposeGoogleSheetModal
        open={composeSheetOpen}
        onClose={() => setComposeSheetOpen(false)}
        onCreate={handleComposeGoogleSheet}
        onDraftWithAigentMe={handleDraftSheet}
        theme={theme}
      />
      <AgentWalletDrawer
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        agent={{ id: 'aigent-me', name: 'aigentMe' }}
      />
    </>
  );
}

export default AigentMeWelcomeSplitTab;
