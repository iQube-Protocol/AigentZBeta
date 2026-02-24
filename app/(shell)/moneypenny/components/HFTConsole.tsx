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
import { TrendingUp, TrendingDown, Activity, DollarSign, Zap, Play, Pause } from "lucide-react";

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [quotes, setQuotes] = useState<QuoteData[]>([]);
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [pnl, setPnl] = useState<PnLData | null>(null);
  const [totalPnL, setTotalPnL] = useState(0);

  // Mock data generation
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      // Generate mock quote
      const newQuote: QuoteData = {
        chain: ['ETH', 'ARB', 'OP', 'BASE', 'POLYGON'][Math.floor(Math.random() * 5)],
        edge_bps: Math.random() * 50 - 25,
        price_usdc: 0.01 + Math.random() * 0.002,
        qty_qc: Math.random() * 10000,
        timestamp: new Date().toISOString(),
      };

      setQuotes(prev => [newQuote, ...prev.slice(0, 9)]);

      // Generate mock execution occasionally
      if (Math.random() > 0.7) {
        const newExecution: ExecutionData = {
          chain: newQuote.chain,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
          qty_filled: Math.random() * 5000,
          avg_price: newQuote.price_usdc,
          capture_bps: Math.random() * 20 - 5,
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
      {/* Control Panel */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                HFT Console
              </CardTitle>
              <CardDescription className="text-white/60">
                Real-time quote discovery and execution
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={isStreaming ? "default" : "secondary"} className={isStreaming ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/10 text-white/60 border-white/20"}>
                {isStreaming ? "Live" : "Stopped"}
              </Badge>
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
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
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
            <p className="text-xs text-white/60 mt-1">
              Capture basis points
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              Turnover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              ${pnl?.turnover_usd.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-white/60 mt-1">
              Total volume
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {executions.length}
            </div>
            <p className="text-xs text-white/60 mt-1">
              Total trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quotes and Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Quotes */}
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Live Quotes
            </CardTitle>
            <CardDescription className="text-white/60">
              Real-time quote discovery across chains
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {quotes.length === 0 ? (
                <p className="text-center text-white/60 py-8">
                  No quotes available. Start streaming to see data.
                </p>
              ) : (
                quotes.map((quote, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-white/10 text-white/60 border-white/20">{quote.chain}</Badge>
                      <span className="text-sm text-white/80">{quote.qty_qc.toFixed(0)} Q¢</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm ${getEdgeColor(quote.edge_bps)}`}>
                        {quote.edge_bps > 0 ? '+' : ''}{quote.edge_bps.toFixed(1)} bps
                      </div>
                      <div className="text-xs text-white/60">
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
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-400" />
              Recent Executions
            </CardTitle>
            <CardDescription className="text-white/60">
              Latest trade executions and fills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.length === 0 ? (
                <p className="text-center text-white/60 py-8">
                  No executions yet. Start streaming to see trades.
                </p>
              ) : (
                executions.map((exec, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-white/10 text-white/60 border-white/20">{exec.chain}</Badge>
                      <Badge variant={exec.side === 'BUY' ? 'default' : 'destructive'} className={exec.side === 'BUY' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                        {exec.side}
                      </Badge>
                      <span className="text-sm text-white/80">{exec.qty_filled.toFixed(0)} Q¢</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm ${getEdgeColor(exec.capture_bps)}`}>
                        {exec.capture_bps > 0 ? '+' : ''}{exec.capture_bps.toFixed(1)} bps
                      </div>
                      <div className="text-xs text-white/60">
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
