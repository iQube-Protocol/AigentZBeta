/**
 * HFT Console Component
 *
 * Real-time high-frequency trading console
 * Displays quotes, executions, and P&L
 *
 * 2026-09-04 tranche ("shared market-session controller consumed by inline,
 * capsule and HFTConsole representations"): this panel no longer owns its
 * own quote/execution/P&L state. It mounts the SAME `MarketConsoleCapsule`
 * (presentation="panel") the copilot's inline/capsule rich blocks use,
 * backed by the SAME `useMoneyPennyMarketSession()` singleton — so a
 * capsule left open in the conversation and this panel, if both mounted at
 * once, read the identical session (one interval, no duplicate stream; see
 * services/moneypenny/marketSessionController.ts's header for the
 * subscribe/unsubscribe lifecycle proof). "Start/Stop" below mounts/unmounts
 * the capsule, which is what starts/stops THIS component's subscription —
 * the shared session keeps running as long as ANY other consumer (e.g. an
 * open copilot capsule) still holds a subscription.
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Play, Pause, Maximize2, Minimize2 } from "lucide-react";
import { SimulationNotice } from "./SimulationNotice";
import { useMoneyPennyFullScreen } from "./MoneyPennyFullScreenContext";
import { MarketConsoleCapsule } from "@/components/smarttriad/surfaces/MarketConsoleCapsule";

export function HFTConsole() {
  // C-01 full-screen takeover (2026-09-02): the operator's own direction
  // that this existing disclosed simulation is "a suitable surface" for
  // it, rather than building a new one. `agentName` is null when this
  // component is rendered outside a real MoneyPenny workspace (the
  // standalone `/moneypenny` route, `SmartTriadSurfaces.tsx`) — the Expand
  // control only renders when a real workspace is actually hosting it.
  const { isFullScreen, enterFullScreen, exitFullScreen, environment, agentName } = useMoneyPennyFullScreen();
  const [isStreaming, setIsStreaming] = useState(false);

  return (
    <div className="space-y-6">
      <SimulationNotice label="Quotes, fills and performance below are simulated — not a live market feed" />

      {/* Control Panel */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                HFT Console
              </CardTitle>
              <CardDescription className="text-slate-400">
                Real-time quote discovery and execution
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {agentName && (
                <span className="text-xs text-slate-400">
                  <span className="font-medium text-emerald-300">{agentName}</span>
                  {' · '}
                  <span className="capitalize">{environment}</span>
                </span>
              )}
              <Badge variant={isStreaming ? "default" : "secondary"} className={isStreaming ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-800/60 text-slate-400 border-slate-700"}>
                {isStreaming ? "Live" : "Stopped"}
              </Badge>
              {agentName && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (isFullScreen ? exitFullScreen() : enterFullScreen())}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800/60"
                >
                  {isFullScreen ? (
                    <>
                      <Minimize2 className="h-4 w-4 mr-2" />
                      Exit full screen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Full screen
                    </>
                  )}
                </Button>
              )}
              <Button
                variant={isStreaming ? "destructive" : "default"}
                size="sm"
                onClick={() => setIsStreaming(!isStreaming)}
                className={isStreaming ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"}
              >
                {isStreaming ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Market console — the SAME shared-session capsule the copilot's
          inline/capsule rich blocks mount; reconstituted here rather than
          forked, per the 2026-09-04 "atomic, capsule-composable surfaces"
          ruling ("do not create a second market console"). */}
      {isStreaming ? (
        <MarketConsoleCapsule initialPresentation="panel" hideToggle />
      ) : (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardContent className="py-8 text-center text-sm text-slate-400">
            Start streaming to see quotes, fills and performance.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
