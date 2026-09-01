/**
 * MoneyPennyCapabilityRail — the polished, donor-inspired vertical
 * capability navigation for the MoneyPenny cartridge (SPEC-MPY-002 §2.1,
 * §10, work package MPY2-1: "introduce polished capability rail/menu using
 * donor interaction grammar").
 *
 * Reuses the EXISTING cross-cartridge tab-switch seam
 * (`tryOpenInMountedCartridge`, `services/cartridge/CartridgePresenceRegistry`)
 * — the same single mechanism the wallet and Living Canon chips already use
 * to switch a mounted cartridge's tab in place. This rail does NOT create a
 * second router/shell (SPEC-MPY-002 §10 integration rule, §16 non-goal): it
 * is a navigation AID rendered inside the existing `moneypenny-codex`
 * cartridge shell (`MoneyPennyShell`), and every item it links to is a real
 * `data/codex-configs.ts` `MONEYPENNY_CARTRIDGE` tab, dispatched through the
 * unchanged `MoneyPennyPanelTab` component.
 *
 * `data/codex-configs.ts`'s `MONEYPENNY_CARTRIDGE.tabGroups` is
 * DELIBERATELY left untouched here (still `operate/connect/service/
 * administer`, pinned by
 * `tests/fs-operate-embed-viewport-parity.test.ts`'s exact-match canary) —
 * this rail is an ADDITIVE capability-axis view over the same tabs, not a
 * replacement of the Standard Cartridge Navigation Framework's own
 * tabGroups. See the MPY2-0 donor harvest audit doc for the full rationale.
 *
 * Items with `panel: null` (SPEC-MPY-002 capabilities not yet built —
 * Financial Profile, Risk Envelope, Scenario/Backtest, Opportunities,
 * Execution Insights) render disabled with a "Coming soon" state rather
 * than linking anywhere — never represent a capability as live when it
 * isn't (SPEC-MPY-002 §7 truthfulness rule).
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Circle, LayoutGrid } from "lucide-react";
import { tryOpenInMountedCartridge } from "@/services/cartridge/CartridgePresenceRegistry";
import { MONEYPENNY_CAPABILITY_GROUPS } from "./moneypennyCapabilities";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";

const MONEYPENNY_CODEX_ID = "moneypenny-codex";

const MODE_BADGE_STYLE: Record<string, string> = {
  ADVISOR: "bg-sky-500/10 text-sky-300 border border-sky-800/60",
  ARCHITECT: "bg-amber-500/10 text-amber-300 border border-amber-800/60",
  RUNTIME: "bg-emerald-500/10 text-emerald-300 border border-emerald-800/60",
};

export interface MoneyPennyCapabilityRailProps {
  /** The panel currently rendered by MoneyPennyPanelTab, for highlighting. */
  activePanel?: MoneyPennyPanelKey;
  /** When true, renders as a slim collapsible rail; otherwise a fixed-width sidebar. */
  collapsible?: boolean;
}

export function MoneyPennyCapabilityRail({ activePanel, collapsible = true }: MoneyPennyCapabilityRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MONEYPENNY_CAPABILITY_GROUPS.map((g) => [g.id, true])),
  );

  const navigate = (panel: MoneyPennyPanelKey | null) => {
    if (!panel) return;
    tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, tab: panel });
  };

  if (collapsible && collapsed) {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900/60"
          aria-label="Expand capability navigation"
        >
          <LayoutGrid className="h-4 w-4 text-emerald-400" />
          <span>Capabilities</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <nav
      aria-label="MoneyPenny capabilities"
      className="w-64 shrink-0 rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1 overflow-y-auto"
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <LayoutGrid className="h-3.5 w-3.5 text-emerald-400" />
          Capabilities
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
            aria-label="Collapse capability navigation"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate("overview" as MoneyPennyPanelKey)}
        className={`w-full text-left rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
          activePanel === "overview" ? "bg-emerald-500/10 text-emerald-300" : "text-slate-300 hover:bg-slate-800/60"
        }`}
      >
        Overview
      </button>

      {MONEYPENNY_CAPABILITY_GROUPS.map((group) => {
        const isOpen = openGroups[group.id] ?? true;
        return (
          <div key={group.id} className="pt-1">
            <button
              type="button"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !isOpen }))}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300"
            >
              {group.label}
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {isOpen && (
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const available = item.panel !== null;
                  const active = available && item.panel === activePanel;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!available}
                      title={available ? item.description : `${item.description} (coming soon)`}
                      onClick={() => navigate(item.panel)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        !available
                          ? "cursor-not-allowed text-slate-600"
                          : active
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <Circle className={`h-1.5 w-1.5 shrink-0 ${active ? "fill-emerald-400 text-emerald-400" : "fill-slate-700 text-slate-700"}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!available && (
                        <span className="shrink-0 rounded border border-slate-700 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-600">
                          Soon
                        </span>
                      )}
                      {available && item.mode && (
                        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${MODE_BADGE_STYLE[item.mode] ?? ""}`}>
                          {item.mode}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default MoneyPennyCapabilityRail;
