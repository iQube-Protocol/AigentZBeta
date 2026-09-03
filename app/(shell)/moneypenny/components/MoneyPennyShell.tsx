/**
 * MoneyPennyShell — the connection/status header shared across every
 * codex-integrated MoneyPenny tab (SPEC-VLM-001 Phase 2, 2026-07-24).
 *
 * A NEW file, not an edit to `MoneyPennyCartridge.tsx` — that component
 * remains the untouched, standalone `/moneypenny` route's own flat
 * ten-tab interface (`app/(shell)/moneypenny/page.tsx`). This shell
 * extracts the SAME header + connection-status logic so the codex-side
 * tabs (`MoneyPennyPanelTab.tsx`) get identical status visibility without
 * duplicating it inline in ten places, and without risking the standalone
 * route (extend, don't duplicate — CLAUDE.md).
 */

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

import { useMoneyPennyClient } from "../hooks/useMoneyPennyClient";
import { MoneyPennyAreaNav } from "./MoneyPennyAreaNav";
import { MoneyPennyRoleSelector } from "./MoneyPennyRoleSelector";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";
import type { MoneyPennyProviderMode } from "@/types/financialServices";

function getStatusColor(status: string) {
  switch (status) {
    case "online":
      return "bg-emerald-500";
    case "offline":
      return "bg-red-500";
    case "degraded":
      return "bg-yellow-500";
    default:
      return "bg-gray-500";
  }
}

export interface MoneyPennyShellProps {
  children: React.ReactNode;
  /** The panel currently dispatched by MoneyPennyPanelTab — threaded down so
   *  the capability rail can highlight the active destination. */
  activePanel?: MoneyPennyPanelKey;
  /** MoneyPenny experience-coherence correction (2026-09-03, §6) — the
   *  contextual role selector's current value and setter, owned by
   *  MoneyPennyCopilotWorkspace.tsx (so it can wire the same value into
   *  groundContext/contextVersioning). */
  role: MoneyPennyProviderMode;
  onRoleChange: (role: MoneyPennyProviderMode) => void;
}

export function MoneyPennyShell({ children, activePanel, role, onRoleChange }: MoneyPennyShellProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    quotes: "offline",
    execution: "offline",
    settlements: "offline",
    fio: "offline",
  });

  const moneyPennyClient = useMoneyPennyClient();

  useEffect(() => {
    const initializeClient = async () => {
      try {
        if (moneyPennyClient) {
          const healthCheck = await moneyPennyClient.healthCheck();
          // Every field here — including `redis`/`core` — is itself a
          // stubbed value inside `MoneyPennyClient.healthCheck()` today
          // ("simplified for now" / "Will be implemented" per its own
          // comments), not a live monitoring signal. Derive ALL four rows
          // from that same (currently fake) source rather than hardcoding
          // two of them to "online" unconditionally, which claimed X402/FIO
          // were live even when core/quotes reported degraded — the
          // SPEC-MPY-002 §7 truthfulness rule applies to status chrome too,
          // not only trading data. See the MPY2-0 donor harvest audit for
          // the tracked gap: a real health-check backend does not exist yet.
          setSystemStatus({
            // `quotes` (not the previous, nonexistent `redis` key — the
            // healthCheck's own `services` map has no `redis` field, so
            // this row always rendered "offline" regardless of the real
            // stub value) is the correct key on MoneyPennyClient.healthCheck().
            quotes: healthCheck.services.quotes ? "online" : "offline",
            execution: healthCheck.services.core ? "online" : "offline",
            settlements: healthCheck.services.x402 ? "online" : "offline",
            fio: healthCheck.services.fio ? "online" : "offline",
          });
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to initialize MoneyPenny:", error);
        setIsConnected(false);
      }
    };

    initializeClient();
  }, [moneyPennyClient]);

  return (
    <div className="h-full w-full p-6 space-y-4 bg-slate-950">
      {/* MoneyPenny experience-coherence correction (2026-09-03, §6) — the
       * contextual role selector, at the top of the right workspace as
       * specified. Kept OUTSIDE the diagnostics <details> below (it is a
       * real, always-visible control, not a diagnostic). */}
      <div className="flex items-center justify-between gap-2">
        <MoneyPennyRoleSelector role={role} onChange={onRoleChange} />
      </div>

      {/* MoneyPenny experience-coherence correction (2026-09-03, operator
       * directive: "Remove the large 'MoneyPenny — Financial Services
       * Runtime Agents' banner and its technical connection-light strip
       * from the default workspace. Preserve useful diagnostics behind an
       * appropriate details surface."). A collapsed <details> disclosure,
       * closed by default — the diagnostic capability is preserved
       * (service-by-service status, honestly derived — see the comment on
       * setSystemStatus above), it just no longer occupies default
       * screen space with implementation-status chrome. */}
      <details className="group rounded-lg border border-slate-800 bg-slate-900/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300">
          <span className="flex items-center gap-2">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Connection diagnostics
          </span>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className={`text-[10px] ${isConnected ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}`}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </summary>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 px-3 py-2">
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(systemStatus.quotes)}`} />
            <span className="text-xs text-slate-400">Quotes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(systemStatus.execution)}`} />
            <span className="text-xs text-slate-400">Execution</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(systemStatus.settlements)}`} />
            <span className="text-xs text-slate-400">X402</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(systemStatus.fio)}`} />
            <span className="text-xs text-slate-400">FIO</span>
          </div>
        </div>
      </details>

      <div className="min-w-0 flex-1 space-y-4">
        <MoneyPennyAreaNav activePanel={activePanel} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default MoneyPennyShell;
