"use client";

/**
 * MetaMeRuntimeSettingsTab — admin control for the Runtime takeover context.
 *
 * Surfaces the SAME toggle state as the in-runtime ⚡ Play-menu lightning-bolt
 * (which flips the metaMe Runtime welcome between the metaMe and KNYT takeovers).
 * This tab controls the *persisted default* context the runtime adopts on
 * arrival, via the shared `runtimeContextPreference` helper.
 *
 * It does NOT rebuild the takeover inference logic. Flipping the toggle writes
 * the shared localStorage preference; any live runtime surface (including an
 * embedded iframe) picks the change up through the browser-native `storage`
 * event and re-infers as a "toggle" entry — the existing mechanism.
 */

import React, { useEffect, useState } from "react";
import { Zap, Hexagon, Info } from "lucide-react";

import {
  getRuntimeContextPreference,
  setRuntimeContextPreference,
  RUNTIME_CONTEXT_PREF_KEY,
  type RuntimeContext,
} from "@/utils/runtimeContextPreference";

const OPTIONS: Array<{
  value: RuntimeContext;
  label: string;
  blurb: string;
  icon: React.ReactNode;
  active: string;
}> = [
  {
    value: "metame",
    label: "metaMe",
    blurb: "metaMe sovereignty surface — emerald banner, cross-cartridge NBEs (launch default).",
    icon: <Hexagon className="h-4 w-4" />,
    active: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
  },
  {
    value: "knyt",
    label: "KNYT World",
    blurb: "KNYT activation-campaign takeover — amber banner, KNYT-specific CTAs.",
    icon: <Zap className="h-4 w-4" />,
    active: "border-amber-500/50 bg-amber-500/10 text-amber-200",
  },
];

export function MetaMeRuntimeSettingsTab() {
  const [context, setContext] = useState<RuntimeContext>("metame");
  const [hydrated, setHydrated] = useState(false);

  // Read the persisted preference — server-side first, localStorage fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/runtime/settings/context", { cache: "no-store" });
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.context === "metame" || data.context === "knyt") {
            setContext(data.context);
            setRuntimeContextPreference(data.context);
          }
        }
      } catch {
        if (!cancelled) setContext(getRuntimeContextPreference());
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Keep in sync if the runtime's ⚡ toggle (or another admin tab) changes it.
  useEffect(() => {
    function onStorage() {
      setContext(getRuntimeContextPreference());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const select = (value: RuntimeContext) => {
    setContext(value);
    setRuntimeContextPreference(value);
    // Persist server-side so the thin client (different origin) picks it up.
    void fetch("/api/runtime/settings/context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: value }),
    }).then(async (res) => {
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("[runtime-context] PUT failed", res.status, detail);
      }
    }).catch((err) => {
      console.error("[runtime-context] PUT network error", err);
    });
    // Notify same-document listeners too — the native `storage` event does not
    // fire in the document that performed the write, only in sibling documents.
    try {
      window.dispatchEvent(
        new StorageEvent("storage", { key: RUNTIME_CONTEXT_PREF_KEY, newValue: value })
      );
    } catch {
      /* StorageEvent constructor unavailable — sibling-doc sync still works */
    }
  };

  return (
    <div className="max-w-2xl space-y-6 p-1">
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-slate-100">Runtime Settings</h2>
        <p className="text-sm text-slate-400">
          Choose which takeover owns the metaMe Runtime welcome surface by default. This is the
          same context the in-runtime ⚡ toggle flips — set here it becomes the persisted default
          users land on.
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Default runtime takeover
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const isActive = hydrated && context === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt.value)}
                aria-pressed={isActive}
                className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? opt.active
                    : "border-slate-700/60 bg-slate-800/30 text-slate-300 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {opt.icon}
                  {opt.label}
                  {isActive && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide opacity-80">
                      active
                    </span>
                  )}
                </div>
                <p className="text-xs leading-snug text-slate-400">{opt.blurb}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-slate-700/50 bg-slate-800/20 px-3 py-2.5 text-xs text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
        <span>
          Applies to runtime surfaces on this browser. A live runtime (including an embedded
          iframe) reflects the change immediately; otherwise it takes effect on the next runtime
          load. This setting does not alter takeover inference — only which cartridge is active.
        </span>
      </div>
    </div>
  );
}

export default MetaMeRuntimeSettingsTab;
