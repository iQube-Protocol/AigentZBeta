/**
 * MoneyPenny SmartTriad Integration
 * 
 * SmartTriad drawer configuration for MoneyPenny trading operations
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Activity, DollarSign, Zap, Brain, Target, Settings } from "lucide-react";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";

interface MoneyPennySmartTriadProps {
  compact?: boolean;
  personaId?: string;
}

export function MoneyPennySmartTriad({ compact = false, personaId }: MoneyPennySmartTriadProps) {
  const { actions } = useSmartTriad();

  // Mock trading data
  const tradingStats = {
    activeStrategies: 3,
    todayPnL: 150.25,
    winRate: 68.5,
    totalTrades: 42,
    bestChain: 'Arbitrum',
  };

  const quickActions = [
    {
      id: 'console',
      label: 'HFT Console',
      icon: Activity,
      description: 'Real-time quotes and execution',
      color: 'bg-blue-500',
    },
    {
      id: 'chat',
      label: 'AI Assistant',
      icon: Brain,
      description: 'Trading insights and analysis',
      color: 'bg-green-500',
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      icon: DollarSign,
      description: 'Performance analytics',
      color: 'bg-purple-500',
    },
    {
      id: 'strategies',
      label: 'Strategies',
      icon: Target,
      description: 'Manage trading strategies',
      color: 'bg-orange-500',
    },
  ];

  const openDrawer = (drawerType: string) => {
    actions.setActiveDrawer(`moneypenny-${drawerType}`);
  };

  if (compact) {
    return (
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">
                  +${tradingStats.todayPnL.toFixed(2)}
                </div>
                <div className="text-xs text-white/60">Today P&L</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {tradingStats.winRate}%
                </div>
                <div className="text-xs text-white/60">Win Rate</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              {quickActions.slice(0, 4).map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    onClick={() => openDrawer(action.id)}
                    className="h-auto p-2 flex flex-col items-center gap-1 bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          MoneyPenny Trading
        </CardTitle>
        <CardDescription className="text-white/60">
          High-frequency trading operations and portfolio management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trading Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">
              +${tradingStats.todayPnL.toFixed(2)}
            </div>
            <div className="text-sm text-white/60">Today P&L</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {tradingStats.winRate}%
            </div>
            <div className="text-sm text-white/60">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {tradingStats.totalTrades}
            </div>
            <div className="text-sm text-white/60">Today Trades</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {tradingStats.activeStrategies}
            </div>
            <div className="text-sm text-white/60">Active Strategies</div>
          </div>
        </div>

        {/* Performance by Chain */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-white/80">Performance by Chain</h4>
          <div className="space-y-2">
            {[
              { chain: 'Arbitrum', pnl: 85.50, percentage: 57 },
              { chain: 'Ethereum', pnl: 42.25, percentage: 28 },
              { chain: 'Base', pnl: 15.00, percentage: 10 },
              { chain: 'Polygon', pnl: 7.50, percentage: 5 },
            ].map((chain) => (
              <div key={chain.chain} className="flex items-center justify-between">
                <span className="text-sm text-white/80">{chain.chain}</span>
                <div className="flex items-center gap-2">
                  <Progress value={chain.percentage} className="w-20 h-2" />
                  <span className="text-sm font-medium text-emerald-400">
                    +${chain.pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-white/80">Quick Actions</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  onClick={() => openDrawer(action.id)}
                  className="h-auto p-4 flex flex-col items-center gap-2 bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
                >
                  <div className={`p-2 rounded-full ${action.color} bg-opacity-20`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{action.label}</div>
                    <div className="text-xs text-white/60">{action.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-white/80">Recent Activity</h4>
          <div className="space-y-2">
            {[
              { action: 'Trade executed', details: 'BUY 5000 Q¢ on Arbitrum', time: '2 min ago', type: 'trade' },
              { action: 'Strategy updated', details: 'Arbitrage Hunter parameters optimized', time: '15 min ago', type: 'strategy' },
              { action: 'AI insight', details: 'New arbitrage opportunity detected', time: '1 hour ago', type: 'ai' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <Badge variant={activity.type === 'trade' ? 'default' : activity.type === 'strategy' ? 'secondary' : 'outline'} className={activity.type === 'trade' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : activity.type === 'strategy' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-white/10 text-white/60 border-white/20"}>
                    {activity.type}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium text-white/80">{activity.action}</div>
                    <div className="text-xs text-white/60">{activity.details}</div>
                  </div>
                </div>
                <span className="text-xs text-white/60">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
