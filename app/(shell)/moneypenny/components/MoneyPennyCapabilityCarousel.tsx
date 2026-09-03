/**
 * MoneyPennyCapabilityCarousel — the contextual capsule shortcuts for the
 * CURRENTLY ACTIVE native area tab (navigation-hierarchy correction,
 * 2026-09-03). Replaces `MoneyPennyAreaNav.tsx`, whose OWN top row (Home |
 * My Money | Plan | Markets | Activity) is now redundant and removed —
 * those five areas are real native `CodexTab` entries
 * (`data/codex-configs.ts`'s `MONEYPENNY_CARTRIDGE`, group 'moneypenny'),
 * rendered by `CodexPanelDynamic`'s own tier-1/tier-2 chrome, never a
 * second, independently-rendered menu inside this pane.
 *
 * What remains here is exactly the operator's item 3: "the current
 * capability buttons wrap across multiple rows — make it a single
 * horizontally scrollable carousel," with Connection diagnostics folded
 * in as the FINAL carousel button rather than its own full-width
 * accordion above the menu (retired from MoneyPennyShell.tsx). Selecting
 * diagnostics expands a secondary detail region BELOW the carousel row;
 * every other button navigates via `MoneyPennyNavigationContext` exactly
 * as the old chip row did.
 *
 * `activePanel`/`area` are always in agreement here — `area` names which
 * native tab this mount IS (no ambiguity to resolve via `areaForPanel`
 * the way the old cross-panel AreaNav had to), so `areaItems(area)` is the
 * complete, correctly-scoped item list for this carousel, in the same
 * order the capability groups already define it (e.g. Activity: Runtime,
 * Automation, Service Orchestration, Portfolio/Performance, Relationships
 * (CRM) — the operator's own given sequence, verified against the data,
 * not hand-typed).
 *
 * Only AVAILABLE (non-null `panel`) items render — a disabled "coming
 * soon" placeholder would otherwise occupy a slot in an intentionally
 * tight, non-wrapping row for a destination that doesn't exist yet; the
 * SPEC-MPY-002 §7 truthfulness rule this rail always followed is about
 * never LINKING a fake destination, not about reserving carousel space for
 * one. Nothing here fabricates new health indicators — the diagnostics
 * detail region renders the SAME systemStatus MoneyPennyShell.tsx already
 * derives honestly from the (currently stubbed) healthCheck() call.
 */

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMoneyPennyNavigation } from './moneyPennyNavigation';
import { areaItems, type MoneyPennyAreaId } from './moneypennyCapabilities';
import type { MoneyPennyPanelKey } from '@/app/triad/components/codex/tabs/MoneyPennyPanelTab';

const MODE_BADGE_STYLE: Record<string, string> = {
  ADVISOR: 'bg-sky-500/10 text-sky-300 border border-sky-800/60',
  ARCHITECT: 'bg-amber-500/10 text-amber-300 border border-amber-800/60',
  RUNTIME: 'bg-emerald-500/10 text-emerald-300 border border-emerald-800/60',
};

function statusDotColor(status: string) {
  switch (status) {
    case 'online':
      return 'bg-emerald-500';
    case 'degraded':
      return 'bg-yellow-500';
    default:
      return 'bg-red-500';
  }
}

export interface MoneyPennyCapabilityCarouselProps {
  activePanel?: MoneyPennyPanelKey;
  area: MoneyPennyAreaId | null;
  isConnected: boolean;
  systemStatus: { quotes: string; execution: string; settlements: string; fio: string };
}

export function MoneyPennyCapabilityCarousel({
  activePanel,
  area,
  isConnected,
  systemStatus,
}: MoneyPennyCapabilityCarouselProps) {
  const { navigate } = useMoneyPennyNavigation();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const items = area ? areaItems(area).filter((item) => item.panel !== null) : [];

  return (
    <div className="w-full space-y-2">
      {/* One non-wrapping row at every width — overflow-x-auto, no-scrollbar
          (same convention CodexPanelDynamic's own carousels use), touch
          scrolling works natively; each button is a real, individually
          focusable <button> so sequential Tab traversal (and the
          browser's native scroll-into-view-on-focus for an overflow
          container) covers keyboard navigation without a bespoke
          roving-tabindex widget. */}
      <div
        role="tablist"
        aria-label={area ? `${area} capabilities` : 'MoneyPenny capabilities'}
        className="flex w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-lg border border-slate-800 bg-slate-900/40 p-1.5"
      >
        {items.map((item) => {
          const active = item.panel === activePanel;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={item.description}
              onClick={() => item.panel && navigate(item.panel)}
              className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? 'border-emerald-800/60 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span>{item.label}</span>
              {item.mode && (
                <span className={`rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${MODE_BADGE_STYLE[item.mode] ?? ''}`}>
                  {item.mode}
                </span>
              )}
            </button>
          );
        })}
        {/* Connection diagnostics — the FINAL carousel button (2026-09-03
            correction: previously a standalone full-width accordion above
            this row). Toggles the detail region below; never itself
            navigates a panel. */}
        <button
          type="button"
          onClick={() => setDiagnosticsOpen((open) => !open)}
          aria-expanded={diagnosticsOpen}
          className={`ml-auto flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs transition-colors ${
            diagnosticsOpen
              ? 'border-slate-600 bg-slate-800/60 text-slate-200'
              : 'border-slate-800 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${diagnosticsOpen ? 'rotate-180' : ''}`} />
          <span>Connection diagnostics</span>
          <Badge
            variant={isConnected ? 'default' : 'destructive'}
            className={`text-[9px] ${isConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''}`}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </button>
      </div>

      {/* Secondary detail region — only exists when the diagnostics
          button is selected; when closed, only the single carousel row
          above remains, per the operator's explicit sizing requirement. */}
      {diagnosticsOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/20 px-3 py-2">
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${statusDotColor(systemStatus.quotes)}`} />
            <span className="text-xs text-slate-400">Quotes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${statusDotColor(systemStatus.execution)}`} />
            <span className="text-xs text-slate-400">Execution</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${statusDotColor(systemStatus.settlements)}`} />
            <span className="text-xs text-slate-400">X402</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${statusDotColor(systemStatus.fio)}`} />
            <span className="text-xs text-slate-400">FIO</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MoneyPennyCapabilityCarousel;
