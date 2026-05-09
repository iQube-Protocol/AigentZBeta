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

const MIN_KNYT = 10;
const RAIL_FEE: Record<Rail, number> = { qc: 0, usdc: 0.01, paypal: 0.10 };

// $1 = 100 Q¢ → 1 Q¢ = $0.01. Render Q¢ count as integer cents.
function usdToQcents(usd: number): number {
  return Math.round(usd * 100);
}

export function BuyKnytModal({ open, onClose, personaId, onPurchaseComplete }: Props) {
  const [packages, setPackages] = useState<KnytPackage[]>([]);
  const [usdPerKnyt, setUsdPerKnyt] = useState<number>(0);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  /** Free-text input. Empty string = use selectedPackageId. */
  const [customAmount, setCustomAmount] = useState<string>('');
  const [rail, setRail] = useState<Rail>('qc');
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ knyt: number; balance: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setCustomAmount('');
    fetch('/api/wallet/knyt/purchase')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setPackages(d.packages || []);
        setUsdPerKnyt(typeof d.usdPerKnyt === 'number' ? d.usdPerKnyt : 0);
        setSelectedPackageId(d.packages?.[1]?.packageId || d.packages?.[0]?.packageId || null);
      })
      .catch((e) => setError(`Failed to load packages: ${e.message}`))
      .finally(() => setLoading(false));
  }, [open]);

  // Derive the effective purchase: custom amount takes precedence over the
  // preset package picker, so the manual field doubles as a live calculator.
  const customKnyt = useMemo(() => {
    const n = Number(customAmount);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }, [customAmount]);

  const presetPkg = useMemo(
    () => packages.find((p) => p.packageId === selectedPackageId),
    [packages, selectedPackageId]
  );

  const effectiveKnyt = customKnyt ?? presetPkg?.knytAmount ?? 0;
  const effectiveBaseUsd = useMemo(() => {
    if (customKnyt !== null) return Math.round(customKnyt * usdPerKnyt * 100) / 100;
    return presetPkg?.usdPrice ?? 0;
  }, [customKnyt, usdPerKnyt, presetPkg]);

  const railPrice = (r: Rail): number =>
    Math.round(effectiveBaseUsd * (1 + RAIL_FEE[r]) * 100) / 100;

  const customError =
    customAmount !== '' && (customKnyt === null || customKnyt < MIN_KNYT)
      ? `Minimum is ${MIN_KNYT} KNYT`
      : null;

  const canPurchase = !purchasing && effectiveKnyt >= MIN_KNYT && !customError;

  const handlePayPal = async () => {
    setPurchasing(true);
    setError(null);
    try {
      const orderRes = await fetch('/api/wallet/knyt/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          customKnyt !== null
            ? { personaId, customKnytAmount: customKnyt }
            : { personaId, packageId: selectedPackageId }
        ),
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
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/knyt/buy-stub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          customKnyt !== null
            ? { personaId, rail, customKnytAmount: customKnyt }
            : { personaId, rail, packageId: selectedPackageId }
        ),
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

  const submitLabel = !canPurchase
    ? purchasing
      ? 'Processing…'
      : effectiveKnyt < MIN_KNYT
        ? `Minimum ${MIN_KNYT} KNYT`
        : 'Select an amount'
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
            {/* Preset amount picker */}
            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Choose Amount</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {packages.map((p) => {
                const active = customKnyt === null && selectedPackageId === p.packageId;
                return (
                  <button
                    key={p.packageId}
                    onClick={() => {
                      setSelectedPackageId(p.packageId);
                      setCustomAmount('');
                    }}
                    className={`p-3 rounded-xl border transition-all text-left ${
                      active
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-white font-medium">{p.knytAmount} KNYT</div>
                    <div className="text-amber-300/80 text-xs">${p.usdPrice.toFixed(2)}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom amount input — doubles as a live KNYT/USD calculator */}
            <div className={`mb-5 p-3 rounded-xl border transition-all ${
              customKnyt !== null
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-white/10 bg-white/5'
            }`}>
              <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">
                Or enter custom amount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_KNYT}
                  step="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`min ${MIN_KNYT}`}
                  className="flex-1 bg-transparent text-white text-base font-medium focus:outline-none placeholder-white/30"
                />
                <span className="text-white/60 text-sm">KNYT</span>
                {customKnyt !== null && customKnyt >= MIN_KNYT && (
                  <span className="text-amber-300 text-sm">
                    ≈ ${effectiveBaseUsd.toFixed(2)}
                  </span>
                )}
              </div>
              {customError && (
                <p className="text-red-400 text-[11px] mt-1">{customError}</p>
              )}
              {usdPerKnyt > 0 && (
                <p className="text-white/40 text-[10px] mt-1">
                  Live rate: 1 KNYT = ${usdPerKnyt.toFixed(4)}
                </p>
              )}
            </div>

            {/* Base price card — mirrors store ContentPurchaseModal */}
            {effectiveKnyt > 0 && (
              <div className="mb-5 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Base Price</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{effectiveKnyt} KNYT</span>
                    <span className="text-white/40 text-sm ml-2">(${effectiveBaseUsd.toFixed(2)})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment method picker — same visual treatment as store */}
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
                <div className="text-right">
                  <div className="text-cyan-300 font-bold">${railPrice('qc').toFixed(2)}</div>
                  <div className="text-[10px] text-white/40">{usdToQcents(railPrice('qc'))} Q¢</div>
                </div>
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
              disabled={!canPurchase}
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
