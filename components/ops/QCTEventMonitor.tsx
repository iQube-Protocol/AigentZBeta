// QCT Event Listener Monitor - UI component for managing transaction listeners
"use client";

import { useState } from 'react';
import { Play, Square, RotateCcw, RefreshCw, Activity, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useEventListener } from '@/hooks/qct/useEventListener';
import ChainTransactionHistoryModal from './ChainTransactionHistoryModal';

interface QCTEventMonitorProps {
  className?: string;
}

export function QCTEventMonitor({ className = '' }: QCTEventMonitorProps) {
  const {
    status,
    loading,
    error,
    start,
    stop,
    restart,
    refresh,
    isRunning,
    totalChains,
    enabledChains,
    getRunningChains,
    getErrorChains,
    getTotalEvents,
    getTotalErrors,
  } = useEventListener(10000); // Refresh every 10 seconds

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showChainDetails, setShowChainDetails] = useState(false);
  const [selectedChain, setSelectedChain] = useState<{ id: string; name: string } | null>(null);

  const handleStart = async () => {
    try {
      setActionLoading('start');
      await start();
    } catch (error) {
      console.error('Failed to start listener:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading('stop');
      await stop();
    } catch (error) {
      console.error('Failed to stop listener:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    try {
      setActionLoading('restart');
      await restart();
    } catch (error) {
      console.error('Failed to restart listener:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatUptime = (uptime: number) => {
    if (uptime < 60000) return `${Math.floor(uptime / 1000)}s`;
    if (uptime < 3600000) return `${Math.floor(uptime / 60000)}m`;
    if (uptime < 86400000) return `${Math.floor(uptime / 3600000)}h`;
    return `${Math.floor(uptime / 86400000)}d`;
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '—';
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const getChainIcon = (type: string) => {
    switch (type) {
      case 'evm': return '🔗';
      case 'solana': return '◎';
      case 'bitcoin': return '₿';
      default: return '⚡';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      case 'stopped': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      case 'stopped': return <Square className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold text-slate-100">iQube & QCT Event Register</h2>
            <p className="text-sm text-slate-400">Comprehensive registry of all iQube and QCT transactions across 7 chains</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Status</div>
          <div className={`flex items-center gap-2 ${isRunning ? 'text-emerald-400' : 'text-slate-400'}`}>
            {isRunning ? <CheckCircle className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            <span className="font-semibold">{isRunning ? 'Running' : 'Stopped'}</span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Chains</div>
          <div className="text-white font-semibold">
            {getRunningChains()}/{enabledChains}
            {getErrorChains() > 0 && (
              <span className="text-red-400 ml-1">({getErrorChains()} errors)</span>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Events Processed</div>
          <div className="text-white font-semibold">
            {getTotalEvents().toLocaleString()}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Total Errors</div>
          <div className={`font-semibold ${getTotalErrors() > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {getTotalErrors().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleStart}
          disabled={isRunning || actionLoading === 'start'}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-300 rounded-lg hover:bg-emerald-500/20 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          {actionLoading === 'start' ? 'Starting...' : 'Start Listener'}
        </button>

        <button
          onClick={handleStop}
          disabled={!isRunning || actionLoading === 'stop'}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-300 rounded-lg hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-4 h-4" />
          {actionLoading === 'stop' ? 'Stopping...' : 'Stop Listener'}
        </button>

        <button
          onClick={handleRestart}
          disabled={actionLoading === 'restart'}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-300 rounded-lg hover:bg-amber-500/20 border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
        </button>
      </div>

      {/* Chain Status Details */}
      {status && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Chain Status</h3>
            <button
              onClick={() => setShowChainDetails(!showChainDetails)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              {showChainDetails ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show Details
                </>
              )}
            </button>
          </div>

          {/* Collapsed Summary */}
          {!showChainDetails && (
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">
                    {getRunningChains()}/{enabledChains} chains running
                  </span>
                  {getErrorChains() > 0 && (
                    <span className="text-red-400">
                      {getErrorChains()} errors
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{getTotalEvents().toLocaleString()} events</span>
                  <span>Click "Show Details" for per-chain stats • Click any chain to view transaction history</span>
                </div>
              </div>
            </div>
          )}
          
          {showChainDetails && status.stats.map((stat) => {
            const chain = status.chains.find(c => c.chainId === stat.chainId);
            if (!chain) return null;

            return (
              <button
                key={stat.chainId}
                onClick={() => setSelectedChain({ id: stat.chainId, name: chain.name })}
                className="w-full bg-slate-800/30 hover:bg-slate-800/50 rounded-lg p-3 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getChainIcon(chain.type)}</span>
                    <span className="text-sm font-medium text-slate-200">{chain.name}</span>
                    <div className={`flex items-center gap-1 ${getStatusColor(stat.status)}`}>
                      {getStatusIcon(stat.status)}
                      <span className="text-xs capitalize">{stat.status}</span>
                    </div>
                  </div>
                  
                  {stat.status === 'running' && stat.uptime > 0 && (
                    <span className="text-xs text-slate-400">
                      Up {formatUptime(stat.uptime)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Block:</span>
                    <span className="text-slate-300 ml-1">{stat.lastBlock.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Events:</span>
                    <span className="text-slate-300 ml-1">{stat.eventsProcessed.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Errors:</span>
                    <span className={`ml-1 ${stat.errors > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                      {stat.errors.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Last Event:</span>
                    <span className="text-slate-300 ml-1">{formatTimestamp(stat.lastEventAt)}</span>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Info - Only show in expanded view */}
          {showChainDetails && (
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="text-blue-300 text-sm">
                <strong>P2P Transfer Infrastructure:</strong> This listener monitors all iQube and QCT transactions (mint, burn, transfer) across your 7-chain ecosystem. Events are automatically submitted to the DVN queue for cross-chain synchronization, enabling direct peer-to-peer transfers without exchanges or intermediaries.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction History Modal */}
      {selectedChain && (
        <ChainTransactionHistoryModal
          chainId={selectedChain.id}
          chainName={selectedChain.name}
          isOpen={!!selectedChain}
          onClose={() => setSelectedChain(null)}
        />
      )}
    </div>
  );
}
