import React, { useState, useEffect } from 'react';
import { ArrowUpDown, RefreshCw, Send } from 'lucide-react';
import { getMetaMaskWallet } from '@/services/wallet/metamask';
import { getPhantomWallet } from '@/services/wallet/phantom';
import { getUnisatWallet } from '@/services/wallet/unisat';
import QCTMintBurnModal from './QCTMintBurnModal';
import QCTSendModal from './QCTSendModal';

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
  const [bitcoinAddress, setBitcoinAddress] = useState<string | null>(null);
  
  // Mint/Burn modal state
  const [showMintBurnModal, setShowMintBurnModal] = useState(false);
  const [mintBurnMode, setMintBurnMode] = useState<'mint' | 'burn'>('mint');
  
  // Send modal state
  const [showSendModal, setShowSendModal] = useState(false);

  const chains = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', type: 'btc' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', type: 'evm' },
    { id: 'polygon', name: 'Polygon', symbol: 'POL', type: 'evm' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', type: 'evm' },
    { id: 'optimism', name: 'Optimism', symbol: 'OP', type: 'evm' },
    { id: 'base', name: 'Base', symbol: 'BASE', type: 'evm' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', type: 'solana' },
  ];

  // Map chain IDs to numeric chainIds
  const getChainId = (chainId: string): number => {
    const chainIdMap: Record<string, number> = {
      bitcoin: 1, // Bitcoin (custom)
      ethereum: 11155111, // Sepolia
      polygon: 80002, // Amoy
      arbitrum: 421614, // Arbitrum Sepolia
      optimism: 11155420, // Optimism Sepolia
      base: 84532, // Base Sepolia
      solana: 103, // Solana Devnet
    };
    return chainIdMap[chainId] || 80002;
  };

  // Get chain decimals for amount conversion
  const getChainDecimals = (chainId: string): number => {
    const decimalsMap: Record<string, number> = {
      bitcoin: 8,
      ethereum: 18,
      polygon: 18,
      arbitrum: 18,
      optimism: 18,
      base: 18,
      solana: 9,
    };
    return decimalsMap[chainId] || 18;
  };

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
      
      // Check Unisat
      const unisat = getUnisatWallet();
      console.log('[QCT] Unisat installed:', unisat.isInstalled(), 'connected:', unisat.isConnected());
      if (unisat.isInstalled() && unisat.isConnected()) {
        const addr = unisat.getAddress();
        console.log('[QCT] Unisat address:', addr);
        if (addr) {
          setBitcoinAddress(addr);
          console.log('[QCT] Bitcoin address set:', addr);
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
          // loadBalances() will be called by useEffect when evmAddress changes
        }
      } else if (chain?.type === 'solana') {
        const phantom = getPhantomWallet();
        const publicKey = await phantom.connect();
        setSolanaAddress(publicKey);
        // loadBalances() will be called by useEffect when solanaAddress changes
      } else if (chain?.type === 'btc') {
        const unisat = getUnisatWallet();
        if (!unisat.isInstalled()) {
          setError('Unisat wallet not installed. Please install from https://unisat.io');
          return;
        }
        const address = await unisat.connect();
        console.log('[QCT] Bitcoin address connected:', address);
        setBitcoinAddress(address);
        // loadBalances() will be called by useEffect when bitcoinAddress changes
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to connect wallet');
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
    } catch {
      // Phantom might not support disconnect, just clear state
      setSolanaAddress(null);
    }
  };

  // Disconnect Bitcoin wallet
  const disconnectBitcoin = async () => {
    try {
      const unisat = getUnisatWallet();
      await unisat.disconnect();
      setBitcoinAddress(null);
      setError(null);
    } catch {
      // Just clear state
      setBitcoinAddress(null);
    }
  };

  // Get address for chain type
  const getAddress = (chainId: string): string => {
    const chain = chains.find(c => c.id === chainId);
    if (chain?.type === 'evm' && evmAddress) return evmAddress;
    if (chain?.type === 'solana' && solanaAddress) return solanaAddress;
    if (chain?.type === 'btc' && bitcoinAddress) return bitcoinAddress;
    // Fallback to mock if wallet not connected
    return '';
  };

  // Load QCT balances - Show actual wallet balances (typically 0.0000)
  const loadBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use connected wallet address or skip if no wallet connected
      const address = evmAddress || solanaAddress || bitcoinAddress;
      
      if (!address) {
        // No wallet connected, show zero balances
        setBalances(chains.map(chain => ({
          chain: chain.id,
          balance: '0',
          decimals: 4,
          symbol: 'Q¢'
        })));
        setLoading(false);
        return;
      }
      
      // For now, show zero balances for connected wallets since we don't have 
      // actual wallet balance API implemented yet (avoiding treasury data confusion)
      setBalances(chains.map(chain => ({
        chain: chain.id,
        balance: '0',
        decimals: 4,
        symbol: 'Q¢'
      })));
      
      setLoading(false);
    } catch (err) {
      setError((err as Error).message || 'Failed to load balances');
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
    } catch (err) {
      alert(`Trade error: ${(err as Error).message}`);
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

  // Load balances when wallets connect/disconnect
  useEffect(() => {
    loadBalances();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evmAddress, solanaAddress, bitcoinAddress]);

  return (
    <Card title={title} actions={
      <IconRefresh 
        onClick={loadBalances} 
        disabled={loading}
      />
    }>
      {/* Balance Overview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-slate-300">Wallet Q¢ Balances</div>
        </div>
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Q¢ Balances */}
        <div className="border-t border-slate-700 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {chains.map(chain => (
              <div key={chain.id} className="flex justify-between items-center bg-slate-800/50 rounded px-2 py-1">
                <span className="text-slate-400">{chain.symbol}:</span>
                <span className="text-slate-300 font-mono">
                  {loading ? '...' : `${getChainBalance(chain.id)} Q¢`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Interface */}
        <div className="space-y-3 border-t border-slate-700 pt-3">
          <div className="text-xs font-medium text-slate-300">Cross-Chain Trading</div>
          
          {/* Trade Action Buttons */}
          <div className="flex gap-1">
            {(['buy', 'sell', 'bridge', 'send'] as const).map(action => (
              <button
                key={action}
                onClick={() => {
                  if (action === 'send') {
                    setShowSendModal(true);
                  } else {
                    setTradeAction(action as 'buy' | 'sell' | 'bridge');
                  }
                }}
                disabled={action === 'send' && !evmAddress && !solanaAddress && !bitcoinAddress}
                className={`flex-1 px-2 py-1 text-xs rounded ${
                  action === 'send'
                    ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20'
                    : tradeAction === action
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {action === 'send' && <Send className="inline w-3 h-3 mr-1" />}
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </button>
            ))}
          </div>

          {/* Chain Selection with Wallet Badges */}
          <div className="grid grid-cols-2 gap-2 mt-4">
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
              {/* Show wallet badge for From chain */}
              <div className="mt-3">
                {chains.find(c => c.id === selectedFromChain)?.type === 'evm' && evmAddress && (
                  <button
                    onClick={disconnectEVM}
                    className="w-full px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors"
                    title={`${evmAddress}\n\nClick to disconnect`}
                  >
                    🔗 {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                  </button>
                )}
                {chains.find(c => c.id === selectedFromChain)?.type === 'solana' && solanaAddress && (
                  <button
                    onClick={disconnectSolana}
                    className="w-full px-2 py-0.5 text-xs bg-purple-500/10 text-purple-300 rounded border border-purple-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors"
                    title={`${solanaAddress}\n\nClick to disconnect`}
                  >
                    ◎ {solanaAddress.slice(0, 6)}...{solanaAddress.slice(-4)}
                  </button>
                )}
                {chains.find(c => c.id === selectedFromChain)?.type === 'btc' && bitcoinAddress && (
                  <button
                    onClick={disconnectBitcoin}
                    className="w-full px-2 py-0.5 text-xs bg-orange-500/10 text-orange-300 rounded border border-orange-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors"
                    title={`${bitcoinAddress}\n\nClick to disconnect`}
                  >
                    ₿ {bitcoinAddress.slice(0, 6)}...{bitcoinAddress.slice(-4)}
                  </button>
                )}
                {!getAddress(selectedFromChain) && (
                  <button
                    onClick={connectWallet}
                    disabled={loading}
                    className="w-full px-2 py-0.5 text-xs bg-blue-500/10 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-50"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
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
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700 my-4"></div>

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

        {/* Quick Amount Buttons */}
        <div className="space-y-1 pt-3 pb-6">
          <div className="text-xs text-slate-400 mb-2">Quick Amounts</div>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {['1000', '5000', '10000'].map(qctAmount => (
              <button
                key={qctAmount}
                onClick={() => setAmount(parseInt(qctAmount).toFixed(2))}
                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 truncate"
                title={`Set amount to ${parseInt(qctAmount).toLocaleString()} Q¢`}
              >
                {parseInt(qctAmount).toLocaleString()} Q¢
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {['100000', '1000000', '10000000'].map(qctAmount => (
              <button
                key={qctAmount}
                onClick={() => setAmount(parseInt(qctAmount).toFixed(2))}
                className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 truncate"
                title={`Set amount to ${parseInt(qctAmount).toLocaleString()} Q¢`}
              >
                {parseInt(qctAmount) >= 1000000 ? `${parseInt(qctAmount) / 1000000}M` : `${parseInt(qctAmount) / 1000}K`} Q¢
              </button>
            ))}
          </div>
        </div>

        {/* Mint/Burn Actions */}
        <div className="flex gap-2 text-xs border-t border-slate-700 pt-4 mt-8">
          <button
            onClick={() => {
              setMintBurnMode('mint');
              setShowMintBurnModal(true);
            }}
            disabled={!evmAddress && !solanaAddress && !bitcoinAddress}
            className="flex-1 px-3 py-2 bg-green-500/10 text-green-300 rounded hover:bg-green-500/20 border border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!evmAddress && !solanaAddress && !bitcoinAddress ? 'Connect a wallet to mint QCT' : 'Mint QCT tokens'}
          >
            🪙 Mint QCT
          </button>
          <button
            onClick={() => {
              setMintBurnMode('burn');
              setShowMintBurnModal(true);
            }}
            disabled={!evmAddress && !solanaAddress && !bitcoinAddress}
            className="flex-1 px-3 py-2 bg-red-500/10 text-red-300 rounded hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!evmAddress && !solanaAddress && !bitcoinAddress ? 'Connect a wallet to burn QCT' : 'Burn QCT tokens'}
          >
            🔥 Burn QCT
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs border-t border-slate-700 pt-4 mt-8">
          <span className="text-slate-400">Status:</span>
          <span className={loading ? "text-amber-400" : "text-emerald-400"}>
            {loading ? "Loading..." : "Ready"}
          </span>
        </div>
      </div>

      {/* Mint/Burn Modal */}
      <QCTMintBurnModal
        isOpen={showMintBurnModal}
        onClose={() => setShowMintBurnModal(false)}
        mode={mintBurnMode}
        chainId={getChainId(selectedFromChain)}
        walletAddress={getAddress(selectedFromChain) || ''}
      />

      {/* Send Modal */}
      <QCTSendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        fromChain={selectedFromChain}
        fromChainType={(chains.find(c => c.id === selectedFromChain)?.type || 'evm') as 'evm' | 'solana' | 'btc'}
        walletAddress={getAddress(selectedFromChain)}
        balance={getChainBalance(selectedFromChain)}
      />
    </Card>
  );
}
