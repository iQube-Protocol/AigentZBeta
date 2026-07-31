"use client";

/**
 * VenturePortfolioWizard — the cross-venture portfolio surface, gated to
 * Venture Lab Pro / Elite (wizardAccess.portfolio). It reuses the citizen's own
 * VentureQubes (not the admin scorecard), shows derived cross-venture
 * intelligence (shared capabilities, stage spread), and lets the operator set a
 * portfolio thesis + prioritise their ventures.
 *
 * Reuse, not rebuild: ventures + positions come from the existing venture model;
 * only the portfolio thesis/notes/priority ordering is new (venture_portfolios).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Check, Lock, ArrowUp, ArrowDown, Layers, Plus, Rocket, X, Compass } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MicButton } from "@/components/ui/MicButton";
import { VentureLightWizard } from "./VentureLightWizard";
import { VentureProWizard } from "./VentureProWizard";
import type { VentureOperatingModel, OperatingObjective } from "@/types/ventureQube";

interface VentureSummary {
  id: string;
  name: string;
  stage: string;
  ventureConfidence: number | null;
}

interface Portfolio {
  thesis: string | null;
  notes: string | null;
  ventures: VentureSummary[];
  sharedCapabilities: string[];
  stageSpread: Record<string, number>;
  ventureCount: number;
  operatingModel: VentureOperatingModel | null;
}

const OBJECTIVE_STATUSES: OperatingObjective["status"][] = ["active", "completed", "blocked", "deferred"];

/** newline-delimited text ↔ trimmed string[] (the light-touch list UX). */
const linesToArray = (s: string): string[] =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);
const arrayToLines = (a?: string[]): string => (a ?? []).join("\n");

export function VenturePortfolioWizard({
  open,
  onOpenChange,
  personaId,
  hasPortfolioAccess,
  hasOperatingAccess,
  mode = "portfolio",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  /** Founder Pro/Elite — unlocks the multi-venture portfolio surfaces. */
  hasPortfolioAccess: boolean;
  /**
   * Founder Office (any paid tier) — unlocks the operating brief. Defaults to
   * hasPortfolioAccess for back-compat when a caller only passes the latter.
   */
  hasOperatingAccess?: boolean;
  /**
   * 'portfolio' (default) = full surface (ventures + thesis + priorities +
   * operating brief), Founder Pro/Elite. 'operating' = operating brief only,
   * available to any Founder Office tier (the tier-1 value-add).
   */
  mode?: "portfolio" | "operating";
  onSaved?: () => void;
}) {
  const operatingMode = mode === "operating";
  const canOperate = hasOperatingAccess ?? hasPortfolioAccess;
  const accessGranted = operatingMode ? canOperate : hasPortfolioAccess;
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [order, setOrder] = useState<VentureSummary[]>([]);
  const [thesis, setThesis] = useState("");
  const [notes, setNotes] = useState("");
  // Operating brief (Chief-of-Staff layer).
  const [omMission, setOmMission] = useState("");
  const [omPrimaryMetric, setOmPrimaryMetric] = useState("");
  const [omSuccessMetrics, setOmSuccessMetrics] = useState("");
  const [omPriorityPartners, setOmPriorityPartners] = useState("");
  const [omPriorityActions, setOmPriorityActions] = useState("");
  const [omObjectives, setOmObjectives] = useState<OperatingObjective[]>([]);
  const [omReviewCadence, setOmReviewCadence] = useState("");
  const [omNextReviewDate, setOmNextReviewDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add-venture cycle: Light (create) → optionally deepen with Pro.
  const [addLightOpen, setAddLightOpen] = useState(false);
  const [proVentureId, setProVentureId] = useState<string | null>(null);
  const [proOpen, setProOpen] = useState(false);
  const wasOpen = useRef(false);

  const load = useCallback(async () => {
    if (!accessGranted) return;
    setLoading(true);
    try {
      const res = await personaFetch("/api/venture/portfolio", { personaIdHint: personaId, cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Portfolio & { ok: boolean };
        setPortfolio(data);
        setOrder(data.ventures ?? []);
        setThesis(data.thesis ?? "");
        setNotes(data.notes ?? "");
        const om = data.operatingModel ?? null;
        setOmMission(om?.mission ?? "");
        setOmPrimaryMetric(om?.primaryMetric ?? "");
        setOmSuccessMetrics(arrayToLines(om?.successMetrics));
        setOmPriorityPartners(arrayToLines(om?.priorityPartners));
        setOmPriorityActions(arrayToLines(om?.priorityActions));
        setOmObjectives(om?.activeObjectives ?? []);
        setOmReviewCadence(om?.reviewCadence ?? "");
        setOmNextReviewDate(om?.nextReviewDate ?? "");
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b?.error || `Could not load portfolio (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId, accessGranted]);

  useEffect(() => {
    if (!open || wasOpen.current) { wasOpen.current = open; return; }
    wasOpen.current = true;
    setError(null);
    void load();
  }, [open, load]);

  const move = (i: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const buildOperatingModel = (): VentureOperatingModel | null => {
    const objectives = omObjectives
      .map((o) => ({ objective: o.objective.trim(), status: o.status }))
      .filter((o) => o.objective);
    const om: VentureOperatingModel = {
      mission: omMission.trim() || undefined,
      primaryMetric: omPrimaryMetric.trim() || undefined,
      successMetrics: linesToArray(omSuccessMetrics),
      priorityPartners: linesToArray(omPriorityPartners),
      priorityActions: linesToArray(omPriorityActions),
      activeObjectives: objectives,
      reviewCadence: omReviewCadence.trim() || undefined,
      nextReviewDate: omNextReviewDate.trim() || undefined,
    };
    // Drop empty arrays/undefined so a blank brief persists as null.
    const hasContent =
      om.mission ||
      om.primaryMetric ||
      om.reviewCadence ||
      om.nextReviewDate ||
      (om.successMetrics?.length ?? 0) > 0 ||
      (om.priorityPartners?.length ?? 0) > 0 ||
      (om.priorityActions?.length ?? 0) > 0 ||
      (om.activeObjectives?.length ?? 0) > 0;
    return hasContent ? om : null;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Operating mode persists only the operating brief; portfolio mode also
      // saves the multi-venture thesis/notes/priorities.
      const payload = operatingMode
        ? { operatingModel: buildOperatingModel() }
        : {
            thesis: thesis.trim() || null,
            notes: notes.trim() || null,
            priorities: order.map((v) => v.id),
            operatingModel: buildOperatingModel(),
          };
      const res = await personaFetch("/api/venture/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        personaIdHint: personaId,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{operatingMode ? "Operating Brief" : "Venture Portfolio"}</DialogTitle>
          <DialogDescription>
            {operatingMode
              ? "Your living operational brief — what aigentMe runs as Chief of Staff. Available the moment you enter the Founder Office."
              : "Prioritise your ventures, set a portfolio thesis, and see the capabilities they share. Built from your own VentureQubes."}
          </DialogDescription>
        </DialogHeader>

        {!accessGranted ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-2">
            <Lock className="w-5 h-5 text-amber-300 mx-auto" />
            <p className="text-sm font-medium text-amber-200">
              {operatingMode ? "The Operating Brief is a Founder Office feature" : "Venture Portfolio is an Operator Pro / Elite surface"}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {operatingMode
                ? "Enter the Founder Office (Operator tier or above) to set the operating brief aigentMe executes against."
                : "Upgrade to Operator Pro (3 ventures) or Operator Elite (unlimited) to manage a venture portfolio with cross-venture intelligence."}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your portfolio…
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Portfolio-only surfaces (Operator Pro/Elite) — hidden in operating mode. */}
            {!operatingMode && (
            <>
            {/* Cross-venture summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
                <div className="text-lg font-semibold text-slate-100">{portfolio?.ventureCount ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Ventures</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
                <div className="text-lg font-semibold text-slate-100">{portfolio?.sharedCapabilities.length ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Shared caps</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
                <div className="text-lg font-semibold text-slate-100">{Object.keys(portfolio?.stageSpread ?? {}).length}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Stages</div>
              </div>
            </div>

            {portfolio && portfolio.sharedCapabilities.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {portfolio.sharedCapabilities.map((c) => (
                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                    {c}
                  </span>
                ))}
              </div>
            )}

            {/* Priority ordering + add */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-200">Ventures &amp; priority</label>
                <button
                  type="button"
                  onClick={() => setAddLightOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
                >
                  <Plus className="w-3 h-3" /> Add a venture
                </button>
              </div>
              {order.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  No ventures yet. Use “Add a venture” — you’ll capture the essentials (Light), then
                  deepen into the full blueprint (Pro).
                </p>
              ) : (
                <div className="space-y-1.5">
                  {order.map((v, i) => (
                    <div key={v.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-2.5 py-1.5">
                      <Layers className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span className="text-sm text-slate-100 truncate flex-1">{v.name}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{v.stage}</span>
                      {typeof v.ventureConfidence === "number" && (
                        <span className="text-[10px] text-emerald-300">{v.ventureConfidence}%</span>
                      )}
                      <button
                        type="button"
                        onClick={() => { setProVentureId(v.id); setProOpen(true); }}
                        title="Deepen with the Venture Pro wizard"
                        className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-violet-500/40 text-violet-200 hover:bg-violet-500/15"
                      >
                        <Rocket className="w-3 h-3" /> Pro
                      </button>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-200 disabled:opacity-30">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} className="text-slate-400 hover:text-slate-200 disabled:opacity-30">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Portfolio thesis</label>
              <div className="relative">
                <textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  rows={3}
                  placeholder="What ties these ventures together — the throughline of your portfolio."
                  className="w-full text-sm rounded-lg p-2.5 pr-10 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                />
                <div className="absolute top-1.5 right-1.5">
                  <MicButton onTranscript={(t) => setThesis((v) => (v ? `${v.trimEnd()} ${t}` : t))} size="sm" theme="dark" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Notes</label>
              <div className="relative">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Prioritisation rationale, shared resources, sequencing…"
                  className="w-full text-sm rounded-lg p-2.5 pr-10 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                />
                <div className="absolute top-1.5 right-1.5">
                  <MicButton onTranscript={(t) => setNotes((v) => (v ? `${v.trimEnd()} ${t}` : t))} size="sm" theme="dark" />
                </div>
              </div>
            </div>
            </>
            )}

            {/* Operating brief — the Chief-of-Staff layer aigentMe executes against. */}
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-3">
              <div className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-violet-300" />
                <h4 className="text-sm font-semibold text-violet-100">Operating brief</h4>
                <span className="text-[10px] text-slate-400">— what aigentMe runs as your Chief of Staff</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Operating mission <span className="text-slate-500">— the operational expression of your thesis (the What-right-now)</span>
                </label>
                <div className="relative">
                  <textarea
                    value={omMission}
                    onChange={(e) => setOmMission(e.target.value)}
                    rows={2}
                    placeholder="e.g. what you are doing right now in service of your portfolio thesis."
                    className="w-full text-sm rounded-lg p-2.5 pr-10 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                  />
                  <div className="absolute top-1.5 right-1.5">
                    <MicButton onTranscript={(t) => setOmMission((v) => (v ? `${v.trimEnd()} ${t}` : t))} size="sm" theme="dark" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Primary metric</label>
                <input
                  value={omPrimaryMetric}
                  onChange={(e) => setOmPrimaryMetric(e.target.value)}
                  placeholder="e.g. Net Value Acceleration — did our actions reduce time-to-value?"
                  className="w-full text-sm rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Success metrics <span className="text-slate-500">— one per line</span></label>
                <textarea
                  value={omSuccessMetrics}
                  onChange={(e) => setOmSuccessMetrics(e.target.value)}
                  rows={3}
                  placeholder={"e.g. 1,000 active users\n$10k MRR\n3 partnerships signed"}
                  className="w-full text-sm rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                />
              </div>

              {/* Active objectives — text + lifecycle status. */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">Active objectives</label>
                  <button
                    type="button"
                    onClick={() => setOmObjectives((p) => [...p, { objective: "", status: "active" }])}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-violet-500/40 text-violet-200 hover:bg-violet-500/15"
                  >
                    <Plus className="w-3 h-3" /> Objective
                  </button>
                </div>
                {omObjectives.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No objectives yet. Add the ones in flight so aigentMe knows what to act on.</p>
                ) : (
                  <div className="space-y-1.5">
                    {omObjectives.map((o, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          value={o.objective}
                          onChange={(e) => setOmObjectives((p) => p.map((x, j) => (j === i ? { ...x, objective: e.target.value } : x)))}
                          placeholder="e.g. Identify your first 50 customers"
                          className="flex-1 text-sm rounded-lg p-1.5 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                        />
                        <select
                          value={o.status}
                          onChange={(e) => setOmObjectives((p) => p.map((x, j) => (j === i ? { ...x, status: e.target.value as OperatingObjective["status"] } : x)))}
                          className="text-xs rounded-lg p-1.5 border bg-slate-900/60 border-slate-700 text-slate-200 focus:border-violet-500/60 focus:outline-none capitalize"
                        >
                          {OBJECTIVE_STATUSES.map((s) => (
                            <option key={s} value={s} className="capitalize">{s}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => setOmObjectives((p) => p.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Priority partners <span className="text-slate-500">— one per line</span></label>
                  <textarea
                    value={omPriorityPartners}
                    onChange={(e) => setOmPriorityPartners(e.target.value)}
                    rows={3}
                    placeholder={"e.g. a channel partner\na platform integration\na distribution partner"}
                    className="w-full text-sm rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Priority actions <span className="text-slate-500">— one per line</span></label>
                  <textarea
                    value={omPriorityActions}
                    onChange={(e) => setOmPriorityActions(e.target.value)}
                    rows={3}
                    placeholder={"Next concrete steps, highest-priority first"}
                    className="w-full text-sm rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Review cadence</label>
                  <input
                    value={omReviewCadence}
                    onChange={(e) => setOmReviewCadence(e.target.value)}
                    placeholder="weekly"
                    className="w-full text-sm rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Next review date</label>
                  <input
                    type="date"
                    value={omNextReviewDate}
                    onChange={(e) => setOmNextReviewDate(e.target.value)}
                    className="w-full text-sm rounded-lg p-2 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">{error}</p>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-violet-600/30 border border-violet-500/50 text-violet-100 hover:bg-violet-600/50 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Saving…" : operatingMode ? "Save operating brief" : "Save portfolio"}
              </button>
            </DialogFooter>
          </div>
        )}

        {!accessGranted && (
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">
              Close
            </button>
          </DialogFooter>
        )}

        {/* Add-venture cycle: Light (create) → deepen with Pro on the new id. */}
        <VentureLightWizard
          open={addLightOpen}
          onOpenChange={setAddLightOpen}
          personaId={personaId}
          forceCreate
          onSaved={(r) => {
            void load();
            // Chain straight into the Pro wizard on the venture just created.
            if (r.ventureId) { setProVentureId(r.ventureId); setProOpen(true); }
          }}
        />
        <VentureProWizard
          open={proOpen}
          onOpenChange={setProOpen}
          personaId={personaId}
          ventureId={proVentureId ?? undefined}
          hasProAccess={hasPortfolioAccess}
          onSaved={() => void load()}
        />
      </DialogContent>
    </Dialog>
  );
}

export default VenturePortfolioWizard;
