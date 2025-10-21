"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Activity, ArrowRight, Clock, CheckCircle2 } from "lucide-react";

interface A2AMessage {
  messageId: string;
  sourceChain: number;
  timestamp: number;
  payload: string;
}

interface A2ABatch {
  batchId: string;
  receiptCount: number;
  timestamp: number;
  a2aReceipts: number;
}

interface A2AStatus {
  pendingDVN: number;
  pendingPoS: number;
  recentA2AMessages: A2AMessage[];
  recentA2ABatches: A2ABatch[];
}

export function A2ADVNCard({ title }: { title: string }) {
  const [status, setStatus] = useState<A2AStatus | null>(null);
  const [loading, setLoading] = useState(false); // Start with false to prevent initial flash
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fetchingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    try {
      setLoading(true);
      const response = await fetch("/api/ops/a2a/status", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.ok && data.a2aStatus) {
        setStatus(data.a2aStatus);
        setError(null);
      } else {
        setError(data.error || "Invalid A2A status response");
      }
    } catch (err: any) {
      console.error('A2A DVN Card fetch error:', err);
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchStatus();
    
    // Add a gentle auto-refresh every 60 seconds
    const interval = setInterval(() => {
      if (!fetchingRef.current) {
        fetchStatus();
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, []); // Empty dependency array

  const getChainName = (chainId: number) => {
    switch (chainId) {
      case 0: return "Bitcoin";
      case 101: return "Solana";
      case 11155111: return "Ethereum Sepolia";
      case 421614: return "Arbitrum Sepolia";
      case 84532: return "Base Sepolia";
      case 11155420: return "Optimism Sepolia";
      case 80002: return "Polygon Amoy";
      default: return `Chain ${chainId}`;
    }
  };

  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp / 1000000).toLocaleTimeString(); // Convert from nanoseconds
  }, []);

  const parsePayload = useCallback((payload: string) => {
    try {
      const data = JSON.parse(payload);
      return {
        action: data.action || 'UNKNOWN',
        txHash: data.txHash || 'N/A',
        chainId: data.chainId || 0,
        status: data.status || 'unknown'
      };
    } catch {
      return { action: 'PARSE_ERROR', txHash: 'N/A', chainId: 0, status: 'error' };
    }
  }, []);

  if (!mounted || (loading && !status)) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-blue-400" size={20} />
          <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        </div>
        <div className="text-slate-400">Loading A2A DVN status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-red-400" size={20} />
          <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        </div>
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-400" size={20} />
          <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        </div>
        <button 
          onClick={fetchStatus}
          disabled={loading}
          className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1 rounded border border-slate-600 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="text-orange-400" size={16} />
            <span className="text-sm font-medium text-slate-300">Pending DVN Messages</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">{status?.pendingDVN || 0}</div>
          <div className="text-xs text-slate-400">A2A transactions in DVN queue</div>
        </div>

        <div className="bg-slate-900/50 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="text-green-400" size={16} />
            <span className="text-sm font-medium text-slate-300">Pending PoS Receipts</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{status?.pendingPoS || 0}</div>
          <div className="text-xs text-slate-400">Receipts awaiting batch processing</div>
        </div>
      </div>

      {/* Recent A2A Messages */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <ArrowRight size={14} />
          Recent A2A DVN Messages
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {status?.recentA2AMessages?.length ? (
            status.recentA2AMessages.map((msg, idx) => {
              const parsed = parsePayload(msg.payload);
              return (
                <div key={idx} className="bg-slate-900/30 rounded p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-slate-300">
                      {getChainName(parsed.chainId)}
                    </span>
                    <span className="text-slate-400">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="text-slate-400 truncate">
                    TX: {parsed.txHash.slice(0, 20)}...
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                      {parsed.action}
                    </span>
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs">
                      {parsed.status}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-slate-400 text-sm">No recent A2A messages</div>
          )}
        </div>
      </div>

      {/* Processing Flow Indicator */}
      <div className="border-t border-slate-700 pt-3">
        <div className="text-xs text-slate-400 mb-2">A2A → DVN → PoS → Batch → Anchor → BTC Flow</div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span className="text-slate-400">A2A Payment</span>
          </div>
          <ArrowRight size={12} className="text-slate-600" />
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-slate-400">DVN Queue</span>
          </div>
          <ArrowRight size={12} className="text-slate-600" />
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-slate-400">PoS Receipt</span>
          </div>
          <ArrowRight size={12} className="text-slate-600" />
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span className="text-slate-400">BTC Anchor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
