'use client';

/**
 * PilotJourneyTab — Partner workspace "Pilot > Journey" surface (PRD-GJR-001
 * §6, §7, §14). Renders the Guided Journey Runtime for the one configured
 * journey (services/journey/horizenMoneyPennyJourney.ts): a compact stage
 * bar, the current stage's real composed surface(s), and a Companion
 * narrative overlay — never a parallel demo app (§0, §5.9).
 *
 * One-State Principle (§5.3): stage state comes ONLY from
 * /api/journey/moneypenny-horizen/state, which resolves it via
 * resolveJourneyState() against real receipts/Agent Card data. This
 * component never marks a stage complete on its own — clicking a stage bar
 * item only selects which stage's surface is shown (§5.1).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Lock, Loader2, RefreshCw, ExternalLink, Construction } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { AigentMeFocusDispositionPrompt } from '@/components/journey/AigentMeFocusDispositionPrompt';
import { AgentCardSurface } from '@/components/journey/AgentCardSurface';
import type { JourneyRuntimeState, JourneyStageState } from '@/types/journey';

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
 */
const JOURNEY_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  AigentMeFocusDispositionPrompt,
  AgentCardSurface,
};

const STAGE_ICON: Record<JourneyStageState, React.ReactNode> = {
  COMPLETE: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  IN_PROGRESS: <Loader2 className="h-4 w-4 text-purple-400 animate-pulse" />,
  READY: <Circle className="h-4 w-4 text-slate-300" />,
  NOT_STARTED: <Circle className="h-4 w-4 text-slate-600" />,
  BLOCKED: <Lock className="h-4 w-4 text-slate-600" />,
  REFUSED: <Lock className="h-4 w-4 text-rose-400" />,
  QUARANTINED: <Lock className="h-4 w-4 text-amber-400" />,
};

export function PilotJourneyTab({ personaId }: PilotJourneyTabProps) {
  const [runtimeState, setRuntimeState] = useState<JourneyRuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

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

  const activeStageId = selectedStageId ?? runtimeState?.currentStageId ?? journey.stages[0]?.id;
  const activeStage = journey.stages.find((s) => s.id === activeStageId) ?? journey.stages[0];
  const activeStageRuntime = runtimeState?.stages.find((s) => s.stageId === activeStageId);

  return (
    <div className="flex h-full flex-col gap-4 p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Horizen × metaMe</p>
          <h2 className="text-lg font-semibold text-slate-100">{journey.label}</h2>
          <p className="text-xs text-slate-400">Destination: aigentMe (Founder Office available as a next destination)</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh state
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error} — journey state could not be resolved; no stage is assumed complete.
        </div>
      )}

      {/* Journey bar — clicking selects a stage's viewport; it never completes a stage (§5.1). */}
      <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40 p-2">
        {journey.stages.map((stage, idx) => {
          const stageState = runtimeState?.stages.find((s) => s.stageId === stage.id)?.state ?? 'NOT_STARTED';
          const isActive = stage.id === activeStageId;
          return (
            <button
              key={stage.id}
              onClick={() => setSelectedStageId(stage.id)}
              title={stageState === 'BLOCKED' ? 'Blocked — prerequisites not yet met' : stage.description}
              className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                isActive
                  ? 'border-purple-700/60 bg-purple-950/30 text-purple-100'
                  : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              {STAGE_ICON[stageState]}
              <span>{idx + 1}. {stage.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[2fr_1fr]">
        {/* Stage viewport — composes the stage's real surfaces (§5.9). */}
        <div className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div>
            <h3 className="text-sm font-medium text-slate-100">{activeStage.label}</h3>
            <p className="text-xs text-slate-400">{activeStage.description}</p>
          </div>
          {activeStageRuntime && activeStageRuntime.evidenceMissing.length > 0 && (
            <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
              Awaiting: {activeStageRuntime.evidenceMissing.join(', ')}
            </div>
          )}
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
                    className="h-96 w-full rounded-md border border-slate-800 bg-slate-950"
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
                  <div key={i} className="rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
                    <p className="font-medium">External URL not yet resolvable</p>
                    <p className="mt-1 text-amber-200/80">{descriptor.note}</p>
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
                    <Component {...(surfaceRef.props ?? {})} />
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

        {/* Companion overlay (§5.9) — narrates the real surfaces above; never renders as one itself. */}
        <div className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">Companion</h4>
          <p className="text-sm text-slate-200">
            {activeStageRuntime?.state === 'COMPLETE' ? activeStage.companion.complete : activeStage.companion.before}
          </p>
          {activeStageRuntime?.refusalReason && (
            <p className="rounded-md border border-rose-900/60 bg-rose-950/30 p-2 text-xs text-rose-300">
              Refused: {activeStageRuntime.refusalReason}
            </p>
          )}
          {activeStageRuntime && activeStageRuntime.receiptRefs.length > 0 && (
            <div className="text-xs text-slate-500">
              Receipts: {activeStageRuntime.receiptRefs.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PilotJourneyTab;
