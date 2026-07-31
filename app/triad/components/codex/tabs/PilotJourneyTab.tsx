'use client';

/**
 * PilotJourneyTab — Partner workspace "Pilot > Journey" surface (PRD-GJR-001
 * §6, §7, §14). Renders the Guided Journey Runtime for the one configured
 * journey (services/journey/horizenMoneyPennyJourney.ts): a compact circles-
 * and-lines stage stepper (mirrors AccessionProgressBar's visual pattern,
 * app/triad/components/codex/AccessionProgressBar.tsx — the IRL onboarding
 * stepper) over the current stage's real composed surface(s) — never a
 * parallel demo app, and never its own embedded Companion panel (§0, §5.9).
 * The platform's real Companion (Metayé) is a separate, independently
 * toggled overlay; this component does not duplicate it.
 *
 * One-State Principle (§5.3): stage state comes ONLY from
 * /api/journey/moneypenny-horizen/state, which resolves it via
 * resolveJourneyState() against real receipts/Agent Card data. This
 * component never marks a stage complete on its own — clicking a stage node
 * only selects which stage's surface is shown (§5.1).
 *
 * Full-screen (operator UI review, 2026-07-31): an expand toggle portals the
 * stepper + viewport to a fixed, full-viewport overlay via createPortal —
 * raised above the Venture Lab shell's z-index, not a modal/popup. Collapse
 * returns it to its normal embedded position; nothing unmounts either way.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Lock, Loader2, RefreshCw, ExternalLink, Construction, Maximize2, Minimize2 } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { AgentCardSurface } from '@/components/journey/AgentCardSurface';
import { PassportBureauApplyTab } from './PassportBureauApplyTab';
import { BoundedDelegationTab } from './BoundedDelegationTab';
import { ParticipationStandingTab } from './ParticipationStandingTab';
import type { JourneyRuntimeState } from '@/types/journey';

interface PilotJourneyTabProps {
  personaId?: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  theme?: string;
}

/**
 * Real, built journey-surface components, keyed by
 * journeySurfaceRegistry.ts's `component` name. Only surfaces the registry
 * marks `kind: 'component'` (built) resolve here — `kind: 'component-new'`
 * entries render the explicit "not yet built" state below instead, never a
 * silent fallback into this map.
 *
 * PassportBureauApplyTab / BoundedDelegationTab / ParticipationStandingTab
 * are rendered bare (Guided Journey Runtime §24.4 Navigation Suppression) —
 * the same Venture Lab α Participate modules, with no cartridge nav or
 * tab-group chrome around them. The aigentMe focus-disposition ceremony
 * (formerly bolted onto this tab's 'aigentme' stage) now lives as a capsule
 * inside AigentMeWelcomeSplitTab itself (§24.8 Ceremony Capsule Principle).
 */
const JOURNEY_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  AgentCardSurface,
  PassportBureauApplyTab,
  BoundedDelegationTab,
  ParticipationStandingTab,
};

function PilotJourneyTabInner({ personaId }: PilotJourneyTabProps) {
  const [runtimeState, setRuntimeState] = useState<JourneyRuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);

  const journey = HORIZEN_MONEYPENNY_JOURNEY;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/journey/moneypenny-horizen/state', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Journey state request failed (${res.status})`);
      const json = await res.json();
      setRuntimeState(json.state as JourneyRuntimeState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journey state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Companion synchronization (PRD-GJR-001 §11.5, operator ruling 2026-07-31):
  // one journey state, multiple authorized renderers. Selecting a stage here
  // or in the Companion's quick-link carousel (JourneyCompanionCarousel.tsx)
  // dispatches/receives the same `journey:select-stage` event, so both stay
  // on the same stage without either owning the other's state. Location and
  // context only — this never completes a stage (§11.7 temporary invariant).
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

  // Escape collapses full screen — matches the old cartridge full-screen convention.
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
  const activeIdx = journey.stages.findIndex((s) => s.id === activeStageId);

  const content = (
    <div className="flex h-full flex-col gap-4 p-4 text-slate-100">
      {/* Header — single row (operator note 2026-07-31: don't repeat
          "Horizen × metaMe" across an eyebrow + title, and drop the
          not-currently-relevant "Founder Office" aside). */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 font-semibold text-slate-100">Horizen × metaMe</span>
          <span className="shrink-0 text-slate-600">·</span>
          <span className="truncate text-slate-300">{journey.label}</span>
          <span className="shrink-0 text-slate-600">·</span>
          <span className="shrink-0 text-xs text-slate-500">Destination: aigentMe</span>
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
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error} — journey state could not be resolved; no stage is assumed complete.
        </div>
      )}

      {/* Stage description — one condensed line, ABOVE the stepper (operator
          note 2026-07-31: frees vertical room for the stage content below,
          which matters most at the Agent/aigentMe stages). */}
      <div className="flex items-center gap-2 overflow-hidden text-xs">
        <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 font-semibold text-purple-200">
          {activeIdx + 1}
        </span>
        <span className="shrink-0 font-medium text-slate-100">{activeStage.label}</span>
        <span className="shrink-0 text-slate-600">—</span>
        <span className="truncate text-slate-400">{activeStage.description}</span>
      </div>
      {activeStageRuntime && activeStageRuntime.evidenceMissing.length > 0 && (
        <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-400">
          Awaiting: {activeStageRuntime.evidenceMissing.join(', ')}
        </div>
      )}
      {activeStageRuntime?.refusalReason && (
        <p className="rounded-md border border-rose-900/60 bg-rose-950/30 p-2 text-xs text-rose-300">
          Refused: {activeStageRuntime.refusalReason}
        </p>
      )}

      {/* Stage stepper — circles + connecting lines, mirroring AccessionProgressBar.
          Clicking selects a stage's viewport; it never completes a stage (§5.1). */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-4 py-2.5 rounded-lg">
        <div className="flex items-center overflow-x-auto">
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

      {/* Stage viewport — composes the stage's real surfaces (§5.9). Full width:
          the Companion is a separate, independently-toggled overlay elsewhere
          in the shell, never duplicated here. Description/Awaiting/Refused
          now render above the stepper (operator note 2026-07-31) so this
          viewport keeps the room, especially at the Agent/aigentMe stages. */}
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
              const src = buildCodexUrl(descriptor.codexSlug, { tab: descriptor.tab, personaId, shell: 'embed' });
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
              // Quieter than an error card (operator UI review, 2026-07-31): this
              // isn't a Journey failure, it's a genuine external data gap — the
              // human-browsable Horizen URL hasn't been confirmed yet. Once one
              // is supplied, this surface resolves to an 'api'/'embed' descriptor
              // and the Companion/browser shell opens it; no iframe support for
              // partner sites is required here.
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
              const Component = JOURNEY_COMPONENTS[descriptor.component];
              if (!Component) {
                return (
                  <div key={i} className="rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
                    {descriptor.component} is marked built in the registry but is not wired into
                    PilotJourneyTab&apos;s JOURNEY_COMPONENTS map.
                  </div>
                );
              }
              return (
                <div key={i}>
                  <Component personaId={personaId} {...(surfaceRef.props ?? {})} />
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
      </div>
    </div>
  );

  if (!fullScreen) return content;

  // Raised above the shell's z-index via a portal to document.body — not a
  // modal, not a popup: the same content, rendered outside the Venture Lab
  // shell so it can occupy the full viewport, un-distracted.
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-950">{content}</div>,
    document.body,
  );
}

export function PilotJourneyTab(props: PilotJourneyTabProps) {
  return <PilotJourneyTabInner {...props} />;
}

export default PilotJourneyTab;
