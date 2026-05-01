"use client";
import React, { useState, useCallback, useEffect } from "react";
import { X, Copy, ExternalLink, Send, Download, CheckCircle, Wallet, ArrowUpRight, ArrowDownLeft, Shield, Circle, Info } from "lucide-react";
import { getAgentConfig, getAgentSupportedChains, chainConfigs, agentConfigs } from "@/app/data/agentConfig";
// Removed useBalances import - using direct balance fetching instead
import AliasConsentToggle from "@/app/components/identity/AliasConsentToggle";
import SettlementRetryButton from "@/app/components/x402/SettlementRetryButton";

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
  const [aliasConsent, setAliasConsent] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('x402_alias_consent') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('x402_alias_consent', aliasConsent ? 'true' : 'false'); } catch {}
  }, [aliasConsent]);
  const [retrySettlementId, setRetrySettlementId] = useState<string>("");
  const [retryMessageId, setRetryMessageId] = useState<string>("");
  const [custodyCount, setCustodyCount] = useState<number>(0);
  const [claimCount, setClaimCount] = useState<number>(0);
  const [openClaims, setOpenClaims] = useState<Array<{ id: string; iqube_id?: string; amount_qcent?: number; created_at?: string }>>([]);
  const [loadingClaims, setLoadingClaims] = useState<boolean>(false);
  const [redeemClaimId, setRedeemClaimId] = useState<string>("");
  const [redeemLoading, setRedeemLoading] = useState<boolean>(false);
  const [selectedToAgent, setSelectedToAgent] = useState<string>("");
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; txHash?: string; error?: string } | null>(null);

  async function redeemClaim() {
    if (!redeemClaimId) return;
    setRedeemLoading(true);
    setRedeemResult(null);
    try {
      const res = await fetch('/api/x402/claims/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimId: redeemClaimId })
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setRedeemResult({ ok: true, txHash: j.txHash });
        // best-effort refresh claims count
        try {
          const did = agent?.id ? `did:iq:${agent.id}#auth` : undefined;
          if (did) {
            const r = await fetch(`/api/x402/claims?did=${encodeURIComponent(did)}&status=open`, { cache: 'no-store' });
            const rj = await r.json().catch(() => ({}));
            if (rj?.ok && Array.isArray(rj.data)) setClaimCount(rj.data.length);
          }
        } catch {}
        setRedeemClaimId("");
      } else {
        setRedeemResult({ ok: false, error: j?.error || 'Redeem failed' });
      }
    } catch (e: any) {
      setRedeemResult({ ok: false, error: e?.message || 'Redeem error' });
    } finally {
      setRedeemLoading(false);
    }
  }

  useEffect(() => {
    try {
      const did = agent?.id ? `did:iq:${agent.id}#auth` : undefined;
      if (!did) return;
      (async () => {
        try {
          const c = await fetch(`/api/x402/custody?did=${encodeURIComponent(did)}`, { cache: 'no-store' });
          const cj = await c.json().catch(() => ({}));
          if (cj?.ok && Array.isArray(cj.data)) setCustodyCount(cj.data.length);
        } catch {}
        try {
          setLoadingClaims(true);
          const r = await fetch(`/api/x402/claims?did=${encodeURIComponent(did)}&status=open`, { cache: 'no-store' });
          const rj = await r.json().catch(() => ({}));
          if (rj?.ok && Array.isArray(rj.data)) {
            setClaimCount(rj.data.length);
            setOpenClaims(rj.data);
          }
        } catch {}
        finally { setLoadingClaims(false); }
      })();
    } catch {}
  }, [agent?.id]);

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
      import('@/app/utils/balanceUtils').then(({ getQCTBalance, getQCTBalancesByChain }) => {
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
                import('@/app/utils/balanceUtils').then(({ getQCTBalance, getQCTBalancesByChain }) => {
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
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 drawer-backdrop bg-indigo-950/60" onClick={onClose} />
      <div className="ml-auto h-full drawer-content animate-slide-in-left w-[21.6rem] bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10 overflow-y-auto">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-white/5 ring-1 ring-white/10">
          <div className="min-w-0 flex-1">
            <h3 className="text-slate-100 text-sm font-medium tracking-wide">{agentConfig.name} — Wallet</h3>
            <p className="text-xs text-slate-300">{agentConfig.fioId}</p>
            {agentConfig.personaId && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-slate-500 font-mono select-all truncate" title="Persona UUID">
                  {agentConfig.personaId}
                </p>
                <button
                  type="button"
                  title="Copy UUID"
                  onClick={() => {
                    navigator.clipboard.writeText(agentConfig.personaId!);
                  }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close wallet drawer"
            className="px-2 py-1 text-xs rounded-md bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
          >
            ✕
          </button>
        </header>

        {/* Custody/Claim badges */}
        <div className="px-4 mt-2 flex items-center gap-2 text-[11px]">
          <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/20">Custody: {custodyCount}</span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">Claims: {claimCount}</span>
        </div>

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
                  <div className="flex items-center justify-between">
                    <label className="block text-xs text-slate-300 mb-1">
                      Recipient (TO_DID)
                      <span title="TO_DID is the recipient's DID used in x402 messages (e.g., did:iq:aigent-moneypenny#auth). Use the dropdown to pick an agent; we will auto-fill recipient and show their public EVM address from DIDQube." className="ml-1 text-slate-500 cursor-help inline-flex items-center"><Info size={11} /></span>
                    </label>
                    <div className="text-[10px] text-slate-500">
                      Select agent:
                      <select
                        value={selectedToAgent}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedToAgent(id);
                          const ac = agentConfigs[id as keyof typeof agentConfigs];
                          if (ac) {
                            setTxState(prev => ({ ...prev, recipient: `@${id}` }));
                          }
                        }}
                        className="ml-1 bg-white/5 ring-1 ring-white/10 rounded px-1 py-0.5"
                        title="Pick one of our four agents; recipient will be set to @agent-id and EVM address shown"
                      >
                        <option value="">—</option>
                        {Object.values(agentConfigs).map(ac => (
                          <option key={ac.id} value={ac.id}>{ac.fioId}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={txState.type === "verify" ? txState.txHash : txState.recipient}
                      onChange={(e) => setTxState(prev => ({ 
                        ...prev, 
                        [txState.type === "verify" ? "txHash" : "recipient"]: e.target.value 
                      }))}
                      placeholder={txState.type === "verify" ? "0x..." : "@aigent-moneypenny or 0x..."}
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
                      {selectedToAgent && agentConfigs[selectedToAgent as keyof typeof agentConfigs] && (
                        <div className="mt-2 text-[11px] text-slate-400">
                          <span className="text-slate-300">EVM address:</span> {agentConfigs[selectedToAgent as keyof typeof agentConfigs].walletAddresses.evmAddress}
                          <span className="ml-2 text-slate-500">FIO:</span> {agentConfigs[selectedToAgent as keyof typeof agentConfigs].fioId}
                        </div>
                      )}
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

          {/* Identity (card) */}
          <div className="bg-white/5 ring-1 ring-white/10 rounded p-3">
            <h4 className="text-xs font-medium text-slate-200 mb-3 tracking-wide">Identity</h4>
            <div className="text-xs text-slate-300">FIO: {agentConfig.fioId || "—"}</div>
            <div className="mt-3">
              <AliasConsentToggle consented={aliasConsent} onChange={setAliasConsent} />
              <div className="text-[11px] text-slate-400 mt-1">X-402-Consent-Alias-Bind: {aliasConsent ? 'true' : 'false'}</div>
            </div>
          </div>

          {/* x402 Settlement (card) */}
          <div className="bg-white/5 ring-1 ring-white/10 rounded p-3">
            <h4 className="text-xs font-medium text-slate-200 mb-3 tracking-wide">x402 Settlement</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Settlement ID
                  <span title="The UUID of the x402_settlements row to retry. Leave blank if using Message ID." className="ml-1 cursor-help text-slate-500">?</span>
                </label>
                <input
                  value={retrySettlementId}
                  onChange={(e) => setRetrySettlementId(e.target.value)}
                  placeholder="e.g. 8a2f..."
                  className="w-full px-2 py-1.5 text-sm rounded bg-black/40 ring-1 ring-white/10 text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Message ID
                  <span title="The UUID of the x402_messages row. If provided (and Settlement ID omitted), the latest settlement for this message is retried." className="ml-1 cursor-help text-slate-500">?</span>
                </label>
                <input
                  value={retryMessageId}
                  onChange={(e) => setRetryMessageId(e.target.value)}
                  placeholder="e.g. 5b1d..."
                  className="w-full px-2 py-1.5 text-sm rounded bg-black/40 ring-1 ring-white/10 text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <SettlementRetryButton settlementId={retrySettlementId || undefined} messageId={retryMessageId || undefined} />
            </div>
          </div>
        </div>

        {/* x402 Claims (card) */}
        <div className="px-4 py-3">
          <div className="bg-white/5 ring-1 ring-white/10 rounded p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-slate-200 tracking-wide">x402 Claims</h4>
              <span
                className="inline-flex items-center text-slate-400 cursor-help"
                title="REDEEM_TO is the destination EVM address embedded when the claim was created. Redeeming will send funds to that address; it cannot be changed here."
              >
                <Info size={12} />
              </span>
            </div>
            <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] text-slate-400">Open Claims</label>
                {loadingClaims && <span className="text-[10px] text-slate-500">loading…</span>}
              </div>
              <div className="flex gap-1">
                <select
                  value={redeemClaimId}
                  onChange={(e) => setRedeemClaimId(e.target.value)}
                  title="Select an open claim to auto-fill"
                  className="flex-1 bg-white/5 ring-1 ring-white/10 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="">Select a claim…</option>
                  {openClaims.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.iqube_id || 'iqube'} — {c.amount_qcent ?? '?'} Q¢ — {c.id.slice(0,6)}…
                    </option>
                  ))}
                </select>
                {redeemClaimId && (
                  <button
                    onClick={() => setRedeemClaimId('')}
                    title="Clear selection"
                    className="px-2 py-1 text-xs rounded bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Claim ID
                <span title="UUID of the claim to redeem." className="ml-1 cursor-help text-slate-500">?</span>
              </label>
              <input
                value={redeemClaimId}
                onChange={(e) => setRedeemClaimId(e.target.value)}
                placeholder="claim uuid"
                className="w-full bg-white/5 ring-1 ring-white/10 rounded px-2 py-1 text-xs text-slate-200"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={redeemClaim}
                disabled={redeemLoading || !redeemClaimId}
                className="px-3 py-1.5 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-white/5 disabled:cursor-not-allowed ring-1 ring-purple-500/30 text-purple-200"
              >
                {redeemLoading ? 'Redeeming...' : 'Redeem Claim'}
              </button>
              <button
                onClick={() => setRedeemClaimId('')}
                className="px-2 py-1 text-xs rounded bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
              >
                Clear
              </button>
            </div>

            {/* Redeem result shown inside the modal, with truncation */}
            {redeemResult && (
              <div className={`mt-2 p-2 rounded ring-1 ${redeemResult.ok ? 'bg-green-500/10 ring-green-500/20 text-green-200' : 'bg-red-500/10 ring-red-500/20 text-red-200'}`}>
                {redeemResult.ok ? (
                  <div className="text-[11px]">
                    <div className="mb-1">Claim redeemed</div>
                    {redeemResult.txHash && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] max-w-[11rem] overflow-hidden text-ellipsis whitespace-nowrap">
                          {`${redeemResult.txHash.slice(0, 12)}…${redeemResult.txHash.slice(-8)}`}
                        </span>
                        <button
                          onClick={() => copyToClipboard(redeemResult.txHash!)}
                          className="px-2 py-0.5 text-[10px] rounded bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
                          title="Copy full transaction hash"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px]">
                    <div className="mb-1">Redeem failed</div>
                    {redeemResult.error && (
                      <div className="font-mono text-[10px] max-w-[11rem] overflow-hidden text-ellipsis whitespace-nowrap">
                        {redeemResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
