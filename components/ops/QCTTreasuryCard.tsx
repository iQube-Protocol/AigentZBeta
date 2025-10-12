import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, ArrowRightLeft } from 'lucide-react';

interface TreasuryBalance {
  chain: string;
  asset: string;
  balance: string;
  decimals: number;
  contractAddress: string;
}

interface TreasuryData {
  usdcBalances: TreasuryBalance[];
  qctUsdcRate: number;
  totalUSDCValue: number;
  treasuryWallet: string;
}

interface QCTTreasuryCardProps {
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

export function QCTTreasuryCard({ title }: QCTTreasuryCardProps) {
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [selectedChain, setSelectedChain] = useState('polygon');

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'polygon', name: 'Polygon', symbol: 'POL' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB' },
    { id: 'optimism', name: 'Optimism', symbol: 'OP' },
    { id: 'base', name: 'Base', symbol: 'BASE' },
    { id: 'solana', name: 'Solana', symbol: 'SOL' },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  ];

  // Load treasury data
  const loadTreasury = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/qct/treasury?action=balances');
      const data = await response.json();
      
      if (data.ok) {
        setTreasury(data.treasury);
      } else {
        setError(data.error || 'Failed to load treasury data');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load treasury');
    } finally {
      setLoading(false);
    }
  };

  // Execute treasury trade
  const executeTrade = async () => {
    try {
      setLoading(true);
      setError(null);

      const tradeRequest = {
        action: tradeType === 'buy' ? 'buy_qct' : 'sell_qct',
        chain: selectedChain,
        amount: tradeAmount,
        slippage: '0.5'
      };

      const response = await fetch('/api/qct/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeRequest)
      });

      const result = await response.json();
      
      if (result.ok) {
        alert(`Treasury ${tradeType} successful!\nTransaction: ${result.transaction.txHash}\nStatus: ${result.transaction.status}`);
        await loadTreasury(); // Refresh treasury data
      } else {
        alert(`Treasury ${tradeType} failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Treasury error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format USDC balance
  const formatUSDC = (balance: string, decimals: number) => {
    const value = parseFloat(balance) / Math.pow(10, decimals);
    return value.toFixed(2);
  };

  // Calculate expected amount
  const getExpectedAmount = () => {
    if (!treasury || !tradeAmount) return '0';
    const amount = parseFloat(tradeAmount);
    if (tradeType === 'buy') {
      // Buying QCT with USDC: 1 USDC = 100 Q¢
      return (amount * 100).toFixed(0);
    } else {
      // Selling QCT for USDC: 100 Q¢ = 1 USDC
      return (amount / 100).toFixed(2);
    }
  };

  // Load treasury on mount
  useEffect(() => {
    loadTreasury();
  }, []);

  return (
    <Card title={title} actions={
      <button
        onClick={loadTreasury}
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

        {/* Treasury Overview */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">Treasury Overview</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/50 rounded px-2 py-1">
              <div className="text-slate-400">QCT Rate:</div>
              <div className="text-emerald-300 font-mono">
                1 Q¢ = {treasury?.qctUsdcRate || 0.01} USDC
              </div>
            </div>
            <div className="bg-slate-800/50 rounded px-2 py-1">
              <div className="text-slate-400">Total USDC:</div>
              <div className="text-blue-300 font-mono">
                ${treasury?.totalUSDCValue.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* USDC Balances by Chain */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">USDC Treasury Balances</div>
          <div className="space-y-1 text-xs">
            {treasury?.usdcBalances.map(balance => (
              <div key={balance.chain} className="flex justify-between items-center bg-slate-800/50 rounded px-2 py-1">
                <span className="text-slate-400 capitalize">{balance.chain}:</span>
                <span className="text-slate-300 font-mono">
                  {loading ? '...' : `$${formatUSDC(balance.balance, balance.decimals)}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Treasury Trading Interface */}
        <div className="space-y-3 border-t border-slate-700 pt-3">
          <div className="text-xs font-medium text-slate-300">Treasury Trading</div>
          
          {/* Trade Type Toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setTradeType('buy')}
              className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${
                tradeType === 'buy'
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
              }`}
            >
              <TrendingUp size={12} />
              Buy QCT
            </button>
            <button
              onClick={() => setTradeType('sell')}
              className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${
                tradeType === 'sell'
                  ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
              }`}
            >
              <TrendingDown size={12} />
              Sell QCT
            </button>
          </div>

          {/* Chain Selection */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Chain</label>
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
            >
              {chains.map(chain => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Amount ({tradeType === 'buy' ? 'USDC' : 'Qc'})
            </label>
            <input
              type="number"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              placeholder={tradeType === 'buy' ? '10.00' : '1000'}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
            />
            {tradeAmount && (
              <div className="mt-1 text-xs text-slate-400">
                Expected: {getExpectedAmount()} {tradeType === 'buy' ? 'Q¢' : 'USDC'}
              </div>
            )}
          </div>

          {/* Execute Trade Button */}
          <button
            onClick={executeTrade}
            disabled={loading || !tradeAmount || parseFloat(tradeAmount) <= 0}
            className="w-full px-3 py-2 bg-blue-500/10 text-blue-300 rounded-md hover:bg-blue-500/20 border border-blue-500/30 text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin w-3 h-3 border border-blue-300 border-t-transparent rounded-full" />
            ) : (
              <ArrowRightLeft size={12} />
            )}
            {tradeType === 'buy' ? 'Buy QCT with USDC' : 'Sell QCT for USDC'}
          </button>

          {/* Quick Trade Buttons */}
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-1 text-xs">
              {['10', '50', '100'].map(amount => (
                <button
                  key={amount}
                  onClick={() => setTradeAmount(parseFloat(amount).toFixed(2))}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                >
                  {tradeType === 'buy' ? `$${amount}` : `${parseInt(amount) * 10}K Qc`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {['1000', '10000', '100000'].map(amount => (
                <button
                  key={amount}
                  onClick={() => setTradeAmount(parseFloat(amount).toFixed(2))}
                  className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-blue-300"
                >
                  {tradeType === 'buy' ? `$${parseInt(amount).toLocaleString()}` : `${parseInt(amount) / 100}M Qc`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Treasury Wallet Info */}
        <div className="text-xs border-t border-slate-700 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Treasury Wallet:</span>
            <span className="text-slate-300 font-mono">
              {treasury?.treasuryWallet ? 
                `${treasury.treasuryWallet.slice(0, 6)}...${treasury.treasuryWallet.slice(-4)}` : 
                '—'
              }
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
