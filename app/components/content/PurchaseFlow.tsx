"use client";

import React from "react";
import type { SmartContentQube } from "@/types/smartContent";

export type PurchaseStep = "idle" | "confirm" | "processing" | "success" | "error";
export type PaymentMethod = "arb" | "base" | "polygon" | "optimism" | "knyt";

interface PurchaseFlowProps {
  content: SmartContentQube;
  purchaseStep: PurchaseStep;
  contentPrice?: { amount?: number; currency?: string; kind?: string };
  isFreeContent: boolean;
  selectedPaymentMethod: PaymentMethod;
  purchaseError: string | null;
  onStartPurchase: () => void;
  onConfirmPurchase: () => void;
  onCancelPurchase: () => void;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
}

const PAYMENT_METHODS = [
  { key: "arb" as const, label: "Q¢ Arbitrum", icon: "🔷", color: "blue" },
  { key: "base" as const, label: "Q¢ Base", icon: "🔵", color: "sky" },
  { key: "polygon" as const, label: "Q¢ Polygon", icon: "🟣", color: "purple" },
  { key: "optimism" as const, label: "Q¢ Optimism", icon: "🔴", color: "red" },
  { key: "knyt" as const, label: "KNYT", icon: "🔗", color: "cyan" },
];

export default function PurchaseFlow({
  content,
  purchaseStep,
  contentPrice,
  isFreeContent,
  selectedPaymentMethod,
  purchaseError,
  onStartPurchase,
  onConfirmPurchase,
  onCancelPurchase,
  onSelectPaymentMethod,
}: PurchaseFlowProps) {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 ring-1 ring-fuchsia-500/20 p-3">
      <div className="text-[11px] uppercase tracking-wider text-fuchsia-300 mb-2">
        {purchaseStep === "idle" ? "Current Content" : "Purchase"}
      </div>
      
      <div className="text-sm text-white font-medium">{content.title}</div>
      <div className="text-xs text-slate-400 mt-1">{content.app}</div>
      
      {/* Idle */}
      {purchaseStep === "idle" && (
        <div className="mt-3">
          {isFreeContent ? (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">Free</span>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-300">
                {contentPrice?.amount} {contentPrice?.currency}
              </span>
              <button onClick={onStartPurchase} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-xs font-medium hover:from-fuchsia-400 hover:to-purple-400">
                Purchase
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Confirm */}
      {purchaseStep === "confirm" && (
        <div className="mt-3 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Select Payment</div>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => onSelectPaymentMethod(m.key)}
                className={`p-2 rounded-lg text-center transition-colors ${
                  selectedPaymentMethod === m.key
                    ? "bg-fuchsia-500/20 ring-1 ring-fuchsia-500/50 text-fuchsia-300"
                    : "bg-white/5 ring-1 ring-white/10 text-slate-400 hover:bg-white/10"
                }`}
              >
                <div className="text-lg">{m.icon}</div>
                <div className="text-[10px] mt-0.5">{m.label}</div>
              </button>
            ))}
          </div>
          <div className="p-2 rounded-lg bg-black/30 ring-1 ring-white/10 flex justify-between text-xs">
            <span className="text-slate-400">Amount</span>
            <span className="text-white font-mono">{contentPrice?.amount} {contentPrice?.currency}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancelPurchase} className="flex-1 px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-xs hover:bg-white/10">
              Cancel
            </button>
            <button onClick={onConfirmPurchase} className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-xs font-medium">
              Confirm
            </button>
          </div>
        </div>
      )}
      
      {/* Processing */}
      {purchaseStep === "processing" && (
        <div className="mt-3 flex flex-col items-center py-4">
          <div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
          <div className="text-xs text-slate-400 mt-2">Processing...</div>
        </div>
      )}
      
      {/* Success */}
      {purchaseStep === "success" && (
        <div className="mt-3 flex flex-col items-center py-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/50 flex items-center justify-center text-xl">✓</div>
          <div className="text-sm text-emerald-300 mt-2">Purchase Complete!</div>
        </div>
      )}
      
      {/* Error */}
      {purchaseStep === "error" && (
        <div className="mt-3 space-y-2">
          <div className="p-2 rounded-lg bg-red-500/10 ring-1 ring-red-500/30 text-xs text-red-300">
            {purchaseError || "Purchase failed"}
          </div>
          <button onClick={onCancelPurchase} className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-xs">
            Try Again
          </button>
        </div>
      )}
    </section>
  );
}
