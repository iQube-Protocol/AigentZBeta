"use client";

/**
 * ExperienceModelSetupWizard — multi-step setup flow for the user's
 * ExperienceQube. aigentMe Phase 2.b.
 *
 * Per PRD v0.2 §6.3 (ExperienceModel setup flow). Six PRD prompts are
 * grouped into three logical steps so the user can complete setup in <2
 * minutes:
 *
 *   Step 1 — Project: experienceName + experienceType + primaryGoal
 *   Step 2 — Scope:   activeCartridges + currentStage
 *   Step 3 — Privacy: confidentialityDefault + progressModel
 *
 * Wires through the canonical PersonaSpine `personaFetch` to
 * POST /api/assistant/experience-model. The route resolves the persona
 * from the spine — the wizard never sends a personaId in the body.
 *
 * On success the wizard calls onSaved with the new GET response shape so
 * the parent surface can re-render without an extra fetch.
 *
 * Non-goals (deferred):
 *   - BlakQube editing (strategic notes, IP, KPIs, partners) — Phase 5
 *     specialist routing surfaces will edit these one slice at a time.
 *   - Curated experience-model picker (selecting from the global
 *     experience_models catalogue) — Phase 4 AVL flow uses this.
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
import type { ExperienceModelCardData } from "@/components/metame/cards/ExperienceModelCard";

// ─────────────────────────────────────────────────────────────────────────
// Types — mirror the route's accepted body fields.
// ─────────────────────────────────────────────────────────────────────────

type ExperienceType =
  | "personal"
  | "creative"
  | "venture"
  | "client"
  | "portfolio"
  | "venture_building";

type ExperienceStage =
  | "setup"
  | "alpha_activation"
  | "launch"
  | "growth"
  | "scale";

type ConfidentialityDefault =
  | "private_by_default"
  | "selective_share"
  | "open";

type ActiveCartridgeSlug =
  | "metame"
  | "knyt"
  | "qriptopian"
  | "marketa"
  | "avl";

interface FormState {
  experienceName: string;
  experienceType: ExperienceType;
  primaryGoal: string;
  activeCartridges: ActiveCartridgeSlug[];
  currentStage: ExperienceStage;
  confidentialityDefault: ConfidentialityDefault;
  progressModel: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial state — pre-fills from the existing ExperienceQube if any. */
  initial?: Partial<FormState>;
  /** Called with the GET response shape after a successful save. */
  onSaved: (data: ExperienceModelCardData) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Static option catalogues — single source of truth for the wizard UI.
// ─────────────────────────────────────────────────────────────────────────

const EXPERIENCE_TYPES: Array<{ value: ExperienceType; label: string; hint: string }> = [
  { value: "venture_building", label: "Venture building", hint: "Active venture / franchise / commercial program" },
  { value: "creative",         label: "Creative",         hint: "Editorial, media, narrative, IP development" },
  { value: "personal",         label: "Personal",         hint: "Personal goals, learning, sovereignty journey" },
  { value: "client",           label: "Client",           hint: "Work delivered for an external client" },
  { value: "portfolio",        label: "Portfolio",        hint: "Multi-venture / multi-cartridge oversight" },
];

const STAGES: Array<{ value: ExperienceStage; label: string; hint: string }> = [
  { value: "setup",            label: "Setup",            hint: "Defining the work" },
  { value: "alpha_activation", label: "Alpha activation", hint: "First live activity" },
  { value: "launch",           label: "Launch",           hint: "Going to market" },
  { value: "growth",           label: "Growth",           hint: "Compounding traction" },
  { value: "scale",            label: "Scale",            hint: "Operating at size" },
];

const CARTRIDGES: Array<{ slug: ActiveCartridgeSlug; label: string }> = [
  { slug: "metame",     label: "metaMe" },
  { slug: "knyt",       label: "KNYT" },
  { slug: "qriptopian", label: "The Qriptopian" },
  { slug: "marketa",    label: "Marketa" },
  { slug: "avl",        label: "AgentiQ Venture Lab" },
];

const CONFIDENTIALITY_OPTIONS: Array<{ value: ConfidentialityDefault; label: string; hint: string }> = [
  { value: "private_by_default", label: "Private by default", hint: "aigentMe asks before sharing any context with specialists or external tools" },
  { value: "selective_share",    label: "Selective share",    hint: "aigentMe may share scoped context with the specialists you've enabled, asking only on consequential actions" },
  { value: "open",               label: "Open",               hint: "aigentMe may share context broadly across enabled specialists; consequential actions still require approval" },
];

const PROGRESS_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "brief_decide_create_coordinate_record", label: "Brief · Decide · Create · Coordinate · Record" },
  { value: "weekly_kpi_review",                     label: "Weekly KPI review" },
  { value: "campaign_sprint",                       label: "Campaign sprint" },
];

// ─────────────────────────────────────────────────────────────────────────
// Wizard.
// ─────────────────────────────────────────────────────────────────────────

const STEP_TITLES = ["Project", "Scope", "Privacy"];

export function ExperienceModelSetupWizard({ open, onOpenChange, initial, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    experienceName: initial?.experienceName ?? "",
    experienceType: initial?.experienceType ?? "venture_building",
    primaryGoal: initial?.primaryGoal ?? "",
    activeCartridges: initial?.activeCartridges ?? ["metame"],
    currentStage: initial?.currentStage ?? "alpha_activation",
    confidentialityDefault: initial?.confidentialityDefault ?? "private_by_default",
    progressModel: initial?.progressModel ?? "brief_decide_create_coordinate_record",
  });

  // Re-hydrate form state from `initial` each time the wizard opens. The
  // wizard mounts once at page load when `expModel` is still null, so the
  // initial useState above can only ever see undefined. Without this sync,
  // reopening the wizard after a save shows stale defaults and asks users
  // to re-enter values they already saved.
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;
    setForm({
      experienceName: initial?.experienceName ?? "",
      experienceType: initial?.experienceType ?? "venture_building",
      primaryGoal: initial?.primaryGoal ?? "",
      activeCartridges: initial?.activeCartridges ?? ["metame"],
      currentStage: initial?.currentStage ?? "alpha_activation",
      confidentialityDefault: initial?.confidentialityDefault ?? "private_by_default",
      progressModel: initial?.progressModel ?? "brief_decide_create_coordinate_record",
    });
    setStep(0);
    setError(null);
  }, [open, initial]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleCartridge(slug: ActiveCartridgeSlug) {
    setForm((f) => {
      const has = f.activeCartridges.includes(slug);
      const next = has
        ? f.activeCartridges.filter((s) => s !== slug)
        : [...f.activeCartridges, slug];
      // Always keep at least one cartridge selected — fall back to metame.
      return { ...f, activeCartridges: next.length > 0 ? next : ["metame"] };
    });
  }

  // ── Step gates ──
  const step1Valid = form.experienceName.trim().length > 0 && form.primaryGoal.trim().length > 0;
  const step2Valid = form.activeCartridges.length > 0;
  const canAdvance = step === 0 ? step1Valid : step === 1 ? step2Valid : true;
  const isLast = step === STEP_TITLES.length - 1;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/experience-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceName: form.experienceName.trim(),
          experienceType: form.experienceType,
          primaryGoal: form.primaryGoal.trim(),
          activeCartridges: form.activeCartridges,
          currentStage: form.currentStage,
          confidentialityDefault: form.confidentialityDefault,
          progressModel: form.progressModel,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `save failed (${res.status})`);
      }
      const data = (await res.json()) as ExperienceModelCardData;
      onSaved(data);
      onOpenChange(false);
      // Reset step so re-opening starts at the beginning.
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
          <DialogTitle>Set up your ExperienceModel</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEP_TITLES.length} · {STEP_TITLES[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {STEP_TITLES.map((title, i) => (
            <div
              key={title}
              className={`flex-1 h-1 rounded ${
                i <= step ? "bg-violet-500" : "bg-slate-700/50"
              }`}
            />
          ))}
        </div>

        {/* Step body */}
        <div className="space-y-4 py-2 min-h-[280px]">
          {step === 0 && (
            <>
              <Field label="What are you building or progressing?" required>
                <input
                  type="text"
                  value={form.experienceName}
                  onChange={(e) => update("experienceName", e.target.value)}
                  placeholder="KNYT Wheel · metaMe Alpha · Qriptopian launch · Partner campaign"
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500"
                  maxLength={500}
                />
              </Field>

              <Field label="Experience type">
                <RadioGroup
                  value={form.experienceType}
                  options={EXPERIENCE_TYPES}
                  onChange={(v) => update("experienceType", v as ExperienceType)}
                />
              </Field>

              <Field label="What outcome matters most right now?" required>
                <div className="relative">
                  <textarea
                    value={form.primaryGoal}
                    onChange={(e) => update("primaryGoal", e.target.value)}
                    placeholder="Launch readiness · Investor activation · Partner proposals · Content publication · Revenue validation"
                    className="w-full px-3 py-2 pr-12 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500 min-h-[80px]"
                    maxLength={1000}
                  />
                  <div className="absolute top-2 right-2">
                    <MicButton
                      onTranscript={(text) =>
                        update("primaryGoal", form.primaryGoal ? `${form.primaryGoal.trimEnd()} ${text}` : text)
                      }
                      size="sm"
                      theme="dark"
                    />
                  </div>
                </div>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Which cartridges are active?" required>
                <div className="flex flex-wrap gap-2">
                  {CARTRIDGES.map((c) => {
                    const selected = form.activeCartridges.includes(c.slug);
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => toggleCartridge(c.slug)}
                        className={`px-3 py-1.5 rounded-full border text-sm transition ${
                          selected
                            ? "bg-violet-500/20 border-violet-500 text-violet-200"
                            : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {selected && <Check className="inline w-3 h-3 mr-1" />}
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  metaMe is included by default. You can change this anytime.
                </p>
              </Field>

              <Field label="Current stage">
                <RadioGroup
                  value={form.currentStage}
                  options={STAGES}
                  onChange={(v) => update("currentStage", v as ExperienceStage)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="What should remain confidential by default?">
                <RadioGroup
                  value={form.confidentialityDefault}
                  options={CONFIDENTIALITY_OPTIONS}
                  onChange={(v) =>
                    update("confidentialityDefault", v as ConfidentialityDefault)
                  }
                />
              </Field>

              <Field label="Progress model">
                <select
                  value={form.progressModel}
                  onChange={(e) => update("progressModel", e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500"
                >
                  {PROGRESS_MODEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  How aigentMe structures your daily / project briefs.
                </p>
              </Field>
            </>
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
              disabled={!canAdvance || saving}
              onClick={() => setStep((s) => Math.min(STEP_TITLES.length - 1, s + 1))}
              className="flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !canAdvance}
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Save ExperienceModel"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tiny field + radio-group helpers — local only; not worth promoting yet.
// ─────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200 block mb-1.5">
        {label}
        {required && <span className="text-violet-400 ml-1">*</span>}
      </span>
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
                  selected
                    ? "bg-violet-400 border-violet-400"
                    : "border-slate-500"
                }`}
              />
              <span className="text-sm font-medium text-slate-100">{opt.label}</span>
            </div>
            {opt.hint && (
              <p className="text-xs text-slate-400 mt-1 pl-5">{opt.hint}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ExperienceModelSetupWizard;
