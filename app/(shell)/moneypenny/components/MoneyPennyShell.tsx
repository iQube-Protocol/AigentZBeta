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
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

import { useMoneyPennyClient } from "../hooks/useMoneyPennyClient";
import { MoneyPennyAreaNav } from "./MoneyPennyAreaNav";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";

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
}

export function MoneyPennyShell({ children, activePanel }: MoneyPennyShellProps) {
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
    <div className="h-full w-full p-6 space-y-6 bg-slate-950">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
                <span className="text-emerald-400">MoneyPenny</span>
                <span className="text-slate-400">— Financial Services Runtime Agents</span>
              </CardTitle>
              <CardDescription className="text-slate-400">
                Real-time high-frequency trading agent powered by Qripto
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.quotes)}`} />
                  <span className="text-xs text-slate-400">Quotes</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.execution)}`} />
                  <span className="text-xs text-slate-400">Execution</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.settlements)}`} />
                  <span className="text-xs text-slate-400">X402</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.fio)}`} />
                  <span className="text-xs text-slate-400">FIO</span>
                </div>
              </div>
              <Badge
                variant={isConnected ? "default" : "destructive"}
                className={isConnected ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}
              >
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="min-w-0 flex-1 space-y-4">
        <MoneyPennyAreaNav activePanel={activePanel} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default MoneyPennyShell;
