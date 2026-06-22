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
import { Loader2, Check, Lock, ArrowUp, ArrowDown, Layers, Plus, Rocket } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MicButton } from "@/components/ui/MicButton";
import { VentureLightWizard } from "./VentureLightWizard";
import { VentureProWizard } from "./VentureProWizard";

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
}

export function VenturePortfolioWizard({
  open,
  onOpenChange,
  personaId,
  hasPortfolioAccess,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  hasPortfolioAccess: boolean;
  onSaved?: () => void;
}) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [order, setOrder] = useState<VentureSummary[]>([]);
  const [thesis, setThesis] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add-venture cycle: Light (create) → optionally deepen with Pro.
  const [addLightOpen, setAddLightOpen] = useState(false);
  const [proVentureId, setProVentureId] = useState<string | null>(null);
  const [proOpen, setProOpen] = useState(false);
  const wasOpen = useRef(false);

  const load = useCallback(async () => {
    if (!hasPortfolioAccess) return;
    setLoading(true);
    try {
      const res = await personaFetch("/api/venture/portfolio", { personaIdHint: personaId, cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Portfolio & { ok: boolean };
        setPortfolio(data);
        setOrder(data.ventures ?? []);
        setThesis(data.thesis ?? "");
        setNotes(data.notes ?? "");
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b?.error || `Could not load portfolio (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId, hasPortfolioAccess]);

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

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch("/api/venture/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        personaIdHint: personaId,
        body: JSON.stringify({
          thesis: thesis.trim() || null,
          notes: notes.trim() || null,
          priorities: order.map((v) => v.id),
        }),
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
          <DialogTitle>Venture Portfolio</DialogTitle>
          <DialogDescription>
            Prioritise your ventures, set a portfolio thesis, and see the capabilities
            they share. Built from your own VentureQubes.
          </DialogDescription>
        </DialogHeader>

        {!hasPortfolioAccess ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-2">
            <Lock className="w-5 h-5 text-amber-300 mx-auto" />
            <p className="text-sm font-medium text-amber-200">Venture Portfolio is a Pro / Elite wizard</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Upgrade to Venture Lab Pro (3 ventures) or Elite (unlimited) to manage a venture
              portfolio with cross-venture intelligence.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your portfolio…
          </div>
        ) : (
          <div className="space-y-4 py-1">
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
                {saving ? "Saving…" : "Save portfolio"}
              </button>
            </DialogFooter>
          </div>
        )}

        {!hasPortfolioAccess && (
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
