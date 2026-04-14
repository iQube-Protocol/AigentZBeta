"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ChevronDown } from "lucide-react";

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
  window.dispatchEvent(new CustomEvent("metame_settings_changed", { detail: settings }));
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3.5 border-b border-gray-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-tight">{label}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">{description}</p>
      </div>
      <div className="shrink-0 flex items-center mt-0.5">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${
        checked ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 mt-[2px] rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

function SettingSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 pl-2.5 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-slate-500" />
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

/**
 * MetaMeSettingsPanel
 *
 * Rendered inside:
 * - MetaMeRuntimeClient left-entering drawer (Be tab sub-item)
 * - /metame/settings standalone page
 *
 * No inner header — the drawer wrapper provides the header.
 */
export function MetaMeSettingsPanel() {
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

  if (!hydrated) {
    return <div className="px-4 py-6 text-xs text-gray-400 dark:text-slate-500">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Settings rows */}
      <div className="flex-1 px-4 pt-1 pb-4">
        <SettingRow
          label="Guardian Mode"
          description="Require approval before agents take actions on your behalf."
        >
          <Toggle checked={settings.guardianMode} onChange={(v) => update("guardianMode", v)} />
        </SettingRow>

        <SettingRow
          label="Lead Agent"
          description="Primary agent that handles your requests."
        >
          <SettingSelect
            value={settings.leadAgent}
            options={[
              { value: "aigent-kn0w1", label: "Aigent Kn0w1" },
              { value: "aigent-z",     label: "Aigent Z" },
              { value: "aigent-c",     label: "Aigent C" },
            ]}
            onChange={(v) => update("leadAgent", v as LeadAgent)}
          />
        </SettingRow>

        <SettingRow
          label="Spend Autonomy"
          description="How much agents can spend without asking."
        >
          <SettingSelect
            value={settings.budgetPosture}
            options={[
              { value: "low",    label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high",   label: "High" },
            ]}
            onChange={(v) => update("budgetPosture", v as BudgetPosture)}
          />
        </SettingRow>

        <SettingRow
          label="Show Receipts"
          description="Display transaction receipts after agent actions."
        >
          <Toggle checked={settings.receiptVisibility} onChange={(v) => update("receiptVisibility", v)} />
        </SettingRow>

        <SettingRow
          label="Curated Skills Only"
          description="Restrict agents to pre-approved skill sets."
        >
          <Toggle checked={settings.curatedSkillsOnly} onChange={(v) => update("curatedSkillsOnly", v)} />
        </SettingRow>

        <SettingRow
          label="Explain Before Acting"
          description="Agents explain their plan before executing."
        >
          <Toggle checked={settings.explanationFirst} onChange={(v) => update("explanationFirst", v)} />
        </SettingRow>
      </div>

      {/* Save footer */}
      <div className="px-4 pb-5 pt-2 border-t border-gray-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white text-sm font-semibold py-2 transition-colors"
        >
          {saved ? (
            <span className="inline-flex items-center gap-1.5 justify-center">
              <CheckCircle className="h-3.5 w-3.5" />
              Saved
            </span>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
