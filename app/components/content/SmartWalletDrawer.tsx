"use client";

/**
 * SmartWalletDrawer - Enhanced version from Netlify app
 * Supports both main app and Codex embedded modes
 */

import React, { useState, useEffect } from "react";
import type { SmartWalletNode, WalletTask, PersonaState } from "@/types/smartWallet";
import type { SmartContentQube } from "@/types/smartContent";
import { useBalances } from "@/app/hooks/useBalances";
import {
  Wallet, Library, Target, Award, Gift, X, Loader2, Coins, Send, Plus, RefreshCw,
  User, Book, Film, Trophy, Medal, BadgeCheck, Crown
} from "lucide-react";

type DrawerTab = "wallet" | "library" | "tasks" | "reputation" | "rewards";

interface SmartWalletDrawerProps {
  open: boolean;
  onClose: () => void;
  variant?: 'overlay' | 'embedded';
  embeddedWidth?: 'fill' | 'fixed';
  agent: {
    id: string;
    name: string;
    evmSepolia?: `0x${string}`;
    evmArb?: `0x${string}`;
    btcAddress?: string;
    fioHandle?: string;
    walletAddress?: string;
  };
  personaId?: string;
  codexMode?: boolean;
  recipientAddress?: string;
  currentContent?: SmartContentQube;
  walletNode?: SmartWalletNode;
  onPurchaseComplete?: (...args: any[]) => void | Promise<void>;
  onCreatePersona?: (...args: any[]) => void;
  onContentSelect?: (...args: any[]) => void;
  onPersonaChange?: (...args: any[]) => void;
  onTaskAction?: (...args: any[]) => void;
  onSubmitReputationClaim?: (...args: any[]) => void;
  onOpenCopilot?: (...args: any[]) => void;
}

export default function SmartWalletDrawer({
  open, onClose, variant = 'overlay', embeddedWidth = 'fill',
  agent, personaId, codexMode = false
}: SmartWalletDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("wallet");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const balances = useBalances(
    { sepolia: agent.evmSepolia, arb: agent.evmArb, btc: agent.btcAddress },
    { refreshKey }
  );

  const formatToken = (raw: string, decimals = 18) => {
    if (!raw) return "0";
    if (!/^\d+$/.test(raw)) return raw;
    const padded = raw.padStart(decimals + 1, "0");
    const whole = padded.slice(0, -decimals);
    const fraction = padded.slice(-decimals).replace(/0+$/, "");
    if (!fraction) return whole;
    return `${whole}.${fraction.slice(0, 4)}`;
  };

  const qcRaw = balances.qctArb !== "0" ? balances.qctArb : balances.qctSep;
  const qcDecimals = balances.qctArb !== "0" ? balances.qctArbDecimals : balances.qctSepDecimals;
  const qcDisplay = formatToken(qcRaw, qcDecimals ?? 18);
  const qcNumber = Number(qcDisplay);

  useEffect(() => {
    if (open) {
      setLoading(false);
    }
  }, [open]);

  const tabs = [
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'reputation', label: 'Reputation', icon: Award },
    { id: 'rewards', label: 'Rewards', icon: Gift },
  ] as const;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-xl p-6 border border-indigo-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              Q¢ Balance
            </h3>
            <button
              onClick={() => setRefreshKey((value) => value + 1)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-white/70" />
            </button>
          </div>
          <div className="text-3xl font-bold text-white mb-2">
            {qcDisplay} Q¢
          </div>
          <div className="text-sm text-white/70">
            ≈ ${Number.isFinite(qcNumber) ? (qcNumber * 1.4).toFixed(2) : "0.00"} USD
          </div>
        </div>

        {/* Persona Info */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            Active Persona
          </h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-slate-400">Name</div>
              <div className="text-white font-medium">{agent.name}</div>
            </div>
            {agent.fioHandle && (
              <div>
                <div className="text-sm text-slate-400">FIO Handle</div>
                <div className="text-white font-medium">@{agent.fioHandle}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!open) return null;

  const drawerClasses = variant === 'embedded' 
    ? `h-full ${embeddedWidth === 'fill' ? 'w-full' : 'w-96'}`
    : 'fixed inset-y-0 right-0 w-96 shadow-2xl';

  return (
    <div className={drawerClasses}>
      <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">SmartWallet</h2>
              <p className="text-sm text-slate-400">
                {codexMode ? 'Codex Integration' : 'x402 Powered'}
              </p>
            </div>
          </div>
          {variant === 'overlay' && (
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
