import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ExternalLink, Copy, RefreshCw } from 'lucide-react';

interface QCTBalance {
  chain: string;
  balance: string;
  decimals: number;
  symbol: string;
  contractAddress?: string;
  runesId?: string;
}

interface QCTTradingCardProps {
  title: string;
}

// Simple Card wrapper to match the ops page style
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

function IconRefresh({ onClick, disabled, className }: { onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      aria-label="Refresh"
    >
      <RefreshCw size={16} className={disabled ? 'animate-spin' : ''} />
    </button>
  );
}

export function QCTTradingCard({ title }: QCTTradingCardProps) {
  const [balances, setBalances] = useState<QCTBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFromChain, setSelectedFromChain] = useState('bitcoin');
  const [selectedToChain, setSelectedToChain] = useState('ethereum');
  const [amount, setAmount] = useState('');
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell' | 'bridge'>('bridge');

  const chains = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
    { id: 'optimism', name: 'Optimism', symbol: 'ETH' },
    { id: 'base', name: 'Base', symbol: 'ETH' },
  ];

  // Load QCT balances
  const loadBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock address for demo - in production, get from wallet
      const mockAddress = 'tb1q03256641efc3dd9877560daf26e4d6bb46086a42';
      
      const response = await fetch(`/api/qct/trading?action=balances&address=${mockAddress}`);
      const data = await response.json();
      
      if (data.ok) {
        setBalances(data.balances);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  // Execute QCT trade
  const executeTrade = async () => {
    try {
      setLoading(true);
      setError(null);

      const tradeRequest = {
        action: tradeAction,
        fromChain: selectedFromChain,
        toChain: selectedToChain,
        amount: amount,
        fromAddress: 'tb1q03256641efc3dd9877560daf26e4d6bb46086a42', // Mock address
        toAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', // Mock address
        slippage: 1.0,
        deadline: Date.now() + 3600000 // 1 hour
      };

      const response = await fetch('/api/qct/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeRequest)
      });

      const result = await response.json();
      
      if (result.ok) {
        alert(`Trade successful!\nTransaction ID: ${result.transactionId}\nStatus: ${result.status}`);
        await loadBalances(); // Refresh balances
      } else {
        alert(`Trade failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Trade error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format balance for display
  const formatBalance = (balance: QCTBalance) => {
    const value = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
    return value.toFixed(4);
  };

  // Get balance for specific chain
  const getChainBalance = (chainId: string) => {
    const balance = balances.find(b => b.chain === chainId);
    return balance ? formatBalance(balance) : '0.0000';
  };

  useEffect(() => {
    loadBalances();
  }, []);

  return (
    <Card title={title} actions={
      <IconRefresh 
        onClick={loadBalances} 
        disabled={loading} 
        className={loading ? 'animate-spin' : ''} 
      />
    }>
      <div className="space-y-4">
        {/* QCT Balances */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">QCT Balances</div>
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {chains.map(chain => (
              <div key={chain.id} className="flex justify-between items-center bg-slate-800/50 rounded px-2 py-1">
                <span className="text-slate-400">{chain.name}:</span>
                <span className="text-slate-300 font-mono">
                  {loading ? '...' : `${getChainBalance(chain.id)} QCT`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Interface */}
        <div className="space-y-3 border-t border-slate-700 pt-3">
          <div className="text-xs font-medium text-slate-300">Cross-Chain Trading</div>
          
          {/* Trade Action */}
          <div className="flex gap-1">
            {(['buy', 'sell', 'bridge'] as const).map(action => (
              <button
                key={action}
                onClick={() => setTradeAction(action)}
                className={`px-2 py-1 text-xs rounded ${
                  tradeAction === action
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
                }`}
              >
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </button>
            ))}
          </div>

          {/* Chain Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">From Chain</label>
              <select
                value={selectedFromChain}
                onChange={(e) => setSelectedFromChain(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
              >
                {chains.map(chain => (
                  <option key={chain.id} value={chain.id}>{chain.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">To Chain</label>
              <select
                value={selectedToChain}
                onChange={(e) => setSelectedToChain(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
              >
                {chains.map(chain => (
                  <option key={chain.id} value={chain.id}>{chain.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Amount (QCT)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0000"
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
              />
              <button
                onClick={() => setAmount(getChainBalance(selectedFromChain))}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              >
                Max
              </button>
            </div>
          </div>

          {/* Trade Button */}
          <button
            onClick={executeTrade}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full px-3 py-2 bg-blue-500/10 text-blue-300 rounded-md hover:bg-blue-500/20 border border-blue-500/30 text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin w-3 h-3 border border-blue-300 border-t-transparent rounded-full" />
            ) : (
              <ArrowUpDown size={12} />
            )}
            {tradeAction === 'bridge' 
              ? `Bridge ${selectedFromChain} → ${selectedToChain}`
              : `${tradeAction.charAt(0).toUpperCase() + tradeAction.slice(1)} QCT`
            }
          </button>

          {/* Quick Actions */}
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => {
                setTradeAction('bridge');
                setSelectedFromChain('bitcoin');
                setSelectedToChain('ethereum');
              }}
              className="flex-1 px-2 py-1 bg-orange-500/10 text-orange-300 rounded hover:bg-orange-500/20 border border-orange-500/30"
            >
              BTC → ETH
            </button>
            <button
              onClick={() => {
                setTradeAction('bridge');
                setSelectedFromChain('ethereum');
                setSelectedToChain('bitcoin');
              }}
              className="flex-1 px-2 py-1 bg-purple-500/10 text-purple-300 rounded hover:bg-purple-500/20 border border-purple-500/30"
            >
              ETH → BTC
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs border-t border-slate-700 pt-2">
          <span className="text-slate-400">Status:</span>
          <span className={loading ? "text-amber-400" : "text-emerald-400"}>
            {loading ? "Loading..." : "Ready"}
          </span>
        </div>
      </div>
    </Card>
  );
}
