'use client';

/**
 * JourneyRunSurface — the Guided Journey Runtime's generic stage stepper +
 * viewport (PRD-GJR-001 §6, §7, §14), extracted from PilotJourneyTab.tsx
 * (2026-08-01) so a second journey (the Validation Programme, services/
 * journey/validationProgrammeJourney.ts) can reuse the SAME runner instead of
 * forking a second stepper implementation — inv.engineering.036.
 *
 * Everything Horizen-specific (the agent-slug carrying logic, the
 * MoneyPenny/HorizenAgentPageSurface context props, the JOURNEY_COMPONENTS
 * map) stays OUT of this file and lives in the caller's `resolveSurfaceProps`
 * / `components` props — this file only knows about JourneyDefinition,
 * JourneyRuntimeState and JOURNEY_SURFACES (the shared registry), never a
 * specific journey's stages.
 *
 * One-State Principle (§5.3): stage state comes ONLY from the caller-supplied
 * `stateUrl`, resolved server-side via resolveJourneyState() against real
 * receipts/data. This component never marks a stage complete on its own —
 * clicking a stage node only selects which stage's surface is shown (§5.1).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Lock, Loader2, RefreshCw, ExternalLink, Construction, Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';
import { JOURNEY_SURFACES, buildEmbedSurfaceSrc, type JourneySurfaceDescriptor } from '@/services/journey/journeySurfaceRegistry';
import { StageReceiptsDrawer } from '@/components/journey/StageReceiptsDrawer';
import type { JourneyDefinition, JourneyRuntimeState, JourneyStageDefinition, JourneySurfaceRef } from '@/types/journey';
import { overlayZClass } from '@/components/ui/overlayLayers';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

/**
 * One status row above the stepper, crossfading between whichever of
 * description/Awaiting/Refused apply for the active stage. Parent remounts
 * this with `key={activeStageId}` so switching stages always starts fresh at
 * slide 0, fully visible.
 */
/**
 * ONE shared connector rule for EVERY inter-stage interval in the strip —
 * Register→Claim through Operate→fork alike (Horizen Journey spacing
 * correction, 2026-08-09, reversing an over-correction from earlier the
 * same day).
 *
 * The immediately prior fix made every connector a FIXED `w-4` (16px) to
 * stop Operate→fork visually diverging from the other five gaps — it
 * succeeded at making them equal, but equal-and-tiny is not what "uniform
 * spacing" meant: the whole strip collapsed to its min-content width and
 * sat bunched in the left portion of the surface, leaving the rest of the
 * available width empty. The actual ask was uniform DISTRIBUTION across
 * the full available width, not a uniform fixed pixel gap.
 *
 * `flex-1` makes every connector claim an EQUAL share of the strip's
 * leftover space (stage nodes stay `shrink-0`, so only connectors grow);
 * `min-w-[40px]` keeps a breathable floor once the strip is narrower than
 * its content and must scroll instead of crushing gaps toward zero. Used
 * identically by the ordinary spine connectors AND the Operate→fork
 * connector — never a per-position special case.
 */
const JOURNEY_CONNECTOR_CLASS = 'h-px flex-1 min-w-[40px]';

/**
 * A server-derived signal name, made readable — MECHANICALLY.
 *
 * `principalRegistrationMandateSigned` → "Principal registration mandate
 * signed". Deliberately a pure transformation of the identifier rather than a
 * hand-written label map: a map would be a second place stating what each
 * signal means, and it would silently fall back to the raw key the moment the
 * server added a signal it didn't know (inv.engineering.036/037). Reads worse
 * than curated prose; cannot go stale, and cannot mislabel a new signal.
 */
function humaniseSignal(signal: string): string {
  const spaced = signal.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function RotatingStatusLine({ slides }: { slides: Array<{ key: string; node: React.ReactNode }> }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (slides.length <= 1) return;
    const showMs = 3200;
    const fadeTimer = setTimeout(() => setVisible(false), showMs);
    return () => clearTimeout(fadeTimer);
  }, [index, slides.length]);

  useEffect(() => {
    if (visible || slides.length <= 1) return;
    const advanceTimer = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
      setVisible(true);
    }, 300);
    return () => clearTimeout(advanceTimer);
  }, [visible, slides.length]);

  const current = slides[index % Math.max(slides.length, 1)];
  if (!current) return null;
  return (
    <span className={`truncate transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {current.node}
    </span>
  );
}

export interface JourneyRunSurfaceProps {
  journey: JourneyDefinition;
  /** GET route returning `{ ok: true, state: JourneyRuntimeState }`. */
  stateUrl: string;
  personaId?: string;
  /** Rendered after the metaMe mark in the header row (journey-specific branding). */
  headerLabel: React.ReactNode;
  /**
   * Rendered on the SAME row as the stage description (compact mode) or the
   * top row (two-row mode), immediately to the right of it and before
   * `headerActions` (KNYTS Bridge Admin button, 2026-08-10). Optional and
   * journey-specific — undefined for every caller that doesn't pass it, so
   * Horizen/Validation are unaffected. Kept out of `headerLabel` because
   * that prop sits inside a plain inline `<span>` (brand text), which wraps
   * a block-level child like a `<button>` onto its own line the moment
   * space runs short — this renders as a proper flex sibling instead.
   */
  headerExtra?: React.ReactNode;
  /** Optional back button callback. When provided, renders a back button
   * on the left side of the header (after branding) that triggers this
   * callback. Used when opening an embedded cartridge so users can return
   * to their previous position in the guide.
   */
  onBack?: () => void;
  /** Companion quick-links document.title signal while this stage view is mounted (services/companion/quickLinks.ts). */
  documentTitle?: string;
  /** Per-journey component registry, keyed by journeySurfaceRegistry component name — never shared across journeys. */
  components: Record<string, React.ComponentType<Record<string, unknown>>>;
  /**
   * Journey-specific extra props to merge onto a surface's rendered
   * component — the hook that replaces PilotJourneyTab's old inline
   * `journeyContextProps` ternary. Called once per rendered `component`
   * surface; return `{}` for surfaces that need nothing extra.
   */
  resolveSurfaceProps?: (args: {
    surfaceRef: JourneySurfaceRef;
    descriptor: Extract<JourneySurfaceDescriptor, { kind: 'component' }>;
    stage: JourneyStageDefinition;
    /**
     * The OBSERVER's resolved state, so a surface can be handed a decision the
     * observer has already made rather than re-deriving it (operator's
     * three-layer rule, 2026-08-03: "projection consumes observer state only;
     * no stepper component may query lower-level evidence directly").
     *
     * Null while the first read is in flight — a caller must treat that as
     * "not known yet", never as a negative finding.
     */
    runtimeState: JourneyRuntimeState | null;
    /**
     * P&L evidence (Final Horizen Projection Reconciliation part 2/3,
     * 2026-08-09) — the SAME canonical-receipt-backed facts `runtimeState`
     * carries for other stages, surfaced separately because they're
     * deliberately excluded from `verify`'s `completionEvidence` (Pulse/P&L
     * must never gate Ratify) and so never appear in any stage's
     * `evidencePresent`. Null while the first read is in flight.
     */
    pnlEvidence: {
      serviceRegistered: boolean;
      serviceRegisteredDvnStatus: string | null;
      serviceVerified: boolean;
      serviceVerifiedDvnStatus: string | null;
    } | null;
    /**
     * Ratify's five sub-predicates, each independently projected (CFS-055
     * coherence pass, 2026-08-10) — `{ predicate, established, authority,
     * effectiveAt, evidenceRefs, receiptRefs, dvnStatus }` per key
     * (`agreementAuthorized`, `pulseAuthorized`, `pnlDisclosureAuthorized`,
     * `pnlServiceRegistered`, `pnlEvidenceVerified`). Null while the first
     * read is in flight. This is what AgreementRatifyPanel/
     * PulseTransparencyToggle must consume for these facts — never their
     * own Agent Card fetch, `/verify/status` poll, or duplicated status-rank
     * logic.
     */
    ratifySubPredicates: Record<
      string,
      {
        predicate: string;
        established: boolean;
        authority: string;
        effectiveAt: string | null;
        evidenceRefs: string[];
        receiptRefs: string[];
        dvnStatus: string | null;
      }
    > | null;
    /**
     * Register's seven-step ceremony projection, computed read-only from
     * canonical evidence (Pre-recording Horizen polish, part C, 2026-08-10)
     * — same per-step shape as `ratifySubPredicates` above, plus `authority`
     * may be `'inferred'` for the two steps with no receipt type
     * (`principalWalletReady`, `mandatePrepared`). Its former UI consumer
     * (RegisterCeremonyReplay) was removed from the journey UI (2026-08-11);
     * this projection and its thread-through are kept as-is — never a
     * second source of truth for whether Register is complete. Null while
     * the first read is in flight.
     */
    registerCeremony: Record<
      string,
      {
        predicate: string;
        established: boolean;
        authority: string;
        effectiveAt: string | null;
        evidenceRefs: string[];
        receiptRefs: string[];
        dvnStatus: string | null;
      }
    > | null;
  }) => Record<string, unknown>;
  /**
   * The Journey's currently-selected agent (resolveRegistrableAgent slug,
   * e.g. "nakamoto") — the SAME value used to build `stateUrl`'s `agentSlug`
   * query param, so the iframe's selected agent and the observer's selected
   * agent are always identical (al, 2026-08-04). Forwarded only to 'embed'
   * surfaces that opt in via `agentScoped: true` in journeySurfaceRegistry —
   * see buildEmbedSurfaceSrc. Undefined leaves every embed surface's URL
   * unchanged.
   */
  selectedAgentSlug?: string;
  /**
   * The `agents_invoked` value naming the currently-selected agent as a
   * receipt subject (e.g. Horizen's "aigent-<slug>" convention) — an
   * opaque string from this file's own perspective, computed by the caller,
   * which already knows the journey-specific naming convention (operator
   * directive, 2026-08-08). Applied ONLY to stages whose
   * `receiptsScopedToSubjectAgent` is true; every other stage's Evidence
   * Receipts drawer is unaffected. See StageReceiptsDrawer's own doc comment
   * for the defect this closes.
   */
  receiptsSubjectAgentRef?: string;
  /**
   * Journey-specific accent theming (KNYTS Bridge reconstitution, 2026-08-09)
   * — the ONE sanctioned way a caller projects its own visual identity onto
   * the shared runner (spec point 7: "the runner should accept/theme through
   * journey-specific props/config... never change JourneyRunSurface globally
   * to make all journeys KNYT-like"). Every class below defaults to the
   * EXACT purple classes this file always rendered, so omitting this prop —
   * every existing journey (Horizen, Validation Programme) — is pixel
   * identical to before this prop existed. Only the "current stage" accent
   * is themeable; structural chrome (slate panels, emerald complete,
   * amber-for-pending, rose-for-refused) stays shared across every journey.
   */
  accent?: {
    /** Current-stage node: border + bg + text, e.g. 'border-purple-400 bg-purple-500/20 text-purple-200'. */
    node: string;
    /** Current-stage label text colour, e.g. 'text-purple-200'. */
    label: string;
    /** Status-row ordinal chip: bg + text, e.g. 'bg-purple-500/20 text-purple-200'. */
    chip: string;
  };
  /**
   * Fold the journey-brand row and the stage-description row into ONE
   * compact row (KNYTS Bridge reconstitution, 2026-08-09) — see the
   * `compact` render branch's own comment. Defaults to false: every existing
   * caller (Horizen, Validation Programme) keeps the original two-row header
   * byte-for-byte unless it opts in.
   */
  compact?: boolean;
  /**
   * Distinguish "Bridge navigation availability" from "constitutional
   * evidence complete" in the spine's node styling (CI Bridge final
   * interaction pass, 2026-08-11). Without this flag, every stage that
   * isn't COMPLETE/current/BLOCKED renders in one identical plain-grey
   * bucket — which reads as "locked" even for a stage that has no
   * prerequisite at all and was always clickable (see
   * services/journey/resolveJourneyState.ts's `priorStagesAllComplete`
   * gate: once a gate-less narrative stage like CI Bridge's HOME passes
   * without ever reaching COMPLETE — by design, it has no
   * completionEvidence — every later gate-less stage falls into the same
   * generic NOT_STARTED bucket as a stage that hasn't opened yet).
   *
   * Enabling this splits that bucket into its own "available" style (a
   * lighter emerald outline — distinct from COMPLETE's solid emerald+check
   * and from BLOCKED's Lock) for any stage that is not done/current/blocked.
   * This is PURELY a presentation reclassification of the stage's already
   * -resolved `JourneyStageState` (read at line ~790 below) — it changes
   * zero data, reads zero new fields, and does not touch
   * resolveJourneyState.ts / types/journey.ts / any JourneyDefinition.
   * Navigation itself (`selectStage`) was already unconditional before this
   * flag existed and remains so: this never gates a click, only its icon.
   *
   * Defaults to false: every existing caller (Horizen, Validation
   * Programme, KNYTS Bridge) renders byte-for-byte as before unless it
   * opts in.
   */
  distinguishAvailableStages?: boolean;
}

const DEFAULT_ACCENT = {
  node: 'border-purple-400 bg-purple-500/20 text-purple-200',
  label: 'text-purple-200',
  chip: 'bg-purple-500/20 text-purple-200',
};

export function JourneyRunSurface({
  journey,
  stateUrl,
  personaId,
  headerLabel,
  headerExtra,
  onBack,
  documentTitle,
  components,
  resolveSurfaceProps,
  selectedAgentSlug,
  receiptsSubjectAgentRef,
  accent = DEFAULT_ACCENT,
  compact = false,
  distinguishAvailableStages = false,
}: JourneyRunSurfaceProps) {
  const [runtimeState, setRuntimeState] = useState<JourneyRuntimeState | null>(null);
  /**
   * Consequence Fork projection (services/journey/consequenceForkProjection.ts)
   * — keyed by stage id, `{ tier, label, detail }`. Optional: a journey whose
   * `/state` route does not compute one (e.g. the Validation Programme) simply
   * never populates it, and the trident renders its plain stage nodes with no
   * badge — this is a pure additive read, never a second completion source.
   */
  const [consequenceFork, setConsequenceFork] = useState<Record<
    string,
    { tier: string; label: string; detail: string }
  > | null>(null);
  /**
   * P&L evidence (Final Horizen Projection Reconciliation part 2/3,
   * 2026-08-09) — `{ serviceRegistered, serviceRegisteredDvnStatus,
   * serviceVerified, serviceVerifiedDvnStatus }`. Same optional-additive
   * discipline as `consequenceFork` above: absent for journeys whose
   * `/state` route doesn't compute it.
   */
  const [pnlEvidence, setPnlEvidence] = useState<{
    serviceRegistered: boolean;
    serviceRegisteredDvnStatus: string | null;
    serviceVerified: boolean;
    serviceVerifiedDvnStatus: string | null;
  } | null>(null);
  // Ratify sub-predicate projection (CFS-055 coherence pass, 2026-08-10) —
  // same optional-additive discipline as `pnlEvidence` above.
  const [ratifySubPredicates, setRatifySubPredicates] = useState<Record<
    string,
    {
      predicate: string;
      established: boolean;
      authority: string;
      effectiveAt: string | null;
      evidenceRefs: string[];
      receiptRefs: string[];
      dvnStatus: string | null;
    }
  > | null>(null);
  // Register ceremony replay projection (Pre-recording Horizen polish, part
  // C, 2026-08-10) — same optional-additive discipline as `ratifySubPredicates`.
  const [registerCeremony, setRegisterCeremony] = useState<Record<
    string,
    {
      predicate: string;
      established: boolean;
      authority: string;
      effectiveAt: string | null;
      evidenceRefs: string[];
      receiptRefs: string[];
      dvnStatus: string | null;
    }
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [expandedEmbedIndices, setExpandedEmbedIndices] = useState<Set<number>>(new Set());

  const toggleEmbedExpansion = (index: number) => {
    setExpandedEmbedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof document === 'undefined' || !documentTitle) return;
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Journey state routes resolve the caller through the identity spine
      // (getActivePersona) — a raw fetch() carries no Authorization header
      // and 401s even for a signed-in persona (the exact failure mode
      // CLAUDE.md's spine rule documents). personaFetch is the one client
      // transport that attaches it, hinted with this journey's own persona
      // when known.
      const res = await personaFetch(stateUrl, { cache: 'no-store', personaIdHint: personaId });
      if (!res.ok) throw new Error(`Journey state request failed (${res.status})`);
      const json = await readJsonOrExplain(res, 'journey/state');
      setRuntimeState(json.state as JourneyRuntimeState);
      setConsequenceFork((json.consequenceFork as typeof consequenceFork) ?? null);
      setPnlEvidence((json.pnlEvidence as typeof pnlEvidence) ?? null);
      setRatifySubPredicates((json.ratifySubPredicates as typeof ratifySubPredicates) ?? null);
      setRegisterCeremony((json.registerCeremony as typeof registerCeremony) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journey state');
    } finally {
      setLoading(false);
    }
  }, [stateUrl, personaId]);

  /**
   * FAIL FAITHFUL (operator ruling, 2026-08-02). A transient status-endpoint
   * failure must never read as a loss of access, and must never be shown to
   * an external participant as a raw transport error.
   *
   * PRIOR DEFECT: a gateway timeout surfaced verbatim — "Journey state
   * request failed (504)" — in a red banner, to an external reviewer whose
   * constitutional access was entirely intact. That string is true but it is
   * not ADDRESSED to them: it names a mechanism they have no relationship
   * with, offers no next step, and (in red, beside a green "Access granted")
   * implies their access is in question. It is not: nothing this endpoint
   * does can revoke a grant.
   *
   * So the participant gets what is true AND actionable — status is
   * temporarily unavailable, confirmed access is unaffected, here is how to
   * retry — while the exact technical detail stays reachable for whoever can
   * act on it. Nothing is hidden; it is addressed to the right reader.
   * `runtimeState` is deliberately NOT cleared on failure: the last resolved
   * state remains the most truthful thing we know, and blanking it would
   * present "unknown" as "nothing complete".
   */
  const technicalDetail = error;
  const isStale = !!error && !!runtimeState;

  /**
   * STAGE CAROUSEL (operator direction, 2026-08-02). The strip has always been
   * `overflow-x-auto`, so it scrolled — but with the Horizen journey grown to
   * eight stages there was no AFFORDANCE: nothing indicated more stages
   * existed off-screen, so a stage past the fold was effectively invisible.
   * Arrows appear only when the strip actually overflows (a control that
   * cannot act must not render — MS-9), and the active stage is scrolled into
   * view whenever it changes, so selecting a stage from elsewhere (the
   * companion's `journey:select-stage`) never leaves the operator looking at
   * the wrong part of the strip.
   */
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const measureOverflow = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflow({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    measureOverflow();
    const ro = new ResizeObserver(measureOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureOverflow, journey.stages.length]);

  const scrollStrip = useCallback((direction: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.6, 160), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Companion synchronization (PRD-GJR-001 §11.5): one journey state, multiple
  // authorized renderers. Location and context only — this never completes a
  // stage (§11.7 temporary invariant).
  useEffect(() => {
    const onSelect = (e: Event) => {
      const stageId = (e as CustomEvent<{ stageId?: string }>).detail?.stageId;
      if (typeof stageId === 'string' && journey.stages.some((s) => s.id === stageId)) {
        setSelectedStageId(stageId);
      }
    };
    window.addEventListener('journey:select-stage', onSelect);
    return () => window.removeEventListener('journey:select-stage', onSelect);
  }, [journey]);

  const selectStage = useCallback((stageId: string) => {
    setSelectedStageId(stageId);
    try {
      window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen]);

  const activeStageId = selectedStageId ?? runtimeState?.currentStageId ?? journey.stages[0]?.id;
  const activeStage = journey.stages.find((s) => s.id === activeStageId) ?? journey.stages[0];
  const activeStageRuntime = runtimeState?.stages.find((s) => s.stageId === activeStageId);

  /**
   * The evidence checklist is a POPOVER anchored to its own trigger, not a
   * `<details>` disclosure in normal flow — a `<details>` open state pushes
   * everything below it down the page, which is exactly what the compact
   * layout correction (2026-08-09) exists to stop. Closed on stage change so
   * a stale checklist for the PREVIOUS stage never appears to describe the
   * new one, and on outside click / Escape like any other transient popover.
   */
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEvidenceOpen(false);
  }, [activeStageId]);

  useEffect(() => {
    if (!evidenceOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (evidenceRef.current && !evidenceRef.current.contains(e.target as Node)) setEvidenceOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEvidenceOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [evidenceOpen]);

  // Keep the active stage visible in the carousel — including when it was
  // selected from OUTSIDE this strip (the companion's `journey:select-stage`),
  // which is exactly the case a manual-scroll-only strip leaves stranded.
  useEffect(() => {
    const el = stripRef.current;
    if (!el || !activeStageId) return;
    const node = el.querySelector<HTMLElement>(`[data-stage-id="${activeStageId}"]`);
    node?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    measureOverflow();
  }, [activeStageId, measureOverflow]);
  const activeIdx = journey.stages.findIndex((s) => s.id === activeStageId);

  /*
   * CONSEQUENCE FORK (Threshold Journey — Orient + Consequence Fork,
   * 2026-08-09) — a rendering-only split, driven by `forkPosition`
   * (types/journey.ts). Stages that opt in are drawn as a three-pronged
   * trident branching from ONE junction after the spine, never mixed into
   * the numbered spine row and never drawn before it. A journey with no
   * `forkPosition`-tagged stages (e.g. the Validation Programme) yields an
   * empty `forkStages` and renders exactly as before — this is purely
   * additive. Gating is untouched: `forkPosition` decides WHERE a stage's
   * node is drawn, never whether it is reachable or complete.
   */
  const spineStages = journey.stages.filter((s) => !s.forkPosition);
  const forkStages = journey.stages.filter((s) => s.forkPosition);
  /*
   * Activate Consolidation (2026-08-11) — 'middle' dropped from the
   * RENDERED rows. A stage may still carry `forkPosition: 'middle'` in its
   * data (the legacy `deploy`/Ingest stage does, for `spineStages`
   * exclusion + historical evidence linkage — see its own header comment
   * in horizenMoneyPennyJourney.ts) without ever drawing a visible trident
   * prong: `forkStages.find(s => s.forkPosition === position)` below only
   * ever looks up 'upper'/'lower', so a 'middle' stage is structurally
   * unreachable by this render regardless of what the data says.
   */
  const FORK_ROWS: Array<{ position: 'upper' | 'lower' }> = [{ position: 'upper' }, { position: 'lower' }];

  /** Shared between the default one-row header and the `compact` one-row
   *  variant (KNYTS Bridge reconstitution, 2026-08-09) — same status slides,
   *  same evidence popover, just arranged differently. Extracted so neither
   *  branch can silently drift from the other.
   *
   *  Narrator alternation (Threshold Guide header compaction, 2026-08-10) —
   *  a stage that declares `narrator` (active/consequence, e.g. Horizen's
   *  "Registering agent" ↔ "Establishes registry presence") swaps in for
   *  the plain `description` slide; a stage without one (every KNYTS Bridge
   *  stage today) falls back to `description` unchanged — same mechanism,
   *  never a second rotation component. */
  const statusSlides = [
    ...(activeStage.narrator
      ? [
          { key: 'active', node: <span className="text-slate-400">{activeStage.narrator.active}</span> },
          { key: 'consequence', node: <span className="italic text-slate-500">{activeStage.narrator.consequence}</span> },
        ]
      : [{ key: 'description', node: <span className="text-slate-400">{activeStage.description}</span> }]),
    ...(activeStageRuntime && activeStageRuntime.evidenceMissing.length > 0
      ? [{ key: 'awaiting', node: <span className="text-slate-400">Awaiting: {activeStageRuntime.evidenceMissing.map(humaniseSignal).join(', ')}</span> }]
      : []),
    ...(activeStageRuntime?.refusalReason
      ? [{ key: 'refused', node: <span className="text-rose-300">Refused: {activeStageRuntime.refusalReason}</span> }]
      : []),
  ];

  const evidenceTrigger = activeStageRuntime &&
    (activeStageRuntime.evidencePresent.length > 0 || activeStageRuntime.evidenceMissing.length > 0) && (
      <div className="relative shrink-0" ref={evidenceRef}>
        <button
          type="button"
          onClick={() => setEvidenceOpen((v) => !v)}
          aria-expanded={evidenceOpen}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-800 bg-slate-900/40 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800/60 hover:text-slate-300"
        >
          Evidence {activeStageRuntime.evidencePresent.length}/
          {activeStageRuntime.evidencePresent.length + activeStageRuntime.evidenceMissing.length}
          {activeStageRuntime.receiptRefs.length > 0 ? ` · ${activeStageRuntime.receiptRefs.length} receipts` : ''}
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${evidenceOpen ? 'rotate-180' : ''}`} />
        </button>
        {evidenceOpen && (
          <div className="absolute right-0 top-[calc(100%+4px)] z-20 max-w-[min(90vw,32rem)] rounded-lg border border-slate-800 bg-slate-900/95 p-2.5 shadow-lg backdrop-blur-sm">
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
              {activeStageRuntime.evidencePresent.map((sig) => (
                <span
                  key={sig}
                  className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-900/60 bg-emerald-950/20 px-2 py-0.5 text-[11px] text-emerald-300/80"
                >
                  <Check className="h-3 w-3 shrink-0" />
                  {humaniseSignal(sig)}
                </span>
              ))}
              {activeStageRuntime.evidenceMissing.map((sig) => (
                <span
                  key={sig}
                  className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-600" />
                  {humaniseSignal(sig)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );

  /**
   * Evidence trigger lives HERE — between Refresh and Full screen (layout
   * correction, 2026-08-10, from the dev branch's own coherence pass): its
   * trigger was previously anchored at the far right of the stage-
   * description row, congesting that corner. From here its popover opens
   * directly onto the description row below (or, in `compact` mode, the
   * same row it's already part of) — exactly where the information belongs.
   * Shared between the two-row and one-row (`compact`) layouts via
   * `headerActions` so neither can drift out of sync with the other's
   * placement (KNYTS Bridge reconstitution, 2026-08-09/10).
   */
  const headerActions = (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <button
        onClick={() => void refresh()}
        title="Refresh state"
        className={`flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 ${compact ? 'p-1.5' : 'px-2.5 py-1.5 text-xs'}`}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        {/* Compact label (Threshold Guide header compaction, 2026-08-10) —
            the full label was crowding the merged one-row header; the icon
            plus the title attribute above already carry the meaning. */}
        {!compact && 'State'}
      </button>
      {evidenceTrigger}
      <button
        onClick={() => setFullScreen((v) => !v)}
        title={fullScreen ? 'Collapse' : 'Full screen'}
        className={`flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 ${compact ? 'p-1.5' : 'px-2.5 py-1.5 text-xs'}`}
      >
        {fullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  const content = (
    <div className="flex h-full flex-col gap-4 p-4 text-slate-100">
      {compact ? (
        /*
         * COMPACT ONE-ROW HEADER (KNYTS Bridge reconstitution, 2026-08-09;
         * spacing/alignment correction, 2026-08-10) — the journey-brand row
         * and the stage-description row are two genuinely separate FACTS
         * (which journey; where in it) but were costing two full rows of
         * vertical space to say so. A lighter journey than Horizen has no
         * evidentiary weight to justify that; one compact row says both.
         * Opt-in only — every existing caller (Horizen, Validation
         * Programme) omits `compact` and keeps its own one-row layout below.
         *
         * Semantic groups, left to right, every one `shrink-0` except the
         * descriptor (the one group allowed to give up space):
         *   brand (icon + headerLabel) → separator → descriptor (flex-1,
         *   min-w-0, truncates) → headerExtra (e.g. Bridge Admin) →
         *   headerActions (Refresh/Evidence/Full screen, pinned right via
         *   its own `ml-auto`). `items-center` on the row baseline-aligns
         *   every group; `flex-wrap` is a deliberate MOBILE fallback (an
         *   allowed responsive collapse), never triggered on desktop widths
         *   once the descriptor is the only group that can shrink.
         */
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/metaMe/metaMe/metame-32.png" alt="" className="h-4 w-4 shrink-0" />
            {headerLabel}
          </div>
          {onBack && (
            <>
              <span className="shrink-0 text-slate-600">·</span>
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition"
                title="Back to previous stage"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <span className="shrink-0 text-slate-600">·</span>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span className="shrink-0 font-medium text-slate-100">{activeStage.label}</span>
            <span className="shrink-0 text-slate-600">—</span>
            <RotatingStatusLine key={activeStageId} slides={statusSlides} />
          </div>
          {headerExtra}
          {headerActions}
        </div>
      ) : (
        /*
         * ONE COMPRESSED TOP ROW, non-compact variant (Threshold Guide
         * header compaction, 2026-08-10) — merged onto the same
         * headerActions/headerExtra/statusSlides this file already shares
         * with `compact` above (KNYTS Bridge reconstitution, 2026-08-09/10),
         * so neither the numbered stage chip nor the narrator gets a second,
         * drifting implementation. The stage chip/label/narrator that used
         * to sit on their own row below now share this row with the
         * branding + controls, and that second row is gone entirely.
         * `min-w-0 flex-1 overflow-hidden` on the left cluster is what makes
         * this survive at narrow widths: the narrator truncates before
         * anything else does.
         */
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/metaMe/metaMe/metame-32.png" alt="" className="h-4 w-4 shrink-0" />
            {headerLabel}
            {onBack && (
              <>
                <span className="shrink-0 text-slate-600">·</span>
                <button
                  type="button"
                  onClick={onBack}
                  className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition"
                  title="Back to previous stage"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <span className="shrink-0 text-slate-600">·</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${accent.chip}`}>{activeIdx + 1}</span>
            <span className="shrink-0 text-xs font-medium text-slate-100">{activeStage.label}</span>
            <span className="shrink-0 text-slate-600">—</span>
            <RotatingStatusLine key={activeStageId} slides={statusSlides} />
          </div>
          {headerExtra}
          {headerActions}
        </div>
      )}

      {error && (
        // Amber, not rose: this is "we cannot tell you right now", which is a
        // different fact from "you are refused". Rose is reserved for a real
        // refusal so the two never read alike.
        <div className="rounded-md border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          <div className="font-medium">Programme status is temporarily unavailable.</div>
          <div className="mt-1 text-amber-200/80">
            Your confirmed access remains active — nothing here has changed it.{' '}
            {isStale
              ? 'The stages below show the last status we resolved.'
              : 'No stage is assumed complete while status is unknown.'}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-950/50"
            >
              Refresh status
            </button>
          </div>
          {/* Operator diagnostics — the exact technical detail, kept out of
              the participant's way but never removed. */}
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-amber-200/60 hover:text-amber-200">
              Diagnostics
            </summary>
            <code className="mt-1 block break-all text-[11px] text-amber-200/70">{technicalDetail}</code>
          </details>
        </div>
      )}

      {/*
        The stage chip/label/narrator that used to render here as a second
        row (STAGE DESCRIPTION ROW) are now folded into the compressed top
        row above, for both `compact` and non-compact layouts (Threshold
        Guide header compaction, 2026-08-10) — this row is gone entirely,
        not merely hidden.
      */}
      <div className="relative border-b border-slate-800 bg-slate-900/40 px-4 py-2.5 rounded-lg">
        {/* Rendered only while there is somewhere to scroll TO. */}
        {overflow.left && (
          <button
            type="button"
            aria-label="Scroll stages left"
            onClick={() => scrollStrip(-1)}
            className="absolute left-0.5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-900/80 p-1 text-slate-300 backdrop-blur-sm transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        {overflow.right && (
          <button
            type="button"
            aria-label="Scroll stages right"
            onClick={() => scrollStrip(1)}
            className="absolute right-0.5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-900/80 p-1 text-slate-300 backdrop-blur-sm transition-colors hover:text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        <div
          ref={stripRef}
          onScroll={measureOverflow}
          className="flex w-full items-center overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {spineStages.map((stage, i) => {
            const stageState = runtimeState?.stages.find((s) => s.stageId === stage.id)?.state ?? 'NOT_STARTED';
            const isDone = stageState === 'COMPLETE';
            const isCurrent = stage.id === activeStageId;
            const isBlocked = stageState === 'BLOCKED';
            // "Available" — not done/current/blocked. Only given its own
            // distinct look when the caller opts in via
            // distinguishAvailableStages; otherwise it stays folded into the
            // same plain-grey bucket every caller has always rendered.
            const isAvailable = distinguishAvailableStages && !isDone && !isCurrent && !isBlocked;
            const prevDone =
              i === 0 ||
              (runtimeState?.stages.find((s) => s.stageId === spineStages[i - 1].id)?.state ?? 'NOT_STARTED') ===
                'COMPLETE';
            return (
              <React.Fragment key={stage.id}>
                {/* The shared flexible connector — see JOURNEY_CONNECTOR_CLASS's
                    own doc for why this is flex-1, not a fixed width. */}
                {i > 0 && <div className={`${JOURNEY_CONNECTOR_CLASS} ${prevDone ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />}
                <button
                  data-stage-id={stage.id}
                  onClick={() => selectStage(stage.id)}
                  className="flex shrink-0 items-center gap-1.5 px-1"
                  title={isBlocked ? 'Blocked — prerequisites not yet met' : isAvailable ? `${stage.description} (available now)` : stage.description}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                      isDone
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : isCurrent
                          ? accent.node
                          : isBlocked
                            ? 'border-slate-700 text-slate-600'
                            : isAvailable
                              ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400/80'
                              : 'border-slate-600 text-slate-400'
                    }`}
                  >
                    {isBlocked && !isDone ? (
                      <Lock className="h-2.5 w-2.5" />
                    ) : loading && isCurrent ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isDone ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[11px] ${
                      isCurrent
                        ? `font-semibold ${accent.label}`
                        : isDone
                          ? 'text-emerald-300/80'
                          : isAvailable
                            ? 'text-emerald-400/70'
                            : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}

          {/*
            CONSEQUENCE FORK — a trident anchored to the END of the spine, in
            the SAME horizontal strip (Horizen Journey trident correction,
            2026-08-09). This is ONE fixed-size relative child of `stripRef`,
            immediately after the last spine node (Operate) — never a
            detached block below, never a second row, no section heading (the
            geometry itself communicates the fork). The three prongs are
            ABSOLUTELY positioned inside this one box, not stacked via normal
            flex-column flow: Ingest sits at the box's vertical center and
            visually continues the spine's own line through ONE junction;
            Ratify's row sits at the top, Stand's at the bottom, each linked
            to the junction by its own vertical-then-horizontal tick. A
            three-row flex/grid stack would recreate the "second panel"
            defect this corrects — the fixed box + absolute connectors are
            what make it read as one object instead.
          */}
          {forkStages.length > 0 && (() => {
            const lastSpineDone =
              (runtimeState?.stages.find((s) => s.stageId === spineStages[spineStages.length - 1]?.id)?.state ??
                'NOT_STARTED') === 'COMPLETE';
            /*
             * Keyed by POSITION NAME, not array index (Activate
             * Consolidation, 2026-08-11 — the old 3-row Ratify/Ingest/Stand
             * geometry indexed these arrays by `rowIndex`, which silently
             * mis-positioned rows once FORK_ROWS shrank to two entries).
             * Ratify (upper) sits at the box's top; Stand (lower) at its
             * bottom — the SAME 72px-tall box, now spanning both ends
             * cleanly instead of clustering near the top. 'middle' stays
             * defined (unused today) so a future journey that legitimately
             * needs a third rendered prong is not blocked by this type.
             */
            const ROW_TOP: Record<'upper' | 'middle' | 'lower', string> = {
              upper: 'top-0',
              middle: 'top-6',
              lower: 'top-12',
            };
            const TICK_Y: Record<'upper' | 'middle' | 'lower', string> = {
              upper: 'top-3',
              middle: 'top-1/2 -translate-y-1/2',
              lower: 'bottom-3',
            };
            return (
              <React.Fragment key="consequence-fork">
                {/* The SAME shared flexible connector as every ordinary spine
                    interval — moved OUT of the fork's fixed-size box so
                    Operate→fork participates in the strip's flex
                    distribution instead of being trapped inside a
                    fixed-width unit (Horizen Journey spacing correction,
                    2026-08-09). The box below now begins right at the
                    junction. */}
                <div className={`${JOURNEY_CONNECTOR_CLASS} ${lastSpineDone ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                <div
                  data-testid="consequence-fork"
                  className="relative h-[72px] w-[154px] shrink-0"
                >
                  {/* The vertical trunk — structural, never coloured by any ONE
                      prong's state (MS-6-style: gate/rank per prong, never
                      subtract from the group). Spans exactly between the top
                      and bottom rows' own centers. */}
                  <div className="absolute bottom-3 left-0 top-3 w-px bg-slate-700" />
                  {/* The junction — ONE point, immediately after Operate. */}
                  <div className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-600" />
                  {FORK_ROWS.map(({ position }) => {
                  const stage = forkStages.find((s) => s.forkPosition === position);
                  if (!stage) return null;
                  const stageState = runtimeState?.stages.find((s) => s.stageId === stage.id)?.state ?? 'NOT_STARTED';
                  const isDone = stageState === 'COMPLETE';
                  const isCurrent = stage.id === activeStageId;
                  const isBlocked = stageState === 'BLOCKED';
                  const projection = consequenceFork?.[stage.id] ?? null;
                  // Independent per-prong tick colour — Stand being
                  // incomplete never dims Ratify's or Ingest's own tick.
                  const tickDone = projection ? projection.tier !== 'refused-unresolved' : isDone;
                  return (
                    <React.Fragment key={stage.id}>
                      {/* Short tick from the trunk to this row's own node —
                          independently coloured by THIS prong's state. */}
                      <div className={`absolute left-0 ${TICK_Y[position]} h-px w-2 ${tickDone ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                      <div
                        className={`absolute left-2 ${ROW_TOP[position]} flex h-6 items-center gap-1.5 whitespace-nowrap`}
                        data-fork-position={position}
                      >
                        <button
                          data-stage-id={stage.id}
                          onClick={() => selectStage(stage.id)}
                          className="flex shrink-0 items-center gap-1.5"
                          title={projection?.detail ?? (isBlocked ? 'Blocked — prerequisites not yet met' : stage.description)}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                              isDone
                                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                                : isCurrent
                                  ? accent.node
                                  : isBlocked
                                    ? 'border-slate-700 text-slate-600'
                                    : 'border-slate-600 text-slate-400'
                            }`}
                          >
                            {isBlocked && !isDone ? (
                              <Lock className="h-2.5 w-2.5" />
                            ) : loading && isCurrent ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isDone ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                          </span>
                          <span
                            className={`whitespace-nowrap text-[11px] ${
                              isCurrent ? `font-semibold ${accent.label}` : isDone ? 'text-emerald-300/80' : 'text-slate-400'
                            }`}
                          >
                            {stage.label}
                          </span>
                          {/*
                            PENDING NEVER READS AS FAILURE (operator
                            instruction, 2026-08-09) — a distinct amber
                            badge, never rose/red, and only rendered once
                            this prong's own projection is known. Text comes
                            from `projection.label` (consequenceForkProjection.ts's
                            `consequenceProngCopy` — "the ONE place this
                            fork's tier copy is written") rather than a
                            second hardcoded string here, so the pill can
                            never drift from that canonical copy again (it
                            said "Pending" here while the source of truth
                            already said "DVN Pending").
                          */}
                          {projection && projection.tier === 'pending-observer-active' && (
                            <span className="whitespace-nowrap rounded-full border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                              {projection.label}
                            </span>
                          )}
                          {projection && projection.tier === 'proven-consequence' && isDone && (
                            <span className="whitespace-nowrap rounded-full border border-emerald-800/60 bg-emerald-950/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                              {projection.label}
                            </span>
                          )}
                        </button>
                      </div>
                    </React.Fragment>
                  );
                })}
                </div>
              </React.Fragment>
            );
          })()}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-2">
          {activeStage.surfaces.map((surfaceRef, i) => {
            const descriptor = JOURNEY_SURFACES[surfaceRef.ref];
            if (!descriptor) {
              return (
                <div key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">
                  Surface not registered: {surfaceRef.ref}
                </div>
              );
            }
            if (descriptor.kind === 'embed') {
              // In-place chrome toggle (2026-08-10): each embed can toggle
              // between focused (Lite) and expanded (Full) presentation states
              // without leaving the journey. The iframe reloads when src changes.
              const isExpanded = expandedEmbedIndices.has(i);
              const shouldFocus = !isExpanded && descriptor.focused;
              const src = buildEmbedSurfaceSrc(
                { ...descriptor, focused: shouldFocus ? true : undefined },
                { personaId, selectedAgentSlug },
                buildCodexUrl
              );
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  {descriptor.focused && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => toggleEmbedExpansion(i)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-none border-none cursor-pointer p-0"
                      >
                        {isExpanded ? 'Focus view' : (descriptor.openLabel ?? 'Open full view ↗')}
                      </button>
                    </div>
                  )}
                  <iframe
                    src={src}
                    title={surfaceRef.ref}
                    className={`w-full rounded-md border border-slate-800 bg-slate-950 ${
                      fullScreen || shouldFocus ? 'h-[calc(100vh-200px)]' : 'h-[36rem]'
                    }`}
                  />
                </div>
              );
            }
            if (descriptor.kind === 'api') {
              return (
                <a
                  key={i}
                  href={descriptor.route}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/40"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {descriptor.note}
                </a>
              );
            }
            if (descriptor.kind === 'external-url-unresolved') {
              return (
                <div key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
                  <p className="text-slate-300">Awaiting confirmation from Horizen</p>
                  <p className="mt-1">{descriptor.note}</p>
                </div>
              );
            }
            if (descriptor.kind === 'component-new') {
              return (
                <div key={i} className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
                  <Construction className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <div>
                    <p className="font-medium text-slate-300">{descriptor.component} — not yet built</p>
                    <p className="mt-1">{descriptor.note}</p>
                    <p className="mt-1 text-slate-500">Tracked in {descriptor.trackedIn}.</p>
                  </div>
                </div>
              );
            }
            if (descriptor.kind === 'component') {
              const Component = components[descriptor.component];
              if (!Component) {
                return (
                  <div key={i} className="rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
                    {descriptor.component} is marked built in the registry but is not wired into this
                    journey&apos;s `components` map.
                  </div>
                );
              }
              const extraProps =
                resolveSurfaceProps?.({ surfaceRef, descriptor, stage: activeStage, runtimeState, pnlEvidence, ratifySubPredicates, registerCeremony }) ?? {};
              return (
                /*
                 * Keyed by the SURFACE, not by array position.
                 *
                 * `key={i}` made every stage's first surface key "0". Two
                 * stages mounting the SAME component there — Deploy and
                 * Standing both mount ParticipationStandingTab, pinned to
                 * different views — reconcile into one instance instead of
                 * remounting, so the second stage inherits the first's state
                 * and renders the first's content. Identity must come from
                 * what is being rendered, never from where it sits in a list.
                 */
                <div key={`${activeStage.id}:${surfaceRef.ref}`}>
                  <Component personaId={personaId} {...extraProps} {...(surfaceRef.props ?? {})} />
                </div>
              );
            }
            return (
              <div key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
                {descriptor.note}
              </div>
            );
          })}
        </div>
        {/* Suppressed where the stage's own surface already shows its
            receipts (see JourneyStageDefinition.receiptsSurfacedNatively) —
            two renderings of the same evidence is not more evidence. */}
        {!activeStage.receiptsSurfacedNatively && (
          <StageReceiptsDrawer
            receiptTypes={activeStage.receiptTypes}
            agentsInvoked={
              activeStage.receiptsScopedToSubjectAgent && receiptsSubjectAgentRef
                ? [receiptsSubjectAgentRef]
                : undefined
            }
            // CFS-055 coherence pass (2026-08-10) — the SAME canonical
            // evidence the checklist popover above already renders, never a
            // second computation. Primary source for the drawer now.
            canonicalEvidencePresent={activeStageRuntime?.evidencePresent}
            canonicalReceiptRefs={activeStageRuntime?.receiptRefs}
          />
        )}
      </div>
    </div>
  );

  if (!fullScreen) return content;

  /* Named layer, not a local number — the wallet overlay must sit ABOVE this
     (components/ui/overlayLayers.ts). Fullscreen is the stage; the wallet is
     the act performed on it. */
  return createPortal(
    <div className={`fixed inset-0 ${overlayZClass('CARTRIDGE_FULLSCREEN')} bg-slate-950`}>{content}</div>,
    document.body,
  );
}

export default JourneyRunSurface;
