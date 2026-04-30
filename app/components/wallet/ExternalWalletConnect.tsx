'use client';

/**
 * ExternalWalletConnect
 *
 * External EVM wallet section for SmartWalletDrawer → Connections tab.
 * Uses raw window.ethereum — no wagmi connectors (avoids peer-dep build failures).
 *
 * Multiple wallet support: detects all installed providers (MetaMask, Phantom, etc.)
 * via window.ethereum.providers and lets the user pick explicitly — prevents Phantom
 * from hijacking window.ethereum and auto-reconnecting.
 *
 * Balance: reads from both KNYT contracts and shows aggregated total.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/utils/supabaseBrowser';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  Send,
  Shield,
  Wallet,
  Zap,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

// Transfer uses the primary KNYT ERC-20 contract
const KNYT_TRANSFER_CONTRACT = '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4';

const KNYT_TREASURY = (process.env.NEXT_PUBLIC_KNYT_TREASURY_ADDRESS ?? '') as string;
const ETH_CHAIN_ID = 1;
const ETH_CHAIN_HEX = '0x1';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
}

// Avoid redeclaring Window.ethereum globally — packages/smartwallet declares it
// as `any` and TS rejects the modifier-narrowing merge. Use a local cast at the
// call site instead (see legacyProviders below).

// ── Provider helpers ──────────────────────────────────────────────────────────

// EIP-6963 types — the standard all modern wallets implement for multi-wallet coexistence
interface EIP6963Info { name: string; icon: string; rdns: string; uuid: string; }
interface EIP6963Detail { info: EIP6963Info; provider: EthereumProvider; }

// Wallet entry shown in the picker (works for both EIP-6963 and legacy window.ethereum)
interface WalletEntry { name: string; icon?: string; provider: EthereumProvider; id: string; }

function legacyWalletName(p: EthereumProvider): string {
  if (p.isPhantom) return 'Phantom';
  if (p.isCoinbaseWallet) return 'Coinbase Wallet';
  if (p.isBraveWallet) return 'Brave Wallet';
  if (p.isRabby) return 'Rabby';
  if (p.isMetaMask) return 'MetaMask';
  return 'Browser Wallet';
}

// Fallback when EIP-6963 returns nothing: read window.ethereum.providers (EIP-5749)
function legacyProviders(): WalletEntry[] {
  if (typeof window === 'undefined') return [];
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (!eth) return [];
  const list = eth.providers?.length ? eth.providers : [eth];
  return list.map((p, i) => ({ name: legacyWalletName(p), provider: p, id: `legacy-${i}` }));
}

// ── EVM encode helpers ─────────────────────────────────────────────────────────

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

// Reads consolidated $KNYT balance (both contracts) via server-side proxy.
// Direct browser RPC calls to eth.llamarpc.com are blocked by CORS.
// Returns the formatted balance string, or throws so the caller can surface an error.
async function readKnytBalance(address: string): Promise<string> {
  const res = await fetch(`/api/wallet/knyt/evm-balance?address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Balance API ${res.status}`);
  // Response: { address, balances: [{ balanceFormatted: "1.2345", ... }] }
  const json = await res.json() as {
    balances?: Array<{ balanceFormatted?: string }>;
    balance?: { balanceFormatted?: string }; // chainId variant
    error?: string;
  };
  if (json.error) throw new Error(json.error);
  const formatted =
    json.balances?.[0]?.balanceFormatted ??
    json.balance?.balanceFormatted ??
    '0';
  return formatted;
}

// ── Component ──────────────────────────────────────────────────────────────────

type SendStatus = 'idle' | 'waiting' | 'verifying' | 'credited' | 'error';

interface SendState {
  status: SendStatus;
  txHash?: string;
  error?: string;
}

type AliasStatus = 'idle' | 'pending' | 'registered' | 'error' | 'precondition';

interface AliasState {
  status: AliasStatus;
  aliasId?: string;
  commitment?: string;
  error?: string;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  } catch { /* ignore */ }
  return headers;
}

const STORAGE_KEY_ADDR = 'ext_wallet_address';
const STORAGE_KEY_ID   = 'ext_wallet_id';

export interface ExternalWalletConnectProps {
  personaId?: string;
  onTxComplete?: (txHash: string, amountKnyt: number) => void;
  /** Called whenever the connected EVM address changes (or undefined on disconnect). */
  onConnected?: (address: string | undefined) => void;
}

export function ExternalWalletConnect({ personaId, onTxComplete, onConnected }: ExternalWalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletName, setWalletName] = useState<string>('');
  const [knytBalance, setKnytBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [sendAmount, setSendAmount] = useState('');
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);
  const [aliasState, setAliasState] = useState<AliasState>({ status: 'idle' });

  // The provider the user explicitly chose — all wallet ops go through this ref
  const activeProviderRef = useRef<EthereumProvider | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // ── Wallet discovery on mount (EIP-6963 + EIP-5749 fallback) ─────────────────

  useEffect(() => {
    const found = new Map<string, WalletEntry>();

    const handler = (event: Event) => {
      const e = event as CustomEvent<EIP6963Detail>;
      const { info, provider } = e.detail;
      if (!found.has(info.uuid)) {
        found.set(info.uuid, { name: info.name, icon: info.icon, provider, id: info.uuid });
        setWallets(Array.from(found.values()));
      }
    };

    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // After 300ms fall back to legacy window.ethereum if no EIP-6963 wallets announced
    const fallback = setTimeout(() => {
      if (found.size === 0) {
        const legacy = legacyProviders();
        legacy.forEach(w => found.set(w.id, w));
        if (legacy.length) setWallets(legacy);
      }
    }, 300);

    return () => {
      window.removeEventListener('eip6963:announceProvider', handler);
      clearTimeout(fallback);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore previous MetaMask connection after navigation (non-prompting eth_accounts check)
  useEffect(() => {
    if (address || wallets.length === 0) return;
    let savedAddr: string | null = null;
    let savedId: string | null = null;
    try {
      savedAddr = sessionStorage.getItem(STORAGE_KEY_ADDR);
      savedId   = sessionStorage.getItem(STORAGE_KEY_ID);
    } catch { return; }
    if (!savedAddr) return;

    const wallet = savedId ? wallets.find(w => w.id === savedId) : wallets[0];
    if (!wallet) return;

    wallet.provider.request({ method: 'eth_accounts' })
      .then((accounts: unknown) => {
        const accs = accounts as string[];
        if (accs.length && accs[0].toLowerCase() === savedAddr!.toLowerCase()) {
          setupProvider(wallet.provider, accs[0], wallet.id);
        } else {
          try { sessionStorage.removeItem(STORAGE_KEY_ADDR); sessionStorage.removeItem(STORAGE_KEY_ID); } catch { /**/ }
        }
      })
      .catch(() => {
        try { sessionStorage.removeItem(STORAGE_KEY_ADDR); sessionStorage.removeItem(STORAGE_KEY_ID); } catch { /**/ }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  const fetchBalance = useCallback(async (addr: string) => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const bal = await readKnytBalance(addr);
      setKnytBalance(bal);
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : 'Balance unavailable');
      setKnytBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // Privacy-preserving alias registration. After a wallet connects, request a
  // signed ownership proof and POST it to /api/identity/wallet-alias/register.
  // The API stores only an HMAC-keyed commitment hash — never the address.
  const registerAlias = useCallback(async (p: EthereumProvider, addr: string) => {
    if (!personaId) {
      // Surface the missing context instead of failing silently — easier to diagnose
      setAliasState({ status: 'error', error: 'No persona context. Open a persona before linking a wallet.' });
      return;
    }
    setAliasState({ status: 'pending' });
    try {
      const auth = await getAuthHeader();
      // 1. Request server-issued challenge
      const challengeUrl =
        `/api/identity/wallet-alias/challenge?didPersonaId=${encodeURIComponent(personaId)}` +
        `&chain=evm&address=${encodeURIComponent(addr)}`;
      const cRes = await fetch(challengeUrl, { headers: auth });
      const cText = await cRes.text();
      let cJson: { ok?: boolean; message?: string; nonce?: string; error?: string };
      try {
        cJson = JSON.parse(cText) as typeof cJson;
      } catch {
        throw new Error(`Challenge (${cRes.status}): ${cText.slice(0, 200) || 'empty response'}`);
      }
      if (!cRes.ok || !cJson.message) {
        throw new Error(cJson.error || `Challenge ${cRes.status}`);
      }
      // 2. Sign with the connected wallet (personal_sign expects [message, address])
      const signature = await p.request({
        method: 'personal_sign',
        params: [cJson.message, addr],
      }) as string;
      // 3. POST proof to register
      const rRes = await fetch('/api/identity/wallet-alias/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          didPersonaId: personaId,
          chain: 'evm',
          walletAddress: addr,
          message: cJson.message,
          signature,
        }),
      });
      const rText = await rRes.text();
      let rJson: { ok?: boolean; id?: string; aliasCommitment?: string; error?: string };
      try {
        rJson = JSON.parse(rText) as typeof rJson;
      } catch {
        throw new Error(`Register (${rRes.status}): ${rText.slice(0, 200) || 'empty response'}`);
      }
      if (rRes.status === 409) {
        // Already linked → treat as success
        setAliasState({ status: 'registered' });
        return;
      }
      if (rRes.status === 404 || (rJson.error || '').includes('Bind a Root DID') || (rJson.error || '').includes('no bound root')) {
        setAliasState({ status: 'precondition', error: 'Bind your Root DID to this persona before linking a wallet.' });
        return;
      }
      if (rRes.status === 503) {
        // Timeout from the server — safe to retry
        throw new Error(rJson.error || 'Server timed out — please retry');
      }
      if (!rRes.ok || !rJson.ok) throw new Error(rJson.error || `Register ${rRes.status}`);
      setAliasState({ status: 'registered', aliasId: rJson.id, commitment: rJson.aliasCommitment });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Alias registration failed';
      // User rejected the signature is expected — don't show as error
      if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
        setAliasState({ status: 'idle' });
        return;
      }
      setAliasState({ status: 'error', error: msg.slice(0, 160) });
    }
  }, [personaId]);

  // Attach event listeners to the selected provider and initialise state
  const setupProvider = useCallback((p: EthereumProvider, connectedAddress: string, walletId?: string) => {
    // Tear down any previous provider's listeners
    const prev = activeProviderRef.current;
    if (prev) {
      prev.removeListener('accountsChanged', handleAccountsChanged);
      prev.removeListener('chainChanged', handleChainChanged);
    }

    activeProviderRef.current = p;
    setAddress(connectedAddress);
    setWalletName(legacyWalletName(p));
    onConnected?.(connectedAddress);

    // Persist connection so it survives navigation (restored on mount)
    try {
      sessionStorage.setItem(STORAGE_KEY_ADDR, connectedAddress.toLowerCase());
      if (walletId) sessionStorage.setItem(STORAGE_KEY_ID, walletId);
    } catch { /* ignore quota/security errors */ }

    p.on('accountsChanged', handleAccountsChanged);
    p.on('chainChanged', handleChainChanged);

    p.request({ method: 'eth_chainId' })
      .then((chain) => setChainId(parseInt(chain as string, 16)))
      .catch(() => {});

    fetchBalance(connectedAddress);
    void registerAlias(p, connectedAddress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBalance, onConnected, registerAlias]);

  // Keep stable refs for event handlers so we can removeListener correctly
  function handleAccountsChanged(accounts: unknown) {
    const accs = accounts as string[];
    if (!accs.length) {
      teardown();
    } else {
      setAddress(accs[0]);
      onConnected?.(accs[0]);
      fetchBalance(accs[0]);
    }
  }

  function handleChainChanged(chain: unknown) {
    setChainId(parseInt(chain as string, 16));
  }

  function teardown() {
    const p = activeProviderRef.current;
    if (p) {
      p.removeListener('accountsChanged', handleAccountsChanged);
      p.removeListener('chainChanged', handleChainChanged);
      activeProviderRef.current = null;
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY_ADDR);
      sessionStorage.removeItem(STORAGE_KEY_ID);
    } catch { /* ignore */ }
    setAddress(null);
    setChainId(null);
    setKnytBalance(null);
    setWalletName('');
    setSendState({ status: 'idle' });
    setSendAmount('');
    setAliasState({ status: 'idle' });
    onConnected?.(undefined);
  }

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    teardown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect to a specific wallet ─────────────────────────────────────────────

  async function connectTo(p: EthereumProvider, id: string) {
    setConnectingId(id);
    setConnectError(null);
    const abort = { cancelled: false };
    connectAbortRef.current = abort;

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Wallet not responding — open the extension and approve the connection request.')),
        30_000,
      );
    });

    try {
      const accounts = await Promise.race([
        p.request({ method: 'eth_requestAccounts' }) as Promise<string[]>,
        timeout,
      ]);
      clearTimeout(timeoutId!);
      if (abort.cancelled) return;
      if (accounts.length) setupProvider(p, accounts[0], id);
    } catch (err: unknown) {
      clearTimeout(timeoutId!);
      if (abort.cancelled) return;
      const msg = err instanceof Error ? err.message : '';
      if (msg && !msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('user denied')) {
        setConnectError(msg);
      }
    } finally {
      if (!abort.cancelled) setConnectingId(null);
    }
  }

  function cancelConnect() {
    connectAbortRef.current.cancelled = true;
    setConnectingId(null);
    setConnectError(null);
  }

  // ── Deposit poll ──────────────────────────────────────────────────────────────

  const startDepositPoll = useCallback((txHash: string, amountKnyt: number) => {
    if (!personaId) return;
    let attempts = 0;

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
      } catch { /* ignore */ }
      attempts++;
      if (attempts < 20) {
        pollRef.current = setTimeout(poll, 3000);
      } else {
        setSendState(prev => ({ ...prev, status: 'credited', txHash }));
      }
    };

    pollRef.current = setTimeout(poll, 4000);
  }, [personaId, address, fetchBalance]);

  // ── Wallet ops ────────────────────────────────────────────────────────────────

  async function switchToEthereum() {
    const p = activeProviderRef.current;
    if (!p) return;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ETH_CHAIN_HEX }] });
    } catch { /* ignore */ }
  }

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  async function handleSend() {
    const p = activeProviderRef.current;
    if (!address || !KNYT_TREASURY || !sendAmount || !p) return;
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSendState({ status: 'waiting' });
    try {
      const data = encodeTransfer(KNYT_TREASURY, parseUnits18(sendAmount));
      const txHash = await p.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: KNYT_TRANSFER_CONTRACT, data }],
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

  // ── Not connected ─────────────────────────────────────────────────────────────

  if (!address) {
    const isConnecting = connectingId !== null;
    return (
      <div className="space-y-3">
        <p className="text-xs text-white/50 pb-1">
          Connect an external EVM wallet to view your consolidated on-chain $KNYT balance and make payments from it directly.
        </p>

        {wallets.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            No wallet detected. Install MetaMask or another browser extension wallet to continue.
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((w) => {
              const spinning = connectingId === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  disabled={isConnecting}
                  onClick={() => connectTo(w.provider, w.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
                >
                  {w.icon
                    ? <img src={w.icon} alt={w.name} className="h-5 w-5 rounded shrink-0" />
                    : <Wallet className="h-5 w-5 text-amber-400 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{w.name}</p>
                    <p className="text-[10px] text-white/40">
                      {spinning ? 'Check your wallet for a connection request…' : 'Click to connect'}
                    </p>
                  </div>
                  {spinning
                    ? <Loader2 className="h-4 w-4 animate-spin text-white/40 ml-auto shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-white/30 ml-auto shrink-0" />}
                </button>
              );
            })}

            {isConnecting && (
              <button
                type="button"
                onClick={cancelConnect}
                className="w-full text-center text-[10px] text-white/30 hover:text-white/50 transition py-1"
              >
                Cancel
              </button>
            )}

            {connectError && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{connectError}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-white/30 text-center pt-1">
          WalletConnect (mobile) — coming soon
        </p>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Connected address card */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/50">
              Connected · {walletName}
            </span>
          </div>
          <button
            type="button"
            onClick={teardown}
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

      {/* Privacy alias status — visible whenever a personaId is in scope */}
      {personaId && aliasState.status !== 'idle' && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
          aliasState.status === 'registered' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : aliasState.status === 'pending' ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
          : aliasState.status === 'precondition' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-red-500/30 bg-red-500/10 text-red-300'
        }`}>
          {aliasState.status === 'pending' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin" />
          ) : aliasState.status === 'registered' ? (
            <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            {aliasState.status === 'pending' && (
              <>
                <p className="font-medium">Action needed in MetaMask</p>
                <p className="opacity-70 mt-0.5">
                  Check your MetaMask extension for a <strong>Sign Message</strong> popup — this is a separate step from connecting. Click Sign to link your wallet privately.
                </p>
                <button
                  type="button"
                  onClick={() => setAliasState({ status: 'idle' })}
                  className="mt-1.5 underline opacity-60 hover:opacity-100 text-[10px]"
                >
                  Dismiss
                </button>
              </>
            )}
            {aliasState.status === 'registered' && (
              <>
                <p className="font-medium">Wallet linked privately</p>
                <p className="opacity-70 mt-0.5">Only a one-way commitment hash is stored — your address never enters our database.</p>
              </>
            )}
            {aliasState.status === 'precondition' && (
              <>
                <p className="font-medium">Root DID not yet bound</p>
                <p className="opacity-80 mt-0.5">{aliasState.error}</p>
              </>
            )}
            {aliasState.status === 'error' && (
              <>
                <p className="font-medium">Privacy alias registration failed</p>
                <p className="opacity-80 mt-0.5">{aliasState.error}</p>
                <button
                  type="button"
                  onClick={() => {
                    const p = activeProviderRef.current;
                    if (p && address) registerAlias(p, address);
                  }}
                  className="mt-1 underline opacity-80 hover:opacity-100"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* KNYT balance — consolidated from both contracts */}
      {!wrongChain && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <div>
                <span className="text-xs text-white/60">EVM $KNYT (Ethereum)</span>
                <p className="text-[9px] text-white/30">Consolidated — 2 contracts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {balanceLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                : <span className="text-sm font-semibold text-amber-300">{knytBalance ?? '—'} $KNYT</span>}
              <button
                type="button"
                onClick={() => address && fetchBalance(address)}
                disabled={balanceLoading}
                title="Refresh balance"
                className="rounded p-1 text-white/30 hover:text-white/60 hover:bg-white/10 transition disabled:opacity-30"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
          <p className="text-[9px] text-white/20 font-mono truncate" title={address ?? ''}>
            querying: {address}
          </p>
          {balanceError && (
            <p className="text-[10px] text-red-400/70">{balanceError}</p>
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

          {sendState.status === 'verifying' && sendState.txHash && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-blue-300 font-medium">Verifying on-chain…</p>
                <a href={`https://etherscan.io/tx/${sendState.txHash}`} target="_blank" rel="noreferrer"
                  className="text-blue-400/70 hover:text-blue-300 font-mono truncate block">
                  {sendState.txHash.slice(0, 18)}…{sendState.txHash.slice(-6)}
                </a>
                <p className="text-blue-400/50 mt-0.5">Your DVN balance will update once confirmed.</p>
              </div>
            </div>
          )}

          {sendState.status === 'credited' && sendState.txHash && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-emerald-300 font-medium">$KNYT credited to DVN balance</p>
                <a href={`https://etherscan.io/tx/${sendState.txHash}`} target="_blank" rel="noreferrer"
                  className="text-emerald-400/70 hover:text-emerald-300 font-mono truncate block">
                  {sendState.txHash.slice(0, 18)}…{sendState.txHash.slice(-6)}
                </a>
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
