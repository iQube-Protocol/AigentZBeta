"use client";

/**
 * MetaMeStrategyTab — strategic posture summary.
 *
 * Combines the ExperienceQube meta slice (what you're building, primary
 * goal, stage, active cartridges, confidentiality default) with the
 * Personal ExperienceGuide T1 summary (focus, alignment, precedence).
 *
 * Read-only — edit CTAs route to the existing setup wizards.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Loader2, Layers, Compass, RefreshCw, AlertCircle, Sparkles, Link2, Target } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";
import { ExperienceModelSetupWizard } from "@/components/metame/setup/ExperienceModelSetupWizard";
import { PersonalGuideSetupWizard } from "@/components/metame/setup/PersonalGuideSetupWizard";
import { ExperienceGoalsEditor } from "@/components/metame/setup/ExperienceGoalsEditor";
import {
  ALIGNMENT_LABEL,
  SPHERE_LABEL,
  type PersonalGuideData,
  type SphereAxis,
} from "@/types/experienceGuide";
import type { InferredStrategy } from "@/services/strategy/strategyInference";

interface ExpModelShape {
  configured: boolean;
  meta: {
    experienceName: string | null;
    experienceType: string;
    primaryGoal: string | null;
    currentStage: string;
    activeCartridges: string[];
    confidentialityDefault: string;
    progressModel: string;
  } | null;
}

interface GuideShape {
  configured: boolean;
  guide: PersonalGuideData | null;
}

const STAGE_LABEL: Record<string, string> = {
  setup: "Setup",
  alpha_activation: "Alpha activation",
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

const CONFIDENTIALITY_LABEL: Record<string, string> = {
  private_by_default: "Private by default",
  selective_share: "Selective share",
  open: "Open",
};

export function MetaMeStrategyTab({ personaId }: { personaId?: string }) {
  const [model, setModel] = useState<ExpModelShape | null>(null);
  const [guide, setGuide] = useState<PersonalGuideData | null>(null);
  const [strategy, setStrategy] = useState<InferredStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [loading, setLoading] = useState(!!personaId);
  const [modelWizardOpen, setModelWizardOpen] = useState(false);
  const [guideWizardOpen, setGuideWizardOpen] = useState(false);
  const [goalsEditorOpen, setGoalsEditorOpen] = useState(false);

  useEffect(() => {
    if (!personaId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      personaFetch("/api/assistant/experience-model", { personaIdHint: personaId }).then((r) => r.json() as Promise<ExpModelShape>),
      personaFetch("/api/assistant/experience-guide", { personaIdHint: personaId }).then((r) => r.json() as Promise<GuideShape>),
      personaFetch("/api/assistant/inferred-strategy", { personaIdHint: personaId }).then((r) => r.json() as Promise<{ strategy: InferredStrategy | null }>).catch(() => ({ strategy: null })),
    ])
      .then(([m, g, s]) => {
        if (cancelled) return;
        setModel(m);
        setGuide(g.guide ?? null);
        setStrategy(s.strategy ?? null);
      })
      .catch(() => { /* shape stays null, UI handles it */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);

  const refreshStrategy = useCallback(async () => {
    if (!personaId) return;
    setStrategyLoading(true);
    try {
      const r = await personaFetch("/api/assistant/inferred-strategy", {
        personaIdHint: personaId,
        method: "POST",
      });
      const data = (await r.json()) as { strategy: InferredStrategy | null };
      setStrategy(data.strategy ?? null);
    } catch {
      /* tolerated — keep previous */
    } finally {
      setStrategyLoading(false);
    }
  }, [personaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading strategy…
      </div>
    );
  }

  const meta = model?.meta;
  const hasModel = !!model?.configured && !!meta;
  const hasGuide = !!guide;

  return (
    <div className="p-4 sm:p-6 w-full text-slate-100 space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Strategy</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Your strategic posture across the venture (ExperienceModel) and the personal layer (ExperienceGuide).
        </p>
      </header>

      {/* Venture posture */}
      <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">Venture posture (ExperienceModel)</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {hasModel && (
              <button
                type="button"
                onClick={() => setGoalsEditorOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 hover:border-violet-500/60 text-xs text-slate-300"
              >
                <Target className="w-3 h-3" />
                Edit goals
              </button>
            )}
            <button
              type="button"
              onClick={() => setModelWizardOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 hover:border-violet-500/60 text-xs text-slate-300"
            >
              <RefreshCw className="w-3 h-3" />
              {hasModel ? "Edit" : "Set up"}
            </button>
          </div>
        </div>
        {hasModel && meta ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: structured metadata */}
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm self-start">
              <dt className="text-slate-400">Experience</dt>
              <dd className="text-slate-100">{meta.experienceName ?? "(untitled)"}</dd>
              <dt className="text-slate-400">Primary goal</dt>
              <dd className="text-slate-100">{meta.primaryGoal ?? "—"}</dd>
              <dt className="text-slate-400">Stage</dt>
              <dd className="text-slate-100">{STAGE_LABEL[meta.currentStage] ?? meta.currentStage}</dd>
              <dt className="text-slate-400">Active cartridges</dt>
              <dd className="flex flex-wrap gap-1.5">
                {meta.activeCartridges.length > 0
                  ? meta.activeCartridges.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-200">{c}</span>
                    ))
                  : <span className="text-slate-500">none</span>}
              </dd>
              <dt className="text-slate-400">Confidentiality</dt>
              <dd className="text-slate-100">{CONFIDENTIALITY_LABEL[meta.confidentialityDefault] ?? meta.confidentialityDefault}</dd>
            </dl>
            {/* Right: inferred prose */}
            <div className="rounded border border-slate-700/60 bg-slate-900/40 p-3 text-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  Inferred posture
                  {strategy?.llmEnriched ? null : <span className="text-[10px] uppercase tracking-wider text-slate-500">baseline</span>}
                </span>
                <button
                  type="button"
                  onClick={refreshStrategy}
                  disabled={strategyLoading}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-200 disabled:opacity-50"
                  title="Re-infer strategy"
                >
                  <RefreshCw className={`w-3 h-3 ${strategyLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              {strategy ? (
                <>
                  <p className="text-slate-200 leading-relaxed">{strategy.venturePosture.paragraph}</p>
                  {strategy.venturePosture.unlocks.length > 0 && (
                    <p className="text-xs text-emerald-300">
                      <span className="text-slate-400">Unlocks:</span> {strategy.venturePosture.unlocks.join(" · ")}
                    </p>
                  )}
                  {strategy.venturePosture.blockers.length > 0 && (
                    <p className="text-xs text-amber-300">
                      <span className="text-slate-400">Blockers:</span> {strategy.venturePosture.blockers.join(" · ")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-slate-400 text-xs">
                  Strategy will be inferred once an ExperienceModel is set up.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No ExperienceModel yet. Set one up to anchor your venture-level strategy.
          </p>
        )}
      </section>

      {/* Personal guide posture */}
      <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">Personal posture (ExperienceGuide)</h3>
          </div>
          <button
            type="button"
            onClick={() => setGuideWizardOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 hover:border-violet-500/60 text-xs text-slate-300"
          >
            <RefreshCw className="w-3 h-3" />
            {hasGuide ? "Reassess" : "Set up"}
          </button>
        </div>
        {hasGuide && guide ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm self-start">
              <dt className="text-slate-400">Focus</dt>
              <dd className="text-slate-100">{guide.focusIntent ?? "—"}</dd>
              <dt className="text-slate-400">Alignment</dt>
              <dd className="text-slate-100">{ALIGNMENT_LABEL[guide.alignmentState]}</dd>
              <dt className="text-slate-400">Precedence</dt>
              <dd className="text-slate-100">
                {guide.precedenceMode === "auto"
                  ? "Auto"
                  : `${SPHERE_LABEL[guide.precedenceMode as SphereAxis]} first`}
              </dd>
              <dt className="text-slate-400">Repair risks</dt>
              <dd className="text-slate-100">
                {(guide.repairRisks ?? []).length === 0 ? "None" : `${guide.repairRisks.length} active`}
              </dd>
            </dl>
            <div className="rounded border border-slate-700/60 bg-slate-900/40 p-3 text-sm space-y-2">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Inferred drive
              </div>
              {strategy ? (
                <p className="text-slate-200 leading-relaxed">{strategy.personalPosture.paragraph}</p>
              ) : (
                <p className="text-slate-400 text-xs">
                  Inference will appear once the ExperienceGuide is set up.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No ExperienceGuide yet. Seven short steps will set it up.
          </p>
        )}
      </section>

      {/* Coherence + correlations */}
      {strategy && (hasModel || hasGuide) && (
        <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">Coherence &amp; correlations</h3>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-400">
              confidence: {strategy.confidence}
            </span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{strategy.coherenceNote}</p>
          {strategy.correlations.length > 0 && (
            <ul className="space-y-1.5 text-xs">
              {strategy.correlations.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-300">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 text-[10px] uppercase tracking-wider">
                    {c.relation}
                  </span>
                  <span>
                    <span className="text-slate-100">{c.from}</span>
                    <span className="text-slate-500"> ↔ </span>
                    <span className="text-slate-100">{c.to}</span>
                    <span className="text-slate-400"> — {c.explanation}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasModel && hasGuide && !strategy && (
        <div className="flex items-start gap-2 rounded border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-slate-300">
          <AlertCircle className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
          <span>
            Strategy is read by aigentMe whenever it composes briefs and next-best actions. Keep both layers honest — coherence between venture posture and personal posture is where the leverage lives.
          </span>
        </div>
      )}

      <ExperienceModelSetupWizard
        open={modelWizardOpen}
        onOpenChange={setModelWizardOpen}
        initial={meta ? {
          experienceName: meta.experienceName ?? undefined,
          experienceType: meta.experienceType as never,
          primaryGoal: meta.primaryGoal ?? undefined,
          activeCartridges: meta.activeCartridges as never,
          currentStage: meta.currentStage as never,
          confidentialityDefault: meta.confidentialityDefault as never,
          progressModel: meta.progressModel,
        } : undefined}
        onSaved={(d) => setModel(d as ExpModelShape)}
      />
      <PersonalGuideSetupWizard
        open={guideWizardOpen}
        onOpenChange={setGuideWizardOpen}
        initial={guide}
        onSaved={(g) => setGuide(g)}
      />
      <ExperienceGoalsEditor
        open={goalsEditorOpen}
        onOpenChange={setGoalsEditorOpen}
        personaId={personaId}
        onSaved={() => { void refreshStrategy(); }}
      />
    </div>
  );
}

export default MetaMeStrategyTab;
