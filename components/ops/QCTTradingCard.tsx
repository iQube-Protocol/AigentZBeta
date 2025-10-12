"use client";
import React, { useState, useEffect } from "react";
import { ArrowUpDown, ExternalLink, Copy, RefreshCw } from "lucide-react";
import { getMetaMaskWallet } from "@/services/wallet/metamask";
import { getPhantomWallet } from "@/services/wallet/phantom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Zap,
  Globe,
  AlertCircle,
} from "lucide-react";

interface TradingData {
  price: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  liquidity: number;
}

interface QCTTradingCardProps {
  className?: string;
  title?: React.ReactNode;
}

interface QCTBalance {
  chain: string;
  balance: string;
  decimals: number;
}

export function QCTTradingCard({ className}: QCTTradingCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedChain, setSelectedChain] = useState("sepolia");
  const [tradingAmount, setTradingAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tradingData, setTradingData] = useState<TradingData>({
    price: 0.001,
    volume24h: 125000,
    marketCap: 500000,
    priceChange24h: 5.2,
    liquidity: 75000,
  });

  // Mock data for different chains
  const chainData = {
    sepolia: { name: "Ethereum Sepolia", symbol: "ETH", balance: "100.50" },
    amoy: { name: "Polygon Amoy", symbol: "MATIC", balance: "250.75" },
    arbitrum: { name: "Arbitrum Sepolia", symbol: "ETH", balance: "50.25" },
    base: { name: "Base Sepolia", symbol: "ETH", balance: "75.00" },
    optimism: { name: "Optimism Sepolia", symbol: "ETH", balance: "30.10" },
  };
  const [balances, setBalances] = useState<QCTBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFromChain, setSelectedFromChain] = useState("bitcoin");
  const [selectedToChain, setSelectedToChain] = useState("ethereum");
  const [amount, setAmount] = useState("");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell" | "bridge">(
    "bridge"
  );

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
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC", type: "btc" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH", type: "evm" },
    { id: "polygon", name: "Polygon", symbol: "POL", type: "evm" },
    { id: "arbitrum", name: "Arbitrum", symbol: "ARB", type: "evm" },
    { id: "optimism", name: "Optimism", symbol: "OP", type: "evm" },
    { id: "base", name: "Base", symbol: "BASE", type: "evm" },
    { id: "solana", name: "Solana", symbol: "SOL", type: "solana" },
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

  // Auto-check wallet connections on mount
  useEffect(() => {
    const checkWallets = async () => {
      console.log("[QCT] Checking for wallet connections...");

      // Check MetaMask
      const metamask = getMetaMaskWallet();
      console.log("[QCT] MetaMask installed:", metamask.isInstalled());
      if (metamask.isInstalled()) {
        const accounts = await metamask.getAccounts();
        console.log("[QCT] MetaMask accounts:", accounts);
        if (accounts.length > 0) {
          setEvmAddress(accounts[0]);
          console.log("[QCT] EVM address set:", accounts[0]);
        }
      }

      // Check Phantom
      const phantom = getPhantomWallet();
      console.log(
        "[QCT] Phantom installed:",
        phantom.isInstalled(),
        "connected:",
        phantom.isConnected()
      );
      if (phantom.isInstalled() && phantom.isConnected()) {
        const pk = phantom.getPublicKey();
        console.log("[QCT] Phantom public key:", pk);
        if (pk) {
          setSolanaAddress(pk);
          console.log("[QCT] Solana address set:", pk);
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
      const chain = chains.find((c) => c.id === selectedFromChain);

      if (chain?.type === "evm") {
        const metamask = getMetaMaskWallet();
        const accounts = await metamask.connect();
        if (accounts.length > 0) {
          setEvmAddress(accounts[0]);
          // loadBalances() will be called by useEffect when evmAddress changes
        }
      } else if (chain?.type === "solana") {
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
        await loadBalances();
      } else if (chain?.type === "btc") {
        setError("Bitcoin wallet integration coming soon");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
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
    const chain = chains.find((c) => c.id === chainId);
    if (chain?.type === "evm" && evmAddress) return evmAddress;
    if (chain?.type === "solana" && solanaAddress) return solanaAddress;
    // Fallback to mock for Bitcoin or if wallet not connected
    return "tb1q03256641efc3dd9877560daf26e4d6bb46086a42";
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

      // Use connected wallet address or fallback
      const address =
        evmAddress ||
        solanaAddress ||
        "tb1q03256641efc3dd9877560daf26e4d6bb46086a42";

      const response = await fetch(
        `/api/qct/trading?action=balances&address=${address}`
      );
      const data = await response.json();

      if (data.ok) {
        setBalances(data.balances);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load balances");
    } finally {
      setIsLoading(false);
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
        deadline: Date.now() + 3600000, // 1 hour
      };

      const response = await fetch("/api/qct/trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeRequest),
      });

      const result = await response.json();

      if (result.ok) {
        alert(
          `Trade successful!\nTransaction ID: ${result.transactionId}\nStatus: ${result.status}`
        );
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
    const balance = balances.find((b) => b.chain === chainId);
    return balance ? formatBalance(balance) : "0.0000";
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
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              QCT Trading Interface
            </CardTitle>
            <CardDescription>
              Trade QCT tokens across multiple EVM chains
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Live
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Market Data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="text-lg font-semibold">
              ${tradingData.price.toFixed(6)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">24h Volume</p>
            <p className="text-lg font-semibold">
              ${tradingData.volume24h.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Market Cap</p>
            <p className="text-lg font-semibold">
              ${tradingData.marketCap.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">24h Change</p>
            <p
              className={`text-lg font-semibold ${
                tradingData.priceChange24h >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {tradingData.priceChange24h >= 0 ? "+" : ""}
              {tradingData.priceChange24h}%
            </p>
          </div>
        </div>

        <Separator />

        {/* Chain Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Trading Chain</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
              />
              <Label className="text-sm">Advanced</Label>
            </div>
          </div>

          <Select value={selectedChain} onValueChange={setSelectedChain}>
            <SelectTrigger>
              <SelectValue placeholder="Select chain" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(chainData).map(([key, data]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {data.name}
                    <Badge variant="outline" className="ml-auto">
                      {data.balance} {data.symbol}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-sm text-muted-foreground">
                  Slippage Tolerance
                </Label>
                <Select defaultValue="0.5">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.1">0.1%</SelectItem>
                    <SelectItem value="0.5">0.5%</SelectItem>
                    <SelectItem value="1.0">1.0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  Transaction Deadline
                </Label>
                <Select defaultValue="20">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="20">20 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {chains.map((chain) => (
              <div
                key={chain.id}
                className="flex justify-between items-center bg-slate-800/50 rounded px-2 py-1"
              >
                <span className="text-slate-400">{chain.symbol}:</span>
                <span className="text-slate-300 font-mono">
                  {loading ? '...' : `${getChainBalance(chain.id)} Q¢`}
                  {loading ? "..." : `${getChainBalance(chain.id)} QCT`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

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
          <div className="text-xs font-medium text-slate-300">
            Cross-Chain Trading
          </div>

          {/* Trade Action */}
          <div className="flex gap-1 items-center justify-between">
            <div className="flex gap-1">
              {(["buy", "sell", "bridge"] as const).map((action) => (
                <button
                  key={action}
                  onClick={() => setTradeAction(action)}
                  className={`px-2 py-1 text-xs rounded ${
                    tradeAction === action
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                      : "bg-slate-800/50 text-slate-400 hover:text-slate-300"
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

          {/* Chain Selection with Wallet Badges */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                From Chain
              </label>
              <select
                value={selectedFromChain}
                onChange={(e) => setSelectedFromChain(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
              >
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
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
              <label className="text-xs text-slate-400 block mb-1">
                To Chain
              </label>
              <select
                value={selectedToChain}
                onChange={(e) => setSelectedToChain(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
              >
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
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
          {/* Amount Input */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Amount (QCT)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0000"
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
              />
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
            {loading ? (
              <div className="animate-spin w-3 h-3 border border-blue-300 border-t-transparent rounded-full" />
            ) : (
              <ArrowUpDown size={12} />
            )}
            {tradeAction === "bridge"
              ? `Bridge ${selectedFromChain} → ${selectedToChain}`
              : `${
                  tradeAction.charAt(0).toUpperCase() + tradeAction.slice(1)
                } QCT`}
          </button>

          {/* Quick Actions - Dynamic based on From Chain */}
          <div className="flex gap-1 text-xs">
            {selectedFromChain !== "bitcoin" ? (
              <>
                <button
                  onClick={() => {
                    setTradeAction("bridge");
                    setSelectedToChain("bitcoin");
                  }}
                  className="flex-1 px-2 py-1 bg-orange-500/10 text-orange-300 rounded hover:bg-orange-500/20 border border-orange-500/30"
                >
                  {chains.find((c) => c.id === selectedFromChain)?.symbol} → BTC
                </button>
                <button
                  onClick={() => {
                    setTradeAction("bridge");
                    setSelectedFromChain("bitcoin");
                    setSelectedToChain(selectedFromChain);
                  }}
                  className="flex-1 px-2 py-1 bg-purple-500/10 text-purple-300 rounded hover:bg-purple-500/20 border border-purple-500/30"
                >
                  BTC → {chains.find((c) => c.id === selectedFromChain)?.symbol}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setTradeAction("bridge");
                    setSelectedFromChain("bitcoin");
                    setSelectedToChain("ethereum");
                  }}
                  className="flex-1 px-2 py-1 bg-orange-500/10 text-orange-300 rounded hover:bg-orange-500/20 border border-orange-500/30"
                >
                  BTC → ETH
                </button>
                <button
                  onClick={() => {
                    setTradeAction("bridge");
                    setSelectedFromChain("ethereum");
                    setSelectedToChain("bitcoin");
                  }}
                  className="flex-1 px-2 py-1 bg-purple-500/10 text-purple-300 rounded hover:bg-purple-500/20 border border-purple-500/30"
                >
                  ETH → BTC
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              disabled={isLoading || !tradingAmount}
              className="bg-green-600 hover:bg-green-700"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {isLoading ? "Processing..." : "Buy QCT"}
            </Button>
            <Button
              disabled={isLoading || !tradingAmount}
              variant="destructive"
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              {isLoading ? "Processing..." : "Sell QCT"}
            </Button>
          </div>

          {tradingAmount && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Est. {tradingAmount} QCT</span>
                <span>
                  ≈ $
                  {(parseFloat(tradingAmount) * tradingData.price).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Trading Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              Trades are executed on{" "}
              {chainData[selectedChain as keyof typeof chainData]?.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>Cross-chain bridging available for multi-chain trading</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
