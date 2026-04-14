"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Brain, CheckCircle, Eye, Info, Settings, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export const METAME_SETTINGS_KEY = "metame_alpha_settings";

export type BudgetPosture = "low" | "medium" | "high";
export type LeadAgent = "aigent-kn0w1" | "aigent-z" | "aigent-c";

export interface MetaMeSettings {
  guardianMode: boolean;
  leadAgent: LeadAgent;
  budgetPosture: BudgetPosture;
  receiptVisibility: boolean;
  curatedSkillsOnly: boolean;
  explanationFirst: boolean;
}

export const METAME_ALPHA_DEFAULTS: MetaMeSettings = {
  guardianMode: true,
  leadAgent: "aigent-kn0w1",
  budgetPosture: "low",
  receiptVisibility: true,
  curatedSkillsOnly: true,
  explanationFirst: true,
};

export function loadMetaMeSettings(): MetaMeSettings {
  if (typeof window === "undefined") return METAME_ALPHA_DEFAULTS;
  try {
    const raw = localStorage.getItem(METAME_SETTINGS_KEY);
    if (!raw) return METAME_ALPHA_DEFAULTS;
    return { ...METAME_ALPHA_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return METAME_ALPHA_DEFAULTS;
  }
}

export function saveMetaMeSettings(settings: MetaMeSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(METAME_SETTINGS_KEY, JSON.stringify(settings));
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  accentClass = "bg-emerald-500",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  accentClass?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer py-3 border-b border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description ? <p className="text-xs text-slate-400 mt-0.5">{description}</p> : null}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${checked ? accentClass : "bg-slate-700"}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </label>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
            value === opt.value
              ? "border-amber-600 bg-amber-950/60 text-amber-200"
              : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * MetaMeSettingsPanel
 *
 * Reusable settings form. Rendered inside both:
 * - /metame/settings page (standalone)
 * - MetaMeRuntimeClient left-entering settings drawer (Be tab sub-item)
 */
export function MetaMeSettingsPanel() {
  const router = useRouter();
  const [settings, setSettings] = useState<MetaMeSettings>(METAME_ALPHA_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadMetaMeSettings());
    setHydrated(true);
  }, []);

  function update<K extends keyof MetaMeSettings>(key: K, value: MetaMeSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveMetaMeSettings(settings);
    setSaved(true);
  }

  function handleReset() {
    setSettings(METAME_ALPHA_DEFAULTS);
    saveMetaMeSettings(METAME_ALPHA_DEFAULTS);
    setSaved(true);
  }

  if (!hydrated) {
    return <div className="p-6 text-sm text-slate-400">Loading settings…</div>;
  }

  return (
    <div className="grid gap-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-400" />
            metaMe Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Teach the system how to act for you without giving up control.
          </p>
        </div>
        <Badge className="border-amber-800 bg-amber-950 text-amber-300 shrink-0 text-[10px]">Alpha</Badge>
      </div>

      {/* Guardian Mode */}
      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Guardian &amp; Authority
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            checked={settings.guardianMode}
            onChange={(v) => update("guardianMode", v)}
            label="Guardian mode"
            description="The system asks before acting on your behalf. Recommended on in alpha."
            accentClass="bg-emerald-500"
          />
        </CardContent>
      </Card>

      {/* Lead Agent */}
      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Brain className="h-4 w-4 text-amber-400" />
            Lead Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400">
            Your lead agent is the primary intelligence surface for your session.
          </p>
          <SegmentedControl
            value={settings.leadAgent}
            options={[
              { value: "aigent-kn0w1", label: "Kn0w1" },
              { value: "aigent-z", label: "Aigent Z" },
              { value: "aigent-c", label: "Aigent C" },
            ]}
            onChange={(v) => update("leadAgent", v as LeadAgent)}
          />
          {settings.leadAgent === "aigent-kn0w1" ? (
            <p className="text-xs text-emerald-400/80 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Kn0w1 is active as your KNYT intelligence lead.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Budget Posture */}
      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Zap className="h-4 w-4 text-sky-400" />
            Spend Autonomy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400">
            Controls how much Qc the system can spend without asking. All skill invocations are 0 Qc in alpha.
          </p>
          <SegmentedControl
            value={settings.budgetPosture}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            onChange={(v) => update("budgetPosture", v as BudgetPosture)}
          />
        </CardContent>
      </Card>

      {/* Visibility & Skills */}
      <Card className="rounded-xl border border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            Visibility &amp; Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            checked={settings.receiptVisibility}
            onChange={(v) => update("receiptVisibility", v)}
            label="Receipt visibility"
            description="Show DVN receipts for meaningful participation events."
          />
          <Toggle
            checked={settings.curatedSkillsOnly}
            onChange={(v) => update("curatedSkillsOnly", v)}
            label="Curated skills only"
            description="Restrict skill access to the curated Know1 alpha family."
          />
          <Toggle
            checked={settings.explanationFirst}
            onChange={(v) => update("explanationFirst", v)}
            label="Explanation-first native assets"
            description="Always explain $KNYT and Qc before acting on them."
          />
        </CardContent>
      </Card>

      {/* Alpha note */}
      <Card className="rounded-xl border border-slate-700/50 bg-slate-900/40">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400">
            Settings are stored locally in alpha. Persistent metaMe Templates backed by your DID arrive post-alpha. Nothing here affects on-chain state.
          </p>
        </CardContent>
      </Card>

      {/* Save controls */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-slate-300 transition underline"
        >
          Reset to defaults
        </button>
        <div className="flex items-center gap-3">
          {saved ? (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Saved
            </span>
          ) : null}
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            onClick={handleSave}
          >
            Save settings
          </Button>
        </div>
      </div>

      {/* Know1 CTA */}
      {settings.leadAgent === "aigent-kn0w1" ? (
        <Card className="rounded-xl border border-amber-700/40 bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-amber-200">Kn0w1 is your lead</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Start a session to explore KNYT treasury, rewards, and your next move.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold whitespace-nowrap"
              onClick={() => router.push("/aigents/aigent-kn0w1")}
            >
              Open Kn0w1 <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
