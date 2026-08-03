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
import { Check, Lock, Loader2, RefreshCw, ExternalLink, Construction, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';
import { JOURNEY_SURFACES, type JourneySurfaceDescriptor } from '@/services/journey/journeySurfaceRegistry';
import { StageReceiptsDrawer } from '@/components/journey/StageReceiptsDrawer';
import type { JourneyDefinition, JourneyMilestone, JourneyRuntimeState, JourneyStageDefinition, JourneySurfaceRef } from '@/types/journey';
import type { JourneyAct, StageResolution } from '@/services/journey/stageResolution';
import { overlayZClass } from '@/components/ui/overlayLayers';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

/**
 * The server's monotonic resolution, when the journey's state route supplies
 * one. Optional so a journey that has not adopted the layer (the Validation
 * Programme) keeps rendering exactly as before — adoption is per-journey, and
 * an absent block means "this journey reports evidence only", never "nothing
 * is complete".
 */
interface JourneyResolutionPayload {
  stages: StageResolution[];
  milestones: JourneyMilestone[];
  highestMilestone: JourneyMilestone | null;
  nextExecutableAct: JourneyAct | null;
  complete: boolean;
}

/**
 * The two post-activation branches. Rendered as a PAIR of independent offers,
 * deliberately not as a continuation of the stepper line: a line would imply
 * an order, and the operator ruled that neither branch gates the other.
 */
interface BranchOfferPayload {
  branch: 'factory' | 'capability';
  stageId: string;
  label: string;
  outcome: string;
  complete: boolean;
  available: boolean;
}

/**
 * One status row above the stepper, crossfading between whichever of
 * description/Awaiting/Refused apply for the active stage. Parent remounts
 * this with `key={activeStageId}` so switching stages always starts fresh at
 * slide 0, fully visible.
 */
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
  }) => Record<string, unknown>;
}

export function JourneyRunSurface({
  journey,
  stateUrl,
  personaId,
  headerLabel,
  documentTitle,
  components,
  resolveSurfaceProps,
}: JourneyRunSurfaceProps) {
  const [runtimeState, setRuntimeState] = useState<JourneyRuntimeState | null>(null);
  const [resolution, setResolution] = useState<JourneyResolutionPayload | null>(null);
  const [branchOffers, setBranchOffers] = useState<BranchOfferPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  /**
   * The act the operator was last shown. Routing follows a CHANGE in the next
   * act, never its mere presence — otherwise every poll would yank them back
   * to the runtime's idea of "current" and a deliberate look at an earlier
   * stage would be impossible (MS-5: a deliberate act outranks an ambient
   * observation).
   */
  const lastActRef = useRef<string | null>(null);
  // Read inside `refresh` without making the journey a dependency of it — the
  // definition is static per mount, and adding it would re-fetch on every
  // parent render.
  const journeyRef = useRef(journey);
  journeyRef.current = journey;

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
      const next = (json.resolution as JourneyResolutionPayload | undefined) ?? null;
      setResolution(next);
      setBranchOffers((json.branchOffers as BranchOfferPayload[] | undefined) ?? []);

      /*
       * ROUTE TO THE NEXT EXECUTABLE ACT (operator ruling, 2026-08-03).
       *
       *   > "After each successful act, take the operator to the next required
       *   >  stage — never back to cartridge home/Lab/dashboard."
       *
       * `selectedStageId` used to win forever once set, so completing a stage
       * left the operator sitting on the stage they had just finished, with
       * nothing indicating where to go. Following the act only when its id
       * CHANGES preserves a deliberate selection while still advancing on a
       * real state transition.
       */
      const actId = next?.nextExecutableAct?.actId ?? null;
      if (actId && lastActRef.current !== null && lastActRef.current !== actId) {
        const stageId = next?.nextExecutableAct?.stageId;
        if (stageId && journeyRef.current.stages.some((s) => s.id === stageId)) setSelectedStageId(stageId);
      }
      lastActRef.current = actId;
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
  const activeResolution = resolution?.stages.find((s) => s.stageId === activeStageId) ?? null;
  const nextAct = resolution?.nextExecutableAct ?? null;

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

  const content = (
    <div className="flex h-full flex-col gap-4 p-4 text-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/metaMe/metaMe/metame-32.png" alt="" className="h-4 w-4 shrink-0" />
          {headerLabel}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh state
          </button>
          <button
            onClick={() => setFullScreen((v) => !v)}
            title={fullScreen ? 'Collapse' : 'Full screen'}
            className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
          >
            {fullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

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

      <div className="flex items-center gap-2 overflow-hidden text-xs">
        <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 font-semibold text-purple-200">
          {activeIdx + 1}
        </span>
        <span className="shrink-0 font-medium text-slate-100">{activeStage.label}</span>
        <span className="shrink-0 text-slate-600">—</span>
        <RotatingStatusLine
          key={activeStageId}
          slides={[
            { key: 'description', node: <span className="text-slate-400">{activeStage.description}</span> },
            ...(activeStageRuntime && activeStageRuntime.evidenceMissing.length > 0
              ? [{ key: 'awaiting', node: <span className="text-slate-400">Awaiting: {activeStageRuntime.evidenceMissing.map(humaniseSignal).join(', ')}</span> }]
              : []),
            ...(activeStageRuntime?.refusalReason
              ? [{ key: 'refused', node: <span className="text-rose-300">Refused: {activeStageRuntime.refusalReason}</span> }]
              : []),
          ]}
        />
      </div>

      {/*
        WHERE YOU ARE · WHAT IS COMPLETE · WHAT IS BLOCKING · WHAT IS NOT ·
        THE ONE NEXT ACT (operator ruling, 2026-08-03).

        Rendered ONLY from the server's resolution — this component computes
        no completion of its own. A surface that derived its own answer would
        be a second observer of the same fact, which is the defect the whole
        settled-fact layer exists to end.
      */}
      {activeResolution && (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* STAGE TRUTH and STAGE EVIDENCE, side by side and never merged.
                A complete stage with partial evidence must read as complete —
                that is the entire point of separating them. */}
            <span
              className={`rounded px-1.5 py-0.5 font-medium ${
                activeResolution.canonicalOutcome
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-slate-700/40 text-slate-300'
              }`}
            >
              {activeResolution.canonicalOutcome ? 'Outcome established' : 'Outcome not yet established'}
            </span>
            <span className="text-slate-500">
              Evidence {activeResolution.evidenceCompleteness}
              {activeResolution.evidenceCompleteness !== 'complete' && activeResolution.canonicalOutcome
                ? ' — evidence gaps do not change the outcome'
                : ''}
            </span>
            {resolution?.highestMilestone && (
              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-200">
                {resolution.highestMilestone.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* BLOCKING — each one terminating in an act, never in prose. */}
          {activeResolution.operationalBlockers.map((blocker) => (
            <div key={blocker.code} className="rounded-md border border-rose-900/60 bg-rose-950/20 p-2.5">
              <div className="text-rose-200">{blocker.summary}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {blocker.acts.map((act) => (
                  <button
                    key={act.actId}
                    type="button"
                    title={act.detail}
                    onClick={() => (act.kind === 're-check' ? void refresh() : selectStage(act.stageId))}
                    className="rounded border border-rose-800/60 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-950/50"
                  >
                    {act.label}
                  </button>
                ))}
              </div>
              {blocker.acts.some((a) => a.detail) && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] text-rose-200/60 hover:text-rose-200">Exact remedy</summary>
                  {blocker.acts
                    .filter((a) => a.detail)
                    .map((a) => (
                      <code key={a.actId} className="mt-1 block break-all text-[11px] text-rose-200/70">
                        {a.detail}
                      </code>
                    ))}
                </details>
              )}
            </div>
          ))}

          {/* NON-BLOCKING — amber, and explicitly labelled as stopping
              nothing. A warning is not a refusal. */}
          {activeResolution.nonBlockingExceptions.length > 0 && (
            <details className="rounded-md border border-amber-900/60 bg-amber-950/20 p-2.5">
              <summary className="cursor-pointer text-amber-200">
                {activeResolution.nonBlockingExceptions.length} disclosed exception
                {activeResolution.nonBlockingExceptions.length === 1 ? '' : 's'} — blocking nothing
              </summary>
              <ul className="mt-1.5 space-y-1.5">
                {activeResolution.nonBlockingExceptions.map((exception) => (
                  <li key={exception.code + exception.recordId} className="text-[11px] text-amber-200/80">
                    <span className="text-amber-100">{exception.recordLabel}</span> — {exception.cause}
                    <div className="text-amber-200/60">{exception.consequence}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* AUDIT GAPS — visible, named, and never mistaken for absence of
              the outcome. */}
          {activeResolution.auditGaps.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                {activeResolution.auditGaps.length} audit gap{activeResolution.auditGaps.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-400">
                {activeResolution.auditGaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </details>
          )}

          {/*
            THE TWO POST-ACTIVATION BRANCHES (operator ruling, 2026-08-03).

            Rendered SIDE BY SIDE, never as a continuation of the stepper —
            a line would imply an order, and neither branch gates the other.
            Each offer states the OUTCOME the operator gets, not the mechanism
            that delivers it. Shown only once activation makes them executable
            (MS-9: a control that cannot act must not render).
          */}
          {branchOffers.some((offer) => offer.available) && (
            <div className="border-t border-slate-800 pt-2">
              <div className="text-slate-500">Agent activated. Continue with either — neither waits on the other:</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {branchOffers
                  .filter((offer) => offer.available)
                  .map((offer) => (
                    <button
                      key={offer.branch}
                      type="button"
                      onClick={() => selectStage(offer.stageId)}
                      className={`rounded-md border p-2.5 text-left transition-colors ${
                        offer.complete
                          ? 'border-emerald-900/60 bg-emerald-950/20 hover:bg-emerald-950/40'
                          : 'border-slate-700 bg-slate-950/40 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {offer.complete && <Check className="h-3 w-3 shrink-0 text-emerald-300" />}
                        <span className={offer.complete ? 'text-emerald-200' : 'text-slate-200'}>{offer.label}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">{offer.outcome}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* THE ONE NEXT ACT. */}
          {nextAct && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
              <span className="text-slate-500">Next:</span>
              <button
                type="button"
                title={nextAct.detail}
                onClick={() => (nextAct.kind === 're-check' ? void refresh() : selectStage(nextAct.stageId))}
                className="rounded border border-purple-700/60 bg-purple-950/30 px-2 py-1 text-[11px] text-purple-100 hover:bg-purple-950/50"
              >
                {nextAct.label}
              </button>
            </div>
          )}
        </div>
      )}

      {/*
        EVIDENCE CHECKLIST — the pilot must not need a SQL console to learn why
        a finished-looking stage is not complete (operator, 2026-08-03: "The
        application should eventually expose this same receipt checklist
        directly in the Journey interface so you are not required to use
        Supabase for normal pilot completion").

        Every value here already travelled to this component in
        `evidencePresent` / `evidenceMissing` / `receiptRefs` — the surface was
        summarising it to a comma list and discarding the met/unmet split. This
        renders the same server-derived facts, and computes nothing of its own:
        a checklist that could disagree with the stage state would be one more
        thing to go stale (the same rule registerCeremonyProgress follows).
      */}
      {activeStageRuntime && (activeStageRuntime.evidencePresent.length > 0 || activeStageRuntime.evidenceMissing.length > 0) && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
            Evidence checklist — {activeStageRuntime.evidencePresent.length} of{' '}
            {activeStageRuntime.evidencePresent.length + activeStageRuntime.evidenceMissing.length} recorded
            {activeStageRuntime.receiptRefs.length > 0 ? ` · ${activeStageRuntime.receiptRefs.length} receipts` : ''}
          </summary>
          <ul className="mt-1.5 space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
            {activeStageRuntime.evidencePresent.map((sig) => (
              <li key={sig} className="flex items-center gap-2 text-[11px] text-emerald-300/80">
                <Check className="h-3 w-3 shrink-0" />
                <span>{humaniseSignal(sig)}</span>
              </li>
            ))}
            {activeStageRuntime.evidenceMissing.map((sig) => (
              <li key={sig} className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="h-3 w-3 shrink-0 rounded-full border border-slate-600" />
                <span>{humaniseSignal(sig)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

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
          className="flex items-center overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {journey.stages.map((stage, i) => {
            const stageState = runtimeState?.stages.find((s) => s.stageId === stage.id)?.state ?? 'NOT_STARTED';
            const isDone = stageState === 'COMPLETE';
            const isCurrent = stage.id === activeStageId;
            const isBlocked = stageState === 'BLOCKED';
            const prevDone =
              i === 0 ||
              (runtimeState?.stages.find((s) => s.stageId === journey.stages[i - 1].id)?.state ?? 'NOT_STARTED') ===
                'COMPLETE';
            return (
              <React.Fragment key={stage.id}>
                {i > 0 && <div className={`h-px flex-1 min-w-[16px] ${prevDone ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />}
                <button
                  data-stage-id={stage.id}
                  onClick={() => selectStage(stage.id)}
                  className="flex shrink-0 items-center gap-1.5 px-1"
                  title={isBlocked ? 'Blocked — prerequisites not yet met' : stage.description}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                      isDone
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : isCurrent
                          ? 'border-purple-400 bg-purple-500/20 text-purple-200'
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
                      i + 1
                    )}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[11px] ${
                      isCurrent ? 'font-semibold text-purple-200' : isDone ? 'text-emerald-300/80' : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
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
              const src = buildCodexUrl(descriptor.codexSlug, {
                tab: descriptor.tab,
                personaId,
                shell: 'embed',
                // Declared on the surface, not decided here: only a cartridge
                // that mounts its own floating copilot needs suppressing, and
                // the registry is where what-is-being-composed is recorded.
                suppressCopilot: descriptor.suppressFloatingCopilot,
              });
              return (
                <iframe
                  key={i}
                  src={src}
                  title={surfaceRef.ref}
                  className={`w-full rounded-md border border-slate-800 bg-slate-950 ${fullScreen ? 'h-[calc(100vh-200px)]' : 'h-[36rem]'}`}
                />
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
              const extraProps = resolveSurfaceProps?.({ surfaceRef, descriptor, stage: activeStage }) ?? {};
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
          <StageReceiptsDrawer receiptTypes={activeStage.receiptTypes} />
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
