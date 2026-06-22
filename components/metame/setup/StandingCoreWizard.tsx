"use client";

/**
 * StandingCoreWizard — the citizen's Standing attestation wizard (free, every
 * citizen). Seven questions (who you are, what you know, what you've done,
 * interests, intentions, formative experiences, what you want to accomplish)
 * are written as self-attested facts and feed the Standing Asset Graph.
 *
 * Non-linear by design (operator decision 2026-06-22): every step is skippable,
 * the progress bar is clickable to jump to any step, and empty fields are
 * PRE-POPULATED from the Experience Model / Experience Guide (which the citizen
 * may have filled first, in any order) — the citizen can overwrite the
 * suggestion freely. Standing, Experience Model and Experience Guide all feed
 * each other; none is a prerequisite for another.
 *
 * Mirrors the ExperienceModelSetupWizard / PersonalGuideSetupWizard shell so
 * the surfaces stay at parity. Saves via /api/standing/core-wizard.
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
import { Loader2, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MicButton } from "@/components/ui/MicButton";

interface Answers {
  whoYouAre: string;
  whatYouKnow: string;
  whatYouveDone: string;
  interests: string;
  intentions: string;
  experiencesThatMatter: string;
  accomplish: string;
}

const EMPTY: Answers = {
  whoYouAre: "",
  whatYouKnow: "",
  whatYouveDone: "",
  interests: "",
  intentions: "",
  experiencesThatMatter: "",
  accomplish: "",
};

interface StepDef {
  key: keyof Answers;
  title: string;
  question: string;
  hint: string;
  placeholder: string;
}

const STEPS: StepDef[] = [
  { key: "whoYouAre", title: "Who you are", question: "Who are you?", hint: "Your identity in your own words — background, roles, the throughline of your story.", placeholder: "I'm a…" },
  { key: "whatYouKnow", title: "What you know", question: "What do you know?", hint: "Domains, skills, and expertise you can stand behind.", placeholder: "I know…" },
  { key: "whatYouveDone", title: "What you've done", question: "What have you done?", hint: "Track record — what you've built, shipped, led, or contributed.", placeholder: "I've…" },
  { key: "interests", title: "Your interests", question: "What are your interests?", hint: "What you're drawn to and care to spend time on.", placeholder: "I'm interested in…" },
  { key: "intentions", title: "Your intentions", question: "What are your intentions?", hint: "What you intend to do — the direction you're attesting to.", placeholder: "I intend to…" },
  { key: "experiencesThatMatter", title: "Experiences that matter", question: "What experiences matter to you?", hint: "Formative experiences that shaped your capability and outlook.", placeholder: "What shaped me…" },
  { key: "accomplish", title: "What you want to accomplish", question: "What would you like to accomplish?", hint: "The outcome you want help achieving — the system aligns around this.", placeholder: "I want to…" },
];

export function StandingCoreWizard({
  open,
  onOpenChange,
  personaId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  onSaved?: (result: { profileId: string; factCount: number }) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [prefilled, setPrefilled] = useState<Partial<Record<keyof Answers, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wasOpen = useRef(false);

  // Hydrate on open: own saved answers first; empty fields prefilled from the
  // Experience Model / Guide (cross-feed). The citizen overwrites freely.
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
      const next: Answers = { ...EMPTY };
      const pre: Partial<Record<keyof Answers, boolean>> = {};
      try {
        const res = await personaFetch("/api/standing/core-wizard", { personaIdHint: personaId, cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const a = (data?.answers ?? {}) as Partial<Answers>;
          for (const s of STEPS) if (typeof a[s.key] === "string") next[s.key] = a[s.key] as string;
        }
      } catch { /* best-effort */ }

      // Cross-feed prefill for still-empty fields.
      try {
        const [emRes, egRes] = await Promise.all([
          personaFetch("/api/assistant/experience-model", { personaIdHint: personaId, cache: "no-store" }),
          personaFetch("/api/assistant/experience-guide", { personaIdHint: personaId, cache: "no-store" }),
        ]);
        if (emRes.ok) {
          const em = await emRes.json();
          const goal = em?.meta?.primaryGoal as string | undefined;
          const goals = (em?.experienceGoals as string[] | undefined) ?? [];
          if (!next.intentions && goal) { next.intentions = goal; pre.intentions = true; }
          if (!next.accomplish && goals.length > 0) { next.accomplish = goals.join("\n"); pre.accomplish = true; }
        }
        if (egRes.ok) {
          const eg = await egRes.json();
          const focus = eg?.guide?.focusIntent as string | undefined;
          if (!next.interests && focus) { next.interests = focus; pre.interests = true; }
        }
      } catch { /* best-effort */ }

      setAnswers(next);
      setPrefilled(pre);
      setLoading(false);
    })();
  }, [open, personaId]);

  const total = STEPS.length;
  const current = STEPS[step];
  const filledCount = STEPS.filter((s) => answers[s.key].trim().length > 0).length;

  const setField = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setPrefilled((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch("/api/standing/core-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, build: filledCount > 0 }),
        personaIdHint: personaId,
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Save failed (${res.status})`);
      }
      onSaved?.({ profileId: data.profileId, factCount: data.factCount });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const isLast = step === total - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Standing Core</DialogTitle>
          <DialogDescription>
            Attest to who you are and what you intend, so the system can help you achieve it.
            Every step is optional — fill them in any order, skip what you like.
          </DialogDescription>
        </DialogHeader>

        {/* Clickable progress bar — non-linear navigation. */}
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Go to: ${s.title}`}
              title={s.title}
              onClick={() => setStep(i)}
              className={`flex-1 h-1.5 rounded transition-colors ${
                i === step
                  ? "bg-violet-500"
                  : answers[s.key].trim().length > 0
                    ? "bg-emerald-500/70"
                    : "bg-slate-700/50 hover:bg-slate-600"
              }`}
            />
          ))}
        </div>

        <div className="text-[11px] text-slate-400">
          Step {step + 1} of {total} · {current.title}
          <span className="ml-2 text-slate-500">{filledCount}/{total} answered</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your Standing…
          </div>
        ) : (
          <div className="space-y-2 py-1">
            <label className="block text-sm font-medium text-slate-200">{current.question}</label>
            <p className="text-[11px] text-slate-400">{current.hint}</p>
            {prefilled[current.key] && (
              <p className="text-[10px] text-violet-300/80 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Pre-filled from your Experience Model / Guide — edit it to make it yours.
              </p>
            )}
            <div className="relative">
              <textarea
                value={answers[current.key]}
                onChange={(e) => setField(current.key, e.target.value)}
                placeholder={current.placeholder}
                rows={5}
                className="w-full text-sm rounded-lg p-2.5 pr-10 border bg-slate-900/60 border-slate-700 text-slate-100 focus:border-violet-500/60 focus:outline-none"
              />
              <div className="absolute top-1.5 right-1.5">
                <MicButton
                  onTranscript={(text) =>
                    setField(current.key, answers[current.key] ? `${answers[current.key].trimEnd()} ${text}` : text)
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
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
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
                {saving ? "Saving…" : "Save Standing"}
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

        {/* Save is always reachable, even mid-flow, so the citizen can attest a
            partial Standing and return later. */}
        {!isLast && !loading && (
          <button
            type="button"
            onClick={save}
            disabled={saving || filledCount === 0}
            className="w-full text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save what I have so far"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default StandingCoreWizard;
