/**
 * SettlementRetryButton - x402 settlement retry functionality
 */
import React, { useState } from 'react';
import { RefreshCw, Loader2, Check, AlertCircle } from 'lucide-react';

interface Props {
  settlementId?: string;
  messageId?: string;
}

export function SettlementRetryButton({ settlementId, messageId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    if (!settlementId && !messageId) return;
    
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      const response = await fetch(`${apiBase}/api/x402/settlement/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId, messageId }),
      });

      const data = await response.json();
      
      if (data.ok || data.success) {
        setResult('success');
        setTimeout(() => setResult(null), 3000);
      } else {
        setResult('error');
        setError(data.error || 'Retry failed');
      }
    } catch (err) {
      setResult('error');
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleRetry}
        disabled={isLoading || (!settlementId && !messageId)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Retrying...
          </>
        ) : result === 'success' ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            Settlement Retried
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Retry Settlement
          </>
        )}
      </button>
      
      {result === 'error' && error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}

export default SettlementRetryButton;
