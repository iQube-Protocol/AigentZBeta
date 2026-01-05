/**
 * CopilotWalletDrawer - In-Codex Wallet Surface
 * 
 * Renders wallet cards and modals within the Codex experience.
 * Supports narrow (glance + tap) and wide (multi-step flows) modes.
 */

import { useState, useEffect } from 'react';
import { X, Wallet, Gift, Unlock, Users, CheckCircle, ArrowRight, Coins, Send, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DrawerMode, WalletUIComponent, DeviceType } from '@/types/knytLiquidUI';
import { getKnytLiquidUIService } from '@/services/knytLiquidUIService';

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
    // Desktop/tablet - dock right
    return {
      position: 'fixed',
      top: '88px',
      right: '80px',
      bottom: 0,
      width: `${(dimensions.width || 0.22) * 100}vw`,
      maxWidth: mode === 'wide' ? '480px' : '320px',
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
          <div key={component} className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 ring-1 ring-white/10">
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
                    <div>
                      <span className="text-white font-medium">{reward.amount} KNYT</span>
                      <span className="text-white/50 text-sm ml-2">{reward.source}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
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

  const renderWalletModal = (component: WalletUIComponent) => {
    switch (component) {
      case 'wallet_modal.checkout':
        return (
          <div key={component} className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Complete Purchase</h3>
            <div className="p-4 rounded-xl bg-white/5 ring-1 ring-white/10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/60">Item</span>
                <span className="text-white font-medium">Digital Scroll #1</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/60">Price</span>
                <span className="text-amber-400 font-bold">5 KNYT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Your Balance</span>
                <span className="text-white">{balance} KNYT</span>
              </div>
            </div>
            <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-white">
              Confirm Purchase
            </Button>
          </div>
        );

      case 'wallet_modal.send_request':
        return (
          <div key={component} className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Send KNYT</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/60 mb-1 block">Recipient</label>
                <input
                  type="text"
                  placeholder="Enter handle or address"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white placeholder:text-white/30 focus:ring-cyan-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1 block">Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white placeholder:text-white/30 focus:ring-cyan-500/50 focus:outline-none"
                />
              </div>
            </div>
            <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-white">
              <Send className="w-4 h-4 mr-2" />
              Send KNYT
            </Button>
          </div>
        );

      case 'wallet_modal.receipt':
        return (
          <div key={component} className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/20">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Transaction Complete</h3>
                <p className="text-sm text-white/60">Your purchase was successful</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 ring-1 ring-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Amount</span>
                <span className="text-white font-medium">5 KNYT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Transaction ID</span>
                <span className="text-white/80 text-sm font-mono">0x1234...5678</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>
              <Receipt className="w-4 h-4 mr-2" />
              View Receipt
            </Button>
          </div>
        );

      case 'wallet_modal.permissions':
        return (
          <div key={component} className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Confirm Action</h3>
            <p className="text-white/70">
              This action requires your confirmation to proceed.
            </p>
            <div className="p-4 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
              <p className="text-amber-400 text-sm">
                You are about to authorize a transaction. Please review the details carefully.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-white"
                onClick={() => onConfirmAction?.('current')}
              >
                Confirm
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isModal = walletUI.some(ui => ui.startsWith('wallet_modal.'));

  return (
    <>
      {/* Backdrop for wide mode */}
      {mode === 'wide' && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        style={getDrawerStyles()}
        className={`
          bg-black/90 backdrop-blur-xl ring-1 ring-white/10 
          ${device === 'mobile' ? 'rounded-t-2xl' : 'rounded-l-2xl'}
          overflow-hidden flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0 translate-x-0' : device === 'mobile' ? 'translate-y-full' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-cyan-400" />
            <span className="font-medium text-white">
              {isModal ? 'Action Required' : 'Wallet'}
            </span>
          </div>
          <button
            onClick={onClose}
            title="Close wallet drawer"
            aria-label="Close wallet drawer"
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {walletUI.map((component) => 
            component.startsWith('wallet_modal.') 
              ? renderWalletModal(component)
              : renderWalletCard(component)
          )}
        </div>
      </div>
    </>
  );
}
