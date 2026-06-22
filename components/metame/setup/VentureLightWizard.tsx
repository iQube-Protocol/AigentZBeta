"use client";

/**
 * VentureLightWizard — the free, single-venture incubation wizard (every
 * citizen). Captures the essentials (name, problem, value, mission, intent,
 * stage) and writes them into the persona's VentureQube via the standard
 * /api/venture/qubes path. Standing calibrates the venture automatically.
 *
 * One venture per free citizen (ventureLimit 1). If a venture already exists,
 * the wizard EDITS it in place (the same venture upgrades to the Pro wizard
 * when the citizen subscribes to Venture Lab Lite — no data is lost).
 *
 * Non-linear (parity with Standing Core): clickable progress bar, every step
 * skippable, save-partial; empty fields pre-filled from Standing Core /
 * Experience Model and overwritable.
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
import { Loader2, ChevronLeft, ChevronRight, Check, Sparkles, Lock } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MicButton } from "@/components/ui/MicButton";

interface Form {
  name: string;
  problemStatement: string;
  valueProposition: string;
  mission: string;
  founderIntents: string;
  ventureIntents: string;
  stage: string;
}

const EMPTY: Form = {
  name: "",
  problemStatement: "",
  valueProposition: "",
  mission: "",
  founderIntents: "",
  ventureIntents: "",
  stage: "concept",
};

const STAGES = ["concept", "validation", "formation", "launch"] as const;

type StepKey = "name" | "problem" | "value" | "intent" | "stage";
interface StepDef {
  key: StepKey;
  title: string;
  render: "name" | "problem" | "value" | "intent" | "stage";
}
const STEPS: StepDef[] = [
  { key: "name", title: "Your venture", render: "name" },
  { key: "problem", title: "The problem", render: "problem" },
  { key: "value", title: "The value", render: "value" },
  { key: "intent", title: "Your intent", render: "intent" },
  { key: "stage", title: "Stage", render: "stage" },
];

const splitLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function VentureLightWizard({
  open,
  onOpenChange,
  personaId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  onSaved?: (result: { ventureId: string; name: string }) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [prefilled, setPrefilled] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [ventureId, setVentureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open || wasOpen.current) {
      wasOpen.current = open;
      return;
    }
    wasOpen.current = true;
    setStep(0);
    setError(null);
    setLoading(true);

    void (async () => {
      const next: Form = { ...EMPTY };
      const pre: Partial<Record<keyof Form, boolean>> = {};
      let existingId: string | null = null;
      try {
        const res = await personaFetch("/api/venture/qubes", { personaIdHint: personaId, cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const v = Array.isArray(data?.ventures) && data.ventures.length > 0 ? data.ventures[0] : null;
          if (v) {
            existingId = v.id;
            next.name = v.name ?? "";
            next.stage = v.stage ?? "concept";
            const t = v.layers?.thesis ?? {};
            next.problemStatement = t.problemStatement ?? "";
            next.valueProposition = t.valueProposition ?? "";
            next.mission = t.mission ?? "";
            const it = v.layers?.intent ?? {};
            next.founderIntents = (it.founderIntents ?? []).join("\n");
            next.ventureIntents = (it.ventureIntents ?? []).join("\n");
          }
        }
      } catch { /* best-effort */ }

      // Cross-feed prefill (create mode only) from Standing Core + Experience Model.
      if (!existingId) {
        try {
          const [scRes, emRes] = await Promise.all([
            personaFetch("/api/standing/core-wizard", { personaIdHint: personaId, cache: "no-store" }),
            personaFetch("/api/assistant/experience-model", { personaIdHint: personaId, cache: "no-store" }),
          ]);
          if (scRes.ok) {
            const sc = await scRes.json();
            const a = sc?.answers ?? {};
            if (!next.founderIntents && a.intentions) { next.founderIntents = a.intentions; pre.founderIntents = true; }
            if (!next.ventureIntents && a.accomplish) { next.ventureIntents = a.accomplish; pre.ventureIntents = true; }
          }
          if (emRes.ok) {
            const em = await emRes.json();
            const goal = em?.meta?.primaryGoal as string | undefined;
            if (!next.mission && goal) { next.mission = goal; pre.mission = true; }
          }
        } catch { /* best-effort */ }
      }

      setVentureId(existingId);
      setForm(next);
      setPrefilled(pre);
      setLoading(false);
    })();
  }, [open, personaId]);

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const setField = (key: keyof Form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setPrefilled((p) => (p[key] ? { ...p, [key]: false } : p));
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Give your venture a name first.");
      setStep(0);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let res: Response;
      if (ventureId) {
        res = await personaFetch(`/api/venture/qubes/${ventureId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          personaIdHint: personaId,
          body: JSON.stringify({
            stage: form.stage,
            layers: {
              thesis: {
                problemStatement: form.problemStatement.trim() || undefined,
                valueProposition: form.valueProposition.trim() || undefined,
                mission: form.mission.trim() || undefined,
              },
              intent: {
                founderIntents: splitLines(form.founderIntents),
                ventureIntents: splitLines(form.ventureIntents),
              },
            },
          }),
        });
      } else {
        res = await personaFetch("/api/venture/qubes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          personaIdHint: personaId,
          body: JSON.stringify({
            name: form.name.trim(),
            stage: form.stage,
            path: "discover",
            seed: {
              problemStatement: form.problemStatement.trim() || undefined,
              valueProposition: form.valueProposition.trim() || undefined,
              mission: form.mission.trim() || undefined,
              founderIntents: splitLines(form.founderIntents),
              ventureIntents: splitLines(form.ventureIntents),
            },
          }),
        });
      }
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Save failed (${res.status})`);
      }
      onSaved?.({ ventureId: data.venture?.id ?? ventureId ?? "", name: data.venture?.name ?? form.name });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const Hint = ({ k }: { k: keyof Form }) =>
    prefilled[k] ? (
      <p className="text-[10px] text-violet-300/80 flex items-center gap-1">
        <Sparkles className="w-3 h-3" /> Pre-filled from your Standing / Experience Model — edit freely.
      </p>
    ) : null;

  const textarea = (k: keyof Form, placeholder: string, rows = 4) => (
    <div className="relative">
      <textarea
        value={form[k]}
        onChange={(e) => setField(k, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm rounded-lg p-2.5 pr-10 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
      />
      <div className="absolute top-1.5 right-1.5">
        <MicButton
          onTranscript={(t) => setField(k, form[k] ? `${form[k].trimEnd()} ${t}` : t)}
          size="sm"
          theme="dark"
        />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Venture Light</DialogTitle>
          <DialogDescription>
            Incubate one venture — the essentials. Standing calibrates it automatically.
            Upgrade to Venture Lab Lite for the full Venture Pro wizard on this same venture.
          </DialogDescription>
        </DialogHeader>

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
          {ventureId && <span className="ml-2 text-emerald-300/80">editing your venture</span>}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-2 py-1">
            {current.render === "name" && (
              <>
                <label className="block text-sm font-medium text-slate-200">What's your venture called?</label>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Venture name"
                  className="w-full text-sm rounded-lg p-2.5 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">A working name is fine — you can change it later.</p>
              </>
            )}
            {current.render === "problem" && (
              <>
                <label className="block text-sm font-medium text-slate-200">What problem does it solve?</label>
                {textarea("problemStatement", "The problem / need…")}
              </>
            )}
            {current.render === "value" && (
              <>
                <label className="block text-sm font-medium text-slate-200">What's the value proposition?</label>
                {textarea("valueProposition", "Why it matters / what it delivers…")}
                <Hint k="mission" />
                <label className="block text-sm font-medium text-slate-200 pt-2">Mission (optional)</label>
                {textarea("mission", "The mission…", 2)}
              </>
            )}
            {current.render === "intent" && (
              <>
                <label className="block text-sm font-medium text-slate-200">Your intent as founder</label>
                <Hint k="founderIntents" />
                {textarea("founderIntents", "One intent per line…", 3)}
                <label className="block text-sm font-medium text-slate-200 pt-2">What the venture should achieve</label>
                <Hint k="ventureIntents" />
                {textarea("ventureIntents", "One outcome per line…", 3)}
              </>
            )}
            {current.render === "stage" && (
              <>
                <label className="block text-sm font-medium text-slate-200">Where is it today?</label>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setField("stage", s)}
                      className={`text-sm capitalize px-3 py-2 rounded-lg border transition ${
                        form.stage === s
                          ? "bg-violet-500/15 border-violet-500/60 text-violet-100"
                          : "bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Revenue, commercial model, execution + the rest of the
                  13-layer blueprint unlock with the Venture Pro wizard (Venture Lab Lite).
                </p>
              </>
            )}
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
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                disabled={saving}
                className="text-sm px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
              >
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
                {saving ? "Saving…" : ventureId ? "Save venture" : "Create venture"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                disabled={saving}
                className="inline-flex items-center gap-1 text-sm font-semibold px-4 py-1.5 rounded-lg bg-violet-600/30 border border-violet-500/50 text-violet-100 hover:bg-violet-600/50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VentureLightWizard;
