import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { getMetaMaskWallet } from '@/services/wallet/metamask';
import { getPhantomWallet } from '@/services/wallet/phantom';

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
  
  // Wallet states (hidden from UI, auto-connect)
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);

  const chains = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', type: 'btc' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', type: 'evm' },
    { id: 'polygon', name: 'Polygon', symbol: 'POL', type: 'evm' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', type: 'evm' },
    { id: 'optimism', name: 'Optimism', symbol: 'OP', type: 'evm' },
    { id: 'base', name: 'Base', symbol: 'BASE', type: 'evm' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', type: 'solana' },
  ];

  // Auto-check wallet connections on mount
  useEffect(() => {
    const checkWallets = async () => {
      console.log('[QCT] Checking for wallet connections...');
      
      // Check MetaMask
      const metamask = getMetaMaskWallet();
      console.log('[QCT] MetaMask installed:', metamask.isInstalled());
      if (metamask.isInstalled()) {
        const accounts = await metamask.getAccounts();
        console.log('[QCT] MetaMask accounts:', accounts);
        if (accounts.length > 0) {
          setEvmAddress(accounts[0]);
          console.log('[QCT] EVM address set:', accounts[0]);
        }
      }
      
      // Check Phantom
      const phantom = getPhantomWallet();
      console.log('[QCT] Phantom installed:', phantom.isInstalled(), 'connected:', phantom.isConnected());
      if (phantom.isInstalled() && phantom.isConnected()) {
        const pk = phantom.getPublicKey();
        console.log('[QCT] Phantom public key:', pk);
        if (pk) {
          setSolanaAddress(pk);
          console.log('[QCT] Solana address set:', pk);
        }
      }
    };
    checkWallets();
  }, []);

  // Connect wallet based on selected From Chain
  const connectWallet = async () => {
    try {
      setError(null);
      const chain = chains.find(c => c.id === selectedFromChain);
      
      if (chain?.type === 'evm') {
        const metamask = getMetaMaskWallet();
        const accounts = await metamask.connect();
        if (accounts.length > 0) {
          setEvmAddress(accounts[0]);
          await loadBalances();
        }
      } else if (chain?.type === 'solana') {
        const phantom = getPhantomWallet();
        const publicKey = await phantom.connect();
        setSolanaAddress(publicKey);
        await loadBalances();
      } else if (chain?.type === 'btc') {
        setError('Bitcoin wallet integration coming soon');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  };

  // Disconnect EVM wallet
  const disconnectEVM = () => {
    setEvmAddress(null);
    setError(null);
  };

  // Disconnect Solana wallet
  const disconnectSolana = async () => {
    try {
      const phantom = getPhantomWallet();
      await phantom.disconnect();
      setSolanaAddress(null);
      setError(null);
    } catch (err: any) {
      // Phantom might not support disconnect, just clear state
      setSolanaAddress(null);
    }
  };

  // Get address for chain type
  const getAddress = (chainId: string): string => {
    const chain = chains.find(c => c.id === chainId);
    if (chain?.type === 'evm' && evmAddress) return evmAddress;
    if (chain?.type === 'solana' && solanaAddress) return solanaAddress;
    // Fallback to mock for Bitcoin or if wallet not connected
    return 'tb1q03256641efc3dd9877560daf26e4d6bb46086a42';
  };

  // Load QCT balances
  const loadBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use connected wallet address or fallback
      const address = evmAddress || solanaAddress || 'tb1q03256641efc3dd9877560daf26e4d6bb46086a42';
      
      const response = await fetch(`/api/qct/trading?action=balances&address=${address}`);
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
        fromAddress: getAddress(selectedFromChain),
        toAddress: getAddress(selectedToChain),
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
                <span className="text-slate-400">{chain.symbol}:</span>
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
          <div className="flex gap-1 items-center justify-between">
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
            {/* Wallet Connection */}
            <div className="flex gap-1 items-center">
              {!evmAddress && !solanaAddress ? (
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-blue-500/10 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-50"
                >
                  Connect Wallet
                </button>
              ) : (
                <>
                  {evmAddress && (
                    <button
                      onClick={disconnectEVM}
                      className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors cursor-pointer"
                      title={`${evmAddress}\n\nClick to disconnect`}
                    >
                      🔗 EVM
                    </button>
                  )}
                  {solanaAddress && (
                    <button
                      onClick={disconnectSolana}
                      className="px-2 py-1 text-xs bg-purple-500/10 text-purple-300 rounded border border-purple-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors cursor-pointer"
                      title={`${solanaAddress}\n\nClick to disconnect`}
                    >
                      ◎ SOL
                    </button>
                  )}
                </>
              )}
            </div>
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

          {/* Quick Actions - Dynamic based on From Chain */}
          <div className="flex gap-1 text-xs">
            {selectedFromChain !== 'bitcoin' ? (
              <>
                <button
                  onClick={() => {
                    setTradeAction('bridge');
                    setSelectedToChain('bitcoin');
                  }}
                  className="flex-1 px-2 py-1 bg-orange-500/10 text-orange-300 rounded hover:bg-orange-500/20 border border-orange-500/30"
                >
                  {chains.find(c => c.id === selectedFromChain)?.symbol} → BTC
                </button>
                <button
                  onClick={() => {
                    setTradeAction('bridge');
                    setSelectedFromChain('bitcoin');
                    setSelectedToChain(selectedFromChain);
                  }}
                  className="flex-1 px-2 py-1 bg-purple-500/10 text-purple-300 rounded hover:bg-purple-500/20 border border-purple-500/30"
                >
                  BTC → {chains.find(c => c.id === selectedFromChain)?.symbol}
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
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
