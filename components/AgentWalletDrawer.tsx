"use client";
import React, { useState, useCallback, useEffect } from "react";
import { X, Copy, ExternalLink, Send, Download, CheckCircle, Wallet, ArrowUpRight, ArrowDownLeft, Shield, Circle } from "lucide-react";
import { getAgentConfig, getAgentSupportedChains, chainConfigs } from "@/app/data/agentConfig";
// Removed useBalances import - using direct balance fetching instead

interface AgentWalletDrawerProps {
  open: boolean;
  onClose: () => void;
  agent: { id: string; name: string };
}

interface TransactionState {
  type: "request" | "send" | "verify" | null;
  chain: string | null;
  asset: "QCT" | "USDC" | null;
  amount: string;
  recipient: string;
  txHash: string;
  status: "pending" | "completed" | "failed" | null;
}

export default function AgentWalletDrawer({ open, onClose, agent }: AgentWalletDrawerProps) {
  const [txState, setTxState] = useState<TransactionState>({
    type: null,
    chain: null,
    asset: "QCT", // Default to QCT only
    amount: "",
    recipient: "",
    txHash: "",
    status: null
  });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const agentConfig = getAgentConfig(agent.id);
  const supportedChains = getAgentSupportedChains(agent.id);

  // Fetch real balances using agent's actual wallet addresses
  const balanceAddresses = agentConfig ? {
    sepolia: agentConfig.walletAddresses.evmAddress as `0x${string}`,
    arb: agentConfig.walletAddresses.evmAddress as `0x${string}`,
    btc: agentConfig.walletAddresses.btcAddress
  } : {};

  // Multi-chain balance fetching
  const [qctBalance, setQctBalance] = useState<string>("0");
  const [chainBalances, setChainBalances] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (agentConfig?.walletAddresses.evmAddress) {
      import('../app/utils/balanceUtils').then(({ getQCTBalance, getQCTBalancesByChain }) => {
        // Get total balance
        getQCTBalance(agentConfig.walletAddresses.evmAddress).then(setQctBalance);
        // Get individual chain balances
        getQCTBalancesByChain(agentConfig.walletAddresses.evmAddress).then(setChainBalances);
      });
    }
  }, [agentConfig?.walletAddresses.evmAddress]);

  const calculateQCTEquivalent = (usdcAmount: string) => {
    // Conversion rate: 1 USDC = 100 Q¢
    const usdc = parseFloat(usdcAmount.replace(/,/g, ""));
    return Math.round(usdc * 100).toLocaleString();
  };

  const calculateUSDCEquivalent = (qctAmount: string) => {
    // Conversion rate: 100 Q¢ = 1 USDC
    const qct = parseFloat(qctAmount.replace(/,/g, ""));
    return (qct / 100).toFixed(2);
  };

  const formatToken = (raw?: string, decimals?: number, fractionDigits: number = 0) => {
    try {
      if (!raw || raw === "0") return "0";
      const d = typeof decimals === "number" ? decimals : 18;
      const bi = BigInt(raw);
      
      // Convert from wei to human readable format
      const divisor = BigInt(10 ** d);
      const quotient = bi / divisor;
      const remainder = bi % divisor;
      
      // Handle the decimal part
      let result = Number(quotient);
      if (remainder > 0n && fractionDigits > 0) {
        const decimalPart = Number(remainder) / Number(divisor);
        result += decimalPart;
      }
      
      return result.toLocaleString(undefined, { 
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: 0
      });
    } catch (error) {
      console.error('formatToken error:', error, { raw, decimals });
      return "0";
    }
  };

  const getTotalBalances = () => {
    try {
      const totalQCT = parseFloat(qctBalance) || 0;
      
      // Only log if there's an actual balance to help debug
      if (totalQCT > 0) {
        console.log(`Agent ${agent.id} has balance:`, totalQCT);
      }
      
      return {
        qct: totalQCT.toLocaleString(undefined, { maximumFractionDigits: 1 }),
        usdc: "0.00" // USDC not implemented yet
      };
    } catch (error) {
      console.error(`Balance calculation error for ${agent.id}:`, error);
      return { qct: "0", usdc: "0.00" };
    }
  };

  // Helper function to resolve agent ID to address
  const resolveRecipientAddress = (recipient: string): string => {
    // Check if it's an agent ID (starts with @aigent or aigent-)
    if (recipient.startsWith('@aigent-') || recipient.startsWith('aigent-')) {
      const agentId = recipient.replace('@', '');
      const recipientConfig = getAgentConfig(agentId);
      if (recipientConfig) {
        return recipientConfig.walletAddresses.evmAddress;
      }
      throw new Error(`Agent ${recipient} not found`);
    }
    
    // Check if it's a valid Ethereum address
    if (recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return recipient;
    }
    
    throw new Error("Invalid recipient. Use agent ID (@aigent-name) or Ethereum address (0x...)");
  };

  const handleTransaction = useCallback(async (type: "request" | "send" | "verify") => {
    if (!txState.chain || !txState.amount || !txState.recipient) {
      setNotification("Please fill in all required fields");
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setLoading(true);
    
    try {
      if (type === "send") {
        const chainConfig = chainConfigs[txState.chain as keyof typeof chainConfigs];
        
        // Resolve recipient address (agent ID or direct address)
        const recipientAddress = resolveRecipientAddress(txState.recipient);
        
        // For EVM chains, use the signer/transfer API
        if (chainConfig && 'qctTokenAddress' in chainConfig) {
          const response = await fetch("/api/a2a/signer/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chainId: chainConfig.id,
              tokenAddress: txState.asset === "QCT" ? chainConfig.qctTokenAddress : chainConfig.usdcTokenAddress,
              to: recipientAddress,
              amount: (parseFloat(txState.amount) * 1e18).toString(), // QCT has 18 decimals
              asset: txState.asset,
              agentId: agent.id // Pass agent ID to retrieve correct private key
            })
          });
          
          const result = await response.json();
          
          if (result.ok) {
            setTxState(prev => ({ ...prev, txHash: result.txHash, status: "completed" }));
            setNotification(`✅ Transaction sent successfully! Hash: ${result.txHash.slice(0, 10)}...`);
            
            // Refresh balances after successful transaction
            setTimeout(() => {
              if (agentConfig?.walletAddresses.evmAddress) {
                import('../app/utils/balanceUtils').then(({ getQCTBalance, getQCTBalancesByChain }) => {
                  getQCTBalance(agentConfig.walletAddresses.evmAddress).then(setQctBalance);
                  getQCTBalancesByChain(agentConfig.walletAddresses.evmAddress).then(setChainBalances);
                });
              }
            }, 2000);
          } else {
            throw new Error(result.error || "Transaction failed");
          }
        } else {
          // For BTC/SOL, simulate manual transaction
          const mockTxHash = `${txState.chain}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          setTxState(prev => ({ ...prev, txHash: mockTxHash, status: "completed" }));
          setNotification(`✅ ${txState.chain.toUpperCase()} transaction initiated!`);
        }
      } else if (type === "verify") {
        // Verify transaction using A2A verify API
        const assetKey = txState.chain === "bitcoin" ? "BTC_QCENT" : 
                        txState.chain === "solana" ? "SOL_QCENT" : 
                        `${txState.chain.toUpperCase()}_QCENT`;
        
        const response = await fetch("/api/a2a/facilitator/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetKey,
            txHashOrId: txState.txHash
          })
        });
        
        const result = await response.json();
        
        if (result.ok) {
          setTxState(prev => ({ ...prev, status: "completed" }));
          setNotification(`✅ Transaction verified successfully!`);
        } else {
          throw new Error(result.error || "Verification failed");
        }
      } else {
        // Request payment
        setNotification(`💰 Payment request created for ${txState.amount} ${txState.asset}`);
      }
      
      setTimeout(() => setNotification(null), 5000);
    } catch (error: any) {
      setTxState(prev => ({ ...prev, status: "failed" }));
      setNotification(`❌ ${error.message}`);
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoading(false);
    }
  }, [txState]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotification("📋 Copied to clipboard");
    setTimeout(() => setNotification(null), 2000);
  };

  const openExplorer = (txHash: string, chain: string) => {
    const chainConfig = chainConfigs[chain as keyof typeof chainConfigs];
    if (chainConfig) {
      const url = `${chainConfig.explorerUrl}/tx/${txHash}`;
      window.open(url, '_blank');
    }
  };

  const resetTransaction = () => {
    setTxState({
      type: null,
      chain: null,
      asset: "QCT", // Default to QCT
      amount: "",
      recipient: "",
      txHash: "",
      status: null
    });
  };

  if (!open || !agentConfig) return null;

  const totalBalances = getTotalBalances();

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 drawer-backdrop bg-indigo-950/60" onClick={onClose} />
      <div className="ml-auto h-full drawer-content animate-slide-in-left w-[21.6rem] bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10 overflow-y-auto">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-white/5 ring-1 ring-white/10">
          <div>
            <h3 className="text-slate-100 text-sm font-medium tracking-wide">{agentConfig.name} — Wallet</h3>
            <p className="text-xs text-slate-300">{agentConfig.fioId}</p>
          </div>
          <button
            onClick={onClose}
            title="Close wallet drawer"
            className="px-2 py-1 text-xs rounded-md bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
          >
            ✕
          </button>
        </header>

        {/* Notification */}
        {notification && (
          <div className="mx-4 mt-3 p-3 bg-blue-500/10 ring-1 ring-blue-500/20 rounded text-blue-200 text-xs">
            {notification}
          </div>
        )}

        {/* Total Balances */}
        <div className="px-4 py-3 space-y-3">
          <div className="bg-white/5 ring-1 ring-white/10 rounded p-3">
            <h4 className="text-xs font-medium text-slate-200 mb-3 tracking-wide">Total Portfolio</h4>
            
            {/* QCT Balance */}
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Q¢ Balance</span>
                <div className="text-right">
                  <div className="text-lg font-semibold text-green-300">{totalBalances.qct} Q¢</div>
                  <div className="text-xs text-slate-400">(${calculateUSDCEquivalent(totalBalances.qct)} USDC)</div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10 my-3"></div>

            {/* USDC Balance */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">USDC Balance</span>
                <div className="text-right">
                  <div className="text-lg font-semibold text-blue-300">${totalBalances.usdc}</div>
                  <div className="text-xs text-slate-400">({calculateQCTEquivalent(totalBalances.usdc)} Q¢)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Interface */}
          <div className="bg-white/5 ring-1 ring-white/10 rounded p-3">
            <h4 className="text-xs font-medium text-slate-200 mb-3 tracking-wide">Transaction Center</h4>
            
            {/* Action Buttons */}
            {!txState.type && (
              <div className="grid grid-cols-3 gap-1 mb-3">
                <button
                  onClick={() => setTxState(prev => ({ ...prev, type: "request", asset: "QCT" }))}
                  className="flex flex-col items-center gap-1 p-2 bg-blue-500/10 hover:bg-blue-500/20 ring-1 ring-blue-500/20 rounded text-blue-200"
                >
                  <ArrowDownLeft size={14} />
                  <span className="text-xs">Request</span>
                </button>
                <button
                  onClick={() => setTxState(prev => ({ ...prev, type: "send", asset: "QCT" }))}
                  className="flex flex-col items-center gap-1 p-2 bg-green-500/10 hover:bg-green-500/20 ring-1 ring-green-500/20 rounded text-green-200"
                >
                  <ArrowUpRight size={14} />
                  <span className="text-xs">Send</span>
                </button>
                <button
                  onClick={() => setTxState(prev => ({ ...prev, type: "verify", asset: "QCT" }))}
                  className="flex flex-col items-center gap-1 p-2 bg-purple-500/10 hover:bg-purple-500/20 ring-1 ring-purple-500/20 rounded text-purple-200"
                >
                  <Shield size={14} />
                  <span className="text-xs">Verify</span>
                </button>
              </div>
            )}

            {/* Transaction Form */}
            {txState.type && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-medium text-slate-200 capitalize tracking-wide">{txState.type} Payment <span className="text-cyan-400">Q¢ (QCT)</span></h5>
                  <div className="flex gap-2">
                    <button
                      onClick={resetTransaction}
                      className="text-xs text-slate-300 hover:text-slate-100"
                    >
                      Reset
                    </button>
                    <button
                      onClick={resetTransaction}
                      className="text-xs text-red-300 hover:text-red-100"
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {/* Chain Selection */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Chain</label>
                  <select
                    value={txState.chain || ""}
                    onChange={(e) => setTxState(prev => ({ ...prev, chain: e.target.value }))}
                    title="Select blockchain network"
                    className="w-full bg-white/5 ring-1 ring-white/10 rounded px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="">Select Chain</option>
                    {supportedChains.map(chain => (
                      <option key={chain.name} value={chain.name.toLowerCase().split(' ')[0]}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Amount</label>
                  <input
                    type="number"
                    value={txState.amount}
                    onChange={(e) => setTxState(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-white/5 ring-1 ring-white/10 rounded px-2 py-1 text-xs text-slate-200"
                  />
                  
                  {/* Quick Payment Amounts */}
                  {txState.type === "send" && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-400 mb-1">Quick amounts:</div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setTxState(prev => ({ ...prev, amount: "10" }))}
                          className="px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 ring-1 ring-green-500/20 rounded text-green-200"
                        >
                          10 Q¢
                        </button>
                        <button
                          onClick={() => setTxState(prev => ({ ...prev, amount: "100" }))}
                          className="px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 ring-1 ring-green-500/20 rounded text-green-200"
                        >
                          100 Q¢
                        </button>
                        <button
                          onClick={() => setTxState(prev => ({ ...prev, amount: "1000" }))}
                          className="px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 ring-1 ring-green-500/20 rounded text-green-200"
                        >
                          1,000 Q¢
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recipient/Sender or TX Hash */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {txState.type === "verify" ? "Transaction Hash" : "Recipient Address / @aigent ID"}
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={txState.type === "verify" ? txState.txHash : txState.recipient}
                      onChange={(e) => setTxState(prev => ({ 
                        ...prev, 
                        [txState.type === "verify" ? "txHash" : "recipient"]: e.target.value 
                      }))}
                      placeholder={txState.type === "verify" ? "0x..." : "0x... or @aigent-name"}
                      className="flex-1 bg-white/5 ring-1 ring-white/10 rounded px-2 py-1 text-xs text-slate-200"
                    />
                    {(txState.txHash || txState.recipient) && (
                      <button
                        onClick={() => copyToClipboard(txState.type === "verify" ? txState.txHash : txState.recipient)}
                        title="Copy to clipboard"
                        className="px-2 py-1 text-xs rounded bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                  {txState.type !== "verify" && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-400 mb-1">Quick select agents:</div>
                      <div className="grid grid-cols-3 gap-1">
                        {['aigent-z', 'aigent-moneypenny', 'aigent-nakamoto', 'aigent-kn0w1']
                          .filter(id => id !== agent.id)
                          .slice(0, 3)
                          .map(agentId => {
                            const displayName = agentId.replace('aigent-', '').replace('moneypenny', 'MoneyPenny').replace(/^\w/, c => c.toUpperCase());
                            return (
                              <button
                                key={agentId}
                                onClick={() => setTxState(prev => ({ ...prev, recipient: `@${agentId}` }))}
                                className="px-2 py-1 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 ring-1 ring-cyan-500/20 rounded text-cyan-200"
                              >
                                {displayName}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Transaction Hash Display (after completion) */}
                {txState.txHash && txState.type !== "verify" && (
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Transaction Hash</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={txState.txHash}
                        readOnly
                        className="flex-1 bg-white/5 ring-1 ring-white/10 rounded px-2 py-1 text-xs text-slate-200"
                      />
                      <button
                        onClick={() => copyToClipboard(txState.txHash)}
                        title="Copy transaction hash"
                        className="px-2 py-1 text-xs rounded bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
                      >
                        <Copy size={12} />
                      </button>
                      {txState.chain && (
                        <button
                          onClick={() => openExplorer(txState.txHash, txState.chain!)}
                          title="View in blockchain explorer"
                          className="px-2 py-1 text-xs rounded bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => handleTransaction(txState.type!)}
                  disabled={loading || !txState.chain || !txState.asset || !txState.amount}
                  className="w-full py-2 px-3 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-white/5 disabled:cursor-not-allowed ring-1 ring-blue-500/30 text-blue-200 rounded text-xs font-medium"
                >
                  {loading ? "Processing..." : `${txState.type?.charAt(0).toUpperCase()}${txState.type?.slice(1)} Payment`}
                </button>

                {/* Status Indicator */}
                {txState.status && (
                  <div className={`flex items-center gap-2 text-xs ${
                    txState.status === "completed" ? "text-green-300" : 
                    txState.status === "failed" ? "text-red-300" : "text-yellow-300"
                  }`}>
                    <CheckCircle size={12} />
                    <span>Transaction {txState.status}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chain Balances */}
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-slate-200 tracking-wide">Q¢ Chain Balances</h4>
            {supportedChains.map(chain => {
              const chainName = chain.name.toLowerCase().split(' ')[0];
              
              // Get real balance for this specific chain
              const getChainBalance = (name: string) => {
                switch (name) {
                  case 'arbitrum':
                    return chainBalances.arbitrum ? parseFloat(chainBalances.arbitrum).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "0";
                  case 'optimism':
                    return chainBalances.optimism ? parseFloat(chainBalances.optimism).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "0";
                  case 'base':
                    return chainBalances.base ? parseFloat(chainBalances.base).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "0";
                  case 'polygon':
                    return chainBalances.polygon ? parseFloat(chainBalances.polygon).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "0";
                  case 'ethereum':
                    return "0"; // Ethereum Sepolia RPC failing
                  case 'bitcoin':
                  case 'solana':
                    return "0"; // Not funded yet
                  default:
                    return "0";
                }
              };
              
              // Get chain-specific color, icon and ticker
              const getChainColor = (name: string) => {
                switch (name) {
                  case 'ethereum': return 'text-blue-400';
                  case 'arbitrum': return 'text-cyan-400';
                  case 'base': return 'text-blue-500';
                  case 'optimism': return 'text-red-400';
                  case 'polygon': return 'text-purple-400';
                  case 'bitcoin': return 'text-orange-400';
                  case 'solana': return 'text-green-400';
                  default: return 'text-slate-400';
                }
              };
              
              const getChainIcon = (name: string) => {
                // Using actual chain symbols from QCTAnalyticsCard
                const chainSymbols = {
                  ethereum: '⟠',
                  arbitrum: '◆',
                  base: '◎',
                  optimism: '◉',
                  polygon: '⬟',
                  bitcoin: '₿',
                  solana: '◎'
                };
                const symbol = chainSymbols[name as keyof typeof chainSymbols] || '●';
                const colorClass = getChainColor(name);
                return <span className={`${colorClass} text-sm font-bold`}>{symbol}</span>;
              };
              
              const getTicker = (name: string) => {
                switch (name) {
                  case 'ethereum': return 'ETH Q¢';
                  case 'arbitrum': return 'ARB Q¢';
                  case 'base': return 'BASE Q¢';
                  case 'optimism': return 'OP Q¢';
                  case 'polygon': return 'POLY Q¢';
                  case 'bitcoin': return 'BTC Q¢';
                  case 'solana': return 'SOL Q¢';
                  default: return 'Q¢';
                }
              };
              
              return (
                <div key={chain.name} className="bg-white/5 ring-1 ring-white/10 rounded p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getChainIcon(chainName)}
                      <span className="text-xs text-slate-300">{getTicker(chainName)}</span>
                    </div>
                    <span className={`text-xs font-medium ${getChainColor(chainName)}`}>
                      {getChainBalance(chainName)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
