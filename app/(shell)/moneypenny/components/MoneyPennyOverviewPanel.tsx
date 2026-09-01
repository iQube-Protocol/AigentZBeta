/**
 * MoneyPennyOverviewPanel — the capability-led landing hub for the
 * `moneypenny-codex` cartridge (SPEC-MPY-002 §2.1 "OVERVIEW", work package
 * MPY2-1). Renders the same `MONEYPENNY_CAPABILITY_GROUPS` data as
 * `MoneyPennyCapabilityRail` as a card grid, so a first-time visitor sees
 * what MoneyPenny can do without first learning the Advisor/Architect/
 * Runtime service-mode vocabulary (SPEC-MPY-002 §2.2, acceptance criterion
 * #5 — "capability-led rather than forcing service-mode jargon first").
 */

"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { tryOpenInMountedCartridge } from "@/services/cartridge/CartridgePresenceRegistry";
import { MONEYPENNY_CAPABILITY_GROUPS } from "./moneypennyCapabilities";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";

const MONEYPENNY_CODEX_ID = "moneypenny-codex";

const MODE_BADGE_STYLE: Record<string, string> = {
  ADVISOR: "bg-sky-500/10 text-sky-300 border border-sky-800/60",
  ARCHITECT: "bg-amber-500/10 text-amber-300 border border-amber-800/60",
  RUNTIME: "bg-emerald-500/10 text-emerald-300 border border-emerald-800/60",
};

export function MoneyPennyOverviewPanel() {
  const navigate = (panel: MoneyPennyPanelKey | null) => {
    if (!panel) return;
    tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, tab: panel });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">One MoneyPenny cartridge. One canonical runtime. Many experience altitudes.</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Explore financial capability by what you&apos;re trying to do, not by which service mode handles it.
          Advisor / Architect / Runtime remain how each capability may act underneath.
        </p>
      </div>

      {MONEYPENNY_CAPABILITY_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const available = item.panel !== null;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!available}
                  onClick={() => navigate(item.panel)}
                  className={`group flex flex-col rounded-lg border p-3 text-left transition-colors ${
                    available
                      ? "border-slate-800 bg-slate-900/40 hover:border-emerald-700/60 hover:bg-slate-900/60"
                      : "cursor-not-allowed border-slate-800/60 bg-slate-900/20 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-100">{item.label}</span>
                    {available ? (
                      <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-emerald-400" />
                    ) : (
                      <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-600">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                  {item.mode && (
                    <span className={`mt-2 inline-block w-fit rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${MODE_BADGE_STYLE[item.mode] ?? ""}`}>
                      {item.mode}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MoneyPennyOverviewPanel;
