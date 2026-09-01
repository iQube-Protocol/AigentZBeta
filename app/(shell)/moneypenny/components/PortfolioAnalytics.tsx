/**
 * Portfolio Analytics Component
 * 
 * Portfolio performance and analytics dashboard
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, PieChart } from "lucide-react";
import { SimulationNotice } from "./SimulationNotice";

export function PortfolioAnalytics() {
  // Hardcoded placeholder data — no canonical portfolio/execution evidence
  // source is wired here yet (SPEC-MPY-002 MPY2-5 "Portfolio/execution/
  // history views read canonical evidence/state wherever available" remains
  // open; flagged in the MPY2-0 donor harvest audit). Labelled with
  // <SimulationNotice> below per the §7 truthfulness rule rather than
  // presented as live P&L.
  const portfolioData = {
    totalValue: 125000,
    totalPnL: 2500,
    totalPnLPercent: 2.04,
    todayPnL: 150,
    todayPnLPercent: 0.12,
    winRate: 68.5,
    totalTrades: 342,
    avgTradeSize: 365,
  };

  const chainAllocation = [
    { chain: 'Ethereum', allocation: 35, value: 43750, color: 'bg-blue-500' },
    { chain: 'Arbitrum', allocation: 25, value: 31250, color: 'bg-sky-500' },
    { chain: 'Polygon', allocation: 20, value: 25000, color: 'bg-purple-500' },
    { chain: 'Base', allocation: 15, value: 18750, color: 'bg-green-500' },
    { chain: 'Optimism', allocation: 5, value: 6250, color: 'bg-orange-500' },
  ];

  const recentPerformance = [
    { date: '2024-01-23', pnl: 150, trades: 12 },
    { date: '2024-01-22', pnl: -75, trades: 8 },
    { date: '2024-01-21', pnl: 225, trades: 15 },
    { date: '2024-01-20', pnl: 100, trades: 10 },
    { date: '2024-01-19', pnl: 50, trades: 6 },
  ];

  return (
    <div className="space-y-6">
      <SimulationNotice label="Portfolio figures are simulated placeholders — no canonical evidence source wired yet" />

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              ${portfolioData.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Portfolio total value
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Total P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolioData.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {portfolioData.totalPnL >= 0 ? '+' : ''}${portfolioData.totalPnL.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {portfolioData.totalPnLPercent.toFixed(2)}% total return
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {portfolioData.winRate}%
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {portfolioData.totalTrades} total trades
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Today P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolioData.todayPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {portfolioData.todayPnL >= 0 ? '+' : ''}${portfolioData.todayPnL}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {portfolioData.todayPnLPercent.toFixed(2)}% today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chain Allocation */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-emerald-400" />
            Chain Allocation
          </CardTitle>
          <CardDescription className="text-slate-400">
            Portfolio distribution across chains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chainAllocation.map((chain) => (
              <div key={chain.chain} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                  <span className="text-sm text-slate-300">{chain.chain}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Progress value={chain.allocation} className="w-20 h-2" />
                    <span className="text-sm text-slate-400">{chain.allocation}%</span>
                  </div>
                  <span className="text-sm font-medium text-slate-100">
                    ${chain.value.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Performance */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            Recent Performance
          </CardTitle>
          <CardDescription className="text-slate-400">
            Daily P&L and trading activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentPerformance.map((day) => (
              <div key={day.date} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">{day.date}</span>
                  <Badge variant="outline" className="bg-slate-800/60 text-slate-400 border-slate-700">
                    {day.trades} trades
                  </Badge>
                </div>
                <div className={`font-mono text-sm ${day.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {day.pnl >= 0 ? '+' : ''}${day.pnl}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
