'use client';

/**
 * ExternalWalletConnect
 *
 * Self-contained external wallet connection section for SmartWalletDrawer → Connections tab.
 * Supports browser-injected wallets (MetaMask, Coinbase, etc.) and WalletConnect (QR / mobile)
 * when NEXT_PUBLIC_REOWN_PROJECT_ID is set.
 *
 * On connection the user's EVM $KNYT balance on Base is read live.
 * The "Pay with EVM $KNYT" flow sends an ERC-20 transfer to the treasury address and
 * surfaces the tx hash for backend confirmation.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createConfig, http, WagmiProvider, useAccount, useConnect, useDisconnect, useReadContract, useSendTransaction } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  QrCode,
  Send,
  Wallet,
  Zap,
} from 'lucide-react';

// ── Config ─────────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '';
const KNYT_CONTRACT = '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4' as const;
const BASE_CHAIN_ID = 8453;

// Operator must set this — the treasury EVM address that receives $KNYT payments
const KNYT_TREASURY = (process.env.NEXT_PUBLIC_KNYT_TREASURY_ADDRESS ?? '') as `0x${string}`;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Build connectors — WalletConnect only if project ID configured
const connectors = PROJECT_ID
  ? [injected(), walletConnect({ projectId: PROJECT_ID, showQrModal: true })]
  : [injected()];

const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors,
});

// Isolated QueryClient so wagmi hooks don't pollute the app's own react-query cache
const walletQueryClient = new QueryClient();

// ── Inner component (needs WagmiProvider ancestor) ─────────────────────────────

interface SendState {
  status: 'idle' | 'waiting' | 'pending' | 'success' | 'error';
  txHash?: string;
  error?: string;
}

function ConnectPanel({
  onTxComplete,
}: {
  onTxComplete?: (txHash: string, amountKnyt: number) => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors: available, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();

  const [sendAmount, setSendAmount] = useState('');
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  // Read live KNYT balance for connected address
  const { data: rawBalance, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    address: KNYT_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: BASE_CHAIN_ID,
    query: { enabled: !!address },
  });

  const knytBalance = rawBalance !== undefined
    ? Number(formatUnits(rawBalance as bigint, 18)).toFixed(2)
    : null;

  const wrongChain = isConnected && chainId !== BASE_CHAIN_ID;

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  async function handleSend() {
    if (!address || !KNYT_TREASURY || !sendAmount) return;
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSendState({ status: 'waiting' });
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [KNYT_TREASURY, parseUnits(sendAmount, 18)],
      });

      const hash = await sendTransactionAsync({
        to: KNYT_CONTRACT,
        data,
        chainId: BASE_CHAIN_ID,
      });

      setSendState({ status: 'success', txHash: hash });
      onTxComplete?.(hash, amount);
      refetchBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction rejected';
      setSendState({ status: 'error', error: msg.slice(0, 120) });
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-white/50 pb-1">
          Connect an external EVM wallet to view your on-chain $KNYT balance and make payments from it directly.
        </p>
        {available.map((connector) => {
          const isWC = connector.id === 'walletConnect';
          return (
            <button
              key={connector.id}
              type="button"
              disabled={isConnecting}
              onClick={() => connect({ connector })}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
            >
              {isWC ? (
                <QrCode className="h-5 w-5 text-blue-400 shrink-0" />
              ) : (
                <Wallet className="h-5 w-5 text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {isWC ? 'WalletConnect' : connector.name}
                </p>
                <p className="text-[10px] text-white/40">
                  {isWC ? 'Scan QR with any mobile wallet' : 'Browser extension wallet'}
                </p>
              </div>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/40 ml-auto shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-white/30 ml-auto shrink-0" />
              )}
            </button>
          );
        })}
        {!PROJECT_ID && (
          <p className="text-[10px] text-amber-400/70 pt-1">
            WalletConnect (mobile) requires NEXT_PUBLIC_REOWN_PROJECT_ID — browser extension wallets work now.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connected address card */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/50">Connected</span>
          </div>
          <button
            type="button"
            onClick={() => disconnect()}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-white/40 hover:bg-white/10 hover:text-white/70 transition"
          >
            <LogOut className="h-3 w-3" />
            Disconnect
          </button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-indigo-300 truncate">{address}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70 transition"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={`https://basescan.org/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Chain warning */}
      {wrongChain && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Switch to Base network in your wallet to see $KNYT balance and make payments.
        </div>
      )}

      {/* KNYT balance */}
      {!wrongChain && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-white/60">EVM $KNYT (Base)</span>
          </div>
          {balanceLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
          ) : (
            <span className="text-sm font-semibold text-amber-300">{knytBalance ?? '—'} $KNYT</span>
          )}
        </div>
      )}

      {/* Send to treasury */}
      {!wrongChain && KNYT_TREASURY && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="h-3.5 w-3.5 text-violet-400" />
            <p className="text-xs font-semibold text-white/70">Pay with EVM $KNYT</p>
          </div>
          <p className="text-[10px] text-white/40 leading-relaxed">
            Send $KNYT to the iQube treasury. Your purchase will be confirmed once the transaction settles on Base (~2 seconds).
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="Amount $KNYT"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-violet-500/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sendState.status === 'waiting' || sendState.status === 'pending' || !sendAmount}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition"
            >
              {sendState.status === 'waiting' || sendState.status === 'pending' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Send
            </button>
          </div>

          {sendState.status === 'success' && sendState.txHash && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-emerald-300 font-medium">Transaction sent</p>
                <a
                  href={`https://basescan.org/tx/${sendState.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400/70 hover:text-emerald-300 font-mono truncate block"
                >
                  {sendState.txHash.slice(0, 18)}…{sendState.txHash.slice(-6)}
                </a>
                <p className="text-emerald-400/50 mt-0.5">Your DVN balance will update once confirmed (~2s).</p>
              </div>
            </div>
          )}

          {sendState.status === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {sendState.error}
            </div>
          )}
        </div>
      )}

      {!KNYT_TREASURY && (
        <p className="text-[10px] text-amber-400/60 text-center pt-1">
          Treasury address not configured — set NEXT_PUBLIC_KNYT_TREASURY_ADDRESS to enable payments.
        </p>
      )}
    </div>
  );
}

// ── Public component (self-provides WagmiProvider) ─────────────────────────────

interface ExternalWalletConnectProps {
  onTxComplete?: (txHash: string, amountKnyt: number) => void;
}

export function ExternalWalletConnect({ onTxComplete }: ExternalWalletConnectProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={walletQueryClient}>
        <ConnectPanel onTxComplete={onTxComplete} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
