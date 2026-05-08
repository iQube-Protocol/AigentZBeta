'use client';

/**
 * TransactionModal - Send, Receive (Request Payment), and Verify transactions
 * 
 * Supports:
 * - Remote Custody: Delegated operations via x402 custody sessions
 * - Deferred Minting: Cross-chain claims with DVN attestation
 * - Canonical Minting: Direct on-chain settlements
 * 
 * Multi-chain support: Arbitrum, Base, Polygon, Optimism, Ethereum, BTC, SOL
 */

import React, { useState, useEffect } from 'react';
import {
  Send,
  Download,
  Search,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type TransactionTab = 'send' | 'receive' | 'verify';

export type TokenType = 'KNYT' | 'QCT' | 'USDC';

export type DeliveryMode = 'custody' | 'claim' | 'canonical' | 'dvn';

export type ChainId = 
  | 421614    // Arbitrum Sepolia
  | 84532     // Base Sepolia
  | 80002     // Polygon Amoy
  | 11155420  // Optimism Sepolia
  | 11155111  // Ethereum Sepolia
  | 'btc-testnet'
  | 'sol-devnet';

export interface ChainConfig {
  id: ChainId;
  name: string;
  ticker: string;
  color: string;
  explorer: string;
  rpcUrl?: string;
  active: boolean;
}

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TransactionTab;
  // Wallet context
  walletAddress?: string;
  personaId?: string;
  agentId?: string;
  fioHandle?: string;
  // Pre-filled values (from Copilot NL parsing)
  prefillRecipient?: string;
  prefillAmount?: number;
  prefillTxHash?: string;
  prefillChainId?: ChainId;
  // Token selection (KNYT default)
  initialToken?: TokenType;
  // Delivery mode preference
  deliveryMode?: DeliveryMode;
  // Feature flags
  enableVerify?: boolean;
  enableCustody?: boolean;
  // Callbacks
  onTransactionComplete?: (result: TransactionResult) => void;
  onRequestCreated?: (request: PaymentRequest) => void;
  // Confirmation threshold (from user preferences)
  autoExecuteThreshold?: number; // Q¢ amount below which auto-execute is allowed
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  chainId: ChainId;
  amount: number;
  recipient: string;
  error?: string;
  deliveryMode: DeliveryMode;
  custodySessionId?: string;
  claimId?: string;
}

export interface PaymentRequest {
  id: string;
  amount: number;
  asset: string;
  chainId: ChainId;
  requesterDid: string;
  requesterFio?: string;
  payerId?: string;
  status?: string;
  memo?: string;
  expiresAt?: string;
  paymentLink: string;
  qrData: string;
}

// =============================================================================
// CHAIN CONFIGURATIONS
// =============================================================================

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: 421614,
    name: 'Arbitrum Sepolia',
    ticker: 'ARB',
    color: 'text-blue-400',
    explorer: 'https://sepolia.arbiscan.io',
    active: true,
  },
  {
    id: 84532,
    name: 'Base Sepolia',
    ticker: 'BASE',
    color: 'text-blue-300',
    explorer: 'https://sepolia.basescan.org',
    active: true,
  },
  {
    id: 80002,
    name: 'Polygon Amoy',
    ticker: 'MATIC',
    color: 'text-purple-400',
    explorer: 'https://amoy.polygonscan.com',
    active: true,
  },
  {
    id: 11155420,
    name: 'Optimism Sepolia',
    ticker: 'OPT',
    color: 'text-red-400',
    explorer: 'https://sepolia-optimism.etherscan.io',
    active: true,
  },
  {
    id: 11155111,
    name: 'Ethereum Sepolia',
    ticker: 'ETH',
    color: 'text-indigo-400',
    explorer: 'https://sepolia.etherscan.io',
    active: true,
  },
  {
    id: 'btc-testnet',
    name: 'Bitcoin Testnet',
    ticker: 'BTC',
    color: 'text-orange-400',
    explorer: 'https://mempool.space/testnet',
    active: false, // Coming soon
  },
  {
    id: 'sol-devnet',
    name: 'Solana Devnet',
    ticker: 'SOL',
    color: 'text-green-400',
    explorer: 'https://explorer.solana.com/?cluster=devnet',
    active: false, // Coming soon
  },
];

// QCT Token addresses per chain
const QCT_ADDRESSES: Record<number, string> = {
  421614: '0x4C4f1aD931589449962bB675bcb8e95672349d09', // Arbitrum Sepolia
  84532: '0x4C4f1aD931589449962bB675bcb8e95672349d09',  // Base Sepolia
  80002: '0x4C4f1aD931589449962bB675bcb8e95672349d09',  // Polygon Amoy
  11155420: '0x4C4f1aD931589449962bB675bcb8e95672349d09', // Optimism Sepolia
  11155111: '0x4C4f1aD931589449962bB675bcb8e95672349d09', // Ethereum Sepolia
};

const KNYT_ADDRESSES: Partial<Record<number, string>> = {
  11155111: process.env.NEXT_PUBLIC_KNYT_SEPOLIA || "",
};

const USDC_ADDRESSES: Partial<Record<number, string>> = {
  11155111: process.env.NEXT_PUBLIC_USDC_SEPOLIA || "",
  421614: process.env.NEXT_PUBLIC_USDC_ARBITRUM_SEPOLIA || "",
  84532: process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA || "",
};

const TOKEN_LABEL: Record<TokenType, string> = {
  KNYT: "KNYT",
  QCT: "Q¢",
  USDC: "USDC",
};

const DELIVERY_LABEL: Record<DeliveryMode, string> = {
  canonical: "Direct",
  custody: "Remote",
  claim: "Deferred",
  dvn: "DVN (off-chain)",
};

// =============================================================================
// COMPONENT
// =============================================================================

export function TransactionModal({
  isOpen,
  onClose,
  initialTab = 'send',
  walletAddress,
  personaId,
  agentId,
  fioHandle,
  prefillRecipient,
  prefillAmount,
  prefillTxHash,
  prefillChainId,
  deliveryMode = 'canonical',
  enableVerify = false,
  enableCustody = false,
  onTransactionComplete,
  onRequestCreated,
  autoExecuteThreshold = 0,
  initialToken = 'KNYT',
}: TransactionModalProps) {
  const [activeTab, setActiveTab] = useState<TransactionTab>(initialTab);
  
  // Token selection (KNYT default)
  const [selectedToken, setSelectedToken] = useState<TokenType>(initialToken);
  
  // Send state
  const [recipient, setRecipient] = useState(prefillRecipient || '');
  const [amount, setAmount] = useState(prefillAmount?.toString() || '');
  const [selectedChain, setSelectedChain] = useState<ChainId>(prefillChainId || 421614);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<TransactionResult | null>(null);
  const initialDeliveryMode: DeliveryMode = (() => {
    // KNYT defaults to off-chain DVN settlement (no gas, instant)
    if (initialToken === 'KNYT' && deliveryMode === 'canonical') return 'dvn';
    if (!enableCustody && deliveryMode === 'custody') return 'canonical';
    return deliveryMode;
  })();
  const [selectedDeliveryMode, setSelectedDeliveryMode] = useState<DeliveryMode>(initialDeliveryMode);
  
  // Receive state
  const [requestAmount, setRequestAmount] = useState('');
  const [requestFrom, setRequestFrom] = useState(''); // Who to request payment from
  const [requestMemo, setRequestMemo] = useState('');
  const [requestChain, setRequestChain] = useState<ChainId>(421614);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<PaymentRequest | null>(null);
  
  // Verify state
  const [txHash, setTxHash] = useState(prefillTxHash || '');
  const [verifyChain, setVerifyChain] = useState<ChainId>(prefillChainId || 421614);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const resolveTokenAddress = (token: TokenType, chainId: ChainId): string | undefined => {
    if (typeof chainId !== "number") return undefined;
    if (token === "QCT") return QCT_ADDRESSES[chainId];
    if (token === "KNYT") return KNYT_ADDRESSES[chainId] || undefined;
    return USDC_ADDRESSES[chainId] || undefined;
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const safeTab =
        !enableVerify && initialTab === 'verify' ? 'send' : initialTab;
      setActiveTab(safeTab);
      if (prefillRecipient) setRecipient(prefillRecipient);
      if (prefillAmount) setAmount(prefillAmount.toString());
      if (prefillTxHash) setTxHash(prefillTxHash);
      if (prefillChainId) {
        setSelectedChain(prefillChainId);
        setVerifyChain(prefillChainId);
      }
      // Clear previous results
      setSendSuccess(null);
      setSendError(null);
      setCreatedRequest(null);
      setRequestError(null);
      setRequestFrom('');
      setVerifyResult(null);
      setVerifyError(null);
    }
  }, [isOpen, initialTab, prefillRecipient, prefillAmount, prefillTxHash, prefillChainId, enableVerify]);

  useEffect(() => {
    if (!enableCustody && selectedDeliveryMode === 'custody') {
      setSelectedDeliveryMode('canonical');
    }
  }, [enableCustody, selectedDeliveryMode]);

  // DVN mode is KNYT-only — only normalise on token change so the user can
  // still explicitly pick canonical/claim/custody for KNYT once selected.
  useEffect(() => {
    setSelectedDeliveryMode((prev) => {
      if (selectedToken !== 'KNYT' && prev === 'dvn') return 'canonical';
      if (selectedToken === 'KNYT' && prev === 'canonical') return 'dvn';
      return prev;
    });
  }, [selectedToken]);

  if (!isOpen) return null;

  // ==========================================================================
  // SEND HANDLER
  // ==========================================================================
  const handleSend = async () => {
    // DVN mode is KNYT-only and skips wallet/agent address requirements
    const isDvn = selectedDeliveryMode === 'dvn';
    if (!recipient || !amount || (!isDvn && !agentId)) {
      setSendError('Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSendError('Please enter a valid amount');
      return;
    }

    // Check auto-execute threshold
    const requiresConfirmation = amountNum > autoExecuteThreshold;
    if (requiresConfirmation) {
      // For now, we always require confirmation
      // Future: show confirmation dialog
    }

    setSendLoading(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      // DVN off-chain transfer — bypass chain/recipient resolution; the server
      // resolves persona handles via the KNYT ledger service.
      if (isDvn) {
        if (selectedToken !== 'KNYT') {
          throw new Error('DVN mode is only available for KNYT');
        }
        const fromIdentifier = fioHandle || personaId || agentId;
        if (!fromIdentifier) {
          throw new Error('Sender persona is not available');
        }
        const transferRes = await fetch('/api/wallet/knyt/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromPersonaId: fromIdentifier,
            toPersonaId: recipient,
            amount: amountNum,
          }),
        });
        if (!transferRes.ok) {
          const err = await transferRes.json().catch(() => ({}));
          throw new Error(err.error || 'DVN transfer failed');
        }
        const data = await transferRes.json();
        const result: TransactionResult = {
          success: true,
          chainId: selectedChain,
          amount: amountNum,
          recipient,
          deliveryMode: 'dvn',
          claimId: data.fromTxId,
        };
        setSendSuccess(result);
        onTransactionComplete?.(result);
        setSendLoading(false);
        return;
      }

      // Resolve recipient (FIO handle or wallet address)
      let resolvedRecipient = recipient;
      if (recipient.includes('@') || recipient.endsWith('.fio')) {
        // FIO handle - resolve to address
        const resolveRes = await fetch(`/api/identity/resolve?handle=${encodeURIComponent(recipient)}`);
        if (resolveRes.ok) {
          const resolved = await resolveRes.json();
          resolvedRecipient = resolved.evmAddress || resolved.address || recipient;
        }
      }

      // Get chain config
      const chainConfig = SUPPORTED_CHAINS.find(c => c.id === selectedChain);
      if (!chainConfig || !chainConfig.active) {
        throw new Error(`Chain ${selectedChain} is not currently supported`);
      }

      // Convert amount to base units (18 decimals default for now).
      const amountWei = (BigInt(Math.floor(amountNum)) * 10n ** 18n).toString();
      const asset = selectedToken;
      const tokenAddress = resolveTokenAddress(selectedToken, selectedChain);

      // Execute transfer based on delivery mode
      let result: TransactionResult;

      if (selectedDeliveryMode === 'custody' && !enableCustody) {
        throw new Error('Custody mode is not enabled for this wallet.');
      }

      if (selectedDeliveryMode === 'custody') {
        // Remote custody mode - create custody session first
        const sessionRes = await fetch('/api/x402/remote/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ttlSec: 300, // 5 minute session
            caps: ['transfer'],
          }),
        });
        
        if (!sessionRes.ok) {
          throw new Error('Failed to create custody session');
        }
        
        const session = await sessionRes.json();
        
        // Execute via custody
        const transferRes = await fetch('/api/a2a/signer/transfer', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Custody-Session': session.sessionId,
          },
          body: JSON.stringify({
            chainId: selectedChain,
            amount: amountWei,
            asset,
            agentId: fioHandle || agentId, // Prefer FIO handle for flexible lookup
            to: resolvedRecipient,
            tokenAddress,
            deliveryMode: 'custody',
          }),
        });

        if (!transferRes.ok) {
          const err = await transferRes.json().catch(() => ({}));
          throw new Error(err.error || 'Transfer failed');
        }

        const transferData = await transferRes.json();
        result = {
          success: true,
          txHash: transferData.txHash,
            chainId: selectedChain,
          amount: amountNum,
          recipient: resolvedRecipient,
          deliveryMode: 'custody',
          custodySessionId: session.sessionId,
        };

      } else if (selectedDeliveryMode === 'claim') {
        // Deferred minting - create claim for cross-chain redemption
        const senderIdentifier = fioHandle || agentId;
        const claimRes = await fetch('/api/x402/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-402-Intent': 'asset.claim',
            'X-402-Sender': fioHandle ? `did:fio:${fioHandle}` : `did:iq:${agentId}`,
            'X-402-Recipient': resolvedRecipient.startsWith('did:') ? resolvedRecipient : `did:evm:${resolvedRecipient}`,
            'X-402-Asset': selectedToken === "QCT" ? 'QCT.QCENT' : selectedToken,
            'X-402-Amount': amountNum.toString(),
            'X-402-Delivery-Mode': 'claim',
            'X-402-Dev-Skip-Sig': 'true', // Dev mode
          },
          body: JSON.stringify({
            rights: {
              asset: selectedToken,
              amount: amountNum.toString(),
            },
            redeem_to: {
              chain: chainConfig.name.toLowerCase().replace(' ', '-'),
              address: resolvedRecipient,
            },
            from_chain: 'arbitrum-sepolia',
            sender_identifier: senderIdentifier, // For flexible key lookup
          }),
        });

        if (!claimRes.ok) {
          const err = await claimRes.json().catch(() => ({}));
          throw new Error(err.error || 'Claim creation failed');
        }

        const claimData = await claimRes.json();
        result = {
          success: true,
          chainId: selectedChain,
          amount: amountNum,
          recipient: resolvedRecipient,
          deliveryMode: 'claim',
          claimId: claimData.settlementId || claimData.messageId,
        };

      } else {
        // Canonical mode - direct on-chain transfer
        const transferRes = await fetch('/api/a2a/signer/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chainId: selectedChain,
            amount: amountWei,
            asset,
            agentId: fioHandle || agentId, // Prefer FIO handle for flexible lookup
            to: resolvedRecipient,
            tokenAddress,
          }),
        });

        if (!transferRes.ok) {
          const err = await transferRes.json().catch(() => ({}));
          throw new Error(err.error || 'Transfer failed');
        }

        const transferData = await transferRes.json();
        result = {
          success: true,
          txHash: transferData.txHash,
          chainId: selectedChain,
          amount: amountNum,
          recipient: resolvedRecipient,
          deliveryMode: 'canonical',
        };
      }

      setSendSuccess(result);
      onTransactionComplete?.(result);

    } catch (err: any) {
      setSendError(err.message || 'Transaction failed');
    } finally {
      setSendLoading(false);
    }
  };

  // ==========================================================================
  // RECEIVE (REQUEST PAYMENT) HANDLER
  // ==========================================================================
  const handleCreateRequest = async () => {
    if (!requestAmount) {
      setRequestError('Please enter an amount');
      return;
    }

    if (!requestFrom) {
      setRequestError('Please specify who to request payment from');
      return;
    }

    const amountNum = parseFloat(requestAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setRequestError('Please enter a valid amount');
      return;
    }

    setRequestLoading(true);
    setRequestError(null);
    setCreatedRequest(null);

    try {
      // Use the new payment request API that sends to payer's wallet
      const res = await fetch('/api/wallet/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: fioHandle || agentId,
          requesterFio: fioHandle,
          requesterAddress: walletAddress,
          payerId: requestFrom,
          payerFio: requestFrom.includes('@') ? requestFrom : undefined,
          amount: amountNum,
          asset: selectedToken,
          chainId: requestChain,
          memo: requestMemo || undefined,
          expiresInDays: 7,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create payment request');
      }

      const request = await res.json();
      setCreatedRequest({
        ...request,
        amount: amountNum,
        asset: selectedToken,
        payerId: requestFrom,
        status: 'pending',
      });
      onRequestCreated?.(request);

    } catch (err: any) {
      setRequestError(err.message || 'Failed to create request');
    } finally {
      setRequestLoading(false);
    }
  };

  // ==========================================================================
  // VERIFY HANDLER
  // ==========================================================================
  const handleVerify = async () => {
    if (!txHash) {
      setVerifyError('Please enter a transaction hash');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResult(null);

    try {
      const res = await fetch(`/api/x402/verify?txHash=${encodeURIComponent(txHash)}&chainId=${verifyChain}`);
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Verification failed');
      }

      const result = await res.json();
      setVerifyResult(result);

    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getExplorerUrl = (hash: string, chainId: ChainId) => {
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    if (!chain) return '#';
    return `${chain.explorer}/tx/${hash}`;
  };

  const activeChains = SUPPORTED_CHAINS.filter(c => c.active);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Transaction</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'send'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Send className="w-4 h-4" />
            Send
          </button>
          <button
            onClick={() => setActiveTab('receive')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'receive'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Download className="w-4 h-4" />
            Receive
          </button>
          {enableVerify && (
            <button
              onClick={() => setActiveTab('verify')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'verify'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Search className="w-4 h-4" />
              Verify
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ================================================================
              SEND TAB
              ================================================================ */}
          {activeTab === 'send' && (
            <div className="space-y-4">
              {/* Success State */}
              {sendSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Transaction Sent!</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Amount</span>
                      <span className="text-white">{sendSuccess.amount} {TOKEN_LABEL[selectedToken]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Mode</span>
                      <span className="text-white">{DELIVERY_LABEL[sendSuccess.deliveryMode]}</span>
                    </div>
                    {sendSuccess.txHash && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Tx Hash</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white truncate max-w-[120px]">
                            {sendSuccess.txHash}
                          </span>
                          <button
                            onClick={() => copyToClipboard(sendSuccess.txHash!)}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <Copy className="w-3 h-3 text-white/60" />
                          </button>
                          <a
                            href={getExplorerUrl(sendSuccess.txHash, sendSuccess.chainId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <ExternalLink className="w-3 h-3 text-white/60" />
                          </a>
                        </div>
                      </div>
                    )}
                    {sendSuccess.claimId && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Claim ID</span>
                        <span className="font-mono text-xs text-white">{sendSuccess.claimId}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSendSuccess(null);
                      setRecipient('');
                      setAmount('');
                    }}
                    className="w-full mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                  >
                    Send Another
                  </button>
                </div>
              )}

              {/* Send Form */}
              {!sendSuccess && (
                <>
                  {/* Error */}
                  {sendError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{sendError}</span>
                    </div>
                  )}

                  {/* Token Selection */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Token</label>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedToken('KNYT')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedToken === 'KNYT' ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>KNYT</button>
                      <button onClick={() => setSelectedToken('QCT')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedToken === 'QCT' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Q¢</button>
                      <button onClick={() => setSelectedToken('USDC')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedToken === 'USDC' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>USDC</button>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Recipient
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="Persona handle or wallet address"
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    <p className="text-xs text-white/40 mt-1">
                      e.g., alice@knyt (Persona handle) or 0x1234...
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Amount ({selectedToken})
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>

                  {/* Hidden: Chain Selection - using token dropdown instead
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Network</label>
                    <div className={`grid ${enableCustody ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                      {activeChains.map((chain) => (
                        <button key={chain.id} onClick={() => setSelectedChain(chain.id)}
                          className={`p-2 rounded-lg text-center transition-colors ${selectedChain === chain.id ? 'bg-cyan-500/20 ring-1 ring-cyan-500/50 text-cyan-300' : 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10'}`}>
                          <div className={`text-xs font-bold ${chain.color}`}>{chain.ticker}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  */}

                  {/* Delivery Mode */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Delivery Mode
                    </label>
                    <div className={`grid ${selectedToken === 'KNYT' ? (enableCustody ? 'grid-cols-4' : 'grid-cols-3') : (enableCustody ? 'grid-cols-3' : 'grid-cols-2')} gap-2`}>
                      {selectedToken === 'KNYT' && (
                        <button
                          onClick={() => setSelectedDeliveryMode('dvn')}
                          className={`p-2 rounded-lg text-center transition-colors ${
                            selectedDeliveryMode === 'dvn'
                              ? 'bg-amber-500/20 ring-1 ring-amber-500/50 text-amber-300'
                              : 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-medium">DVN</div>
                          <div className="text-[10px] text-white/40">Off-chain</div>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedDeliveryMode('canonical')}
                        className={`p-2 rounded-lg text-center transition-colors ${
                          selectedDeliveryMode === 'canonical'
                            ? 'bg-purple-500/20 ring-1 ring-purple-500/50 text-purple-300'
                            : 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs font-medium">Direct</div>
                        <div className="text-[10px] text-white/40">On-chain</div>
                      </button>
                      {enableCustody && (
                        <button
                          onClick={() => setSelectedDeliveryMode('custody')}
                          className={`p-2 rounded-lg text-center transition-colors ${
                            selectedDeliveryMode === 'custody'
                              ? 'bg-purple-500/20 ring-1 ring-purple-500/50 text-purple-300'
                              : 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-medium">Remote</div>
                          <div className="text-[10px] text-white/40">Delegated</div>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedDeliveryMode('claim')}
                        className={`p-2 rounded-lg text-center transition-colors ${
                          selectedDeliveryMode === 'claim'
                            ? 'bg-purple-500/20 ring-1 ring-purple-500/50 text-purple-300'
                            : 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs font-medium">Deferred</div>
                        <div className="text-[10px] text-white/40">Cross-chain</div>
                      </button>
                    </div>
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={handleSend}
                    disabled={sendLoading || !recipient || !amount}
                    className="w-full px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sendLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send {TOKEN_LABEL[selectedToken]}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ================================================================
              RECEIVE TAB
              ================================================================ */}
          {activeTab === 'receive' && (
            <div className="space-y-4">
              {/* Created Request */}
              {createdRequest && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-400 mb-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Payment Request Sent!</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Amount</span>
                      <span className="text-white">{createdRequest.amount} {TOKEN_LABEL[selectedToken]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Requested From</span>
                      <span className="text-white">{createdRequest.payerId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Status</span>
                      <span className="text-amber-400">Pending</span>
                    </div>
                  </div>

                  <div className="mt-3 p-3 rounded-lg bg-white/5 text-xs text-white/60">
                    <p>Your request has been sent to {createdRequest.payerId}'s wallet.</p>
                    <p className="mt-1">You'll be notified when they accept or reject it.</p>
                  </div>

                  <button
                    onClick={() => setCreatedRequest(null)}
                    className="w-full mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                  >
                    Create Another Request
                  </button>
                </div>
              )}

              {/* Request Form */}
              {!createdRequest && (
                <>
                  {/* Error */}
                  {requestError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{requestError}</span>
                    </div>
                  )}

                  {/* Token Selection */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Token</label>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedToken('KNYT')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedToken === 'KNYT' ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>KNYT</button>
                      <button onClick={() => setSelectedToken('QCT')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedToken === 'QCT' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Q¢</button>
                      <button onClick={() => setSelectedToken('USDC')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedToken === 'USDC' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>USDC</button>
                    </div>
                  </div>

                  {/* Your Address */}
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-white/50 mb-1">Your Wallet (Receiving)</div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-white truncate max-w-[200px]">
                        {fioHandle || walletAddress || 'Not connected'}
                      </span>
                      {(fioHandle || walletAddress) && (
                        <button
                          onClick={() => copyToClipboard(fioHandle || walletAddress || '')}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <Copy className="w-4 h-4 text-white/60" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Request From */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Request From (Persona handle or address)
                    </label>
                    <input
                      type="text"
                      value={requestFrom}
                      onChange={(e) => setRequestFrom(e.target.value)}
                      placeholder="e.g., moneypenny@aigent or 0x..."
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      The request will appear in their wallet for approval
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Request Amount ({TOKEN_LABEL[selectedToken]})
                    </label>
                    <input
                      type="number"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  {/* Memo */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Memo (optional)
                    </label>
                    <input
                      type="text"
                      value={requestMemo}
                      onChange={(e) => setRequestMemo(e.target.value)}
                      placeholder="What's this payment for?"
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  {/* Hidden: Chain Selection - using token dropdown instead
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Preferred Network</label>
                    <div className="grid grid-cols-3 gap-2">
                      {activeChains.map((chain) => (
                        <button key={chain.id} onClick={() => setRequestChain(chain.id)}
                          className={`p-2 rounded-lg text-center transition-colors ${requestChain === chain.id ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50 text-emerald-300' : 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10'}`}>
                          <div className={`text-xs font-bold ${chain.color}`}>{chain.ticker}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  */}

                  {/* Create Request Button */}
                  <button
                    onClick={handleCreateRequest}
                    disabled={requestLoading || !requestAmount || !requestFrom}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {requestLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending Request...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Payment Request
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ================================================================
              VERIFY TAB
              ================================================================ */}
          {enableVerify && activeTab === 'verify' && (
            <div className="space-y-4">
              {/* Verify Result */}
              {verifyResult && (
                <div className={`p-4 rounded-xl border ${
                  verifyResult.status === 'confirmed' 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : verifyResult.status === 'pending'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className={`flex items-center gap-2 mb-3 ${
                    verifyResult.status === 'confirmed' ? 'text-emerald-400' :
                    verifyResult.status === 'pending' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {verifyResult.status === 'confirmed' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : verifyResult.status === 'pending' ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="font-medium capitalize">{verifyResult.status}</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {verifyResult.confirmations !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Confirmations</span>
                        <span className="text-white">{verifyResult.confirmations}</span>
                      </div>
                    )}
                    {verifyResult.blockNumber && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Block</span>
                        <span className="text-white">{verifyResult.blockNumber}</span>
                      </div>
                    )}
                    {verifyResult.timestamp && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Time</span>
                        <span className="text-white">
                          {new Date(verifyResult.timestamp * 1000).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {verifyResult.from && (
                      <div className="flex justify-between">
                        <span className="text-white/60">From</span>
                        <span className="font-mono text-xs text-white truncate max-w-[150px]">
                          {verifyResult.from}
                        </span>
                      </div>
                    )}
                    {verifyResult.to && (
                      <div className="flex justify-between">
                        <span className="text-white/60">To</span>
                        <span className="font-mono text-xs text-white truncate max-w-[150px]">
                          {verifyResult.to}
                        </span>
                      </div>
                    )}
                    {verifyResult.value && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Value</span>
                        <span className="text-white">{verifyResult.value}</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={getExplorerUrl(txHash, verifyChain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Explorer
                  </a>
                </div>
              )}

              {/* Verify Form */}
              {!verifyResult && (
                <>
                  {/* Error */}
                  {verifyError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{verifyError}</span>
                    </div>
                  )}

                  {/* Transaction Hash */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Transaction Hash
                    </label>
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  {/* Hidden: Chain Selection - using token dropdown instead
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Network</label>
                    <div className="grid grid-cols-3 gap-2">
                      {SUPPORTED_CHAINS.map((chain) => (
                        <button key={chain.id} onClick={() => setVerifyChain(chain.id)} disabled={!chain.active}
                          className={`p-2 rounded-lg text-center transition-colors ${verifyChain === chain.id ? 'bg-purple-500/20 ring-1 ring-purple-500/50 text-purple-300' : chain.active ? 'bg-white/5 ring-1 ring-white/10 text-white/60 hover:bg-white/10' : 'bg-white/5 ring-1 ring-white/5 text-white/30 cursor-not-allowed'}`}>
                          <div className={`text-xs font-bold ${chain.active ? chain.color : 'text-white/30'}`}>{chain.ticker}</div>
                          {!chain.active && <div className="text-[8px] text-white/30">Soon</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                  */}

                  {/* Verify Button */}
                  <button
                    onClick={handleVerify}
                    disabled={verifyLoading || !txHash}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Verify Transaction
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Clear Result */}
              {verifyResult && (
                <button
                  onClick={() => {
                    setVerifyResult(null);
                    setTxHash('');
                  }}
                  className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                >
                  Verify Another Transaction
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionModal;
