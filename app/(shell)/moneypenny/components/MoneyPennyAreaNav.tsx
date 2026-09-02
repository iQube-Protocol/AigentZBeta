/**
 * MoneyPennyAreaNav — the five-area navigation (Cartridge spec C-03:
 * Home / My Money / Plan / Markets / Activity), replacing the flat
 * 14-item `MoneyPennyCapabilityRail.tsx` (deleted) as MoneyPenny's ONE
 * shared top-level menu (C-01: "do not retain a competing full capability
 * sidebar"). A horizontal area strip plus a contextual chip row for the
 * active area's capsules — not a second vertical sidebar.
 *
 * Navigation only: reuses the EXACT SAME `tryOpenInMountedCartridge` seam
 * the old rail used, so every existing deep link
 * (`buildCodexUrl('moneypenny', {tab})`) and panel component is unchanged —
 * only how the operator reaches them changed. Provider mode
 * (Advisor/Architect/Runtime) badges are carried through unchanged from
 * `moneypennyCapabilities.ts`; area selection never implies or changes
 * mode, execution environment, or authority (C-10).
 */

"use client";

import { useState } from "react";
import { tryOpenInMountedCartridge } from "@/services/cartridge/CartridgePresenceRegistry";
import {
  MONEYPENNY_AREAS,
  MONEYPENNY_UTILITY_ITEM,
  areaForPanel,
  areaItems,
  type MoneyPennyAreaId,
} from "./moneypennyCapabilities";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";

const MONEYPENNY_CODEX_ID = "moneypenny-codex";

const MODE_BADGE_STYLE: Record<string, string> = {
  ADVISOR: "bg-sky-500/10 text-sky-300 border border-sky-800/60",
  ARCHITECT: "bg-amber-500/10 text-amber-300 border border-amber-800/60",
  RUNTIME: "bg-emerald-500/10 text-emerald-300 border border-emerald-800/60",
};

export interface MoneyPennyAreaNavProps {
  /** The panel currently rendered by MoneyPennyPanelTab, for highlighting. */
  activePanel?: MoneyPennyPanelKey;
}

export function MoneyPennyAreaNav({ activePanel }: MoneyPennyAreaNavProps) {
  const activeArea = activePanel ? areaForPanel(activePanel) : "home";
  // Manual area selection (before any panel click) so the operator can
  // browse an area's capsules without first landing on one of them.
  const [selectedArea, setSelectedArea] = useState<MoneyPennyAreaId>(activeArea ?? "home");
  const displayedArea = activeArea ?? selectedArea;

  const navigate = (panel: MoneyPennyPanelKey | null) => {
    if (!panel) return;
    tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, tab: panel });
  };

  const items = areaItems(displayedArea);

  return (
    <nav aria-label="MoneyPenny areas" className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1">
        {MONEYPENNY_AREAS.map((area) => {
          const isActive = area.id === displayedArea;
          return (
            <button
              key={area.id}
              type="button"
              title={area.question}
              onClick={() => {
                setSelectedArea(area.id);
                // Deliberate click into an area's default (first) capsule —
                // browsing to an area is itself a navigation choice, same
                // explicit-act model as a capability rail click always was.
                const first = areaItems(area.id).find((i) => i.panel !== null);
                if (first) navigate(first.panel);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive ? "bg-emerald-500/10 text-emerald-300" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              {area.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <button
            type="button"
            title={MONEYPENNY_UTILITY_ITEM.description}
            onClick={() => navigate(MONEYPENNY_UTILITY_ITEM.panel)}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              activePanel === MONEYPENNY_UTILITY_ITEM.panel
                ? "bg-emerald-500/10 text-emerald-300"
                : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
            }`}
          >
            {MONEYPENNY_UTILITY_ITEM.label}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {items.map((item) => {
            const available = item.panel !== null;
            const active = available && item.panel === activePanel;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!available}
                title={available ? item.description : `${item.description} (coming soon)`}
                onClick={() => navigate(item.panel)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  !available
                    ? "cursor-not-allowed border-slate-800 text-slate-600"
                    : active
                      ? "border-emerald-800/60 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <span>{item.label}</span>
                {!available && (
                  <span className="rounded border border-slate-700 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-600">
                    Soon
                  </span>
                )}
                {available && item.mode && (
                  <span className={`rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${MODE_BADGE_STYLE[item.mode] ?? ""}`}>
                    {item.mode}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}

export default MoneyPennyAreaNav;
