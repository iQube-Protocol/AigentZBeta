"use client";
import React, { useState, useEffect } from "react";
import { RefreshCw, Fuel, Zap, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ChainBalance {
  chainId: number;
  chainName: string;
  balance: string;
  hasGasForTx: boolean;
  status: 'good' | 'low' | 'critical';
  error?: string;
}

interface CanisterStatus {
  canisterId: string;
  name: string;
  cycles: string;
  status: 'good' | 'low' | 'critical';
  error?: string;
}

function Card({ title, children, actions, className }: { 
  title: React.ReactNode; 
  children?: React.ReactNode; 
  actions?: React.ReactNode; 
  className?: string 
}) {
  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6 ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-4 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function StatusIndicator({ status, size = 12 }: { status: 'good' | 'low' | 'critical'; size?: number }) {
  switch (status) {
    case 'good':
      return <CheckCircle size={size} className="text-emerald-400" />;
    case 'low':
      return <AlertTriangle size={size} className="text-amber-400" />;
    case 'critical':
      return <XCircle size={size} className="text-red-400" />;
  }
}

function getStatusColor(status: 'good' | 'low' | 'critical'): string {
  switch (status) {
    case 'good': return 'text-emerald-400';
    case 'low': return 'text-amber-400';
    case 'critical': return 'text-red-400';
  }
}

export function FundingStatusCard({ title }: { title: string }) {
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([]);
  const [canisterStatuses, setCanisterStatuses] = useState<CanisterStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const chains = [
    { chainId: 84532, name: 'BASE', symbol: 'BASE', thresholds: { critical: 0.001, low: 0.003 } },
    { chainId: 11155420, name: 'OPT', symbol: 'OPT', thresholds: { critical: 0.001, low: 0.003 } },
    { chainId: 421614, name: 'ARB', symbol: 'ARB', thresholds: { critical: 0.002, low: 0.005 } },
    { chainId: 80002, name: 'POL', symbol: 'POL', thresholds: { critical: 0.01, low: 0.05 } },
    { chainId: 11155111, name: 'ETH', symbol: 'ETH', thresholds: { critical: 0.001, low: 0.003 } },
    // Non-EVM chains (inactive for now)
    { chainId: 0, name: 'BTC', symbol: 'BTC', thresholds: { critical: 0, low: 0 }, inactive: true },
    { chainId: 0, name: 'SOL', symbol: 'SOL', thresholds: { critical: 0, low: 0 }, inactive: true },
    // Q¢ balance for operational currency
    { chainId: -1, name: 'Q¢', symbol: 'Q¢', thresholds: { critical: 100, low: 500 }, isQCent: true }
  ];

  const canisters = [
    { canisterId: 'sp5ye-2qaaa-aaaao-qkqla-cai', name: 'DVN' },
    { canisterId: 'zdjf3-2qaaa-aaaas-qck4q-cai', name: 'RQH' }
  ];

  const fetchChainBalances = async () => {
    const chainPromises = chains.map(async (chain) => {
      // Handle inactive chains (BTC, SOL)
      if ((chain as any).inactive) {
        return {
          chainId: chain.chainId,
          chainName: chain.name,
          balance: 'N/A',
          hasGasForTx: false,
          status: 'good' as const,
          error: 'Not yet implemented'
        };
      }

      // Handle Q¢ balance
      if ((chain as any).isQCent) {
        try {
          const response = await fetch(`/api/admin/debug/check-qct-balance?agentId=aigent-z`, {
            cache: 'no-store'
          });
          
          if (response.ok) {
            const data = await response.json();
            const balance = parseFloat(data.totalQct || '0');
            
            let status: 'good' | 'low' | 'critical' = 'good';
            if (balance <= chain.thresholds.critical) {
              status = 'critical';
            } else if (balance <= chain.thresholds.low) {
              status = 'low';
            }
            
            return {
              chainId: chain.chainId,
              chainName: chain.name,
              balance: data.totalQct || '0',
              hasGasForTx: balance > chain.thresholds.critical,
              status
            };
          } else {
            return {
              chainId: chain.chainId,
              chainName: chain.name,
              balance: '0',
              hasGasForTx: false,
              status: 'critical' as const,
              error: 'Failed to fetch Q¢ balance'
            };
          }
        } catch (error: any) {
          return {
            chainId: chain.chainId,
            chainName: chain.name,
            balance: '0',
            hasGasForTx: false,
            status: 'critical' as const,
            error: error.message || 'Q¢ balance error'
          };
        }
      }

      try {
        const response = await fetch(`/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=${chain.chainId}`, {
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          const balance = parseFloat(data.humanEthBalance || '0');
          
          let status: 'good' | 'low' | 'critical' = 'good';
          if (balance <= chain.thresholds.critical) {
            status = 'critical';
          } else if (balance <= chain.thresholds.low) {
            status = 'low';
          }
          
          return {
            chainId: chain.chainId,
            chainName: chain.name,
            balance: data.humanEthBalance || '0',
            hasGasForTx: data.hasGasForTx || false,
            status
          };
        } else {
          return {
            chainId: chain.chainId,
            chainName: chain.name,
            balance: '0',
            hasGasForTx: false,
            status: 'critical' as const,
            error: 'Failed to fetch balance'
          };
        }
      } catch (error: any) {
        return {
          chainId: chain.chainId,
          chainName: chain.name,
          balance: '0',
          hasGasForTx: false,
          status: 'critical' as const,
          error: error.message || 'Network error'
        };
      }
    });

    const results = await Promise.allSettled(chainPromises);
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        chainId: 0,
        chainName: 'Unknown',
        balance: '0',
        hasGasForTx: false,
        status: 'critical' as const,
        error: 'Promise failed'
      }
    );
  };

  const fetchCanisterStatuses = async () => {
    const statuses: CanisterStatus[] = [];
    
    for (const canister of canisters) {
      try {
        const response = await fetch(`/api/admin/debug/check-canister-cycles?canisterId=${canister.canisterId}`, {
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          statuses.push({
            canisterId: canister.canisterId,
            name: data.name || canister.name,
            cycles: data.cycles || 'Unknown',
            status: data.status || 'good'
          });
        } else {
          const errorData = await response.json();
          statuses.push({
            canisterId: canister.canisterId,
            name: canister.name,
            cycles: 'Unknown',
            status: 'critical',
            error: errorData.error || 'Failed to fetch'
          });
        }
      } catch (error: any) {
        statuses.push({
          canisterId: canister.canisterId,
          name: canister.name,
          cycles: 'Unknown',
          status: 'critical',
          error: error.message || 'Network error'
        });
      }
    }
    
    return statuses;
  };

  const refreshData = async () => {
    if (loading) return; // Prevent multiple simultaneous refreshes
    
    setLoading(true);
    try {
      const [chains, canisters] = await Promise.all([
        fetchChainBalances(),
        fetchCanisterStatuses()
      ]);
      
      setChainBalances(chains);
      setCanisterStatuses(canisters);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to refresh funding status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(refreshData, 120000);
    return () => clearInterval(interval);
  }, []);

  const overallChainStatus = chainBalances.length > 0 ? 
    chainBalances.some(c => c.status === 'critical') ? 'critical' :
    chainBalances.some(c => c.status === 'low') ? 'low' : 'good' : 'good';

  const overallCanisterStatus = canisterStatuses.length > 0 ?
    canisterStatuses.some(c => c.status === 'critical') ? 'critical' :
    canisterStatuses.some(c => c.status === 'low') ? 'low' : 'good' : 'good';

  return (
    <Card 
      title={
        <div className="flex items-center justify-between w-full cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center gap-2">
            <Fuel size={20} className="text-emerald-400" />
            Ops Gas Status
          </div>
          <div className="ml-4">
            {isExpanded ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </div>
        </div>
      } 
      actions={
        <button 
          onClick={(e) => {
            e.stopPropagation();
            refreshData();
          }} 
          disabled={loading}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      {/* Collapsed Summary View */}
      {!isExpanded && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-blue-400" />
              <span className="font-medium text-slate-200">Aigent Z Native Chain Balances</span>
            </div>
            <StatusIndicator status={overallChainStatus} />
          </div>
          
          <div className="flex items-center justify-between border-t border-slate-700 pt-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
              <span className="font-medium text-slate-200">ICP Cycles Balances</span>
            </div>
            <StatusIndicator status={overallCanisterStatus} />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-700 pt-3">
            <div className="flex items-center gap-4">
              <span>Chains: {chainBalances.filter(c => c.status === 'good').length}/{chainBalances.length} Good</span>
              <span>Canisters: {canisterStatuses.filter(c => c.status === 'good').length}/{canisterStatuses.length} Good</span>
            </div>
            <div>
              {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Never updated'}
            </div>
          </div>
        </div>
      )}

      {/* Expanded Detailed View */}
      {isExpanded && (
        <div className="space-y-4">
          {/* Chain Balances */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-blue-400" />
                <span className="font-medium text-slate-200">Aigent Z Native Chain Balances</span>
              </div>
              <StatusIndicator status={overallChainStatus} />
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              {chainBalances.map((chain) => (
                <div 
                  key={`${chain.chainId}-${chain.chainName}`}
                  className={`p-1.5 rounded border text-center ${
                    chain.balance === 'N/A' ? 'border-blue-500/30 bg-blue-500/5' :
                    chain.status === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    chain.status === 'low' ? 'border-amber-500/30 bg-amber-500/5' :
                    'border-emerald-500/30 bg-emerald-500/5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-300">{chain.chainName}</span>
                    <StatusIndicator status={chain.status} size={8} />
                  </div>
                  <div className={`text-xs font-mono ${chain.balance === 'N/A' ? 'text-blue-400' : getStatusColor(chain.status)}`}>
                    {chain.balance === 'N/A' ? 'N/A' : 
                     chain.error ? 'Error' : 
                     chain.chainName === 'Q¢' ? `${parseFloat(chain.balance).toFixed(0)}` :
                     `${parseFloat(chain.balance).toFixed(3)}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ICP Canister Cycles */}
          <div className="space-y-3 border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <span className="font-medium text-slate-200">ICP Cycles Balances</span>
              </div>
              <StatusIndicator status={overallCanisterStatus} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {canisterStatuses.map((canister) => (
                <div 
                  key={canister.canisterId}
                  className={`p-1.5 rounded border text-center ${
                    canister.status === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    canister.status === 'low' ? 'border-amber-500/30 bg-amber-500/5' :
                    'border-emerald-500/30 bg-emerald-500/5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-300">{canister.name}</span>
                    <StatusIndicator status={canister.status} size={8} />
                  </div>
                  <div className={`text-xs font-mono ${getStatusColor(canister.status)}`}>
                    {canister.cycles}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary & Last Update */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-700 pt-3">
            <div className="flex items-center gap-4">
              <span>Chains: {chainBalances.filter(c => c.status === 'good').length}/{chainBalances.length} Good</span>
              <span>Canisters: {canisterStatuses.filter(c => c.status === 'good').length}/{canisterStatuses.length} Good</span>
            </div>
            <div>
              {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Never updated'}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
