"use client";

import React, { useState, useEffect } from "react";
import { useBalances } from "@/app/hooks/useBalances";
import { useDVNEvents } from "@/app/hooks/useDVNEvents";
import {
  Wallet,
  RefreshCw,
  Send,
  CircleDollarSign,
  Coins,
  TrendingUp,
  Award,
  BookOpen,
  CheckSquare,
  Trophy,
  Gift,
  Loader2,
} from "lucide-react";

interface SmartWalletPanelProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

type TabType = "wallet" | "library" | "tasks" | "reputation" | "rewards";

const TAB_CONFIG: Array<{ key: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "wallet", label: "Wallet", icon: Wallet },
  { key: "library", label: "Library", icon: BookOpen },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "reputation", label: "Reputation", icon: Trophy },
  { key: "rewards", label: "Rewards", icon: Gift },
];

export default function SmartWalletPanel({ theme = 'dark', density = 'wide' }: SmartWalletPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("wallet");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock agent addresses - in production, these would come from auth/persona context
  const mockAddresses = {
    sepolia: "0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844" as `0x${string}`,
    arb: "0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844" as `0x${string}`,
  };

  const balances = useBalances(mockAddresses);
  const { events, isLoading: eventsLoading } = useDVNEvents();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger balance refresh by re-mounting the hook
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Format balance for display
  const formatBalance = (balance: string, decimals?: number) => {
    if (!balance || balance === "0") return "0.00";
    const dec = decimals || 18;
    const num = parseFloat(balance) / Math.pow(10, dec);
    return num.toFixed(2);
  };

  const qctBalance = formatBalance(balances.qctArb || balances.qctSep, balances.qctArbDecimals || balances.qctSepDecimals);
  const knytBalance = formatBalance(balances.knytSep, balances.knytSepDecimals);

  return (
    <div className={`flex flex-col h-full w-full ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-400" />
            SmartWallet
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh balances"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-slate-700/50 px-4">
        <div className="flex gap-1">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {density === 'wide' && label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "wallet" && (
          <div className="space-y-6">
            {/* Balances */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Balances</h3>
              
              {/* Q¢ Balance */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <CircleDollarSign className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Q¢ (QCT)</div>
                      <div className="text-2xl font-bold">{qctBalance}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Arbitrum Sepolia</div>
                  </div>
                </div>
              </div>

              {/* KNYT Balance */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">KNYT</div>
                      <div className="text-2xl font-bold">{knytBalance}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Ethereum Sepolia</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 p-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors">
                  <Send className="w-4 h-4" />
                  <span className="text-sm font-medium">Send</span>
                </button>
                <button className="flex items-center justify-center gap-2 p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors">
                  <Coins className="w-4 h-4" />
                  <span className="text-sm font-medium">Buy KNYT</span>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Activity</h3>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : events && events.length > 0 ? (
                <div className="space-y-2">
                  {events.slice(0, 5).map((event, idx) => (
                    <div key={idx} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">{event.type || 'Transaction'}</div>
                        <div className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "library" && (
          <div className="text-center py-12 text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Content Library</p>
            <p className="text-sm">Your purchased content and entitlements will appear here</p>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="text-center py-12 text-slate-500">
            <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Tasks & Quests</p>
            <p className="text-sm">Complete tasks to earn rewards</p>
          </div>
        )}

        {activeTab === "reputation" && (
          <div className="text-center py-12 text-slate-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Reputation</p>
            <p className="text-sm">Your reputation score and achievements</p>
          </div>
        )}

        {activeTab === "rewards" && (
          <div className="text-center py-12 text-slate-500">
            <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Rewards</p>
            <p className="text-sm">Claim your earned rewards</p>
          </div>
        )}
      </div>
    </div>
  );
}
