'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Coins, Check, Loader2, Sparkles, Wallet, CreditCard } from 'lucide-react';

type Rail = 'qc' | 'usdc' | 'paypal';

interface RailQuote { feePct: number; priceUsd: number; }

interface KnytPackage {
  packageId: string;
  knytAmount: number;
  /** Base USD price (per knytAmount × KNYT/USD rate). Rail fees are applied on top. */
  usdPrice: number;
  bonusKnyt: number;
  label: string;
  rails?: { qc: RailQuote; usdc: RailQuote; paypal: RailQuote };
}

interface Props {
  open: boolean;
  onClose: () => void;
  personaId: string;
  onPurchaseComplete?: (knytAmount: number, newBalance: number) => void;
}

export function BuyKnytModal({ open, onClose, personaId, onPurchaseComplete }: Props) {
  const [packages, setPackages] = useState<KnytPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rail, setRail] = useState<Rail>('qc');
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ knyt: number; balance: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch('/api/wallet/knyt/purchase')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setPackages(d.packages || []);
        setSelected(d.packages?.[1]?.packageId || d.packages?.[0]?.packageId || null);
      })
      .catch((e) => setError(`Failed to load packages: ${e.message}`))
      .finally(() => setLoading(false));
  }, [open]);

  const pkg = useMemo(() => packages.find((p) => p.packageId === selected), [packages, selected]);

  const railPrice = (r: Rail): number => {
    if (!pkg) return 0;
    if (pkg.rails) return pkg.rails[r].priceUsd;
    const fee = r === 'paypal' ? 0.10 : r === 'usdc' ? 0.01 : 0;
    return Math.round(pkg.usdPrice * (1 + fee) * 100) / 100;
  };

  const handlePayPal = async () => {
    if (!selected) return;
    setPurchasing(true);
    setError(null);
    try {
      const orderRes = await fetch('/api/wallet/knyt/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, packageId: selected }),
      });
      if (!orderRes.ok) {
        const t = await orderRes.text();
        throw new Error(`HTTP ${orderRes.status}: ${t}`);
      }
      const { orderId, approvalUrl } = await orderRes.json();
      if (!approvalUrl) throw new Error('PayPal approval URL missing');

      window.open(approvalUrl, '_blank', 'width=500,height=600');
      const checkInterval = setInterval(async () => {
        try {
          const captureRes = await fetch('/api/wallet/knyt/paypal/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId }),
          });
          if (!captureRes.ok) return;
          const result = await captureRes.json();
          if (result.success) {
            clearInterval(checkInterval);
            setSuccess({ knyt: result.knytAmount, balance: result.newBalance });
            onPurchaseComplete?.(result.knytAmount, result.newBalance);
            setPurchasing(false);
          }
        } catch { /* keep polling */ }
      }, 3000);
      setTimeout(() => { clearInterval(checkInterval); setPurchasing(false); }, 120_000);
    } catch (e) {
      setError((e as Error).message);
      setPurchasing(false);
    }
  };

  const handleStubRail = async () => {
    if (!selected) return;
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/knyt/buy-stub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, packageId: selected, rail }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setSuccess({ knyt: json.knytAmount, balance: json.newBalance });
      onPurchaseComplete?.(json.knytAmount, json.newBalance);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchasing(false);
    }
  };

  const handlePurchase = () => (rail === 'paypal' ? handlePayPal() : handleStubRail());

  if (!open) return null;

  const submitLabel = !pkg
    ? 'Select a package'
    : purchasing
      ? 'Processing…'
      : rail === 'paypal'
        ? `Pay $${railPrice('paypal').toFixed(2)} with PayPal`
        : rail === 'usdc'
          ? `Pay $${railPrice('usdc').toFixed(2)} with USDC`
          : `Pay $${railPrice('qc').toFixed(2)} with Q¢`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            Buy KNYT
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-medium">+{success.knyt} KNYT purchased!</p>
            <p className="text-white/60 text-sm mt-1">New balance: {success.balance} KNYT</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm"
            >
              Done
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Package picker */}
            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Choose Amount</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {packages.map((p) => (
                <button
                  key={p.packageId}
                  onClick={() => setSelected(p.packageId)}
                  className={`p-3 rounded-xl border transition-all text-left ${
                    selected === p.packageId
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-white font-medium">{p.knytAmount} KNYT</div>
                  <div className="text-amber-300/80 text-xs">${p.usdPrice.toFixed(2)}</div>
                </button>
              ))}
            </div>

            {/* Base price card — mirrors the store's content purchase modal */}
            {pkg && (
              <div className="mb-5 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Base Price</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{pkg.knytAmount} KNYT</span>
                    <span className="text-white/40 text-sm ml-2">(${pkg.usdPrice.toFixed(2)})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment method picker — same visual treatment as ContentPurchaseModal */}
            <div className="space-y-2 mb-5">
              <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Select Payment Method</p>

              <button
                onClick={() => setRail('qc')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  rail === 'qc'
                    ? 'border-cyan-500/50 bg-cyan-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">Pay with Q¢</div>
                    <div className="text-xs text-white/50">No fees</div>
                  </div>
                </div>
                <div className="text-cyan-300 font-bold">${railPrice('qc').toFixed(2)}</div>
              </button>

              <button
                onClick={() => setRail('usdc')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  rail === 'usdc'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">Pay with USDC</div>
                    <div className="text-xs text-white/50">1% fee</div>
                  </div>
                </div>
                <div className="text-blue-300 font-bold">${railPrice('usdc').toFixed(2)}</div>
              </button>

              <button
                onClick={() => setRail('paypal')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  rail === 'paypal'
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">Pay with PayPal</div>
                    <div className="text-xs text-white/50">10% fee</div>
                  </div>
                </div>
                <div className="text-indigo-300 font-bold">${railPrice('paypal').toFixed(2)}</div>
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs mb-3 p-2 bg-red-500/10 rounded-lg">{error}</p>
            )}

            <button
              onClick={handlePurchase}
              disabled={!selected || purchasing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {purchasing && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitLabel}
            </button>
            <p className="text-center text-white/40 text-xs mt-3">
              {rail === 'paypal'
                ? 'Secure payment via PayPal'
                : rail === 'usdc'
                  ? 'USDC checkout coming soon — KNYT credited immediately for testing'
                  : 'Q¢ checkout coming soon — KNYT credited immediately for testing'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
