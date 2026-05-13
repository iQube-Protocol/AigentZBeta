"use client";

/**
 * ExperienceAlignmentTab — Experience Alignment Helper.
 *
 * Per metaMe Cartridge PRD (Personal ExperienceGuide layer).
 *
 * Reads the Personal ExperienceGuide and renders:
 *   - Alignment state banner
 *   - Per-sphere maturity bars
 *   - Repair Risks list (with add/remove)
 *   - Precedence mode selector (live-saves)
 *   - Reassess button (re-opens the PersonalGuideSetupWizard)
 *
 * All writes go to POST /api/assistant/experience-guide via personaFetch.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";
import {
  ALIGNMENT_LABEL,
  MATURITY_LABEL,
  MATURITY_ORDINAL,
  SPHERE_AXES,
  SPHERE_LABEL,
  type AlignmentState,
  type PersonalGuideData,
  type PrecedenceMode,
  type RepairRisk,
  type SphereAxis,
} from "@/types/experienceGuide";
import { PersonalGuideSetupWizard } from "@/components/metame/setup/PersonalGuideSetupWizard";

const ALIGNMENT_BG: Record<AlignmentState, string> = {
  aligned:  "border-emerald-500/40 bg-emerald-500/10",
  drifting: "border-amber-500/40 bg-amber-500/10",
  at_risk:  "border-orange-500/40 bg-orange-500/10",
  repair:   "border-rose-500/40 bg-rose-500/10",
};

const PRECEDENCE_LABELS: Array<{ value: PrecedenceMode; label: string }> = [
  { value: "auto",         label: "Auto" },
  { value: "energy",       label: "Energy" },
  { value: "body",         label: "Body" },
  { value: "mind",         label: "Mind" },
  { value: "emotion",      label: "Emotion" },
  { value: "relationship", label: "Relationship" },
  { value: "community",    label: "Community" },
  { value: "legacy",       label: "Legacy" },
];

interface ApiResponse {
  configured: boolean;
  guide: PersonalGuideData | null;
}

function ExperienceAlignmentInner({ personaId }: { personaId: string }) {
  const [guide, setGuide] = useState<PersonalGuideData | null>(null);
  const [loading, setLoading] = useState(!!personaId);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [savingPrecedence, setSavingPrecedence] = useState(false);
  const [newRiskSphere, setNewRiskSphere] = useState<SphereAxis>("energy");
  const [newRiskSignal, setNewRiskSignal] = useState("");
  const [newRiskSuggestion, setNewRiskSuggestion] = useState("");
  const [savingRisk, setSavingRisk] = useState(false);

  const load = useCallback(async () => {
    if (!personaId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/experience-guide", { personaIdHint: personaId });
      const data = (await res.json()) as ApiResponse;
      setGuide(data.guide ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void load(); }, [load]);

  async function persist(patch: Partial<PersonalGuideData>) {
    const res = await personaFetch("/api/assistant/experience-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      personaIdHint: personaId,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      throw new Error(body?.detail || body?.error || `save failed (${res.status})`);
    }
    const data = (await res.json()) as ApiResponse;
    if (data.guide) setGuide(data.guide);
  }

  async function changePrecedence(next: PrecedenceMode) {
    if (!guide || savingPrecedence) return;
    setSavingPrecedence(true);
    try {
      await persist({ precedenceMode: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPrecedence(false);
    }
  }

  async function addRisk() {
    if (!guide || savingRisk || !newRiskSignal.trim()) return;
    setSavingRisk(true);
    try {
      const risk: RepairRisk = {
        sphere: newRiskSphere,
        signal: newRiskSignal.trim(),
        ...(newRiskSuggestion.trim() ? { suggestion: newRiskSuggestion.trim() } : {}),
      };
      const next: RepairRisk[] = [...(guide.repairRisks ?? []), risk];
      await persist({ repairRisks: next });
      setNewRiskSignal("");
      setNewRiskSuggestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingRisk(false);
    }
  }

  async function removeRisk(idx: number) {
    if (!guide) return;
    const next = (guide.repairRisks ?? []).filter((_, i) => i !== idx);
    try {
      await persist({ repairRisks: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading your Alignment Helper…
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="p-6 rounded border border-slate-700 bg-slate-800/40 text-slate-300 text-sm">
        <p className="mb-3 font-medium text-slate-100">Your Personal ExperienceGuide is not set up yet.</p>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="px-3 py-2 rounded-md bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium"
        >
          Set up your ExperienceGuide
        </button>
        <PersonalGuideSetupWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          initial={null}
          onSaved={(g) => setGuide(g)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full text-slate-100 space-y-5">
      {/* Alignment banner */}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border ${ALIGNMENT_BG[guide.alignmentState]}`}>
        <div>
          <p className="text-xs text-slate-300/80 mb-0.5">Current alignment</p>
          <p className="text-base font-semibold text-slate-100">{ALIGNMENT_LABEL[guide.alignmentState]}</p>
          {guide.focusIntent && (
            <p className="text-xs text-slate-300/80 mt-1 max-w-2xl">Focus: {guide.focusIntent}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/70 hover:bg-slate-800 border border-slate-700 text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reassess
        </button>
      </div>

      {error && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">{error}</div>
      )}

      {/* Sphere maturity bars */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Sphere maturity</h3>
        <div className="space-y-2">
          {SPHERE_AXES.map((sphere) => {
            const level = guide.sphereMaturity[sphere];
            const pct = (MATURITY_ORDINAL[level] / 7) * 100;
            return (
              <div key={sphere} className="grid grid-cols-[120px_1fr_120px] items-center gap-3">
                <span className="text-sm text-slate-300">{SPHERE_LABEL[sphere]}</span>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-violet-500/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 text-right">{MATURITY_LABEL[level]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Precedence selector */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Precedence — which sphere leads</h3>
        <div className="flex flex-wrap gap-1.5">
          {PRECEDENCE_LABELS.map((p) => {
            const selected = p.value === guide.precedenceMode;
            return (
              <button
                key={p.value}
                type="button"
                disabled={savingPrecedence}
                onClick={() => void changePrecedence(p.value)}
                className={`px-2.5 py-1 rounded-full border text-xs transition ${
                  selected
                    ? "bg-violet-500/20 border-violet-500 text-violet-200"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {savingPrecedence && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 ml-1" />}
        </div>
      </section>

      {/* Repair risks */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Repair risks</h3>
        {(guide.repairRisks ?? []).length === 0 && (
          <p className="text-xs text-slate-500 mb-2">No active repair risks — add one if something is pulling you out of alignment.</p>
        )}
        <ul className="space-y-1.5 mb-3">
          {(guide.repairRisks ?? []).map((risk, idx) => (
            <li key={`${risk.sphere}-${idx}`} className="flex items-start justify-between gap-2 px-3 py-2 rounded border border-slate-700 bg-slate-800/40 text-sm">
              <div>
                <span className="text-xs text-slate-400 mr-2">{SPHERE_LABEL[risk.sphere]}</span>
                <span className="text-slate-100">{risk.signal}</span>
                {risk.suggestion && (
                  <p className="text-xs text-slate-400 mt-1">↳ {risk.suggestion}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void removeRisk(idx)}
                className="text-slate-500 hover:text-rose-400"
                aria-label="Remove risk"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={newRiskSphere}
              onChange={(e) => setNewRiskSphere(e.target.value as SphereAxis)}
              className="px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100"
            >
              {SPHERE_AXES.map((s) => (
                <option key={s} value={s}>{SPHERE_LABEL[s]}</option>
              ))}
            </select>
            <input
              type="text"
              value={newRiskSignal}
              onChange={(e) => setNewRiskSignal(e.target.value)}
              placeholder="What is pulling this sphere out of alignment?"
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100"
              maxLength={500}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={newRiskSuggestion}
              onChange={(e) => setNewRiskSuggestion(e.target.value)}
              placeholder="Suggested remedy (optional)"
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100"
              maxLength={500}
            />
            <button
              type="button"
              disabled={savingRisk || !newRiskSignal.trim()}
              onClick={() => void addRisk()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-500 hover:bg-violet-400 text-white text-xs font-medium disabled:opacity-50"
            >
              {savingRisk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add risk
            </button>
          </div>
        </div>
      </section>

      <PersonalGuideSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initial={guide}
        onSaved={(g) => setGuide(g)}
      />
    </div>
  );
}

export function ExperienceAlignmentTab({ personaId }: { personaId?: string }) {
  return <ExperienceAlignmentInner personaId={personaId ?? ""} />;
}

export default ExperienceAlignmentTab;
