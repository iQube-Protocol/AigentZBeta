/**
 * CopilotWalletDrawer - In-Codex Wallet Surface
 *
 * Renders wallet cards and modals within the Codex experience.
 * Supports narrow (glance + tap) and wide (multi-step flows) modes.
 */

import { useState } from 'react';
import { X, Wallet, Gift, Unlock, Users, CheckCircle, ArrowRight, Coins, Send, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DrawerMode, WalletUIComponent, DeviceType } from '@/app/types/knytLiquidUI';
import { getKnytLiquidUIService } from '@/app/services/knyt/knytLiquidUIService';

interface CopilotWalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: DrawerMode;
  walletUI: WalletUIComponent[];
  device: DeviceType;
  // Wallet data
  balance?: number;
  spendableBalance?: number;
  pendingRewards?: Array<{ id: string; amount: number; source: string }>;
  activeTask?: { id: string; title: string; progress: number; nextStep: string };
  // Callbacks
  onClaimReward?: (rewardId: string) => void;
  onUnlock?: (contentId: string) => void;
  onSend?: (amount: number, recipient: string) => void;
  onInvite?: () => void;
  onConfirmAction?: (actionId: string) => void;
}

export function CopilotWalletDrawer({
  isOpen,
  onClose,
  mode,
  walletUI,
  device,
  balance = 0,
  spendableBalance,
  pendingRewards = [],
  activeTask,
  onClaimReward,
  onUnlock,
  onSend,
  onInvite,
  onConfirmAction,
}: CopilotWalletDrawerProps) {
  const safeWalletUI = Array.isArray(walletUI) ? walletUI : [];
  const service = getKnytLiquidUIService();
  const dimensions = service.getDrawerDimensions(mode, device);

  if (!isOpen || mode === 'none') return null;

  // Calculate drawer styles based on device and mode
  const getDrawerStyles = (): React.CSSProperties => {
    if (device === 'mobile') {
      return {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${(dimensions.height || 0.28) * 100}svh`,
        zIndex: 51,
      };
    }
    // Desktop/tablet - dock right, bottom-aligned
    return {
      position: 'fixed',
      right: '80px',
      bottom: '10px',
      width: `${(dimensions.width || 0.22) * 100}vw`,
      maxWidth: mode === 'wide' ? '480px' : '320px',
      height: 'calc(100vh - 140px)',
      maxHeight: '600px',
      zIndex: 51,
    };
  };

  const renderWalletCard = (component: WalletUIComponent) => {
    switch (component) {
      case 'wallet_card.balance':
        return (
          <div key={component} className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 ring-1 ring-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Wallet className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-sm text-white/60">KNYT Balance</span>
            </div>
            <div className="text-2xl font-bold text-white">{balance.toLocaleString()} KNYT</div>
            {spendableBalance !== undefined && spendableBalance !== balance && (
              <div className="text-sm text-white/50 mt-1">
                {spendableBalance.toLocaleString()} spendable
              </div>
            )}
          </div>
        );

      case 'wallet_card.reward_claim':
        return (
          <div key={component} className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 ring-1 ring-amber-500/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Gift className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-white/60">Pending Rewards</span>
            </div>
            {pendingRewards.length > 0 ? (
              <div className="space-y-2">
                {pendingRewards.slice(0, 3).map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between">
                    <span className="text-sm text-white">{reward.amount} KNYT</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                      onClick={() => onClaimReward?.(reward.id)}
                    >
                      Claim
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/50 text-sm">No pending rewards</div>
            )}
          </div>
        );

      case 'wallet_card.task_step':
        return activeTask ? (
          <div key={component} className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 ring-1 ring-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-white/60">Active Quest</span>
            </div>
            <div className="text-white font-medium mb-2">{activeTask.title}</div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                style={{ width: `${activeTask.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/50">{activeTask.progress}% complete</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-green-400 hover:text-green-300 hover:bg-green-500/20 gap-1"
              >
                {activeTask.nextStep} <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : null;

      case 'wallet_card.unlock_offer':
        return (
          <div key={component} className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 ring-1 ring-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Unlock className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-white/60">Unlock Content</span>
            </div>
            <Button
              className="w-full bg-purple-500 hover:bg-purple-400 text-white"
              onClick={() => onUnlock?.('current')}
            >
              <Coins className="w-4 h-4 mr-2" />
              Unlock with KNYT
            </Button>
          </div>
        );

      case 'wallet_card.referral_invite':
        return (
          <div key={component} className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 ring-1 ring-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-white/60">Invite Friends</span>
            </div>
            <p className="text-sm text-white/70 mb-3">
              Earn 5 KNYT for each friend who joins!
            </p>
            <Button
              className="w-full bg-blue-500 hover:bg-blue-400 text-white"
              onClick={onInvite}
            >
              <Users className="w-4 h-4 mr-2" />
              Send Invite
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const drawerStyles = getDrawerStyles();

  return (
    <div style={drawerStyles} className="bg-slate-950/95 backdrop-blur-xl rounded-t-2xl ring-1 ring-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">Wallet</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100% - 80px)' }}>
        {safeWalletUI.map(renderWalletCard)}
      </div>
    </div>
  );
}

