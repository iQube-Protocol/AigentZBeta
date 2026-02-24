/**
 * PurchaseFlow - Multi-step purchase flow with payment method selection
 */
import React from 'react';
import { CreditCard, Check, X, Loader2, Zap, Coins } from 'lucide-react';

export type PurchaseStep = 'idle' | 'confirm' | 'processing' | 'success' | 'error';
export type PaymentMethod = 'arb' | 'base' | 'polygon' | 'optimism' | 'usdc' | 'knyt';

interface ContentPrice {
  kind: string;
  amount: number;
  currency?: string;
}

interface Content {
  id: string;
  title: string;
  creatorRootDid?: string;
}

interface Props {
  content: Content;
  purchaseStep: PurchaseStep;
  contentPrice?: ContentPrice;
  isFreeContent: boolean;
  selectedPaymentMethod: PaymentMethod;
  purchaseError: string | null;
  onStartPurchase: () => void;
  onConfirmPurchase: () => void;
  onCancelPurchase: () => void;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; name: string; icon: React.ReactNode; color: string }[] = [
  { id: 'arb', name: 'Arbitrum', icon: <Zap className="w-4 h-4" />, color: 'text-cyan-400' },
  { id: 'base', name: 'Base', icon: <Zap className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'polygon', name: 'Polygon', icon: <Zap className="w-4 h-4" />, color: 'text-purple-400' },
  { id: 'optimism', name: 'Optimism', icon: <Zap className="w-4 h-4" />, color: 'text-red-400' },
  { id: 'usdc', name: 'USDC (Base)', icon: <Coins className="w-4 h-4" />, color: 'text-emerald-400' },
  { id: 'knyt', name: 'KNYT', icon: <Coins className="w-4 h-4" />, color: 'text-amber-400' },
];

export function PurchaseFlow({
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
}: Props) {
  if (purchaseStep === 'idle' && isFreeContent) {
    return (
      <section className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-4">
        <div className="flex items-center gap-3">
          <Check className="w-6 h-6 text-emerald-400" />
          <div>
            <div className="text-sm font-medium text-white">Free Content</div>
            <div className="text-xs text-white/60">This content is available at no cost</div>
          </div>
        </div>
      </section>
    );
  }

  if (purchaseStep === 'idle') {
    return (
      <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white">{content.title}</div>
          <div className="text-lg font-bold text-amber-300">
            {contentPrice?.amount || 0} {contentPrice?.currency || 'Q¢'}
          </div>
        </div>
        <button
          onClick={onStartPurchase}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Purchase Now
        </button>
      </section>
    );
  }

  if (purchaseStep === 'confirm') {
    return (
      <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 space-y-4">
        <div className="text-center">
          <div className="text-sm text-white/60 mb-1">Confirm Purchase</div>
          <div className="text-lg font-medium text-white">{content.title}</div>
          <div className="text-2xl font-bold text-amber-300 mt-2">
            {contentPrice?.amount || 0} {contentPrice?.currency || 'Q¢'}
          </div>
        </div>

        {/* Payment method selection */}
        <div>
          <div className="text-xs text-white/60 mb-2">Select Payment Chain</div>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(method => (
              <button
                key={method.id}
                onClick={() => onSelectPaymentMethod(method.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  selectedPaymentMethod === method.id
                    ? 'border-fuchsia-500 bg-fuchsia-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <span className={method.color}>{method.icon}</span>
                <span className="text-sm text-white">{method.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancelPurchase}
            className="flex-1 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmPurchase}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Confirm
          </button>
        </div>
      </section>
    );
  }

  if (purchaseStep === 'processing') {
    return (
      <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-fuchsia-400 animate-spin mx-auto mb-3" />
          <div className="text-sm text-white/60">Processing payment...</div>
          <div className="text-xs text-white/40 mt-2">Please wait while we confirm your transaction</div>
        </div>
      </section>
    );
  }

  if (purchaseStep === 'success') {
    return (
      <section className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="text-lg font-medium text-white">Purchase Complete!</div>
          <div className="text-sm text-white/60 mt-1">You now have access to this content</div>
        </div>
      </section>
    );
  }

  if (purchaseStep === 'error') {
    return (
      <section className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 p-4">
        <div className="flex items-start gap-3">
          <X className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-white">Purchase Failed</div>
            <div className="text-xs text-red-300 mt-1">{purchaseError || 'An error occurred'}</div>
            <button
              onClick={onStartPurchase}
              className="mt-3 px-4 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return null;
}

export default PurchaseFlow;
