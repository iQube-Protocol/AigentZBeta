"use client";

/**
 * VentureProWizard — the full VentureQube (13-layer) guided wizard, gated to
 * Venture Lab Lite and above (wizardAccess.pro). It operates on the persona's
 * venture in place: it loads the existing venture (created via Venture Light or
 * here), captures the deeper layers — customer archetypes, revenue engines,
 * commercial targets, required capabilities, execution phases — and PATCHes the
 * VentureQube. Standing + metaCommons signals calibrate the rest (governance,
 * signal evidence) automatically.
 *
 * This is the guided counterpart to the Founder Office discover/validate/
 * architect flow; both write the same VentureQube so the surfaces stay at
 * parity. The remaining essentials (name/problem/value/intent) are inherited
 * from the Light wizard — this wizard focuses on the Pro-only layers.
 *
 * Non-linear: skippable steps, clickable progress. When the caller lacks pro
 * access the wizard renders a locked upgrade panel instead of the form.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight, Check, Lock } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MicButton } from "@/components/ui/MicButton";

interface Form {
  name: string;
  archetypes: string;       // one customer kind per line
  revenueEngines: string;   // one engine per line
  revenueTargets: string;   // one target per line
  requiredCapabilities: string; // one per line
  executionPhases: string;  // one phase per line
}

const EMPTY: Form = {
  name: "",
  archetypes: "",
  revenueEngines: "",
  revenueTargets: "",
  requiredCapabilities: "",
  executionPhases: "",
};

const STEPS = [
  { key: "archetypes", title: "Customers", label: "Who are your customers?", hint: "One customer kind per line (e.g. early-stage founders, indie creators).", field: "archetypes" as const },
  { key: "revenue", title: "Revenue", label: "How does it make money?", hint: "One revenue engine per line (e.g. subscription, services, licensing).", field: "revenueEngines" as const },
  { key: "targets", title: "Targets", label: "Commercial targets", hint: "One target per line (e.g. $10k MRR by Q3, 500 paying citizens).", field: "revenueTargets" as const },
  { key: "capability", title: "Capabilities", label: "Capabilities required", hint: "One required capability per line. Standing auto-fills what you already have.", field: "requiredCapabilities" as const },
  { key: "execution", title: "Execution", label: "Execution phases", hint: "One phase per line (e.g. MVP build, alpha launch, growth).", field: "executionPhases" as const },
] as const;

const splitLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function VentureProWizard({
  open,
  onOpenChange,
  personaId,
  ventureId: targetVentureId,
  hasProAccess,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  /** Target a specific venture (portfolio multi-venture). Omit for single-venture. */
  ventureId?: string;
  /** When false the wizard shows a locked upgrade panel. */
  hasProAccess: boolean;
  onSaved?: (result: { ventureId: string }) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [ventureId, setVentureId] = useState<string | null>(null);
  // Preserve the loaded capability arrays so a PATCH doesn't clobber them.
  const [capabilitySnapshot, setCapabilitySnapshot] = useState<{
    availableCapabilities: string[]; capabilityGaps: string[]; capabilityPriorities: string[];
  }>({ availableCapabilities: [], capabilityGaps: [], capabilityPriorities: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open || wasOpen.current) { wasOpen.current = open; return; }
    wasOpen.current = true;
    setStep(0);
    setError(null);
    if (!hasProAccess) return;
    setLoading(true);
    void (async () => {
      const next: Form = { ...EMPTY };
      try {
        let v: { id: string; name?: string; layers?: Record<string, unknown> } | null = null;
        if (targetVentureId) {
          const res = await personaFetch(`/api/venture/qubes/${targetVentureId}`, { personaIdHint: personaId, cache: "no-store" });
          if (res.ok) { const data = await res.json(); v = data?.venture ?? null; }
        } else {
          const res = await personaFetch("/api/venture/qubes", { personaIdHint: personaId, cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            v = Array.isArray(data?.ventures) && data.ventures.length > 0 ? data.ventures[0] : null;
          }
        }
        {
          if (v) {
            setVentureId(v.id);
            next.name = v.name ?? "";
            const L = (v.layers ?? {}) as {
              archetypes?: Array<{ label?: string }>;
              revenueArchitecture?: { engines?: Array<{ engineName?: string }> };
              commercialModel?: { revenueTargets?: string[] };
              capability?: { requiredCapabilities?: string[]; availableCapabilities?: string[]; capabilityGaps?: string[]; capabilityPriorities?: string[] };
              execution?: { phases?: Array<{ phaseName?: string }> };
            };
            next.archetypes = (L.archetypes ?? []).map((a) => a.label).filter(Boolean).join("\n");
            next.revenueEngines = (L.revenueArchitecture?.engines ?? []).map((e) => e.engineName).filter(Boolean).join("\n");
            next.revenueTargets = (L.commercialModel?.revenueTargets ?? []).join("\n");
            next.requiredCapabilities = (L.capability?.requiredCapabilities ?? []).join("\n");
            next.executionPhases = (L.execution?.phases ?? []).map((p) => p.phaseName).filter(Boolean).join("\n");
            setCapabilitySnapshot({
              availableCapabilities: L.capability?.availableCapabilities ?? [],
              capabilityGaps: L.capability?.capabilityGaps ?? [],
              capabilityPriorities: L.capability?.capabilityPriorities ?? [],
            });
          }
        }
      } catch { /* best-effort */ } finally {
        setForm(next);
        setLoading(false);
      }
    })();
  }, [open, personaId, hasProAccess, targetVentureId]);

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const setField = (key: keyof Form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Ensure a venture exists (create a minimal one if the citizen jumped
      // straight into Pro without a Light venture).
      let id = ventureId;
      if (!id) {
        const createRes = await personaFetch("/api/venture/qubes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          personaIdHint: personaId,
          body: JSON.stringify({ name: form.name.trim() || "My venture", path: "architect" }),
        });
        const created = await createRes.json();
        if (!createRes.ok || !created?.ok) throw new Error(created?.error || "Could not create venture");
        id = created.venture.id;
        setVentureId(id);
      }

      const layers = {
        archetypes: splitLines(form.archetypes).map((label) => ({ kind: "other" as const, label })),
        revenueArchitecture: {
          engines: splitLines(form.revenueEngines).map((engineName) => ({
            engineType: "subscription" as const,
            engineName,
          })),
        },
        commercialModel: { revenueTargets: splitLines(form.revenueTargets) },
        capability: {
          requiredCapabilities: splitLines(form.requiredCapabilities),
          availableCapabilities: capabilitySnapshot.availableCapabilities,
          capabilityGaps: capabilitySnapshot.capabilityGaps,
          capabilityPriorities: capabilitySnapshot.capabilityPriorities,
        },
        execution: {
          phases: splitLines(form.executionPhases).map((phaseName) => ({
            phaseName,
            objectives: [],
            deliverables: [],
          })),
        },
      };

      const res = await personaFetch(`/api/venture/qubes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        personaIdHint: personaId,
        body: JSON.stringify({ layers, path: "architect" }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      onSaved?.({ ventureId: id! });
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
          <DialogTitle>Venture Pro</DialogTitle>
          <DialogDescription>
            The full venture blueprint — customers, revenue, commercial targets, capabilities,
            and execution. Standing + signals calibrate the rest automatically.
          </DialogDescription>
        </DialogHeader>

        {!hasProAccess ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-2">
            <Lock className="w-5 h-5 text-amber-300 mx-auto" />
            <p className="text-sm font-medium text-amber-200">Venture Pro is a premium wizard</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Upgrade to Venture Lab Lite or above to build the full 13-layer VentureQube on your
              venture. Your Venture Light venture upgrades in place — nothing is lost.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  title={s.title}
                  onClick={() => setStep(i)}
                  className={`flex-1 h-1.5 rounded transition-colors ${
                    i === step ? "bg-violet-500" : "bg-slate-700/50 hover:bg-slate-600"
                  }`}
                />
              ))}
            </div>
            <div className="text-[11px] text-slate-400">
              Step {step + 1} of {total} · {current.title}
              {ventureId ? <span className="ml-2 text-emerald-300/80">editing your venture</span> : <span className="ml-2 text-slate-500">a new venture will be created on save</span>}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your venture…
              </div>
            ) : (
              <div className="space-y-2 py-1">
                <label className="block text-sm font-medium text-slate-200">{current.label}</label>
                <p className="text-[11px] text-slate-400">{current.hint}</p>
                <div className="relative">
                  <textarea
                    value={form[current.field]}
                    onChange={(e) => setField(current.field, e.target.value)}
                    rows={6}
                    className="w-full text-sm rounded-lg p-2.5 pr-10 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                    placeholder="One per line…"
                  />
                  <div className="absolute top-1.5 right-1.5">
                    <MicButton
                      onTranscript={(t) =>
                        setField(current.field, form[current.field] ? `${form[current.field].trimEnd()} ${t}` : t)
                      }
                      size="sm"
                      theme="dark"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
                {error}
              </p>
            )}

            <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || saving}
                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-2">
                {!isLast && (
                  <button type="button" onClick={() => setStep((s) => Math.min(total - 1, s + 1))} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200">
                    Skip
                  </button>
                )}
                {isLast ? (
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-violet-600/30 border border-violet-500/50 text-violet-100 hover:bg-violet-600/50 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? "Saving…" : "Save blueprint"}
                  </button>
                ) : (
                  <button type="button" onClick={() => setStep((s) => Math.min(total - 1, s + 1))} disabled={saving} className="inline-flex items-center gap-1 text-sm font-semibold px-4 py-1.5 rounded-lg bg-violet-600/30 border border-violet-500/50 text-violet-100 hover:bg-violet-600/50">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default VentureProWizard;
