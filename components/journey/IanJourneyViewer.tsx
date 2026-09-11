/**
 * Ian Journey Viewer — Stage 4 Integration Test Component
 *
 * Displays the current state of Ian Boundary Research journey, including:
 * - Current stage and phase
 * - Stage states (COMPLETE, READY, BLOCKED, etc.)
 * - Available actions (surfaces) for current stage
 * - Phase completion progress
 * - Recommendations from Journey Spine
 *
 * This component is a reference implementation for integrating Journey Spine
 * state into UI components. It fetches state via `/api/journey/ian/state` and
 * surfaces via `/api/journey/ian/surfaces`.
 */

'use client';

import { useEffect, useState } from 'react';
import type { JourneyRuntimeState } from '@/types/journey';
import { personaFetch } from '@/utils/personaSpine';

interface SurfacesResponse {
  journey: { id: string; label: string };
  surfaces: Record<string, Array<{ mode: string; ref: string; note: string }>>;
}

export function IanJourneyViewer() {
  const [state, setState] = useState<JourneyRuntimeState | null>(null);
  const [surfaces, setSurfaces] = useState<SurfacesResponse | null>(null);
  const [evidenceGaps, setEvidenceGaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Spine-gated routes — MUST use personaFetch, never raw fetch. Raw
        // fetch carries no Authorization header and 401s even for a signed-
        // in persona (CLAUDE.md's Identity & Access Spine rule); the prior
        // bug here produced exactly that: "Error: State fetch failed:" with
        // an empty reason, because HTTP/2 omits a status text for a 401.
        const [stateRes, surfacesRes] = await Promise.all([
          personaFetch('/api/journey/ian/state', { cache: 'no-store' }),
          personaFetch('/api/journey/ian/surfaces', { cache: 'no-store' }),
        ]);

        if (!stateRes.ok) {
          const body = await stateRes.json().catch(() => null);
          throw new Error(`State fetch failed (${stateRes.status}): ${body?.error ?? stateRes.statusText}`);
        }
        if (!surfacesRes.ok) {
          const body = await surfacesRes.json().catch(() => null);
          throw new Error(`Surfaces fetch failed (${surfacesRes.status}): ${body?.error ?? surfacesRes.statusText}`);
        }

        const stateJson = (await stateRes.json()) as { ok: boolean; state: JourneyRuntimeState; evidenceGaps?: string[] };
        const stateData = stateJson.state;
        const surfacesData = (await surfacesRes.json()) as SurfacesResponse;

        setState(stateData);
        setSurfaces(surfacesData);
        setEvidenceGaps(stateJson.evidenceGaps ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading Ian journey state...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!state || !surfaces) {
    return <div className="p-4">No data loaded</div>;
  }

  const currentStage = state.stages.find((s) => s.stageId === state.currentStageId);
  const phaseProgress = state.stages.filter((s) => s.state === 'COMPLETE').length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">{surfaces.journey.label}</h1>
        <p className="text-sm text-gray-600 mt-1">Journey ID: {state.journeyId}</p>
      </div>

      {/* Current Stage */}
      {currentStage && (
        <div className="bg-slate-50 p-4 rounded border border-slate-800">
          <h2 className="font-semibold mb-2">Current Stage</h2>
          <div className="space-y-1">
            <p>
              <span className="font-mono text-sm bg-white px-2 py-1 rounded">
                {currentStage.stageId}
              </span>
            </p>
            <p className="text-sm">
              State: <span className="font-semibold">{currentStage.state}</span>
            </p>
            {currentStage.evidencePresent.length > 0 && (
              <p className="text-sm">
                Evidence: {currentStage.evidencePresent.join(', ')}
              </p>
            )}
            {currentStage.evidenceMissing.length > 0 && (
              <p className="text-sm text-amber-700">
                Pending: {currentStage.evidenceMissing.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Phase Progress */}
      <div className="bg-slate-50 p-4 rounded border border-slate-800">
        <h2 className="font-semibold mb-3">Stage Progression</h2>
        <div className="space-y-2">
          {state.stages.map((s) => (
            <div key={s.stageId} className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  s.state === 'COMPLETE'
                    ? 'bg-green-500'
                    : s.state === 'READY'
                      ? 'bg-blue-500'
                      : s.state === 'IN_PROGRESS'
                        ? 'bg-amber-500'
                        : s.state === 'BLOCKED'
                          ? 'bg-red-500'
                          : 'bg-gray-300'
                }`}
              />
              <span className="font-mono text-sm w-32">{s.stageId}</span>
              <span className="text-sm font-semibold">{s.state}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Available Surfaces */}
      {currentStage && surfaces.surfaces[currentStage.stageId]?.length > 0 && (
        <div className="bg-slate-50 p-4 rounded border border-slate-800">
          <h2 className="font-semibold mb-3">Available Actions</h2>
          <div className="space-y-3">
            {surfaces.surfaces[currentStage.stageId].map((surface, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-slate-200">
                <p className="text-sm font-mono text-slate-700">{surface.ref}</p>
                <p className="text-xs text-slate-600 mt-1">{surface.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-slate-50 p-4 rounded border border-slate-800">
        <h2 className="font-semibold mb-2">Summary</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Completed</p>
            <p className="text-2xl font-bold">
              {state.stages.filter((s) => s.state === 'COMPLETE').length}/
              {state.stages.length}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Status</p>
            <p className="text-2xl font-bold">{state.complete ? '✓' : '…'}</p>
          </div>
          <div>
            <p className="text-gray-600">Current Phase</p>
            <p className="text-sm font-mono">{state.currentStageId}</p>
          </div>
        </div>
      </div>

      {/* Evidence gaps — honest reporting from /api/journey/ian/state, never suppressed */}
      {evidenceGaps.length > 0 && (
        <div className="bg-amber-50 p-4 rounded border border-amber-300">
          <h2 className="font-semibold mb-2 text-amber-900">Evidence Gaps</h2>
          <ul className="space-y-1 list-disc pl-5">
            {evidenceGaps.map((gap, idx) => (
              <li key={idx} className="text-xs text-amber-800">
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Interaction Context (if available) */}
      {state.interactionContext && (
        <div className="bg-slate-50 p-4 rounded border border-slate-800">
          <h2 className="font-semibold mb-2">Recommendations</h2>
          <div className="space-y-2">
            {(state.interactionContext.recommendedNextActions?.length ?? 0) > 0 ? (
              state.interactionContext.recommendedNextActions!.map((action) => (
                <div key={action} className="text-sm font-mono bg-white px-2 py-1 rounded">
                  {action}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600">No recommendations</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
