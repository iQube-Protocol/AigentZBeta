"use client";
import React from 'react';

export interface SettlementRetryButtonProps {
  settlementId?: string;
  messageId?: string;
  className?: string;
  onSuccess?: (info: { settlementId: string; txHash: string }) => void;
}

export const SettlementRetryButton: React.FC<SettlementRetryButtonProps> = ({ settlementId, messageId, className, onSuccess }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  const disabled = loading || (!settlementId && !messageId);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      const r = await fetch('/api/x402/settlements/retry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settlementId, messageId }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || 'Retry failed');
      }
      setTxHash(j.txHash);
      onSuccess?.({ settlementId: j.settlementId, txHash: j.txHash });
    } catch (e: any) {
      setError(e?.message || 'Retry failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`w-full py-2 px-3 rounded text-xs font-medium ring-1 
          ${disabled ? 'bg-white/5 cursor-not-allowed text-slate-400 ring-white/10' : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 ring-blue-500/30'}`}
      >
        {loading ? 'Retrying…' : 'Retry Settlement'}
      </button>
      {txHash && (
        <div className="text-xs text-green-300 mt-2 font-mono truncate">txHash: {txHash}</div>
      )}
      {error && (
        <div className="text-xs text-red-300 mt-2">{error}</div>
      )}
    </div>
  );
};

export default SettlementRetryButton;
