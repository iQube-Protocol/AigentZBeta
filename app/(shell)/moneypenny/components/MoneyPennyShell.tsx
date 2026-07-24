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

export function MoneyPennyShell({ children }: { children: React.ReactNode }) {
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
          setSystemStatus({
            quotes: healthCheck.services.redis ? "online" : "offline",
            execution: healthCheck.services.core ? "online" : "offline",
            settlements: "online", // Mock for now
            fio: "online", // Mock for now
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
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
                <span className="text-emerald-400">MoneyPenny</span>
                <span className="text-white/60">Q¢ HFT Aigent</span>
              </CardTitle>
              <CardDescription className="text-white/60">
                Real-time high-frequency trading agent powered by Qripto
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.quotes)}`} />
                  <span className="text-xs text-white/60">Quotes</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.execution)}`} />
                  <span className="text-xs text-white/60">Execution</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.settlements)}`} />
                  <span className="text-xs text-white/60">X402</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.fio)}`} />
                  <span className="text-xs text-white/60">FIO</span>
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

      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default MoneyPennyShell;
