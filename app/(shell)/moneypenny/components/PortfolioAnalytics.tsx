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

export function PortfolioAnalytics() {
  // Mock portfolio data
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
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              ${portfolioData.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-white/60 mt-1">
              Portfolio total value
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
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
            <p className="text-xs text-white/60 mt-1">
              {portfolioData.totalPnLPercent.toFixed(2)}% total return
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {portfolioData.winRate}%
            </div>
            <p className="text-xs text-white/60 mt-1">
              {portfolioData.totalTrades} total trades
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
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
            <p className="text-xs text-white/60 mt-1">
              {portfolioData.todayPnLPercent.toFixed(2)}% today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chain Allocation */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-emerald-400" />
            Chain Allocation
          </CardTitle>
          <CardDescription className="text-white/60">
            Portfolio distribution across chains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chainAllocation.map((chain) => (
              <div key={chain.chain} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                  <span className="text-sm text-white/80">{chain.chain}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Progress value={chain.allocation} className="w-20 h-2" />
                    <span className="text-sm text-white/60">{chain.allocation}%</span>
                  </div>
                  <span className="text-sm font-medium text-white">
                    ${chain.value.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Performance */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            Recent Performance
          </CardTitle>
          <CardDescription className="text-white/60">
            Daily P&L and trading activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentPerformance.map((day) => (
              <div key={day.date} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80">{day.date}</span>
                  <Badge variant="outline" className="bg-white/10 text-white/60 border-white/20">
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
