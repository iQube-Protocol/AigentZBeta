import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Globe, Activity, RefreshCw } from 'lucide-react';

interface ChainAnalytics {
  chain: string;
  balance: string;
  decimals: number;
  symbol: string;
  contractAddress?: string;
  usdValue?: number;
}

interface QCTAnalyticsCardProps {
  title: string;
}

function Card({ title, children, actions, className }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6 ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        {children}
      </div>
    </div>
  );
}

export function QCTAnalyticsCard({ title }: QCTAnalyticsCardProps) {
  const [analytics, setAnalytics] = useState<ChainAnalytics[]>([]);
  const [rates, setRates] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chainInfo = {
    bitcoin: { name: 'Bitcoin', symbol: 'BTC', color: 'text-orange-400', icon: '₿' },
    ethereum: { name: 'Ethereum', symbol: 'ETH', color: 'text-blue-400', icon: '⟠' },
    polygon: { name: 'Polygon', symbol: 'POL', color: 'text-purple-400', icon: '⬟' },
    arbitrum: { name: 'Arbitrum', symbol: 'ARB', color: 'text-cyan-400', icon: '◆' },
    optimism: { name: 'Optimism', symbol: 'OP', color: 'text-red-400', icon: '◉' },
    base: { name: 'Base', symbol: 'BASE', color: 'text-blue-300', icon: '◎' },
    solana: { name: 'Solana', symbol: 'SOL', color: 'text-green-400', icon: '◎' },
  };

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load balances (using treasury wallet as example)
      const balanceResponse = await fetch('/api/qct/trading?action=balances&address=0xE9c2A64226a698117986D44473FA73Ed767d3455');
      const balanceData = await balanceResponse.json();
      
      // Load rates
      const ratesResponse = await fetch('/api/qct/trading?action=rates');
      const ratesData = await ratesResponse.json();
      
      if (balanceData.ok && ratesData.ok) {
        setAnalytics(balanceData.balances);
        setRates(ratesData);
      } else {
        setError('Failed to load analytics data');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Format balance for display
  const formatBalance = (balance: ChainAnalytics) => {
    const value = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Calculate USD value
  const calculateUSDValue = (balance: ChainAnalytics) => {
    const qctAmount = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
    const usdValue = qctAmount * (rates?.treasury?.qctUsdcRate || 0.01);
    return usdValue.toFixed(2);
  };

  // Calculate total supply
  const getTotalSupply = () => {
    return analytics.reduce((total, balance) => {
      const qctAmount = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
      return total + qctAmount;
    }, 0);
  };

  // Calculate total USD value
  const getTotalUSDValue = () => {
    return analytics.reduce((total, balance) => {
      const usdValue = parseFloat(calculateUSDValue(balance));
      return total + usdValue;
    }, 0);
  };

  // Get chain distribution percentages with proper ordering
  const getChainDistribution = () => {
    const total = getTotalSupply();
    const chainOrder = ['bitcoin', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'solana'];
    
    const distributionData = analytics.map(balance => {
      const qctAmount = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
      const percentage = total > 0 ? (qctAmount / total) * 100 : 0;
      return {
        ...balance,
        percentage: percentage.toFixed(1)
      };
    });
    
    // Sort according to the desired order
    return distributionData.sort((a, b) => {
      const aIndex = chainOrder.indexOf(a.chain);
      const bIndex = chainOrder.indexOf(b.chain);
      return aIndex - bIndex;
    });
  };

  // Load analytics on mount
  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <Card title={title} actions={
      <button
        onClick={loadAnalytics}
        disabled={loading}
        className="p-1 text-slate-400 hover:text-white disabled:opacity-50"
        aria-label="Refresh"
      >
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
      </button>
    }>
      <div className="space-y-4">
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-800/50 rounded px-2 py-1">
            <div className="text-slate-400 flex items-center gap-1">
              <Globe size={10} />
              Total Supply:
            </div>
            <div className="text-emerald-300 font-mono text-sm">
              {loading ? '...' : `${getTotalSupply().toLocaleString()} Q¢`}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded px-2 py-1">
            <div className="text-slate-400 flex items-center gap-1">
              <TrendingUp size={10} />
              Total Value:
            </div>
            <div className="text-blue-300 font-mono text-sm">
              {loading ? '...' : `$${getTotalUSDValue().toLocaleString()}`}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded px-2 py-1">
            <div className="text-slate-400 flex items-center gap-1">
              <Activity size={10} />
              Active Chains:
            </div>
            <div className="text-purple-300 font-mono text-sm">
              {analytics.length}/7
            </div>
          </div>
          <div className="bg-slate-800/50 rounded px-2 py-1">
            <div className="text-slate-400 flex items-center gap-1">
              <BarChart3 size={10} />
              QCT Rate:
            </div>
            <div className="text-amber-300 font-mono text-sm">
              {loading ? '...' : `$${rates?.treasury?.qctUsdcRate || 0.01}`}
            </div>
          </div>
        </div>

        {/* Chain Distribution */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">Chain Distribution</div>
          <div className="space-y-1">
            {getChainDistribution().map(balance => {
              const info = chainInfo[balance.chain as keyof typeof chainInfo];
              if (!info) return null;
              
              return (
                <div key={balance.chain} className="bg-slate-800/30 rounded px-2 py-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={info.color}>{info.icon}</span>
                      <span className="text-slate-300 text-xs">{info.name}</span>
                      <span className="text-slate-400 text-xs">({balance.percentage}%)</span>
                    </div>
                    <div className="text-slate-300 font-mono text-xs">
                      {formatBalance(balance)} Q¢
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="w-full bg-slate-700 rounded-full h-1">
                      <div 
                        className={`h-1 rounded-full ${info.color.replace('text-', 'bg-')}`}
                        style={{ 
                          width: `${Math.max(parseFloat(balance.percentage), 2)}%`,
                          minWidth: parseFloat(balance.percentage) > 0 ? '2px' : '0px'
                        }}
                      />
                    </div>
                    <span className="text-slate-400 ml-2 min-w-fit">
                      ${calculateUSDValue(balance)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Market Data */}
        {rates && (
          <div className="space-y-2 border-t border-slate-700 pt-3">
            <div className="text-xs font-medium text-slate-300">Market Rates</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="bg-slate-800/50 rounded px-2 py-1">
                <div className="text-slate-400">QCT → USDC:</div>
                <div className="text-emerald-300 font-mono">{rates.rates?.['qct-to-usdc'] || '0.01'}</div>
              </div>
              <div className="bg-slate-800/50 rounded px-2 py-1">
                <div className="text-slate-400">USDC → QCT:</div>
                <div className="text-blue-300 font-mono">{rates.rates?.['usdc-to-qct'] || '100'}</div>
              </div>
              <div className="bg-slate-800/50 rounded px-2 py-1">
                <div className="text-slate-400">BTC → USDC:</div>
                <div className="text-orange-300 font-mono">${parseInt(rates.rates?.['btc-to-usdc'] || '43000').toLocaleString()}</div>
              </div>
              <div className="bg-slate-800/50 rounded px-2 py-1">
                <div className="text-slate-400">SOL → USDC:</div>
                <div className="text-purple-300 font-mono">${rates.rates?.['sol-to-usdc'] || '140'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Supported Trading Pairs */}
        <div className="text-xs border-t border-slate-700 pt-2">
          <div className="text-slate-400 mb-1">Supported Pairs:</div>
          <div className="flex flex-wrap gap-1">
            {rates?.treasury?.supportedPairs?.map((pair: string) => (
              <span key={pair} className="bg-blue-500/10 text-blue-300 px-1 py-0.5 rounded text-xs">
                {pair}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
