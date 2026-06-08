"use client";

/**
 * PersonalExperienceMatrixTab — 7×7 lattice view of the user's
 * Personal ExperienceGuide.
 *
 * Per metaMe Cartridge PRD (Personal ExperienceGuide layer).
 *
 * Rows = Sphere of Agency. Columns = Experience Maturity. Each cell is
 * tinted by the user's overall alignment state; the user's current
 * position on each sphere is highlighted. Hovering a cell reveals its
 * prescription (from `data/experience-guide-matrix.ts`).
 *
 * Reads /api/assistant/experience-guide via the canonical PersonaSpine
 * `personaFetch`. If the guide has not been set up, renders an empty
 * state pointing the user to the welcome surface.
 */

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";
import {
  ALIGNMENT_LABEL,
  MATURITY_LABEL,
  MATURITY_LEVELS,
  SPHERE_AXES,
  SPHERE_LABEL,
  explainOverallAlignment,
  type AlignmentState,
  type MaturityLevel,
  type PersonalGuideData,
  type SphereAxis,
} from "@/types/experienceGuide";
import { EXPERIENCE_MATRIX } from "@/data/experience-guide-matrix";

const ALIGNMENT_CELL_BG: Record<AlignmentState, string> = {
  aligned:  "bg-emerald-500/15 border-emerald-500/40",
  drifting: "bg-amber-500/15 border-amber-500/40",
  at_risk:  "bg-orange-500/15 border-orange-500/40",
  repair:   "bg-rose-500/15 border-rose-500/40",
};

const ALIGNMENT_BADGE_BG: Record<AlignmentState, string> = {
  aligned:  "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  drifting: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  at_risk:  "bg-orange-500/20 text-orange-200 border-orange-500/40",
  repair:   "bg-rose-500/20 text-rose-200 border-rose-500/40",
};

interface ApiResponse {
  configured: boolean;
  guide: PersonalGuideData | null;
}

function PersonalExperienceMatrixInner({ personaId }: { personaId: string }) {
  const [guide, setGuide] = useState<PersonalGuideData | null>(null);
  const [loading, setLoading] = useState(!!personaId);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ sphere: SphereAxis; level: MaturityLevel } | null>(null);

  useEffect(() => {
    if (!personaId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    personaFetch("/api/assistant/experience-guide", { personaIdHint: personaId })
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        setGuide(data.guide ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading your Experience Matrix…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm">
        Failed to load Experience Matrix: {error}
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="p-6 rounded border border-slate-700 bg-slate-800/40 text-slate-300 text-sm">
        <p className="mb-2 font-medium text-slate-100">Your Personal ExperienceGuide is not set up yet.</p>
        <p>Set it up from the aigentMe welcome tab. It takes about three minutes — seven short steps assessing the spheres of your life and how settled your practice feels in each one.</p>
      </div>
    );
  }

  const overall = guide.alignmentState;
  const sphereAlignment = guide.sphereAlignment;
  const overallExplainer = explainOverallAlignment(sphereAlignment);

  return (
    <div className="p-4 sm:p-6 w-full text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Personal Experience Matrix</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sphere of Agency (Legacy → Energy) × Experience Maturity. Each row is tinted by your alignment for that sphere — so you can see at a glance which spheres are aligned, drifting, at risk, or in repair. Highlighted cell is your current maturity on each sphere.
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block text-xs px-2 py-1 rounded-full border ${ALIGNMENT_BADGE_BG[overall]}`} title={overallExplainer}>
            Overall: {ALIGNMENT_LABEL[overall]}
          </span>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[280px]">{overallExplainer}</p>
        </div>
      </div>

      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-separate" style={{ borderSpacing: 4 }}>
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-medium pr-2">Sphere ↑ / Maturity →</th>
              {MATURITY_LEVELS.map((m) => (
                <th key={m} className="text-left text-slate-300 font-medium px-2 py-1 whitespace-nowrap">
                  {MATURITY_LABEL[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...SPHERE_AXES].reverse().map((sphere) => {
              const rowAlignment = sphereAlignment[sphere];
              const rowCellBg = ALIGNMENT_CELL_BG[rowAlignment];
              return (
                <tr key={sphere}>
                  <td className="text-slate-300 font-medium pr-3 align-top whitespace-nowrap">
                    <div className="flex items-center justify-between gap-3 min-w-[170px]">
                      <span className="text-left">{SPHERE_LABEL[sphere]}</span>
                      <span
                        className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${ALIGNMENT_BADGE_BG[rowAlignment]}`}
                        title={`${SPHERE_LABEL[sphere]} alignment — ${ALIGNMENT_LABEL[rowAlignment]}`}
                      >
                        {ALIGNMENT_LABEL[rowAlignment]}
                      </span>
                    </div>
                  </td>
                  {MATURITY_LEVELS.map((level) => {
                    const isCurrent = guide.sphereMaturity[sphere] === level;
                    const cell = EXPERIENCE_MATRIX[sphere][level];
                    const ring = isCurrent ? "ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-900" : "";
                    return (
                      <td
                        key={level}
                        onMouseEnter={() => setHoveredCell({ sphere, level })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`min-w-[90px] max-w-[140px] align-top px-2 py-1.5 rounded border cursor-default transition ${
                          isCurrent ? "bg-violet-500/20 border-violet-500/60" : rowCellBg
                        } ${ring}`}
                        title={`${SPHERE_LABEL[sphere]} · ${ALIGNMENT_LABEL[rowAlignment]} · ${cell.prescription}`}
                      >
                        <span className="block leading-tight text-[11px] text-slate-100">{cell.label}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hover prescription */}
      <div className="mt-4 min-h-[44px]">
        {hoveredCell ? (
          <p className="text-sm text-slate-200">
            <span className="font-medium">
              {SPHERE_LABEL[hoveredCell.sphere]} · {MATURITY_LABEL[hoveredCell.level]}:
            </span>{" "}
            {EXPERIENCE_MATRIX[hoveredCell.sphere][hoveredCell.level].prescription}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Hover a cell to see its prescription.</p>
        )}
      </div>

      {/* Focus intent footer */}
      {guide.focusIntent && (
        <div className="mt-6 rounded border border-slate-700 bg-slate-800/40 p-3">
          <p className="text-xs text-slate-400 mb-1">Current focus</p>
          <p className="text-sm text-slate-100">{guide.focusIntent}</p>
        </div>
      )}
    </div>
  );
}

export function PersonalExperienceMatrixTab({ personaId }: { personaId?: string }) {
  return <PersonalExperienceMatrixInner personaId={personaId ?? ""} />;
}

export default PersonalExperienceMatrixTab;
