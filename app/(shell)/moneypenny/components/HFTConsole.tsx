/**
 * HFT Console Component
 * 
 * Real-time high-frequency trading console
 * Displays quotes, executions, and P&L
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Activity, DollarSign, Zap, Play, Pause, Maximize2, Minimize2 } from "lucide-react";
import { SimulationNotice } from "./SimulationNotice";
import { useMoneyPennyFullScreen } from "./MoneyPennyFullScreenContext";
import { EdgeGaugeSurface } from "@/components/smarttriad/surfaces/EdgeGaugeSurface";
import { InventoryGaugeSurface } from "@/components/smarttriad/surfaces/InventoryGaugeSurface";
import { simulateEdge, simulateInventory, simulateQuote, simulationSource, timeBucket } from "@/services/moneypenny/marketSimulation";

const HFT_CHAINS = ["ETH", "ARB", "OP", "BASE", "POLYGON"] as const;

interface QuoteData {
  chain: string;
  edge_bps: number;
  price_usdc: number;
  qty_qc: number;
  timestamp: string;
}

interface ExecutionData {
  chain: string;
  side: 'BUY' | 'SELL';
  qty_filled: number;
  avg_price: number;
  capture_bps: number;
  timestamp: string;
}

interface PnLData {
  capture_bps: number;
  turnover_usd: number;
  timestamp: string;
}

export function HFTConsole() {
  // C-01 full-screen takeover (2026-09-02): the operator's own direction
  // that this existing disclosed simulation is "a suitable surface" for
  // it, rather than building a new one. `agentName` is null when this
  // component is rendered outside a real MoneyPenny workspace (the
  // standalone `/moneypenny` route, `SmartTriadSurfaces.tsx`) — the Expand
  // control only renders when a real workspace is actually hosting it.
  const { isFullScreen, enterFullScreen, exitFullScreen, environment, agentName } = useMoneyPennyFullScreen();
  const [isStreaming, setIsStreaming] = useState(false);
  const [quotes, setQuotes] = useState<QuoteData[]>([]);
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [pnl, setPnl] = useState<PnLData | null>(null);
  const [totalPnL, setTotalPnL] = useState(0);

  // Simulated quotes/executions/P&L below — labelled via <SimulationNotice>
  // in the render, never presented as live. 2026-09-04 "atomic,
  // capsule-composable surfaces" ruling: values now come from the ONE
  // deterministic, seeded simulation service
  // (services/moneypenny/marketSimulation.ts) rather than `Math.random()`
  // scattered inline — same visual liveliness (values still move every
  // tick), but reproducible from a seed and honestly source-classified.
  // Replacing simulation with a real market-data provider remains a
  // separate, unstarted work package (MPY2-4, MPY2-0 donor harvest audit) —
  // not done here.
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const bucket = timeBucket();
      const chain = HFT_CHAINS[bucket % HFT_CHAINS.length];
      const q = simulateQuote(chain, bucket);
      const newQuote: QuoteData = {
        chain,
        edge_bps: q.edgeBps,
        price_usdc: q.priceUsdc,
        qty_qc: q.qtyQc,
        timestamp: new Date().toISOString(),
      };

      setQuotes(prev => [newQuote, ...prev.slice(0, 9)]);

      // Deterministic "did this quote fill" condition — a wide-enough edge
      // triggers a simulated execution, derived from the SAME seeded quote
      // rather than a second independent random draw.
      if (Math.abs(q.edgeBps) > 15) {
        const newExecution: ExecutionData = {
          chain: newQuote.chain,
          side: q.edgeBps >= 0 ? 'BUY' : 'SELL',
          qty_filled: q.qtyQc * 0.5,
          avg_price: newQuote.price_usdc,
          capture_bps: q.edgeBps * 0.4,
          timestamp: new Date().toISOString(),
        };

        setExecutions(prev => [newExecution, ...prev.slice(0, 9)]);

        // Update P&L
        setTotalPnL(prev => prev + newExecution.capture_bps);
      }

      // Update P&L data
      setPnl({
        capture_bps: totalPnL,
        turnover_usd: executions.reduce((sum, exec) => sum + (exec.qty_filled * exec.avg_price), 0),
        timestamp: new Date().toISOString(),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, totalPnL, executions]);

  const edgeSim = simulateEdge();
  const inventorySim = simulateInventory();

  const getEdgeColor = (edge: number) => {
    if (edge > 10) return "text-green-500";
    if (edge < -10) return "text-red-500";
    return "text-yellow-500";
  };

  const getSideColor = (side: 'BUY' | 'SELL') => {
    return side === 'BUY' ? "text-green-500" : "text-red-500";
  };

  return (
    <div className="space-y-6">
      <SimulationNotice label="Quotes, executions and P&L below are randomly generated — not a live market feed" />

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

      {/* P&L Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Total P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getEdgeColor(totalPnL)}`}>
              {totalPnL.toFixed(2)} bps
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Capture basis points
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              Turnover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              ${pnl?.turnover_usd.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Total volume
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {executions.length}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Total trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Market gauges — the SAME harvested atomic surfaces
          (EdgeGaugeSurface/InventoryGaugeSurface) the SmartTriad copilot
          rich-block path renders inline in conversation; reconstituted here
          rather than forked, per the 2026-09-04 "atomic, capsule-composable
          surfaces" ruling ("do not create a second market console"). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EdgeGaugeSurface
          payload={{
            capabilityId: "moneypenny.market-console",
            mode: "simulation",
            source: simulationSource(new Date().toISOString()),
            floorBps: edgeSim.floorBps,
            minEdgeBps: edgeSim.minEdgeBps,
            liveEdgeBps: edgeSim.liveEdgeBps,
          }}
        />
        <InventoryGaugeSurface
          payload={{
            capabilityId: "moneypenny.market-console",
            mode: "simulation",
            source: simulationSource(new Date().toISOString()),
            inventoryMin: inventorySim.inventoryMin,
            inventoryMax: inventorySim.inventoryMax,
            currentInventory: inventorySim.currentInventory,
            workingQc: inventorySim.workingQc,
          }}
        />
      </div>

      {/* Quotes and Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Quotes */}
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Live Quotes
            </CardTitle>
            <CardDescription className="text-slate-400">
              Real-time quote discovery across chains
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {quotes.length === 0 ? (
                <p className="text-center text-slate-400 py-8">
                  No quotes available. Start streaming to see data.
                </p>
              ) : (
                quotes.map((quote, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-slate-800/60 text-slate-400 border-slate-700">{quote.chain}</Badge>
                      <span className="text-sm text-slate-300">{quote.qty_qc.toFixed(0)} Q¢</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm ${getEdgeColor(quote.edge_bps)}`}>
                        {quote.edge_bps > 0 ? '+' : ''}{quote.edge_bps.toFixed(1)} bps
                      </div>
                      <div className="text-xs text-slate-400">
                        ${quote.price_usdc.toFixed(6)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-400" />
              Recent Executions
            </CardTitle>
            <CardDescription className="text-slate-400">
              Latest trade executions and fills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.length === 0 ? (
                <p className="text-center text-slate-400 py-8">
                  No executions yet. Start streaming to see trades.
                </p>
              ) : (
                executions.map((exec, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-slate-800/60 text-slate-400 border-slate-700">{exec.chain}</Badge>
                      <Badge variant={exec.side === 'BUY' ? 'default' : 'destructive'} className={exec.side === 'BUY' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                        {exec.side}
                      </Badge>
                      <span className="text-sm text-slate-300">{exec.qty_filled.toFixed(0)} Q¢</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm ${getEdgeColor(exec.capture_bps)}`}>
                        {exec.capture_bps > 0 ? '+' : ''}{exec.capture_bps.toFixed(1)} bps
                      </div>
                      <div className="text-xs text-slate-400">
                        ${exec.avg_price.toFixed(6)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
