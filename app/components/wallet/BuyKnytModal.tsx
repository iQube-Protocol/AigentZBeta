'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Coins, Check, Loader2 } from 'lucide-react';

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

const RAIL_LABEL: Record<Rail, string> = {
  qc: 'Base Q¢',
  usdc: 'USDC',
  paypal: 'PayPal',
};

const RAIL_HINT: Record<Rail, string> = {
  qc: 'No fee · stubbed',
  usdc: '1% fee · stubbed',
  paypal: '10% fee · live',
};

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

  // Rail-adjusted price for the selected package. Falls back to base × (1 + fee)
  // if the API didn't return a rails block (older clients / fallback path).
  const railPriceUsd = useMemo(() => {
    if (!pkg) return 0;
    if (pkg.rails) return pkg.rails[rail].priceUsd;
    const fee = rail === 'paypal' ? 0.10 : rail === 'usdc' ? 0.01 : 0;
    return Math.round(pkg.usdPrice * (1 + fee) * 100) / 100;
  }, [pkg, rail]);

  const railFeePct = useMemo(() => {
    if (pkg?.rails) return pkg.rails[rail].feePct;
    return rail === 'paypal' ? 0.10 : rail === 'usdc' ? 0.01 : 0;
  }, [pkg, rail]);

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

  const submitLabel = purchasing
    ? 'Processing…'
    : rail === 'paypal'
      ? `Pay $${railPriceUsd.toFixed(2)} with PayPal`
      : rail === 'usdc'
        ? `Pay $${railPriceUsd.toFixed(2)} with USDC (stub)`
        : `Pay ${railPriceUsd.toFixed(2)} Q¢ (stub)`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm mx-4 p-5"
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
            <div className="space-y-2 mb-4">
              {packages.map((p) => {
                const railed = p.rails ? p.rails[rail].priceUsd : p.usdPrice;
                return (
                  <button
                    key={p.packageId}
                    onClick={() => setSelected(p.packageId)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selected === p.packageId
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-left">
                      <div className="text-white font-medium">{p.knytAmount} KNYT</div>
                    </div>
                    <div className="text-amber-300 font-semibold">
                      {rail === 'qc' ? `${railed.toFixed(2)} Q¢` : `$${railed.toFixed(2)}`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Payment method picker */}
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">Pay with</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['qc', 'usdc', 'paypal'] as Rail[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRail(r)}
                    className={`p-2 rounded-lg text-center transition-colors ${
                      rail === r
                        ? 'bg-amber-500/20 ring-1 ring-amber-500/50 text-amber-200'
                        : 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-medium">{RAIL_LABEL[r]}</div>
                    <div className="text-[10px] text-white/40">{RAIL_HINT[r]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fee breakdown */}
            {pkg && (
              <div className="text-[11px] text-white/50 mb-3 px-1">
                Base ${pkg.usdPrice.toFixed(2)}
                {railFeePct > 0 && <> + {(railFeePct * 100).toFixed(0)}% {RAIL_LABEL[rail]} fee</>}
                {' = '}
                <span className="text-amber-300 font-medium">
                  {rail === 'qc' ? `${railPriceUsd.toFixed(2)} Q¢` : `$${railPriceUsd.toFixed(2)}`}
                </span>
              </div>
            )}

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

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
