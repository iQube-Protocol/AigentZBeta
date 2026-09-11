"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ChevronDown } from "lucide-react";

export const METAME_SETTINGS_KEY = "metame_alpha_settings";

export type BudgetPosture = "low" | "medium" | "high";
export type LeadAgent = "aigent-kn0w1" | "aigent-marketa" | "aigent-c";

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
  // Default lead agent is the user's aigentMe — wired to their metaMe
  // cartridge state. Cartridge-specific specialists remain selectable.
  leadAgent: "aigent-me",
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
    <div className="flex items-start justify-between gap-3 py-3.5 border-b border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        {/* text-slate-100 → ink-secondary (#595247) in mm-light; near-white in dark */}
        <p className="text-sm font-semibold text-slate-100 leading-tight">{label}</p>
        {/* text-slate-400 → ink-muted (#7B7266) in mm-light; medium in dark */}
        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{description}</p>
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
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        checked
          ? "bg-emerald-500 ring-1 ring-emerald-400/30"
          : "bg-white/[0.08] ring-1 ring-white/10 backdrop-blur-sm"
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
      {/* bg-slate-900/80 → surface-1 (#F7F2E8) in mm-light; dark in dark mode */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none text-xs rounded-lg border border-white/10 bg-slate-900/80 backdrop-blur-sm text-slate-100 pl-2.5 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* text-slate-400 → ink-muted in mm-light */}
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

/**
 * MetaMeSettingsPanel
 *
 * Rendered inside:
 * - MetaMeRuntimeClient left-entering drawer (Be tab sub-item) — no inner header needed
 * - /metame/settings standalone page
 *
 * When personaId is provided: loads from and saves to /api/metame/settings.
 * Without personaId: falls back to localStorage (offline / unauthenticated).
 *
 * Uses slate-* and white/* classes throughout so mm-light remapping applies correctly.
 */
export function MetaMeSettingsPanel({ personaId }: { personaId?: string } = {}) {
  const [settings, setSettings] = useState<MetaMeSettings>(METAME_ALPHA_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (personaId) {
      fetch(`/api/metame/settings?personaId=${encodeURIComponent(personaId)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.ok && json.data) {
            // Persist to localStorage so loadMetaMeSettings() returns fresh data
            saveMetaMeSettings(json.data);
            setSettings(json.data);
          } else {
            setSettings(loadMetaMeSettings());
          }
        })
        .catch(() => setSettings(loadMetaMeSettings()))
        .finally(() => setHydrated(true));
    } else {
      setSettings(loadMetaMeSettings());
      setHydrated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId]);

  function update<K extends keyof MetaMeSettings>(key: K, value: MetaMeSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaved(false);
  }

  function handleSave() {
    // Always update localStorage so runtime consumers get the event immediately
    saveMetaMeSettings(settings);

    if (personaId) {
      fetch("/api/metame/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, settings }),
      }).catch((err) =>
        console.warn("[MetaMeSettingsPanel] API save failed, localStorage updated:", err)
      );
    }

    setIsDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!hydrated) {
    return <div className="px-4 py-6 text-xs text-slate-400">Loading…</div>;
  }

  return (
    <div className="flex flex-col">
      {/* Settings rows */}
      <div className="px-4 pt-2 pb-2">
        <SettingRow
          label="Guardian Mode"
          description="Require approval before agents take actions on your behalf."
        >
          <Toggle checked={settings.guardianMode} onChange={(v) => update("guardianMode", v)} />
        </SettingRow>

        <SettingRow
          label="Lead Runtime Agent"
          description="Primary agent that handles your runtime requests."
        >
          <SettingSelect
            value={settings.leadAgent}
            options={[
              { value: "aigent-kn0w1",   label: "Aigent Kn0w1" },
              { value: "aigent-marketa", label: "Aigent Marketa" },
              { value: "aigent-c",       label: "Aigent C" },
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

      {/* Save button — below last row, above the fold; lights up when there are unsaved changes */}
      <div className="px-4 pt-1 pb-4">
        <button
          type="button"
          onClick={handleSave}
          className={`w-full rounded-lg border backdrop-blur-sm text-sm font-semibold py-2 transition-all duration-200 ${
            saved
              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
              : isDirty
              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 active:bg-emerald-500/15"
              : "border-white/10 bg-white/[0.08] text-slate-400 hover:bg-white/[0.13] active:bg-white/[0.06]"
          }`}
        >
          {saved ? (
            <span className="inline-flex items-center gap-1.5 justify-center text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" />
              Saved
            </span>
          ) : isDirty ? (
            "Save changes"
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
