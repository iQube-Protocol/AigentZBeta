"use client";

import React from "react";
import dynamic from "next/dynamic";
import ContentViewer from "./ContentViewer";
import { CopilotWalletDrawer } from "@/app/triad/components/codex/wallet/CopilotWalletDrawer";
import { useSmartTriad } from "./SmartTriadProvider";
import { useAGUIActionBridge } from "./useAGUIActionBridge";
import { SocialSharingModal } from "@/packages/smarttriad/src/SocialSharingModal";
import { agentConfigs } from "@/app/data/agentConfig";
import { MoneyPennyChat } from "@/app/(shell)/moneypenny/components/MoneyPennyChat";
import { PortfolioAnalytics } from "@/app/(shell)/moneypenny/components/PortfolioAnalytics";
import { StrategyBuilder } from "@/app/(shell)/moneypenny/components/StrategyBuilder";
import { X402Dashboard } from "@/app/(shell)/moneypenny/components/X402Dashboard";
import { FIOManager } from "@/app/(shell)/moneypenny/components/FIOManager";
import { CRMIntegration } from "@/app/(shell)/moneypenny/components/CRMIntegration";
import { HFTConsole } from "@/app/(shell)/moneypenny/components/HFTConsole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

// Dynamic imports break the SmartWalletDrawer ↔ SmartTriadProvider circular dependency
const SmartWalletDrawer = dynamic(() => import("./SmartWalletDrawer"), { ssr: false });
const KnytTab = dynamic(
  () => import("@/app/triad/components/codex/tabs/KnytTab").then(m => ({ default: m.KnytTab })),
  { ssr: false }
);

interface SmartTriadSurfacesProps {
  personaId?: string;
  onPersonaChange?: (personaId: string) => void;
  cartridgeSlug?: string;
}

export function SmartTriadSurfaces({ personaId, onPersonaChange, cartridgeSlug }: SmartTriadSurfacesProps) {
  const { state, actions } = useSmartTriad();

  // Bridge: thin-client AG-UI actions → platform SmartTriad state
  useAGUIActionBridge(personaId, {
    openWallet: actions.openWallet,
    closeWallet: actions.closeWallet,
    setActiveDrawer: actions.setActiveDrawer,
  });

  const payer = agentConfigs["aigent-z"];
  const recipient = agentConfigs["aigent-kn0w1"];

  const viewerOpen = state.activeDrawer === "contentViewer" && !!state.currentContent;

  // ── Token gate evaluator ─────────────────────────────────────────────────
  // Default-free with explicit gating tags. The classifier (services/rewards/
  // contentGating.ts) sets content.gating; loaders that haven't been migrated
  // yet leave it undefined → treated as free.
  //
  // Order:
  //   1. free / unstamped → allow (no false positives on editorial content)
  //   2. dev override → allow
  //   3. owned (direct or SKU-expanded) → allow
  //   4. post-purchase grant flag → allow
  //   5. credential-gated → allow only if persona holds the required credential
  //   6. payment-gated → deny (caller routes to ContentPurchaseModal)
  const gating = (() => {
    type ContentWithGating = { gating?: { kind: string; credential?: string } };
    const c = state.currentContent as ContentWithGating | null;
    if (c?.gating?.kind) return c.gating;
    // Legacy fall-through: an item with no explicit gating but with priced
    // tiers is treated as payment-gated. Items with no tiers are free.
    const tiers = state.currentContent?.pricingModel?.tiers ?? [];
    if (tiers.length === 0) return { kind: 'free' as const };
    const allFree = tiers.every(t => !t.amount || Number(t.amount) === 0 || (t as { kind?: string }).kind === 'free');
    return allFree ? { kind: 'free' as const } : { kind: 'payment' as const };
  })();

  const hasAccess = (() => {
    if (!state.currentContent) return false;
    if (gating.kind === 'free') return true;
    if (state.devGatingOverride) return true;
    if (actions.checkOwnership(state.currentContent.id)) return true;
    if (state.contentAccessGranted) return true;
    if (gating.kind === 'credential' && gating.credential) {
      return actions.hasCredential(gating.credential);
    }
    return false;
  })();

  // Handle codex-specific drawers
  const renderCodexDrawer = () => {
    if (!state.activeDrawer || !state.activeDrawer.startsWith('moneypenny-')) {
      return null;
    }

    const drawerType = state.activeDrawer.replace('moneypenny-', '');
    
    const drawerContent = {
      console: <HFTConsole />,
      chat: <MoneyPennyChat />,
      portfolio: <PortfolioAnalytics />,
      strategies: <StrategyBuilder />,
      settlements: <X402Dashboard />,
      fio: <FIOManager />,
      crm: <CRMIntegration />,
    }[drawerType];

    if (!drawerContent) return null;

    return (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => {
            actions.setActiveDrawer(null);
          }}
        />
        <div className="absolute inset-0 p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl bg-slate-950/70 ring-1 ring-white/10 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 border-b border-slate-700/50 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white capitalize">
                {drawerType} Drawer
              </h2>
              <button
                onClick={() => actions.setActiveDrawer(null)}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {drawerContent}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Handle KNYT codex drawer
  const renderKnytDrawer = () => {
    if (!state.activeDrawer || !state.activeDrawer.startsWith('knyt-')) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => {
            actions.setActiveDrawer(null);
          }}
        />
        <div className="absolute inset-0 p-4 flex items-center justify-center">
          <div className="w-full max-w-6xl max-h-[85vh] rounded-2xl bg-slate-950/70 ring-1 ring-white/10 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 border-b border-slate-700/50 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                KNYT Codex
              </h2>
              <button
                onClick={() => actions.setActiveDrawer(null)}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              <KnytTab personaId={personaId} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {viewerOpen && state.currentContent && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              actions.setActiveDrawer(null);
            }}
          />
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="w-full max-w-5xl h-[85vh] rounded-2xl bg-slate-950/70 ring-1 ring-white/10 overflow-hidden">
              <ContentViewer
                content={state.currentContent}
                initialModality={(state.viewerModality as any) || undefined}
                hasAccess={hasAccess}
                accessScope={hasAccess ? "full" : "preview"}
                onClose={() => actions.setActiveDrawer(null)}
                onPanelPayment={() => actions.openWallet("full", "payments")}
              />
            </div>
          </div>
        </div>
      )}

      {renderCodexDrawer()}
      {renderKnytDrawer()}

      {/* SmartActions — Share modal (first-class SmartTriad surface) */}
      {state.shareItem && (
        <SocialSharingModal
          isOpen
          onClose={() => actions.closeShare()}
          article={state.shareItem}
          personaId={personaId ?? undefined}
        />
      )}

      {/* Liquid UI SmartWallet - for card-based flows */}
      <CopilotWalletDrawer
        isOpen={state.walletOpen && state.walletMode === "compact"}
        onClose={() => actions.closeWallet()}
        mode={state.walletDrawerMode}
        walletUI={state.walletUI}
        device="desktop"
        balance={12500} // TODO: Get from wallet service
        spendableBalance={12000}
        pendingRewards={[
          { id: "reward_1", amount: 40, source: "Reading Sprint" }
        ]}
        onClaimReward={(rewardId) => {
          console.log("Claim reward:", rewardId);
          // TODO: Implement reward claim
        }}
        onUnlock={(contentId) => {
          console.log("Unlock content:", contentId);
          // TODO: Implement content unlock
        }}
        onConfirmAction={(actionId) => {
          console.log("Confirm action:", actionId);
          // TODO: Implement action confirmation
        }}
      />

      {/* Layered SmartWallet - for full wallet management */}
      <SmartWalletDrawer
        open={state.walletOpen && state.walletMode === "full"}
        onClose={() => actions.closeWallet()}
        agent={{
          id: payer.id,
          name: payer.name,
          evmSepolia: payer.walletAddresses.evmAddress as `0x${string}`,
          evmArb: payer.walletAddresses.evmAddress as `0x${string}`,
          btcAddress: payer.walletAddresses.btcAddress,
        }}
        recipientAddress={recipient.walletAddresses.evmAddress}
        currentContent={state.currentContent || undefined}
        initialTab={state.walletInitialTab}
        onPurchaseComplete={async () => {
          await actions.refreshLibrary();
          actions.setContentAccessGranted(true);
          // Close wallet after the success screen has shown (matches 2s success timer)
          setTimeout(() => actions.closeWallet(), 2500);
        }}
        personaId={personaId}
        onPersonaChange={onPersonaChange}
        cartridgeSlug={cartridgeSlug}
      />
    </>
  );
}
