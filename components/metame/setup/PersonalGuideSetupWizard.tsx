"use client";

/**
 * PersonalGuideSetupWizard — Personal ExperienceGuide onboarding.
 *
 * Per metaMe Cartridge PRD (Personal ExperienceGuide layer).
 *
 * Seven steps. Each step is short — the user should complete onboarding
 * in under three minutes:
 *
 *   1. Focus — free-text intent ("what are you tending right now?")
 *   2. Energy + Body — self-assessed maturity per sphere
 *   3. Mind + Emotion — same
 *   4. Relationship + Community — same
 *   5. Legacy — same
 *   6. Alignment self-check + precedence mode
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
  ALIGNMENT_LABEL,
  MATURITY_LABEL,
  MATURITY_LEVELS,
  SPHERE_AXES,
  SPHERE_LABEL,
  defaultSphereMaturity,
  type AlignmentState,
  type MaturityLevel,
  type PersonalGuideData,
  type PrecedenceMode,
  type SphereAxis,
} from "@/types/experienceGuide";

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
  alignmentState: AlignmentState;
  precedenceMode: PrecedenceMode;
}

const ALIGNMENT_OPTIONS: Array<{ value: AlignmentState; label: string; hint: string }> = [
  { value: "aligned",  label: "Aligned",  hint: "Your spheres feel coherent — energy, attention and commitments line up." },
  { value: "drifting", label: "Drifting", hint: "A couple of spheres are slipping — nothing urgent, but you can feel it." },
  { value: "at_risk",  label: "At risk",  hint: "Real friction is building in one or more spheres; intervention soon would help." },
  { value: "repair",   label: "Repair",   hint: "You need to repair an active rupture before you can move forward." },
];

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
  "Alignment",
  "Review",
];

function emptyForm(initial?: PersonalGuideData | null): FormState {
  return {
    focusIntent: initial?.focusIntent ?? "",
    sphereMaturity: initial?.sphereMaturity ?? defaultSphereMaturity(),
    alignmentState: initial?.alignmentState ?? "drifting",
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
          alignmentState: form.alignmentState,
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
              <SphereStep sphere="energy" value={form.sphereMaturity.energy} onChange={(v) => setSphere("energy", v)} />
              <SphereStep sphere="body"   value={form.sphereMaturity.body}   onChange={(v) => setSphere("body", v)} />
            </>
          )}

          {step === 2 && (
            <>
              <SphereStep sphere="mind"    value={form.sphereMaturity.mind}    onChange={(v) => setSphere("mind", v)} />
              <SphereStep sphere="emotion" value={form.sphereMaturity.emotion} onChange={(v) => setSphere("emotion", v)} />
            </>
          )}

          {step === 3 && (
            <>
              <SphereStep sphere="relationship" value={form.sphereMaturity.relationship} onChange={(v) => setSphere("relationship", v)} />
              <SphereStep sphere="community"    value={form.sphereMaturity.community}    onChange={(v) => setSphere("community", v)} />
            </>
          )}

          {step === 4 && (
            <SphereStep sphere="legacy" value={form.sphereMaturity.legacy} onChange={(v) => setSphere("legacy", v)} />
          )}

          {step === 5 && (
            <>
              <Field label="How aligned do your spheres feel right now?">
                <RadioGroup
                  value={form.alignmentState}
                  options={ALIGNMENT_OPTIONS}
                  onChange={(v) => setForm((f) => ({ ...f, alignmentState: v }))}
                />
              </Field>
              <Field label="When the guide must choose between spheres, which one leads?">
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
                <Row label="Alignment" value={ALIGNMENT_LABEL[form.alignmentState]} />
                <Row
                  label="Precedence"
                  value={
                    form.precedenceMode === "auto"
                      ? "Auto"
                      : `${SPHERE_LABEL[form.precedenceMode]} first`
                  }
                />
                <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-x-3 gap-y-1">
                  {SPHERE_AXES.map((s) => (
                    <Row key={s} label={SPHERE_LABEL[s]} value={MATURITY_LABEL[form.sphereMaturity[s]]} />
                  ))}
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
  value,
  onChange,
}: {
  sphere: SphereAxis;
  value: MaturityLevel;
  onChange: (next: MaturityLevel) => void;
}) {
  return (
    <Field label={`${SPHERE_LABEL[sphere]} — where do you sit?`}>
      <div className="flex flex-wrap gap-1.5">
        {MATURITY_LEVELS.map((m) => {
          const selected = m === value;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
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
    </Field>
  );
}

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
