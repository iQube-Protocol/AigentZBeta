"use client";

/**
 * PersonalGuideSetupWizard — Personal ExperienceGuide onboarding.
 *
 * Per metaMe Cartridge PRD (Personal ExperienceGuide layer).
 *
 * Seven steps. The user should complete onboarding in a few minutes:
 *
 *   1. Focus — free-text intent ("what are you tending right now?")
 *   2. Energy + Body — per-sphere maturity AND alignment
 *   3. Mind + Emotion — same
 *   4. Relationship + Community — same
 *   5. Legacy — same
 *   6. Precedence — which sphere leads when several need attention (the
 *      overall alignment headline is derived from the per-sphere data)
 *   7. Review & confirm
 *
 * Posts the complete payload to POST /api/assistant/experience-guide. The
 * route resolves the persona from the spine; the wizard never sends a
 * personaId in the body.
 *
 * On open the form re-hydrates from `initial` so re-opening after save
 * never asks the user to re-enter values — same TDZ-safe pattern as the
 * ExperienceModelSetupWizard.
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
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MicButton } from "@/components/ui/MicButton";
import {
  ALIGNMENT_DESCRIPTION,
  ALIGNMENT_LABEL,
  MATURITY_DESCRIPTION,
  MATURITY_LABEL,
  MATURITY_LEVELS,
  SPHERE_DESCRIPTION,
  SPHERE_AXES,
  SPHERE_LABEL,
  backfillSphereAlignment,
  defaultSphereAlignment,
  defaultSphereMaturity,
  deriveOverallAlignment,
  type AlignmentState,
  type MaturityLevel,
  type PersonalGuideData,
  type PrecedenceMode,
  type SphereAxis,
} from "@/types/experienceGuide";

const ALIGNMENT_VALUES: AlignmentState[] = ['aligned', 'drifting', 'at_risk', 'repair'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the form from an existing guide (re-assessment flow). */
  initial?: PersonalGuideData | null;
  /** Called with the saved guide after a successful POST. */
  onSaved: (guide: PersonalGuideData) => void;
}

interface FormState {
  focusIntent: string;
  sphereMaturity: Record<SphereAxis, MaturityLevel>;
  sphereAlignment: Record<SphereAxis, AlignmentState>;
  precedenceMode: PrecedenceMode;
}

const PRECEDENCE_OPTIONS: Array<{ value: PrecedenceMode; label: string; hint: string }> = [
  { value: "auto",         label: "Auto",         hint: "Let the guide pick — usually the lowest maturity or highest-risk sphere." },
  { value: "energy",       label: "Energy first", hint: "Vitality, capacity, and pace lead every nudge." },
  { value: "body",         label: "Body first",   hint: "Physical practice and embodiment lead every nudge." },
  { value: "mind",         label: "Mind first",   hint: "Clarity, focus and learning lead every nudge." },
  { value: "emotion",      label: "Emotion first", hint: "Inner state and feeling lead every nudge." },
  { value: "relationship", label: "Relationships first", hint: "Significant relationships lead every nudge." },
  { value: "community",    label: "Community first", hint: "Belonging and contribution to community lead every nudge." },
  { value: "legacy",       label: "Legacy first", hint: "Long-arc purpose and stewardship lead every nudge." },
];

const STEP_TITLES = [
  "Focus",
  "Energy & Body",
  "Mind & Emotion",
  "Relationship & Community",
  "Legacy",
  "Precedence",
  "Review",
];

function emptyForm(initial?: PersonalGuideData | null): FormState {
  return {
    focusIntent: initial?.focusIntent ?? "",
    sphereMaturity: initial?.sphereMaturity ?? defaultSphereMaturity(),
    // Backfill: if the saved guide only has the legacy overall alignmentState,
    // mirror it across every sphere so the user sees their previous snapshot
    // reflected and can refine it per sphere.
    sphereAlignment:
      initial?.sphereAlignment ??
      (initial?.alignmentState ? backfillSphereAlignment(initial.alignmentState) : defaultSphereAlignment()),
    precedenceMode: initial?.precedenceMode ?? "auto",
  };
}

export function PersonalGuideSetupWizard({ open, onOpenChange, initial, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(initial));

  // Same rehydration pattern as the ExperienceModelSetupWizard: only fires
  // on a false → true open transition, so the user's in-progress edits
  // are never clobbered by an unrelated `initial` re-render.
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;
    setForm(emptyForm(initial));
    setStep(0);
    setError(null);
  }, [open, initial]);

  function setSphere(sphere: SphereAxis, level: MaturityLevel) {
    setForm((f) => ({ ...f, sphereMaturity: { ...f.sphereMaturity, [sphere]: level } }));
  }

  function setSphereAlignment(sphere: SphereAxis, state: AlignmentState) {
    setForm((f) => ({ ...f, sphereAlignment: { ...f.sphereAlignment, [sphere]: state } }));
  }

  const isLast = step === STEP_TITLES.length - 1;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/experience-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sphereMaturity: form.sphereMaturity,
          sphereAlignment: form.sphereAlignment,
          // The server derives the overall too, but we send the rolled-up
          // value so a stale client never desyncs from the rule.
          alignmentState: deriveOverallAlignment(form.sphereAlignment),
          precedenceMode: form.precedenceMode,
          ...(form.focusIntent.trim() ? { focusIntent: form.focusIntent.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `save failed (${res.status})`);
      }
      const data = (await res.json()) as { configured: boolean; guide: PersonalGuideData };
      if (!data.guide) throw new Error("save returned no guide payload");
      onSaved(data.guide);
      onOpenChange(false);
      setStep(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set up your Personal ExperienceGuide</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEP_TITLES.length} · {STEP_TITLES[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          {STEP_TITLES.map((title, i) => (
            <div
              key={title}
              className={`flex-1 h-1 rounded ${i <= step ? "bg-violet-500" : "bg-slate-700/50"}`}
            />
          ))}
        </div>

        <div className="space-y-4 py-2 min-h-[300px]">
          {step === 0 && (
            <Field label="What are you tending right now?">
              <div className="relative">
                <textarea
                  value={form.focusIntent}
                  onChange={(e) => setForm((f) => ({ ...f, focusIntent: e.target.value }))}
                  placeholder="A sentence about what feels most alive in your life right now — what you're growing, stewarding, or repairing."
                  className="w-full px-3 py-2 pr-12 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500 min-h-[100px]"
                  maxLength={1000}
                />
                <div className="absolute top-2 right-2">
                  <MicButton
                    onTranscript={(text) =>
                      setForm((f) => ({
                        ...f,
                        focusIntent: f.focusIntent ? `${f.focusIntent.trimEnd()} ${text}` : text,
                      }))
                    }
                    size="sm"
                    theme="dark"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                aigentMe uses this to frame every guide nudge. You can change it any time.
              </p>
            </Field>
          )}

          {step === 1 && (
            <>
              <SphereStep sphere="energy" maturity={form.sphereMaturity.energy} alignment={form.sphereAlignment.energy} onMaturity={(v) => setSphere("energy", v)} onAlignment={(v) => setSphereAlignment("energy", v)} />
              <SphereStep sphere="body"   maturity={form.sphereMaturity.body}   alignment={form.sphereAlignment.body}   onMaturity={(v) => setSphere("body", v)}   onAlignment={(v) => setSphereAlignment("body", v)} />
            </>
          )}

          {step === 2 && (
            <>
              <SphereStep sphere="mind"    maturity={form.sphereMaturity.mind}    alignment={form.sphereAlignment.mind}    onMaturity={(v) => setSphere("mind", v)}    onAlignment={(v) => setSphereAlignment("mind", v)} />
              <SphereStep sphere="emotion" maturity={form.sphereMaturity.emotion} alignment={form.sphereAlignment.emotion} onMaturity={(v) => setSphere("emotion", v)} onAlignment={(v) => setSphereAlignment("emotion", v)} />
            </>
          )}

          {step === 3 && (
            <>
              <SphereStep sphere="relationship" maturity={form.sphereMaturity.relationship} alignment={form.sphereAlignment.relationship} onMaturity={(v) => setSphere("relationship", v)} onAlignment={(v) => setSphereAlignment("relationship", v)} />
              <SphereStep sphere="community"    maturity={form.sphereMaturity.community}    alignment={form.sphereAlignment.community}    onMaturity={(v) => setSphere("community", v)}    onAlignment={(v) => setSphereAlignment("community", v)} />
            </>
          )}

          {step === 4 && (
            <SphereStep sphere="legacy" maturity={form.sphereMaturity.legacy} alignment={form.sphereAlignment.legacy} onMaturity={(v) => setSphere("legacy", v)} onAlignment={(v) => setSphereAlignment("legacy", v)} />
          )}

          {step === 5 && (
            <>
              <div className="rounded border border-slate-700 bg-slate-800/40 p-3 mb-3">
                <p className="text-xs text-slate-400 mb-1">Your overall alignment will be derived from your per-sphere assessments — taking the most concerning state as the headline so the guide reacts to the weakest link, not the average.</p>
                <Row label="Derived overall" value={ALIGNMENT_LABEL[deriveOverallAlignment(form.sphereAlignment)]} />
              </div>
              <Field label="When the guide must choose between spheres, which one leads?">
                <p className="text-xs text-slate-400 mb-2 -mt-1">
                  Sets the default tie-break when several spheres need attention at once. Auto lets the guide pick — usually the lowest maturity or most at-risk sphere — which is the right answer for most operators.
                </p>
                <RadioGroup
                  value={form.precedenceMode}
                  options={PRECEDENCE_OPTIONS}
                  onChange={(v) => setForm((f) => ({ ...f, precedenceMode: v }))}
                />
              </Field>
            </>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Here is the snapshot your guide will use. You can re-assess any time from the metaMe Cartridge.
              </p>
              <div className="rounded border border-slate-700 bg-slate-800/40 p-3 space-y-1.5">
                <Row label="Focus" value={form.focusIntent.trim() || "—"} />
                <Row label="Overall alignment" value={ALIGNMENT_LABEL[deriveOverallAlignment(form.sphereAlignment)]} />
                <Row
                  label="Precedence"
                  value={
                    form.precedenceMode === "auto"
                      ? "Auto"
                      : `${SPHERE_LABEL[form.precedenceMode]} first`
                  }
                />
                <div className="pt-2 border-t border-slate-700/60 space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Per sphere</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                    {SPHERE_AXES.map((s) => (
                      <Row
                        key={s}
                        label={SPHERE_LABEL[s]}
                        value={`${MATURITY_LABEL[form.sphereMaturity[s]]} · ${ALIGNMENT_LABEL[form.sphereAlignment[s]]}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
            {error}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex items-center gap-1 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {!isLast ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => setStep((s) => Math.min(STEP_TITLES.length - 1, s + 1))}
              className="flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Save ExperienceGuide"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Inline primitives.
// ─────────────────────────────────────────────────────────────────────────

function SphereStep({
  sphere,
  maturity,
  alignment,
  onMaturity,
  onAlignment,
}: {
  sphere: SphereAxis;
  maturity: MaturityLevel;
  alignment: AlignmentState;
  onMaturity: (next: MaturityLevel) => void;
  onAlignment: (next: AlignmentState) => void;
}) {
  return (
    <section className="space-y-3 pb-3 border-b border-slate-800/60 last:border-b-0 last:pb-0">
      <header>
        <h3 className="text-sm font-semibold text-slate-100">{SPHERE_LABEL[sphere]}</h3>
        <p className="text-xs text-slate-400 mt-1 leading-snug">{SPHERE_DESCRIPTION[sphere]}</p>
      </header>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-300">Maturity — how settled is your practice here?</span>
          <span className="text-[10px] text-slate-500 italic">hover any chip for its meaning</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {MATURITY_LEVELS.map((m) => {
            const selected = m === maturity;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMaturity(m)}
                title={`${MATURITY_LABEL[m]} — ${MATURITY_DESCRIPTION[m]}`}
                aria-label={`${MATURITY_LABEL[m]} — ${MATURITY_DESCRIPTION[m]}`}
                className={`px-2.5 py-1 rounded-full border text-xs transition ${
                  selected
                    ? "bg-violet-500/20 border-violet-500 text-violet-200"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                {selected && <Check className="inline w-3 h-3 mr-1" />}
                {MATURITY_LABEL[m]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-300">Alignment — how does this sphere feel right now?</span>
          <span className="text-[10px] text-slate-500 italic">hover any chip for its meaning</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {ALIGNMENT_VALUES.map((a) => {
            const selected = a === alignment;
            const tone = ALIGNMENT_BUTTON_TONE[a];
            return (
              <button
                key={a}
                type="button"
                onClick={() => onAlignment(a)}
                title={`${ALIGNMENT_LABEL[a]} — ${ALIGNMENT_DESCRIPTION[a]}`}
                aria-label={`${ALIGNMENT_LABEL[a]} — ${ALIGNMENT_DESCRIPTION[a]}`}
                className={`px-2.5 py-1 rounded-full border text-xs transition ${selected ? tone.selected : tone.unselected}`}
              >
                {selected && <Check className="inline w-3 h-3 mr-1" />}
                {ALIGNMENT_LABEL[a]}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Per-state colour palette for the alignment chips — emerald (aligned),
// amber (drifting), orange (at risk), rose (repair). Stays consistent with
// the matrix tab and welcome chip so the operator reads the same colour
// language across surfaces.
const ALIGNMENT_BUTTON_TONE: Record<AlignmentState, { selected: string; unselected: string }> = {
  aligned: {
    selected: "bg-emerald-500/20 border-emerald-500 text-emerald-200",
    unselected: "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200",
  },
  drifting: {
    selected: "bg-amber-500/20 border-amber-500 text-amber-200",
    unselected: "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-200",
  },
  at_risk: {
    selected: "bg-orange-500/20 border-orange-500 text-orange-200",
    unselected: "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-orange-500/50 hover:text-orange-200",
  },
  repair: {
    selected: "bg-rose-500/20 border-rose-500 text-rose-200",
    unselected: "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-rose-500/50 hover:text-rose-200",
  },
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200 block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function RadioGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            aria-label={opt.hint ? `${opt.label} — ${opt.hint}` : opt.label}
            className={`w-full text-left px-3 py-2 rounded-md border transition ${
              selected
                ? "bg-violet-500/15 border-violet-500/60"
                : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full border ${
                  selected ? "bg-violet-400 border-violet-400" : "border-slate-500"
                }`}
              />
              <span className="text-sm font-medium text-slate-100">{opt.label}</span>
            </div>
            {opt.hint && <p className="text-xs text-slate-400 mt-1 pl-5">{opt.hint}</p>}
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 font-medium text-right">{value}</span>
    </div>
  );
}

export default PersonalGuideSetupWizard;
