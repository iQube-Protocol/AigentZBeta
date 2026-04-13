"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Brain, CheckCircle, Eye, Info, Settings, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "metame_alpha_settings";

type BudgetPosture = "low" | "medium" | "high";
type LeadAgent = "aigent-kn0w1" | "aigent-z" | "aigent-c";

interface MetaMeSettings {
  guardianMode: boolean;
  leadAgent: LeadAgent;
  budgetPosture: BudgetPosture;
  receiptVisibility: boolean;
  curatedSkillsOnly: boolean;
  explanationFirst: boolean;
}

const ALPHA_DEFAULTS: MetaMeSettings = {
  guardianMode: true,
  leadAgent: "aigent-kn0w1",
  budgetPosture: "low",
  receiptVisibility: true,
  curatedSkillsOnly: true,
  explanationFirst: true,
};

function loadSettings(): MetaMeSettings {
  if (typeof window === "undefined") return ALPHA_DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALPHA_DEFAULTS;
    return { ...ALPHA_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return ALPHA_DEFAULTS;
  }
}

function saveSettings(settings: MetaMeSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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

export default function MetaMeSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<MetaMeSettings>(ALPHA_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  function update<K extends keyof MetaMeSettings>(key: K, value: MetaMeSettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    saveSettings(settings);
    setSaved(true);
  }

  function handleReset() {
    setSettings(ALPHA_DEFAULTS);
    saveSettings(ALPHA_DEFAULTS);
    setSaved(true);
  }

  if (!hydrated) {
    return (
      <div className="p-6 text-sm text-slate-400">Loading settings…</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto grid gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-400" />
            metaMe Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Teach the system how to act for you without giving up control. These settings apply across all cartridges.
          </p>
        </div>
        <Badge className="border-amber-800 bg-amber-950 text-amber-300 shrink-0">Alpha</Badge>
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
            description="The system asks before acting on your behalf. Recommended on in alpha — disabling removes soft-confirm prompts."
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
            Your lead agent is the primary intelligence surface for your session. In the KNYT context, Kn0w1 is the default and recommended lead.
          </p>
          <SegmentedControl
            value={settings.leadAgent}
            options={[
              { value: "aigent-kn0w1", label: "Kn0w1 (recommended)", description: "KNYT cartridge lead" },
              { value: "aigent-z", label: "Aigent Z", description: "System orchestrator" },
              { value: "aigent-c", label: "Aigent C", description: "General guide" },
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
            Controls how much the system can spend Qc on your behalf without asking. Low is the alpha default — all skill invocations are 0 Qc in alpha so this is advisory.
          </p>
          <SegmentedControl
            value={settings.budgetPosture}
            options={[
              { value: "low", label: "Low (default)" },
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
            description="Show DVN receipts for meaningful participation events. Required for rewards recognition."
          />
          <Toggle
            checked={settings.curatedSkillsOnly}
            onChange={(v) => update("curatedSkillsOnly", v)}
            label="Curated skills only"
            description="Restrict skill access to the curated Know1 alpha family. Disabling exposes the broader skill registry."
          />
          <Toggle
            checked={settings.explanationFirst}
            onChange={(v) => update("explanationFirst", v)}
            label="Explanation-first native asset exposure"
            description="Always explain $KNYT and Qc before acting on them. Prevents silent economic actions."
          />
        </CardContent>
      </Card>

      {/* Alpha note */}
      <Card className="rounded-xl border border-slate-700/50 bg-slate-900/40">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400">
            These settings are stored locally in alpha. A persistent metaMe Template backed by your DID and Supabase profile will be available in post-alpha phases. Nothing you configure here affects on-chain state.
          </p>
        </CardContent>
      </Card>

      {/* Save controls */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-slate-300 transition underline"
        >
          Reset to alpha defaults
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
                Start a session with Kn0w1 to explore KNYT treasury, rewards, and your next move.
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
