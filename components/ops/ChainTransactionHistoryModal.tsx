'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Copy, ChevronDown } from 'lucide-react';

interface Transaction {
  id: string;
  chainId: string;
  chainType: 'evm' | 'solana' | 'bitcoin';
  eventType: 'mint' | 'burn' | 'transfer';
  txHash: string;
  timestamp: number;
  from: string;
  to: string;
  amount: string;
}

interface ChainTransactionHistoryModalProps {
  chainId: string;
  chainName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChainTransactionHistoryModal({
  chainId,
  chainName,
  isOpen,
  onClose,
}: ChainTransactionHistoryModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  useEffect(() => {
    if (isOpen) {
      loadTransactions(0);
    }
  }, [isOpen, chainId]);

  const loadTransactions = async (newOffset: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/qct/events/history?chainId=${chainId}&limit=${limit}&offset=${newOffset}`,
        { cache: 'no-store' }
      );
      
      if (!response.ok) throw new Error('Failed to load transactions');
      
      const data = await response.json();
      
      if (newOffset === 0) {
        setTransactions(data.transactions || []);
      } else {
        setTransactions(prev => [...prev, ...(data.transactions || [])]);
      }
      
      setOffset(newOffset);
      setHasMore(data.hasMore || false);
      setTotalCount(data.totalCount || 0);
    } catch (e: any) {
      setError(e.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    loadTransactions(offset + limit);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getExplorerUrl = (tx: Transaction) => {
    const hash = tx.txHash;
    
    switch (tx.chainType) {
      case 'evm':
        switch (chainId) {
          case 'ethereum':
            return `https://sepolia.etherscan.io/tx/${hash}`;
          case 'polygon':
            return `https://amoy.polygonscan.com/tx/${hash}`;
          case 'arbitrum':
            return `https://sepolia.arbiscan.io/tx/${hash}`;
          case 'optimism':
            return `https://sepolia-optimism.etherscan.io/tx/${hash}`;
          case 'base':
            return `https://sepolia.basescan.org/tx/${hash}`;
          default:
            return `https://etherscan.io/tx/${hash}`;
        }
      case 'solana':
        return `https://explorer.solana.com/tx/${hash}?cluster=testnet`;
      case 'bitcoin':
        return `https://mempool.space/testnet/tx/${hash}`;
      default:
        return '#';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatAmount = (amount: string) => {
    try {
      const num = parseFloat(amount);
      if (isNaN(num)) return amount;
      return num.toLocaleString(undefined, { maximumFractionDigits: 8 });
    } catch {
      return amount;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'mint': return 'text-emerald-400';
      case 'burn': return 'text-red-400';
      case 'transfer': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">{chainName} Transaction History</h2>
            <p className="text-sm text-slate-400 mt-1">
              {totalCount} transaction{totalCount !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Close modal"
            aria-label="Close transaction history modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {error && (
            <div className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          {transactions.length === 0 && !loading && (
            <div className="text-center text-slate-400 py-12">
              No transactions recorded for this chain yet
            </div>
          )}

          {transactions.length > 0 && (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium uppercase ${getEventTypeColor(tx.eventType)}`}>
                        {tx.eventType}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatTimestamp(tx.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(tx.txHash)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title="Copy transaction hash"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={getExplorerUrl(tx)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title="View in explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">TX Hash:</span>
                      <span className="text-slate-300 font-mono text-xs truncate max-w-[300px]">
                        {tx.txHash}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">From:</span>
                      <span className="text-slate-300 font-mono text-xs truncate max-w-[300px]">
                        {tx.from}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">To:</span>
                      <span className="text-slate-300 font-mono text-xs truncate max-w-[300px]">
                        {tx.to}
                      </span>
                    </div>
                    {tx.amount !== '0' && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Amount:</span>
                        <span className="text-slate-300 font-mono text-xs">
                          {formatAmount(tx.amount)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="text-center text-slate-400 py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
              <p className="mt-2">Loading transactions...</p>
            </div>
          )}

          {hasMore && !loading && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
                title="Load more transactions"
              >
                Show More
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
