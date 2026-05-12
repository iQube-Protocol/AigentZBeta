/**
 * AigentMeWelcomeTab — metaMe cartridge welcome takeover.
 *
 * Phase 1 of the metaMe Personal Assistant Alpha (Aigent Me).
 *
 * Reads /api/assistant/bootstrap and renders:
 *   - Greeting ("metaMe Personal Assistant, powered by Aigent Me")
 *   - ExperienceModel state (configured? primary stage?)
 *   - Context chips (active cartridges + Metayé Media + Google Workspace)
 *   - Primary CTAs (PRD §9.1) — alpha-preview state until backend phases land
 *   - Specialist directory (Marketa / Quill / Kn0w1 / Aigent Z / Aigent C)
 *   - Locked naming notice
 *
 * Backends for the CTAs land in subsequent phases:
 *   Phase 2 — ExperienceModel setup
 *   Phase 3 — Brief / Move forward
 *   Phase 4 — Venture progress
 *   Phase 5 — Specialist routing
 *   Phase 6 — Artifact creation + approvals
 *   Phase 7 — Receipts
 */

"use client";

/**
 * Reference implementation for the PersonaSpine client protocol.
 * Every other surface (tab, sub-tab, drawer, chip, capsule, ExperienceQube,
 * iQube card, modal) follows this exact pattern:
 *
 *   1. const spine = usePersonaSpine({ personaIdHint });
 *   2. <PersonaSpineGate state={spine}> ...your render... </PersonaSpineGate>
 *   3. For data fetches: personaFetch('/api/...', { personaIdHint });
 *
 * See docs/architecture/persona-spine-client-protocol.md
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  usePersonaSpine,
  personaFetch,
  PersonaSpineGate,
} from "@/utils/personaSpine";
import {
  ExperienceModelCard,
  type ExperienceModelCardData,
} from "@/components/metame/cards/ExperienceModelCard";
import { IqubeContextDisclosure } from "@/components/metame/cards/IqubeContextDisclosure";
import { ExperienceModelSetupWizard } from "@/components/metame/setup/ExperienceModelSetupWizard";
import { BriefCard, type BriefCardData } from "@/components/metame/cards/BriefCard";
import {
  VentureProgressCard,
  type VentureProgressData,
} from "@/components/metame/cards/VentureProgressCard";
import {
  NextBestActionCard,
  type NextBestActionData,
} from "@/components/metame/cards/NextBestActionCard";
import {
  ApprovalCard,
  type ApprovalCardAction,
} from "@/components/metame/cards/ApprovalCard";
import {
  SpecialistResponseCard,
  type SpecialistResponseData,
} from "@/components/metame/cards/SpecialistResponseCard";
import { ArtifactCard, type ArtifactCardData } from "@/components/metame/cards/ArtifactCard";
import { SecondTierApprovalCard } from "@/components/metame/cards/SecondTierApprovalCard";
import { ActivityReceiptCard, type ActivityReceiptData } from "@/components/metame/cards/ActivityReceiptCard";
import { QuickLinksCard } from "@/components/metame/cards/QuickLinksCard";
import { GoogleConnectionsPanel } from "@/components/metame/connections/GoogleConnectionsPanel";
import { ComposeGmailDraftModal } from "@/components/metame/connections/ComposeGmailDraftModal";
import { ComposeCalendarEventModal } from "@/components/metame/connections/ComposeCalendarEventModal";
import { ComposeGoogleDocModal } from "@/components/metame/connections/ComposeGoogleDocModal";
import { ComposeSlidesModal } from "@/components/metame/connections/ComposeSlidesModal";
import { ComposeMarketaEmailModal } from "@/components/metame/connections/ComposeMarketaEmailModal";

interface Specialist {
  id: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c' | 'aigent-nakamoto';
  label: string;
  description: string;
  homeCartridge: 'cross-cutting' | 'qriptopian' | 'knyt' | 'platform' | 'protocol';
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

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
  isPartner?: boolean;
  personaId?: string;
  density?: 'narrow' | 'wide';
}

// Static context chips (PRD §9.1). Not part of bootstrap because they're
// always shown — adding/removing chips is a code change, not a runtime one.
const CONTEXT_CHIPS = [
  'metaMe',
  'KNYT',
  'The Qriptopian',
  'Marketa',
  'AVL',
  'Metayé Media',
  'Google Workspace',
];

export function AigentMeWelcomeTab({ theme = 'dark', personaId }: Props) {
  const spine = usePersonaSpine({ personaIdHint: personaId });
  const [data, setData] = useState<BootstrapSurface | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  // Phase 2.b — ExperienceQube state, fetched once spine is ready.
  const [expModel, setExpModel] = useState<ExperienceModelCardData | null>(null);
  const [expModelLoading, setExpModelLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Phase 3 — brief + move-forward state.
  const [brief, setBrief] = useState<BriefCardData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [moveForwardCartridgeOpen, setMoveForwardCartridgeOpen] = useState(false);
  const [moveForwardResult, setMoveForwardResult] = useState<{
    cartridge: string;
    topAction: NextBestActionData | null;
    alternates: NextBestActionData[];
  } | null>(null);
  const [moveForwardLoading, setMoveForwardLoading] = useState(false);

  // Phase 4 — Venture Progress state.
  const [ventureProgress, setVentureProgress] = useState<VentureProgressData | null>(null);
  const [ventureProgressLoading, setVentureProgressLoading] = useState(false);
  const [ventureProgressError, setVentureProgressError] = useState<string | null>(null);

  // Phase 5 — Specialist responses keyed by nbeId. One specialist call per
  // queued approval; the card stays visible until dismissed.
  const [specialistResponses, setSpecialistResponses] = useState<Record<string, SpecialistResponseData>>({});
  const [specialistLoading, setSpecialistLoading] = useState<Record<string, boolean>>({});
  const [specialistErrors, setSpecialistErrors] = useState<Record<string, string>>({});

  // Phase 6 — created artifacts (alpha: runtime-destination only).
  // Phase 6.b — Artifacts list is restored from sessionStorage on mount so
  // the user keeps their working drafts when navigating away and back to
  // the tab. Keyed by personaId so a persona switch doesn't bleed state.
  // sessionStorage is intentional: clears on browser close (no stale
  // drafts), survives tab navigation. Per the metaMe client protocol the
  // only fields here are T1-safe (artifact ids, titles, action connector
  // hints, public locationUrl) — no personaId, authProfileId, or rootDid.
  const [artifacts, setArtifacts] = useState<ArtifactCardData[]>(() => {
    if (typeof window === 'undefined' || !personaId) return [];
    try {
      const raw = window.sessionStorage.getItem(`aigentme:artifacts:${personaId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ArtifactCardData[]) : [];
    } catch {
      return [];
    }
  });

  // Persist artifacts on every change. Cheap JSON write keyed by persona.
  useEffect(() => {
    if (typeof window === 'undefined' || !personaId) return;
    try {
      window.sessionStorage.setItem(
        `aigentme:artifacts:${personaId}`,
        JSON.stringify(artifacts),
      );
    } catch {
      // Quota exceeded or storage disabled — silently degrade.
    }
  }, [artifacts, personaId]);

  // Phase 6.b Part 2.5 — externalisation state. One artifact at a time can
  // be in flight (pending second-tier approval or running). Errors render
  // inline on the artifact card.
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

  // Phase 6.b Part 2.5b — Compose Gmail draft modal. Lets the user
  // originate a Gmail-destination artifact from the welcome surface
  // without a specialist round-trip or curl.
  const [composeGmailOpen, setComposeGmailOpen] = useState(false);

  // Phase 6.b Part 2.5c — Compose Calendar event modal. Same chief-of-
  // staff pattern: drafter strip + form fields.
  const [composeCalendarOpen, setComposeCalendarOpen] = useState(false);
  const [composeDocOpen, setComposeDocOpen] = useState(false);
  const [composeSlidesOpen, setComposeSlidesOpen] = useState(false);
  const [composeMarketaOpen, setComposeMarketaOpen] = useState(false);

  // Phase 7 — activity receipts panel.
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  // Phase 6.b — T1-safe persona display label echoed by the receipts
  // endpoint. Never personaId / authProfileId / rootDid.
  const [receiptsPersonaLabel, setReceiptsPersonaLabel] = useState<string | null>(null);

  // Phase 3.5 — Approval + IntentQube state. Single pending-approval slot
  // at a time; queued intents are remembered per nbeId so the user can see
  // which actions were already submitted.
  const [pendingApprovalNbe, setPendingApprovalNbe] =
    useState<NextBestActionData | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [queuedIntents, setQueuedIntents] = useState<
    Record<string, { intentId: string; status: string; queueMessage: string }>
  >({});

  // Only fetch the bootstrap surface once the spine is ready. The spine's
  // own auth gate (PersonaSpineGate below) handles the loading /
  // unauthenticated / error states for persona resolution itself.
  useEffect(() => {
    if (spine.status !== 'ready' && spine.status !== 'refreshing') return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    setBootstrapLoading(true);
    setBootstrapError(null);

    personaFetch('/api/assistant/bootstrap', {
      personaIdHint: personaId,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `bootstrap failed (${res.status})`);
        }
        return res.json() as Promise<BootstrapSurface>;
      })
      .then((surface) => {
        if (!cancelled) setData(surface);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setBootstrapError(msg);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setBootstrapLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [spine.status, personaId]);

  // Fetch ExperienceQube state in parallel with bootstrap.
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
    return () => { cancelled = true; };
  }, [spine.status, personaId]);

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
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `brief failed (${res.status})`);
      }
      const data = (await res.json()) as BriefCardData;
      setBrief(data);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : String(err));
    } finally {
      setBriefLoading(false);
    }
  }, [personaId]);

  /**
   * Move-forward fetch.
   *
   * - No `cartridge` arg → auto-pick mode: server returns the strongest NBE
   *   across the user's active cartridges (default behaviour when the user
   *   clicks "Move this forward").
   * - `cartridge` arg → steering mode: re-fetch scoped to one cartridge
   *   (used by the "Switch cartridge" strip below the hero card).
   */
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
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `move-forward failed (${res.status})`);
      }
      const data = (await res.json()) as {
        cartridge: string;
        topAction: NextBestActionData | null;
        alternates: NextBestActionData[];
      };
      setMoveForwardResult(data);
    } catch {
      // Surface failures inline; keep welcome usable.
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
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `venture-progress failed (${res.status})`);
      }
      const data = (await res.json()) as VentureProgressData;
      setVentureProgress(data);
    } catch (err) {
      setVentureProgressError(err instanceof Error ? err.message : String(err));
    } finally {
      setVentureProgressLoading(false);
    }
  }, [personaId]);

  const handleCtaClick = useCallback((ctaId: string) => {
    if (ctaId === 'set-up-experience-model') {
      setWizardOpen(true);
      return;
    }
    if (ctaId === 'brief-me') {
      void fetchBrief();
      return;
    }
    if (ctaId === 'move-this-forward') {
      // Open the section + fire the auto-pick fetch immediately. No picker
      // step — Aigent Me decides the cartridge from the ExperienceQube.
      setMoveForwardCartridgeOpen(true);
      void fetchMoveForward();
      return;
    }
    if (ctaId === 'review-venture-progress') {
      void fetchVentureProgress();
      return;
    }
    // Remaining CTAs (create-something, coordinate-follow-ups, ask-*) stay
    // in 'preview' state until Phases 5/6 wire specialist routing + artifact
    // creation paths.
  }, [fetchBrief, fetchMoveForward, fetchVentureProgress]);

  const handleWizardSaved = useCallback((saved: ExperienceModelCardData) => {
    setExpModel(saved);
  }, []);

  // Phase 3.5 — clicking Act on any NBE opens the ApprovalCard.
  const handleNbeAct = useCallback((action: NextBestActionData) => {
    // If this NBE is already queued, dismiss + re-queue is a no-op for alpha;
    // just no-op so the user sees the queued state stays.
    if (queuedIntents[action.id]) return;
    setApprovalError(null);
    setPendingApprovalNbe(action);
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
        body: JSON.stringify({
          nbeId: action.id,
          cartridge: action.cartridge,
        }),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `intent create failed (${res.status})`);
      }
      const data = (await res.json()) as {
        intentId: string;
        status: string;
        queueMessage: string;
      };
      setQueuedIntents((prev) => ({
        ...prev,
        [action.id]: {
          intentId: data.intentId,
          status: data.status,
          queueMessage: data.queueMessage,
        },
      }));
      // Clear the pending slot; the queued card will replace it inline.
      setPendingApprovalNbe(null);

      // Phase 5 — if the NBE names a specialist, auto-fire the specialist
      // consultation. The SpecialistResponseCard renders inline.
      if (action.specialist) {
        const nbeId = action.id;
        const specialistId = action.specialist;
        setSpecialistLoading((prev) => ({ ...prev, [nbeId]: true }));
        setSpecialistErrors((prev) => {
          const next = { ...prev };
          delete next[nbeId];
          return next;
        });
        void (async () => {
          try {
            const res = await personaFetch('/api/assistant/ask-agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                specialistId,
                intentId: data.intentId,
                cartridge: action.cartridge,
              }),
              personaIdHint: personaId,
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
              throw new Error(body?.detail || body?.error || `ask-agent failed (${res.status})`);
            }
            const sp = (await res.json()) as SpecialistResponseData;
            setSpecialistResponses((prev) => ({ ...prev, [nbeId]: sp }));
          } catch (err) {
            setSpecialistErrors((prev) => ({
              ...prev,
              [nbeId]: err instanceof Error ? err.message : String(err),
            }));
          } finally {
            setSpecialistLoading((prev) => {
              const next = { ...prev };
              delete next[nbeId];
              return next;
            });
          }
        })();
      }
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingApproval(false);
    }
  }, [pendingApprovalNbe, personaId]);

  // Phase 6 — create an artifact from a specialist's suggested chip.
  const handleCreateArtifact = useCallback(async (
    artifactType: string,
    opts: { sourceIntentId?: string; specialistId?: string } = {},
  ) => {
    try {
      const res = await personaFetch('/api/assistant/create-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactType,
          sourceIntentId: opts.sourceIntentId,
          specialistId: opts.specialistId,
          destination: 'runtime',
        }),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `create-artifact failed (${res.status})`);
      }
      const data = (await res.json()) as ArtifactCardData;
      setArtifacts((prev) => [data, ...prev].slice(0, 10));
    } catch (err) {
      // Surface inline as a 'failed' artifact card so the user sees it.
      const msg = err instanceof Error ? err.message : String(err);
      setArtifacts((prev) =>
        [
          {
            artifactId: `err_${Date.now()}`,
            artifactType,
            title: `Failed: ${msg}`,
            destination: 'runtime',
            status: 'draft',
            receiptId: null,
            intentId: opts.sourceIntentId ?? null,
            createdAt: new Date().toISOString(),
          } as ArtifactCardData,
          ...prev,
        ].slice(0, 10),
      );
    }
  }, [personaId]);

  // Phase 6.b Part 2.5b — Aigent Me drafts an email from a one-line prompt.
  // The route assembles T1-safe context (ExperienceQube meta + intent
  // name) and calls OpenAI live (or the deterministic template fallback).
  const handleDraftEmail = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      throw new Error(body?.detail || body?.error || `draft-email failed (${res.status})`);
    }
    return (await res.json()) as {
      to: string;
      cc: string;
      bcc: string;
      subject: string;
      bodyText: string;
      rationale: string;
      source: 'llm' | 'template';
    };
  }, [personaId]);

  // Phase 6.b Part 2.5b — Compose Gmail draft → POST create-artifact with
  // destination='gmail'. The route eager-creates a real Gmail draft via
  // the gmail.draft connector and returns an ArtifactCardData carrying
  // the gmail.send connector binding for the Send button.
  const handleComposeGmailDraft = useCallback(async (input: {
    to: string;
    subject: string;
    bodyText: string;
    cc?: string;
    bcc?: string;
  }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'gmail-draft',
        destination: 'gmail',
        title: input.subject,
        connectorInput: input,
      }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string; hint?: string }));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData;
    setArtifacts((prev) => [data, ...prev].slice(0, 10));
  }, [personaId]);

  // Phase 6.b Part 2.5c — Calendar event drafter + creator.
  const handleDraftEvent = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      throw new Error(body?.detail || body?.error || `draft-event failed (${res.status})`);
    }
    return (await res.json()) as {
      summary: string;
      description: string;
      startIso: string;
      endIso: string;
      timeZone: string;
      attendeeEmails: string[];
      rationale: string;
      source: 'llm' | 'template';
    };
  }, [personaId]);

  const handleComposeCalendarEvent = useCallback(async (input: {
    summary: string;
    description: string;
    startIso: string;
    endIso: string;
    timeZone: string;
    attendeeEmails: string[];
  }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'calendar-block',
        destination: 'calendar',
        title: input.summary,
        connectorInput: input,
      }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string; hint?: string }));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData;
    setArtifacts((prev) => [data, ...prev].slice(0, 10));
  }, [personaId]);

  // Phase 6.b Part 2.5c — Google Doc drafter + creator.
  const handleDraftDoc = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      throw new Error(body?.detail || body?.error || `draft-doc failed (${res.status})`);
    }
    return (await res.json()) as {
      title: string;
      bodyText: string;
      shareSuggestions: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }>;
      rationale: string;
      source: 'llm' | 'template';
    };
  }, [personaId]);

  const handleComposeGoogleDoc = useCallback(async (input: {
    title: string;
    bodyText: string;
    shareSuggestions: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }>;
  }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'google-doc',
        destination: 'drive',
        title: input.title,
        connectorInput: input,
      }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string; hint?: string }));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData;
    setArtifacts((prev) => [data, ...prev].slice(0, 10));
  }, [personaId]);

  // Phase 6.b Part 2.5c — Slides drafter + creator.
  const handleDraftSlides = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      throw new Error(body?.detail || body?.error || `draft-slides failed (${res.status})`);
    }
    return (await res.json()) as {
      title: string;
      outline: string[];
      sections: Array<{ title: string; bullets: string[]; diagramConcept?: string }>;
      rationale: string;
      source: 'llm' | 'template';
    };
  }, [personaId]);

  const handleComposeSlides = useCallback(async (input: {
    title: string;
    outline: string[];
    sections?: Array<{ title: string; bullets: string[]; diagramConcept?: string }>;
  }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'slide-outline',
        destination: 'drive',
        title: input.title,
        connectorInput: input,
      }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string; hint?: string }));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData;
    setArtifacts((prev) => [data, ...prev].slice(0, 10));
  }, [personaId]);

  // Phase 6.b Part 3 — Marketa email drafter + compose. Sends via Mailjet
  // through the existing /api/connectors/execute path (marketa.send-
  // transactional connector), gated by the SecondTierApprovalCard.
  const handleDraftMarketa = useCallback(async (prompt: string) => {
    const res = await personaFetch('/api/assistant/draft-marketa-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      throw new Error(body?.detail || body?.error || `draft-marketa-email failed (${res.status})`);
    }
    return (await res.json()) as {
      to: string;
      cc: string;
      bcc: string;
      subject: string;
      bodyText: string;
      rationale: string;
      source: 'llm' | 'template';
    };
  }, [personaId]);

  const handleComposeMarketa = useCallback(async (input: {
    to: string;
    subject: string;
    bodyText: string;
    cc?: string;
    bcc?: string;
    fromName?: string;
  }) => {
    const res = await personaFetch('/api/assistant/create-artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'marketa-email',
        destination: 'runtime',
        title: input.subject,
        connectorInput: input,
      }),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string; hint?: string }));
      throw new Error(body?.detail || body?.hint || body?.error || `create-artifact failed (${res.status})`);
    }
    const data = (await res.json()) as ArtifactCardData;
    setArtifacts((prev) => [data, ...prev].slice(0, 10));
  }, [personaId]);

  const handleDismissArtifact = useCallback((artifactId: string) => {
    setArtifacts((prev) => prev.filter((a) => a.artifactId !== artifactId));
    setActionErrors((prev) => {
      if (!(artifactId in prev)) return prev;
      const next = { ...prev };
      delete next[artifactId];
      return next;
    });
  }, []);

  // Phase 6.b Part 2.5 — externalise an artifact via its bound connector.
  // Flow:
  //   1. POST /api/connectors/execute with the artifact's actionConnectorId.
  //   2. If the route returns code='requires-approval', surface the
  //      SecondTierApprovalCard for this artifact and wait for the user.
  //   3. On approve, retry execute with a fresh approvalToken (a UUID for
  //      alpha; signed-receipt hardening lands with Part 4).
  //   4. On success, flip the artifact status to 'sent' and dismiss the
  //      approval card.
  const executeArtifactAction = useCallback(async (
    artifact: ArtifactCardData,
    approvalToken?: string,
  ): Promise<void> => {
    if (!artifact.actionConnectorId) return;
    setActionPendingArtifactId(artifact.artifactId);
    setActionErrors((prev) => {
      if (!(artifact.artifactId in prev)) return prev;
      const next = { ...prev };
      delete next[artifact.artifactId];
      return next;
    });
    try {
      const res = await personaFetch('/api/connectors/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        // Surface the second-tier approval card next to the artifact.
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
      // Success — flip status to sent and clear the second-tier card.
      setArtifacts((prev) =>
        prev.map((a) =>
          a.artifactId === artifact.artifactId ? { ...a, status: 'sent' } : a,
        ),
      );
      setSecondTierApproval((prev) =>
        prev && prev.artifactId === artifact.artifactId ? null : prev,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionErrors((prev) => ({ ...prev, [artifact.artifactId]: msg }));
      if (secondTierApproval && secondTierApproval.artifactId === artifact.artifactId) {
        setSecondTierApproval({ ...secondTierApproval, submitting: false, error: msg });
      }
    } finally {
      setActionPendingArtifactId(null);
    }
  }, [personaId, secondTierApproval]);

  const handleSendArtifact = useCallback((artifactId: string) => {
    const artifact = artifacts.find((a) => a.artifactId === artifactId);
    if (!artifact) return;
    void executeArtifactAction(artifact);
  }, [artifacts, executeArtifactAction]);

  const handleApproveSecondTier = useCallback(() => {
    if (!secondTierApproval) return;
    const artifact = artifacts.find((a) => a.artifactId === secondTierApproval.artifactId);
    if (!artifact) return;
    // Phase 6.b Part 4 — request a signed approvalToken from the server
    // bound to (personaId, connectorId, 5-min expiry). The execute route
    // verifies the HMAC + persona match + connector match before running.
    setSecondTierApproval({ ...secondTierApproval, submitting: true, error: null });
    void (async () => {
      try {
        const res = await personaFetch('/api/assistant/approve-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  const handleCancelSecondTier = useCallback(() => {
    setSecondTierApproval(null);
  }, []);

  // Phase 7 — receipts panel.
  const fetchReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const res = await personaFetch('/api/assistant/receipts?limit=25', {
        personaIdHint: personaId,
      });
      if (!res.ok) throw new Error(`receipts fetch failed (${res.status})`);
      const data = (await res.json()) as {
        receipts: ActivityReceiptData[];
        count: number;
        personaDisplayLabel: string | null;
      };
      setReceipts(data.receipts ?? []);
      setReceiptsPersonaLabel(data.personaDisplayLabel ?? null);
    } catch {
      setReceipts([]);
      setReceiptsPersonaLabel(null);
    } finally {
      setReceiptsLoading(false);
    }
  }, [personaId]);

  const toggleReceipts = useCallback(() => {
    setReceiptsOpen((open) => {
      const next = !open;
      if (next) void fetchReceipts();
      return next;
    });
  }, [fetchReceipts]);

  const handleDismissSpecialist = useCallback((nbeId: string) => {
    setSpecialistResponses((prev) => {
      const next = { ...prev };
      delete next[nbeId];
      return next;
    });
    setSpecialistErrors((prev) => {
      const next = { ...prev };
      delete next[nbeId];
      return next;
    });
  }, []);

  const handleDismissQueued = useCallback((nbeId: string) => {
    setQueuedIntents((prev) => {
      const next = { ...prev };
      delete next[nbeId];
      return next;
    });
  }, []);

  const isDark = theme === 'dark';
  const surfaceClass = isDark
    ? 'bg-slate-900/40 border-slate-700/60 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const accentClass = isDark ? 'text-violet-300' : 'text-violet-700';
  const chipClass = isDark
    ? 'bg-slate-800/60 border-slate-700 text-slate-200'
    : 'bg-slate-100 border-slate-200 text-slate-700';

  // ── Persona-spine gate handles idle / loading / unauth / error states.
  return (
    <>
      <PersonaSpineGate state={spine}>
        <AigentMeWelcomeBody
          personaId={personaId}
          data={data}
          bootstrapLoading={bootstrapLoading}
          bootstrapError={bootstrapError}
          spineDisplayLabel={spine.displayLabel}
          expModel={expModel}
          expModelLoading={expModelLoading}
          brief={brief}
          briefLoading={briefLoading}
          briefError={briefError}
          moveForwardCartridgeOpen={moveForwardCartridgeOpen}
          moveForwardResult={moveForwardResult}
          moveForwardLoading={moveForwardLoading}
          onPickMoveForwardCartridge={fetchMoveForward}
          ventureProgress={ventureProgress}
          ventureProgressLoading={ventureProgressLoading}
          ventureProgressError={ventureProgressError}
          onCtaClick={handleCtaClick}
          pendingApprovalNbe={pendingApprovalNbe}
          submittingApproval={submittingApproval}
          approvalError={approvalError}
          queuedIntents={queuedIntents}
          onNbeAct={handleNbeAct}
          onApprovalApprove={handleApprovalApprove}
          onApprovalCancel={handleApprovalCancel}
          onDismissQueued={handleDismissQueued}
          specialistResponses={specialistResponses}
          specialistLoading={specialistLoading}
          specialistErrors={specialistErrors}
          onDismissSpecialist={handleDismissSpecialist}
          artifacts={artifacts}
          onCreateArtifact={handleCreateArtifact}
          onDismissArtifact={handleDismissArtifact}
          actionPendingArtifactId={actionPendingArtifactId}
          actionErrors={actionErrors}
          secondTierApproval={secondTierApproval}
          onSendArtifact={handleSendArtifact}
          onApproveSecondTier={handleApproveSecondTier}
          onCancelSecondTier={handleCancelSecondTier}
          composeGmailOpen={composeGmailOpen}
          onComposeGmailOpenChange={setComposeGmailOpen}
          onComposeGmailDraft={handleComposeGmailDraft}
          onDraftEmail={handleDraftEmail}
          composeCalendarOpen={composeCalendarOpen}
          onComposeCalendarOpenChange={setComposeCalendarOpen}
          onComposeCalendarEvent={handleComposeCalendarEvent}
          onDraftEvent={handleDraftEvent}
          composeDocOpen={composeDocOpen}
          onComposeDocOpenChange={setComposeDocOpen}
          onComposeGoogleDoc={handleComposeGoogleDoc}
          onDraftDoc={handleDraftDoc}
          composeSlidesOpen={composeSlidesOpen}
          onComposeSlidesOpenChange={setComposeSlidesOpen}
          onComposeSlides={handleComposeSlides}
          onDraftSlides={handleDraftSlides}
          composeMarketaOpen={composeMarketaOpen}
          onComposeMarketaOpenChange={setComposeMarketaOpen}
          onComposeMarketa={handleComposeMarketa}
          onDraftMarketa={handleDraftMarketa}
          receipts={receipts}
          receiptsLoading={receiptsLoading}
          receiptsOpen={receiptsOpen}
          onToggleReceipts={toggleReceipts}
          receiptsPersonaLabel={receiptsPersonaLabel}
          theme={theme}
          surfaceClass={surfaceClass}
          mutedClass={mutedClass}
          accentClass={accentClass}
          chipClass={chipClass}
          isDark={isDark}
        />
      </PersonaSpineGate>
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
    </>
  );
}

/**
 * Project an NBE into the shape ApprovalCard expects. Cheap pure helper —
 * lives here because no other surface needs it yet.
 */
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

interface BodyProps {
  personaId?: string;
  data: BootstrapSurface | null;
  bootstrapLoading: boolean;
  bootstrapError: string | null;
  spineDisplayLabel: string | null;
  expModel: ExperienceModelCardData | null;
  expModelLoading: boolean;
  brief: BriefCardData | null;
  briefLoading: boolean;
  briefError: string | null;
  moveForwardCartridgeOpen: boolean;
  moveForwardResult: { cartridge: string; topAction: NextBestActionData | null; alternates: NextBestActionData[] } | null;
  moveForwardLoading: boolean;
  onPickMoveForwardCartridge: (cartridge: string) => void;
  ventureProgress: VentureProgressData | null;
  ventureProgressLoading: boolean;
  ventureProgressError: string | null;
  onCtaClick: (ctaId: string) => void;
  pendingApprovalNbe: NextBestActionData | null;
  submittingApproval: boolean;
  approvalError: string | null;
  queuedIntents: Record<string, { intentId: string; status: string; queueMessage: string }>;
  onNbeAct: (action: NextBestActionData) => void;
  onApprovalApprove: () => void;
  onApprovalCancel: () => void;
  onDismissQueued: (nbeId: string) => void;
  specialistResponses: Record<string, SpecialistResponseData>;
  specialistLoading: Record<string, boolean>;
  specialistErrors: Record<string, string>;
  onDismissSpecialist: (nbeId: string) => void;
  artifacts: ArtifactCardData[];
  onCreateArtifact: (artifactType: string, opts?: { sourceIntentId?: string; specialistId?: string }) => void;
  onDismissArtifact: (artifactId: string) => void;
  // Phase 6.b Part 2.5 — artifact externalisation.
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
  onSendArtifact: (artifactId: string) => void;
  onApproveSecondTier: () => void;
  onCancelSecondTier: () => void;
  composeGmailOpen: boolean;
  onComposeGmailOpenChange: (open: boolean) => void;
  onComposeGmailDraft: (input: { to: string; subject: string; bodyText: string; cc?: string; bcc?: string }) => Promise<void>;
  onDraftEmail: (prompt: string) => Promise<{
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    bodyText: string;
    rationale: string;
    source: 'llm' | 'template';
  }>;
  composeCalendarOpen: boolean;
  onComposeCalendarOpenChange: (open: boolean) => void;
  onComposeCalendarEvent: (input: {
    summary: string;
    description: string;
    startIso: string;
    endIso: string;
    timeZone: string;
    attendeeEmails: string[];
  }) => Promise<void>;
  onDraftEvent: (prompt: string) => Promise<{
    summary: string;
    description: string;
    startIso: string;
    endIso: string;
    timeZone: string;
    attendeeEmails: string[];
    rationale: string;
    source: 'llm' | 'template';
  }>;
  composeDocOpen: boolean;
  onComposeDocOpenChange: (open: boolean) => void;
  onComposeGoogleDoc: (input: {
    title: string;
    bodyText: string;
    shareSuggestions: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }>;
  }) => Promise<void>;
  onDraftDoc: (prompt: string) => Promise<{
    title: string;
    bodyText: string;
    shareSuggestions: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }>;
    rationale: string;
    source: 'llm' | 'template';
  }>;
  composeSlidesOpen: boolean;
  onComposeSlidesOpenChange: (open: boolean) => void;
  onComposeSlides: (input: {
    title: string;
    outline: string[];
    sections?: Array<{ title: string; bullets: string[]; diagramConcept?: string }>;
  }) => Promise<void>;
  onDraftSlides: (prompt: string) => Promise<{
    title: string;
    outline: string[];
    sections: Array<{ title: string; bullets: string[]; diagramConcept?: string }>;
    rationale: string;
    source: 'llm' | 'template';
  }>;
  composeMarketaOpen: boolean;
  onComposeMarketaOpenChange: (open: boolean) => void;
  onComposeMarketa: (input: {
    to: string;
    subject: string;
    bodyText: string;
    cc?: string;
    bcc?: string;
    fromName?: string;
  }) => Promise<void>;
  onDraftMarketa: (prompt: string) => Promise<{
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    bodyText: string;
    rationale: string;
    source: 'llm' | 'template';
  }>;
  receipts: ActivityReceiptData[];
  receiptsLoading: boolean;
  receiptsOpen: boolean;
  onToggleReceipts: () => void;
  /** T1-safe persona display label echoed by the receipts endpoint. */
  receiptsPersonaLabel: string | null;
  theme: 'light' | 'dark';
  surfaceClass: string;
  mutedClass: string;
  accentClass: string;
  chipClass: string;
  isDark: boolean;
}

function AigentMeWelcomeBody({
  personaId,
  data,
  bootstrapLoading,
  bootstrapError,
  spineDisplayLabel,
  expModel,
  expModelLoading,
  brief,
  briefLoading,
  briefError,
  moveForwardCartridgeOpen,
  moveForwardResult,
  moveForwardLoading,
  onPickMoveForwardCartridge,
  ventureProgress,
  ventureProgressLoading,
  ventureProgressError,
  onCtaClick,
  pendingApprovalNbe,
  submittingApproval,
  approvalError,
  queuedIntents,
  onNbeAct,
  onApprovalApprove,
  onApprovalCancel,
  onDismissQueued,
  specialistResponses,
  specialistLoading,
  specialistErrors,
  onDismissSpecialist,
  artifacts,
  onCreateArtifact,
  onDismissArtifact,
  actionPendingArtifactId,
  actionErrors,
  secondTierApproval,
  onSendArtifact,
  onApproveSecondTier,
  onCancelSecondTier,
  composeGmailOpen,
  onComposeGmailOpenChange,
  onComposeGmailDraft,
  onDraftEmail,
  composeCalendarOpen,
  onComposeCalendarOpenChange,
  onComposeCalendarEvent,
  onDraftEvent,
  composeDocOpen,
  onComposeDocOpenChange,
  onComposeGoogleDoc,
  onDraftDoc,
  composeSlidesOpen,
  onComposeSlidesOpenChange,
  onComposeSlides,
  onDraftSlides,
  composeMarketaOpen,
  onComposeMarketaOpenChange,
  onComposeMarketa,
  onDraftMarketa,
  receipts,
  receiptsLoading,
  receiptsOpen,
  onToggleReceipts,
  receiptsPersonaLabel,
  theme,
  surfaceClass,
  mutedClass,
  accentClass,
  chipClass,
  isDark,
}: BodyProps) {
  const moveForwardSectionRef = useRef<HTMLElement | null>(null);

  // When the move-forward section opens, scroll it into view so the user
  // sees Aigent Me's hero recommendation immediately. Without this, the
  // section can appear below the fold and look like a no-op click.
  useEffect(() => {
    if (moveForwardCartridgeOpen && moveForwardSectionRef.current) {
      moveForwardSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [moveForwardCartridgeOpen]);

  if (bootstrapLoading && !data) {
    return (
      <div className="p-10 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
        <span className={mutedClass}>Bringing aigentMe online…</span>
      </div>
    );
  }

  if (bootstrapError && !data) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className={`rounded-lg border p-6 ${surfaceClass}`}>
          <h3 className="font-semibold mb-1">aigentMe bootstrap failed</h3>
          <p className={`text-sm ${mutedClass}`}>{bootstrapError}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Prefer the spine's displayLabel (single source of truth across surfaces);
  // fall back to the bootstrap copy if for some reason it differs.
  const greetingName = (spineDisplayLabel || data.displayLabel || '').trim();
  const usingIqubes: ('PersonaQube' | 'ExperienceQube' | 'IntentQube')[] =
    expModel?.configured ? ['PersonaQube', 'ExperienceQube'] : ['PersonaQube'];

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header — product label + greeting */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-5 h-5 ${accentClass}`} />
          <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
            {data.naming.productLabel}
          </span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-semibold leading-tight">
          {greetingName ? `Welcome back, ${greetingName}.` : 'Welcome back.'}
        </h1>
        <p className={`max-w-2xl ${mutedClass}`}>
          I can help you brief your day, guide your experience strategy, move
          your cartridges forward, create artifacts, coordinate trusted
          agents, and track progress.
        </p>
      </header>

      {/* iQube context disclosure — what's being used right now */}
      <IqubeContextDisclosure using={usingIqubes} theme={theme} />

      {/* Pending approval (single slot) — appears whenever the user clicks
          Act on any NBE. Approve creates an IntentQube row; the queued
          state replaces the pending one inline. */}
      {pendingApprovalNbe && (
        <ApprovalCard
          action={toApprovalAction(pendingApprovalNbe)}
          submitting={submittingApproval}
          queued={null}
          error={approvalError}
          onApprove={onApprovalApprove}
          onCancel={onApprovalCancel}
          onEdit={() => { /* Phase 6 */ }}
          using={usingIqubes}
          theme={theme}
        />
      )}

      {/* Queued intents — chip-sized confirmations stack here until dismissed */}
      {Object.keys(queuedIntents).length > 0 && (
        <section className="space-y-2">
          {Object.entries(queuedIntents).map(([nbeId, queued]) => (
            <ApprovalCard
              key={nbeId}
              action={{
                nbeId,
                label: nbeId,
                rationale: '',
                cartridge: 'metame',
                approvalRequired: false,
                specialist: null,
                suggestedArtifact: null,
              }}
              queued={queued}
              onApprove={() => { /* not used in queued state */ }}
              onCancel={() => onDismissQueued(nbeId)}
              using={usingIqubes}
              theme={theme}
            />
          ))}
        </section>
      )}

      {/* Specialist responses — Phase 5. Cards render inline once a queued
          NBE with a specialist returns from /api/assistant/ask-agent. */}
      {(Object.keys(specialistResponses).length > 0 ||
        Object.keys(specialistLoading).length > 0 ||
        Object.keys(specialistErrors).length > 0) && (
        <section className="space-y-2">
          {Object.keys({ ...specialistResponses, ...specialistLoading, ...specialistErrors }).map((nbeId) => {
            const sp = specialistResponses[nbeId] ?? null;
            const isLoading = !!specialistLoading[nbeId];
            const err = specialistErrors[nbeId] ?? null;
            const intentId = queuedIntents[nbeId]?.intentId;
            return (
              <SpecialistResponseCard
                key={nbeId}
                data={sp}
                loading={isLoading}
                error={err}
                using={usingIqubes}
                onDismiss={() => onDismissSpecialist(nbeId)}
                onCreateArtifact={
                  sp
                    ? (artifactType) =>
                        onCreateArtifact(artifactType, {
                          sourceIntentId: intentId,
                          specialistId: sp.specialistId,
                        })
                    : undefined
                }
                theme={theme}
              />
            );
          })}
        </section>
      )}

      {/* Artifacts — Phase 6. Stack of recently-created runtime-destination
          artifacts. Phase 6.b Part 2.5 — Gmail-destination artifacts carry
          an externalisation button (Send) gated by SecondTierApprovalCard. */}
      {artifacts.length > 0 && (
        <section className="space-y-2">
          <h2 className={`text-xs uppercase tracking-wider ${mutedClass}`}>
            Artifacts
          </h2>
          {artifacts.map((a) => (
            <React.Fragment key={a.artifactId}>
              <ArtifactCard
                data={a}
                onDismiss={() => onDismissArtifact(a.artifactId)}
                onAction={a.actionConnectorId ? () => onSendArtifact(a.artifactId) : undefined}
                actionPending={actionPendingArtifactId === a.artifactId}
                actionError={actionErrors[a.artifactId] ?? null}
                theme={theme}
              />
              {secondTierApproval?.artifactId === a.artifactId && (
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
            </React.Fragment>
          ))}
        </section>
      )}

      {/* Receipts panel — Phase 7. Collapsible. */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-xs uppercase tracking-wider ${mutedClass}`}>
            Recent activity
          </h2>
          <button
            onClick={onToggleReceipts}
            className={`text-xs px-2 py-1 rounded border ${chipClass}`}
          >
            {receiptsOpen ? 'Hide receipts' : 'Show receipts'}
          </button>
        </div>
        {receiptsOpen && (
          <div className="space-y-2">
            {receiptsLoading ? (
              <p className={`text-sm ${mutedClass}`}>Loading receipts…</p>
            ) : receipts.length === 0 ? (
              <p className={`text-sm ${mutedClass}`}>
                No receipts yet. Acting on any NBE will produce one.
              </p>
            ) : (
              receipts.map((r) => (
                <ActivityReceiptCard key={r.id} data={r} personaDisplayLabel={receiptsPersonaLabel} theme={theme} />
              ))
            )}
          </div>
        )}
      </section>

      {/* ExperienceModel card */}
      <ExperienceModelCard
        data={expModel}
        loading={expModelLoading}
        onEdit={() => onCtaClick('set-up-experience-model')}
        theme={theme}
      />

      {/* Quick links — deep-link into the cartridges and tabs the user
          works in most. PersonaId travels with every link via buildCodexUrl. */}
      <QuickLinksCard personaId={personaId} theme={theme} />

      {/* Google Workspace connections — Phase 6.b. Per-source opt-in.
          Renders an operator-action diagnostic for admins when env vars
          aren't set yet; a neutral "coming soon" notice for non-admins. */}
      <GoogleConnectionsPanel
        isAdmin={!!data.cartridgeFlags?.isAdmin}
        theme={theme}
      />

      {/* Phase 6.b Part 2.5b — Compose Gmail draft entry point. The route
          gates on persona connection state; clicking without a connected
          Gmail account surfaces the connector's "not-connected" message
          inline on the modal. */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => onComposeMarketaOpenChange(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-violet-500/40 text-violet-200 hover:border-violet-400 hover:text-violet-100 transition"
        >
          Compose Marketa email
        </button>
        <button
          type="button"
          onClick={() => onComposeSlidesOpenChange(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-violet-500/40 text-violet-200 hover:border-violet-400 hover:text-violet-100 transition"
        >
          Compose Slides deck
        </button>
        <button
          type="button"
          onClick={() => onComposeDocOpenChange(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-violet-500/40 text-violet-200 hover:border-violet-400 hover:text-violet-100 transition"
        >
          Compose Google Doc
        </button>
        <button
          type="button"
          onClick={() => onComposeCalendarOpenChange(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-violet-500/40 text-violet-200 hover:border-violet-400 hover:text-violet-100 transition"
        >
          Compose Calendar event
        </button>
        <button
          type="button"
          onClick={() => onComposeGmailOpenChange(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-violet-500/40 text-violet-200 hover:border-violet-400 hover:text-violet-100 transition"
        >
          Compose Gmail draft
        </button>
      </div>
      <ComposeGmailDraftModal
        open={composeGmailOpen}
        onClose={() => onComposeGmailOpenChange(false)}
        onCreate={onComposeGmailDraft}
        onDraftWithAigentMe={onDraftEmail}
        theme={theme}
      />
      <ComposeCalendarEventModal
        open={composeCalendarOpen}
        onClose={() => onComposeCalendarOpenChange(false)}
        onCreate={onComposeCalendarEvent}
        onDraftWithAigentMe={onDraftEvent}
        theme={theme}
      />
      <ComposeGoogleDocModal
        open={composeDocOpen}
        onClose={() => onComposeDocOpenChange(false)}
        onCreate={onComposeGoogleDoc}
        onDraftWithAigentMe={onDraftDoc}
        theme={theme}
      />
      <ComposeSlidesModal
        open={composeSlidesOpen}
        onClose={() => onComposeSlidesOpenChange(false)}
        onCreate={onComposeSlides}
        onDraftWithAigentMe={onDraftSlides}
        theme={theme}
      />
      <ComposeMarketaEmailModal
        open={composeMarketaOpen}
        onClose={() => onComposeMarketaOpenChange(false)}
        onCreate={onComposeMarketa}
        onDraftWithAigentMe={onDraftMarketa}
        theme={theme}
      />

      {/* Context chips */}
      <section>
        <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          Active context
        </h2>
        <div className="flex flex-wrap gap-2">
          {CONTEXT_CHIPS.map((chip) => (
            <span
              key={chip}
              className={`px-3 py-1 text-sm rounded-full border ${chipClass}`}
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      {/* Primary CTAs */}
      <section>
        <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          What would you like to do?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.primaryCtas.map((cta) => {
            const isPreview = cta.status === 'preview';
            const baseBtn =
              'text-left px-4 py-3 rounded-lg border transition w-full';
            const enabledBtn = isDark
              ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 hover:border-violet-500/40'
              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-violet-400';
            const disabledBtn = isDark
              ? 'bg-slate-900/40 border-slate-800 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 cursor-not-allowed';
            return (
              <button
                key={cta.id}
                disabled={!cta.enabled}
                onClick={() => cta.enabled && onCtaClick(cta.id)}
                className={`${baseBtn} ${cta.enabled ? enabledBtn : disabledBtn}`}
                title={isPreview ? 'Coming in a later phase of the alpha' : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{cta.label}</span>
                  {isPreview && (
                    <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                      preview
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Brief Card — appears once 'Brief me' is clicked */}
      {(briefLoading || briefError || brief) && (
        <section>
          <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Brief
          </h2>
          <BriefCard
            data={brief}
            loading={briefLoading}
            error={briefError}
            onActOnNbe={onNbeAct}
            theme={theme}
          />
        </section>
      )}

      {/* Venture Progress — appears once 'Review venture progress' is clicked */}
      {(ventureProgressLoading || ventureProgressError || ventureProgress) && (
        <section>
          <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Venture Progress
          </h2>
          <VentureProgressCard
            data={ventureProgress}
            loading={ventureProgressLoading}
            error={ventureProgressError}
            onActOnNbe={onNbeAct}
            theme={theme}
          />
        </section>
      )}

      {/* Move-forward — hero NBE first, then alternates, then 'switch cartridge' strip */}
      {moveForwardCartridgeOpen && (
        <section ref={moveForwardSectionRef}>
          <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Move this forward
          </h2>

          {moveForwardLoading && (
            <p className={`text-sm ${mutedClass}`}>Looking for the strongest move…</p>
          )}

          {moveForwardResult && !moveForwardLoading && (
            <div className="space-y-3">
              {moveForwardResult.topAction ? (
                <NextBestActionCard
                  action={moveForwardResult.topAction}
                  variant="hero"
                  onAct={onNbeAct}
                  theme={theme}
                />
              ) : (
                <p className={`text-sm ${mutedClass}`}>
                  No catalogue match at your current stage.
                  Try setting up your ExperienceModel first.
                </p>
              )}
              {moveForwardResult.alternates.length > 0 && (
                <>
                  <h3 className={`text-xs uppercase tracking-wider mt-4 mb-1 ${mutedClass}`}>
                    Or instead
                  </h3>
                  <div className="space-y-2">
                    {moveForwardResult.alternates.map((a) => (
                      <NextBestActionCard
                        key={a.id}
                        action={a}
                        onAct={onNbeAct}
                        theme={theme}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Steering strip — swap cartridge if the user wants a different angle */}
              <div className="pt-3 mt-3 border-t border-slate-800/40">
                <div className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
                  Switch cartridge
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.availableCartridges.map((c) => {
                    const selected = moveForwardResult.cartridge === c.slug;
                    return (
                      <button
                        key={c.slug}
                        onClick={() => onPickMoveForwardCartridge(c.slug)}
                        className={`px-2.5 py-1 rounded-full border text-xs transition ${
                          selected
                            ? 'bg-violet-500/20 border-violet-500 text-violet-200'
                            : isDark
                              ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-violet-400'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Specialist directory */}
      <section>
        <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          Specialists I can coordinate
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.availableSpecialists.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border p-4 ${surfaceClass}`}
            >
              <div className="font-medium mb-1">{s.label}</div>
              <div className={`text-sm ${mutedClass}`}>{s.description}</div>
              <div className={`text-[11px] mt-2 uppercase tracking-wider ${mutedClass}`}>
                {s.homeCartridge}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Naming notice — locked decisions */}
      <footer className={`text-xs ${mutedClass} pt-4 border-t border-slate-800/60`}>
        <p>
          Locked names: <strong>{data.naming.canonicalMediaBrand}</strong> ·
          KNYT specialist <strong>{data.naming.knytSpecialist}</strong> ·
          Qriptopian editorial <strong>Quill</strong>.
          Workspace tools (Gmail, Calendar, Drive) are opt-in per source.
        </p>
      </footer>
    </div>
  );
}

export default AigentMeWelcomeTab;
