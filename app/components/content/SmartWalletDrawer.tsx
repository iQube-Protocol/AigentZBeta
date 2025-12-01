"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useBalances } from "@/app/hooks/useBalances";
import { useDVNEvents } from "@/app/hooks/useDVNEvents";
import AliasConsentToggle from "../identity/AliasConsentToggle";
import SettlementRetryButton from "../x402/SettlementRetryButton";
import LibraryShelf from "./LibraryShelf";
import PurchaseFlow, { type PurchaseStep, type PaymentMethod } from "./PurchaseFlow";
import type { SmartWalletNode, WalletTask, QuestProgress } from "@/types/smartWallet";
import type { SmartContentQube } from "@/types/smartContent";

type DrawerTab = "wallet" | "library" | "tasks" | "rewards";

interface SmartWalletDrawerProps {
  open: boolean;
  onClose: () => void;
  agent: {
    id: string;
    name: string;
    evmSepolia?: `0x${string}`;
    evmArb?: `0x${string}`;
    btcAddress?: string;
    fioHandle?: string;
  };
  personaId?: string;
  walletNode?: SmartWalletNode;
  currentContent?: SmartContentQube;
  onContentSelect?: (content: SmartContentQube) => void;
  onTaskAction?: (task: WalletTask, action: "complete" | "dismiss") => void;
  onPurchaseComplete?: (content: SmartContentQube) => void;
  recipientAddress?: string; // Content creator's wallet address for payments
  initialTab?: DrawerTab;
}

const TAB_CONFIG: Array<{ key: DrawerTab; label: string; icon: string }> = [
  { key: "wallet", label: "Wallet", icon: "💰" },
  { key: "library", label: "Library", icon: "📚" },
  { key: "tasks", label: "Tasks", icon: "✅" },
  { key: "rewards", label: "Rewards", icon: "🎁" },
];

export default function SmartWalletDrawer({
  open,
  onClose,
  agent,
  personaId,
  walletNode,
  currentContent,
  onContentSelect,
  onTaskAction,
  onPurchaseComplete,
  recipientAddress,
  initialTab = "wallet",
}: SmartWalletDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const bals = useBalances({ sepolia: agent.evmSepolia, arb: agent.evmArb, btc: agent.btcAddress });
  const evs = useDVNEvents(agent.id);

  const [aliasConsent, setAliasConsent] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("x402_alias_consent") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("x402_alias_consent", aliasConsent ? "true" : "false");
    } catch {}
  }, [aliasConsent]);

  const [retrySettlementId, setRetrySettlementId] = useState("");
  const [retryMessageId, setRetryMessageId] = useState("");
  const [custodyCount, setCustodyCount] = useState(0);
  const [claimCount, setClaimCount] = useState(0);
  
  // Purchase flow state
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("idle");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("arb");

  // Auto-start purchase flow when content changes and has a price
  useEffect(() => {
    if (currentContent && open) {
      const price = currentContent.pricingModel?.tiers?.[0];
      const isFree = !price || price.kind === "free" || price.amount === 0;
      if (!isFree) {
        setPurchaseStep("confirm");
      } else {
        setPurchaseStep("idle");
      }
    }
  }, [currentContent, open]);

  // Reset purchase state when drawer closes
  useEffect(() => {
    if (!open) {
      setPurchaseStep("idle");
      setPurchaseError(null);
    }
  }, [open]);

  useEffect(() => {
    const did = agent?.id ? `did:iq:${agent.id}#auth` : undefined;
    if (!did) return;
    (async () => {
      try {
        const c = await fetch(`/api/x402/custody?did=${encodeURIComponent(did)}`, { cache: "no-store" });
        const cj = await c.json().catch(() => ({}));
        if (cj?.ok && Array.isArray(cj.data)) setCustodyCount(cj.data.length);
      } catch {}
      try {
        const r = await fetch(`/api/x402/claims?did=${encodeURIComponent(did)}&status=open`, { cache: "no-store" });
        const rj = await r.json().catch(() => ({}));
        if (rj?.ok && Array.isArray(rj.data)) setClaimCount(rj.data.length);
      } catch {}
    })();
  }, [agent?.id]);

  const formatToken = (raw?: string, decimals?: number, fractionDigits: number = 0) => {
    try {
      const d = typeof decimals === "number" ? decimals : 0;
      const bi = BigInt(raw || "0");
      if (d <= 0) return Number(bi).toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
      const factor = 10 ** Math.min(d, 18);
      const whole = Number(bi) / factor;
      return whole.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
    } catch {
      return "0";
    }
  };

  const formatUSDC = (raw?: string, decimals?: number) => formatToken(raw, decimals, 2);
  const formatQcent = (raw?: string, decimals?: number) => formatToken(raw, decimals, 0);

  const qctTotalStr = (() => {
    try {
      const ethQ = Number(BigInt(bals.qctSep || "0")) / 10 ** (bals.qctSepDecimals ?? 0);
      const arbQ = Number(BigInt(bals.qctArb || "0")) / 10 ** (bals.qctArbDecimals ?? 0);
      const btcQ = Number(BigInt(bals.btcQcent || "0"));
      const total = ethQ + arbQ + btcQ;
      return total.toLocaleString(undefined, { maximumFractionDigits: 0 });
    } catch {
      return "0";
    }
  })();

  // Get tasks from wallet node or use empty array
  const tasks = walletNode?.tasks || [];
  const quests = walletNode?.activeQuests || [];
  const rewards = walletNode?.rewardsContext;

  // Get pricing info for current content
  const contentPrice = currentContent?.pricingModel?.tiers?.[0];
  const isFreeContent = !contentPrice || contentPrice.kind === "free" || contentPrice.amount === 0;

  // Handle purchase flow
  const handleStartPurchase = () => {
    setPurchaseStep("confirm");
    setPurchaseError(null);
  };

  const handleConfirmPurchase = async () => {
    if (!currentContent || !personaId) return;
    
    setPurchaseStep("processing");
    setPurchaseError(null);
    
    // Check if content ID is a valid UUID (real database content)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealContent = uuidRegex.test(currentContent.id);
    
    // Get chain config based on payment method
    // Q¢ available on Arbitrum, Base, Polygon, Optimism (all testnets)
    const CHAIN_CONFIG: Record<PaymentMethod, { chainId: number; asset: string; name: string }> = {
      arb: { chainId: 421614, asset: "QCT", name: "Arbitrum Sepolia" },
      base: { chainId: 84532, asset: "QCT", name: "Base Sepolia" },
      polygon: { chainId: 80002, asset: "QCT", name: "Polygon Amoy" },
      optimism: { chainId: 11155420, asset: "QCT", name: "Optimism Sepolia" },
      knyt: { chainId: 1, asset: "KNYT", name: "Ethereum Mainnet" },
    };
    const chainConfig = CHAIN_CONFIG[selectedPaymentMethod];
    
    try {
      // Step 1: Execute payment via x402 rails using agent's wallet
      const paymentAmount = contentPrice?.amount || 0;
      const payTo = recipientAddress || currentContent.creatorRootDid; // Pay to content creator
      
      if (paymentAmount > 0 && payTo) {
        // Use the a2a signer to transfer tokens
        const transferRes = await fetch("/api/a2a/signer/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainId: chainConfig.chainId,
            amount: (BigInt(paymentAmount) * 10n ** 18n).toString(), // Convert to wei
            asset: "QCT",
            agentId: agent.id, // Payer agent (AigentZ)
            to: payTo, // Recipient (Kn0w1)
            tokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09", // QCT token
          }),
        });
        
        if (!transferRes.ok) {
          const text = await transferRes.text();
          let errorMsg = "Payment failed";
          try {
            const err = JSON.parse(text);
            errorMsg = err.error || errorMsg;
          } catch {
            errorMsg = text || errorMsg;
          }
          throw new Error(errorMsg);
        }
        
        const transferData = await transferRes.json();
        const txHash = transferData.txHash;
        
        // Step 2: Grant entitlement after successful payment (only for real content)
        if (isRealContent && txHash) {
          const entitlementRes = await fetch(`/api/content/pricing/${currentContent.id}/entitlement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId,
              scope: "full",
              acquiredVia: "purchase",
              txHash,
              chainId: chainConfig.chainId,
            }),
          });
          
          if (!entitlementRes.ok) {
            console.warn("Entitlement grant failed but payment succeeded:", await entitlementRes.text());
          }
        }
      } else if (!isRealContent) {
        // Demo content with no payment - simulate success
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setPurchaseStep("success");
      onPurchaseComplete?.(currentContent);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setPurchaseStep("idle");
      }, 2000);
    } catch (err: any) {
      setPurchaseError(err.message);
      setPurchaseStep("error");
    }
  };

  const handleCancelPurchase = () => {
    setPurchaseStep("idle");
    setPurchaseError(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 drawer-backdrop bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="ml-auto h-full drawer-content animate-slide-in-left w-[21.6rem] bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-white/5 ring-1 ring-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-slate-100 text-sm font-medium tracking-wide">{agent.name}</h3>
            {walletNode?.personaContext && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30">
                {walletNode.personaContext.identityState}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs rounded-md bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
          >
            Close
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-1 px-3 py-2 bg-white/5 flex-shrink-0">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
              }`}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Wallet Tab */}
          {activeTab === "wallet" && (
            <div className="space-y-4">
              {/* Balances */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Balances</div>
                <ul className="space-y-1 text-sm text-slate-200">
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-blue-400">⟠</span>
                      ETH Q¢
                    </span>
                    <span className="font-mono text-slate-100">{formatQcent(bals.qctSep, bals.qctSepDecimals)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-cyan-400">◆</span>
                      ARB Q¢
                    </span>
                    <span className="font-mono text-slate-100">{formatQcent(bals.qctArb, bals.qctArbDecimals)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-orange-400">₿</span>
                      BTC Q¢
                    </span>
                    <span className="font-mono text-slate-100">{formatQcent(bals.btcQcent, 0)}</span>
                  </li>
                  <li className="flex items-center justify-between pt-2 mt-1 border-t border-white/10">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                      Q¢ Total
                    </span>
                    <span className="font-mono text-slate-100">{qctTotalStr}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      USDC
                    </span>
                    <span className="font-mono text-slate-100">{formatUSDC(bals.usdcSep, bals.usdcSepDecimals)}</span>
                  </li>
                </ul>
              </section>

              {/* Current Content & Purchase Flow */}
              {currentContent && (
                <PurchaseFlow
                  content={currentContent}
                  purchaseStep={purchaseStep}
                  contentPrice={contentPrice}
                  isFreeContent={isFreeContent}
                  selectedPaymentMethod={selectedPaymentMethod}
                  purchaseError={purchaseError}
                  onStartPurchase={handleStartPurchase}
                  onConfirmPurchase={handleConfirmPurchase}
                  onCancelPurchase={handleCancelPurchase}
                  onSelectPaymentMethod={setSelectedPaymentMethod}
                />
              )}

              {/* DVN Events */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Recent DVN Events</div>
                <div className="space-y-2">
                  {evs.slice(0, 3).map((e, i) => {
                    const statusColor = e.event === "PaymentConfirmed" ? "text-emerald-300" : e.event === "PaymentFailed" ? "text-red-300" : "text-amber-300";
                    const statusDot = e.event === "PaymentConfirmed" ? "bg-emerald-400" : e.event === "PaymentFailed" ? "bg-red-400" : "bg-amber-400";
                    return (
                      <div key={i} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-slate-200">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                            <span className={statusColor}>{e.event}</span>
                          </span>
                          <span className="text-slate-400">{e.chain}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{e.amount}</div>
                      </div>
                    );
                  })}
                  {evs.length === 0 && <div className="text-xs text-slate-400">No events yet.</div>}
                </div>
              </section>

              {/* Identity */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Identity</div>
                <div className="flex items-center gap-2 mb-2 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/20">
                    Custody: {custodyCount}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
                    Claims: {claimCount}
                  </span>
                </div>
                <div className="text-xs text-slate-300">FIO: {agent.fioHandle || "—"}</div>
                <div className="mt-3">
                  <AliasConsentToggle consented={aliasConsent} onChange={setAliasConsent} />
                </div>
              </section>

              {/* x402 Settlement */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">x402 Settlement</div>
                <div className="space-y-2">
                  <input
                    value={retrySettlementId}
                    onChange={(e) => setRetrySettlementId(e.target.value)}
                    placeholder="Settlement ID (optional)"
                    className="w-full px-2 py-1.5 text-sm rounded bg-black/40 ring-1 ring-white/10 text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    value={retryMessageId}
                    onChange={(e) => setRetryMessageId(e.target.value)}
                    placeholder="Message ID (optional)"
                    className="w-full px-2 py-1.5 text-sm rounded bg-black/40 ring-1 ring-white/10 text-slate-200 placeholder:text-slate-500"
                  />
                  <SettlementRetryButton settlementId={retrySettlementId || undefined} messageId={retryMessageId || undefined} />
                </div>
              </section>
            </div>
          )}

          {/* Library Tab */}
          {activeTab === "library" && personaId && (
            <LibraryShelf personaId={personaId} onContentSelect={onContentSelect} variant="drawer" />
          )}
          {activeTab === "library" && !personaId && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Connect a persona to view your library
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Active Tasks */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Active Tasks</div>
                <div className="space-y-2">
                  {tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length === 0 && (
                    <div className="text-xs text-slate-400">No active tasks</div>
                  )}
                  {tasks
                    .filter((t) => t.status === "pending" || t.status === "in_progress")
                    .map((task) => (
                      <div key={task.id} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm text-slate-200">{task.title}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{task.description}</div>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              task.priority === "high"
                                ? "bg-red-500/20 text-red-300"
                                : task.priority === "medium"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-500/20 text-slate-300"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        {task.reward && (
                          <div className="mt-2 text-xs text-fuchsia-300">
                            +{task.reward.amount} {task.reward.currency}
                          </div>
                        )}
                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={() => onTaskAction?.(task, "complete")}
                            className="flex-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/30"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => onTaskAction?.(task, "dismiss")}
                            className="px-2 py-1 rounded bg-white/5 text-slate-400 text-xs hover:bg-white/10"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </section>

              {/* Quest Progress */}
              {quests.length > 0 && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Quest Progress</div>
                  <div className="space-y-2">
                    {quests.map((quest) => (
                      <div key={quest.questId} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="text-sm text-slate-200">{quest.questId}</div>
                        <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                            style={{ width: `${(quest.currentStep / quest.totalSteps) * 100}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Step {quest.currentStep} of {quest.totalSteps}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Rewards Tab */}
          {activeTab === "rewards" && (
            <div className="space-y-4">
              {/* Pending Rewards */}
              {rewards && rewards.pendingRewards.length > 0 && (
                <section className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-amber-300 mb-2">Pending Rewards</div>
                  <div className="space-y-2">
                    {rewards.pendingRewards.map((reward, idx) => (
                      <div key={idx} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-200">{reward.reason}</span>
                          <span className="text-sm font-medium text-amber-300">
                            +{reward.amount} {reward.tokenType}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Status: {reward.status}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Recent Rewards */}
              {rewards && rewards.recentRewards.length > 0 && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Recent Rewards</div>
                  <div className="space-y-2">
                    {rewards.recentRewards.map((reward, idx) => (
                      <div key={idx} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-200">{reward.reason}</span>
                          <span className="text-sm font-medium text-emerald-300">
                            +{reward.amount} {reward.tokenType}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(reward.distributedAt || "").toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Lifetime Stats */}
              {rewards && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Lifetime Rewards</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(rewards.lifetimeEarnings).map(([currency, amount]) => (
                      <div key={currency} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2 text-center">
                        <div className="text-lg font-semibold text-white">{amount}</div>
                        <div className="text-[10px] text-slate-400">{currency}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(!rewards || (rewards.pendingRewards.length === 0 && rewards.recentRewards.length === 0)) && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No rewards yet. Complete tasks to earn rewards!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
