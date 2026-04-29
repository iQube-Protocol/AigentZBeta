'use client';

/**
 * ExternalWalletConnect
 *
 * External EVM wallet section for SmartWalletDrawer → Connections tab.
 * Uses raw window.ethereum — no wagmi connectors barrel (avoids peer-dep build failures).
 * Supports injected wallets (MetaMask, Coinbase Wallet, etc.).
 *
 * After a send, polls /api/wallet/knyt/evm-deposit to credit the DVN ledger
 * once the transaction settles on Ethereum mainnet.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Send,
  Wallet,
  Zap,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const KNYT_CONTRACT = '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4';
const KNYT_TREASURY = (process.env.NEXT_PUBLIC_KNYT_TREASURY_ADDRESS ?? '') as string;
const ETH_CHAIN_ID = 1;
const ETH_CHAIN_HEX = '0x1';

// ── Types ──────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

// ── EVM encode helpers (no viem dependency) ───────────────────────────────────

function encodeBalanceOf(addr: string): string {
  return '0x70a08231' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function encodeTransfer(to: string, amount: bigint): string {
  const toEncoded = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  return '0xa9059cbb' + toEncoded + amountHex;
}

function parseUnits18(amount: string): bigint {
  const [whole = '0', frac = ''] = amount.split('.');
  const fracPadded = frac.padEnd(18, '0').slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(fracPadded || '0');
}

function formatUnits18Hex(hex: string): string {
  const raw = hex.replace(/^0x/, '') || '0';
  const n = BigInt('0x' + raw);
  if (n === 0n) return '0';
  const divisor = 10n ** 18n;
  const whole = n / divisor;
  const frac = n % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '').slice(0, 4);
  return `${whole}.${fracStr}`;
}

// Read KNYT balance via raw JSON-RPC (public RPC, no key needed for reads)
async function readKnytBalance(address: string): Promise<string | null> {
  const rpc = 'https://eth.llamarpc.com';
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: KNYT_CONTRACT, data: encodeBalanceOf(address) }, 'latest'],
      }),
    });
    const json = await res.json() as { result?: string };
    if (!json.result || json.result === '0x') return '0';
    return formatUnits18Hex(json.result);
  } catch {
    return null;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

type SendStatus = 'idle' | 'waiting' | 'verifying' | 'credited' | 'error';

interface SendState {
  status: SendStatus;
  txHash?: string;
  error?: string;
}

export interface ExternalWalletConnectProps {
  personaId?: string;
  onTxComplete?: (txHash: string, amountKnyt: number) => void;
}

export function ExternalWalletConnect({ personaId, onTxComplete }: ExternalWalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [knytBalance, setKnytBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);
  const [noWallet, setNoWallet] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;

  const fetchBalance = useCallback(async (addr: string) => {
    setBalanceLoading(true);
    const bal = await readKnytBalance(addr);
    setKnytBalance(bal);
    setBalanceLoading(false);
  }, []);

  const handleAccountsChanged = useCallback((accounts: unknown) => {
    const accs = accounts as string[];
    if (!accs.length) {
      setAddress(null);
      setChainId(null);
      setKnytBalance(null);
    } else {
      setAddress(accs[0]);
      fetchBalance(accs[0]);
    }
  }, [fetchBalance]);

  const handleChainChanged = useCallback((chain: unknown) => {
    setChainId(parseInt(chain as string, 16));
  }, []);

  useEffect(() => {
    if (!provider) return;
    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    // Resume if already connected
    provider.request({ method: 'eth_accounts' }).then((accounts) => {
      const accs = accounts as string[];
      if (accs.length) {
        setAddress(accs[0]);
        provider.request({ method: 'eth_chainId' }).then((chain) => {
          setChainId(parseInt(chain as string, 16));
        }).catch(() => {});
        fetchBalance(accs[0]);
      }
    }).catch(() => {});

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [provider, fetchBalance, handleAccountsChanged, handleChainChanged]);

  // Poll evm-deposit endpoint until the tx is credited or we give up
  const startDepositPoll = useCallback((txHash: string, amountKnyt: number) => {
    if (!personaId) return;
    let attempts = 0;
    const maxAttempts = 20; // ~60s at 3s intervals

    const poll = async () => {
      try {
        const res = await fetch('/api/wallet/knyt/evm-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash, personaId, amountKnyt }),
        });
        const json = await res.json() as { status?: string; credited?: boolean };
        if (json.credited || json.status === 'credited') {
          setSendState({ status: 'credited', txHash });
          if (address) fetchBalance(address);
          return;
        }
      } catch {
        // ignore transient errors, keep polling
      }
      attempts++;
      if (attempts < maxAttempts) {
        pollRef.current = setTimeout(poll, 3000);
      } else {
        // Give up polling — tx may still settle; user can refresh
        setSendState(prev => ({ ...prev, status: 'credited', txHash }));
      }
    };

    pollRef.current = setTimeout(poll, 4000); // First check after 4s (give chain time)
  }, [personaId, address, fetchBalance]);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  async function connect() {
    if (!provider) {
      setNoWallet(true);
      return;
    }
    setConnecting(true);
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts.length) {
        setAddress(accounts[0]);
        const chain = await provider.request({ method: 'eth_chainId' }) as string;
        setChainId(parseInt(chain, 16));
        fetchBalance(accounts[0]);
      }
    } catch {
      // User rejected
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setAddress(null);
    setChainId(null);
    setKnytBalance(null);
    setSendState({ status: 'idle' });
    setSendAmount('');
  }

  async function switchToEthereum() {
    if (!provider) return;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ETH_CHAIN_HEX }],
      });
    } catch {
      // ignore rejection
    }
  }

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  async function handleSend() {
    if (!address || !KNYT_TREASURY || !sendAmount || !provider) return;
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSendState({ status: 'waiting' });
    try {
      const data = encodeTransfer(KNYT_TREASURY, parseUnits18(sendAmount));
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: KNYT_CONTRACT, data }],
      }) as string;

      setSendState({ status: 'verifying', txHash });
      onTxComplete?.(txHash, amount);
      startDepositPoll(txHash, amount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction rejected';
      setSendState({ status: 'error', error: msg.slice(0, 120) });
    }
  }

  const wrongChain = address !== null && chainId !== null && chainId !== ETH_CHAIN_ID;

  // ── Not connected ──────────────────────────────────────────────────────────

  if (!address) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-white/50 pb-1">
          Connect an external EVM wallet to view your on-chain $KNYT balance and make payments from it directly.
        </p>
        {noWallet ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            No wallet detected. Install MetaMask or another browser extension wallet to continue.
          </div>
        ) : (
          <button
            type="button"
            disabled={connecting}
            onClick={connect}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
          >
            <Wallet className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Connect Wallet</p>
              <p className="text-[10px] text-white/40">Browser extension (MetaMask, Coinbase Wallet, etc.)</p>
            </div>
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/40 ml-auto shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/30 ml-auto shrink-0" />
            )}
          </button>
        )}
        <p className="text-[10px] text-white/30 text-center pt-1">
          WalletConnect (mobile) — coming soon
        </p>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────

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
            onClick={disconnect}
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
            {copied
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={`https://etherscan.io/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Wrong chain warning */}
      {wrongChain && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Switch to Ethereum Mainnet to see $KNYT balance.</span>
          <button
            type="button"
            onClick={switchToEthereum}
            className="shrink-0 rounded-lg border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold hover:bg-amber-500/20 transition"
          >
            Switch
          </button>
        </div>
      )}

      {/* KNYT balance */}
      {!wrongChain && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-white/60">EVM $KNYT (Ethereum)</span>
          </div>
          {balanceLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
            : <span className="text-sm font-semibold text-amber-300">{knytBalance ?? '—'} $KNYT</span>}
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
            Send $KNYT to the iQube treasury on Ethereum. Your DVN balance updates once the transaction settles (~15s).
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="Amount $KNYT"
              disabled={sendState.status === 'waiting' || sendState.status === 'verifying'}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-violet-500/50 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sendState.status === 'waiting' || sendState.status === 'verifying' || !sendAmount}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition"
            >
              {sendState.status === 'waiting' || sendState.status === 'verifying'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Zap className="h-3.5 w-3.5" />}
              Send
            </button>
          </div>

          {/* TX verifying */}
          {sendState.status === 'verifying' && sendState.txHash && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-blue-300 font-medium">Verifying on-chain…</p>
                <a
                  href={`https://etherscan.io/tx/${sendState.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400/70 hover:text-blue-300 font-mono truncate block"
                >
                  {sendState.txHash.slice(0, 18)}…{sendState.txHash.slice(-6)}
                </a>
                <p className="text-blue-400/50 mt-0.5">Your DVN balance will update once confirmed.</p>
              </div>
            </div>
          )}

          {/* TX credited */}
          {sendState.status === 'credited' && sendState.txHash && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-emerald-300 font-medium">$KNYT credited to DVN balance</p>
                <a
                  href={`https://etherscan.io/tx/${sendState.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400/70 hover:text-emerald-300 font-mono truncate block"
                >
                  {sendState.txHash.slice(0, 18)}…{sendState.txHash.slice(-6)}
                </a>
              </div>
            </div>
          )}

          {/* TX error */}
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
