import React, { useState, useEffect } from 'react';
import { X, Coins, Check, Loader2 } from 'lucide-react';

interface KnytPackage { packageId: string; knytAmount: number; usdPrice: number; bonusKnyt: number; label: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  personaId: string;
  onPurchaseComplete?: (knytAmount: number, newBalance: number) => void;
}

export function BuyKnytModal({ open, onClose, personaId, onPurchaseComplete }: Props) {
  const [packages, setPackages] = useState<KnytPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ knyt: number; balance: number } | null>(null);

  const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`${apiBase}/api/wallet/knyt/purchase`)
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => { setPackages(d.packages || []); setSelected(d.packages?.[1]?.packageId || null); })
        .catch((e) => setError(`Failed to load packages: ${e.message}`))
        .finally(() => setLoading(false));
    }
  }, [open, apiBase]);

  const handlePurchase = async () => {
    if (!selected) return;
    setPurchasing(true); setError(null);
    try {
      const orderRes = await fetch(`${apiBase}/api/wallet/knyt/paypal/create-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, packageId: selected }),
      });
      if (!orderRes.ok) {
        const errorText = await orderRes.text();
        throw new Error(`HTTP ${orderRes.status}: ${errorText}`);
      }
      const { orderId, approvalUrl } = await orderRes.json();
      if (approvalUrl) {
        window.open(approvalUrl, '_blank', 'width=500,height=600');
        // Poll for completion (simplified - in production use webhooks)
        const checkInterval = setInterval(async () => {
          try {
            const captureRes = await fetch(`${apiBase}/api/wallet/knyt/paypal/capture`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId }),
            });
            if (!captureRes.ok) return; // Skip if not ready yet
            const result = await captureRes.json();
            if (result.success) {
              clearInterval(checkInterval);
              setSuccess({ knyt: result.knytAmount, balance: result.newBalance });
              onPurchaseComplete?.(result.knytAmount, result.newBalance);
              setPurchasing(false);
            }
          } catch {}
        }, 3000);
        setTimeout(() => { clearInterval(checkInterval); setPurchasing(false); }, 120000);
      }
    } catch (e) { setError((e as Error).message); setPurchasing(false); }
  };

  if (!open) return null;
  const pkg = packages.find(p => p.packageId === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Coins className="w-5 h-5 text-amber-400" />Buy KNYT</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-white/60" /></button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-medium">+{success.knyt} KNYT purchased!</p>
            <p className="text-white/60 text-sm mt-1">New balance: {success.balance} KNYT</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm">Done</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {packages.map(p => (
                <button key={p.packageId} onClick={() => setSelected(p.packageId)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selected === p.packageId ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  <div className="text-left">
                    <div className="text-white font-medium">{p.knytAmount} KNYT</div>
                    {p.bonusKnyt > 0 && <div className="text-xs text-emerald-400">+{p.bonusKnyt} bonus</div>}
                  </div>
                  <div className="text-amber-300 font-semibold">${p.usdPrice.toFixed(2)}</div>
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button onClick={handlePurchase} disabled={!selected || purchasing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {purchasing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <>Pay ${pkg?.usdPrice.toFixed(2)} with PayPal</>}
            </button>
            <p className="text-center text-white/40 text-xs mt-3">Secure payment via PayPal</p>
          </>
        )}
      </div>
    </div>
  );
}
