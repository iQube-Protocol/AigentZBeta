'use client';

/**
 * useExternalWallet — read-mostly hook that mirrors ExternalWalletConnect's
 * persisted connection so other surfaces (TransactionModal, etc.) can sign
 * with the user's already-connected EVM wallet without duplicating UI.
 *
 * Discovers wallets via EIP-6963 (with EIP-5749 / window.ethereum.providers
 * fallback). On mount, restores the previously selected wallet using the same
 * sessionStorage keys ExternalWalletConnect writes (ext_wallet_address,
 * ext_wallet_id) — so a user who already connected from the SmartWalletDrawer
 * is immediately ready to sign in this hook's consumer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY_ADDR = 'ext_wallet_address';
const STORAGE_KEY_ID = 'ext_wallet_id';

export interface EthereumProvider {
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

interface EIP6963Info { name: string; icon: string; rdns: string; uuid: string; }
interface EIP6963Detail { info: EIP6963Info; provider: EthereumProvider; }

export interface WalletEntry { name: string; icon?: string; provider: EthereumProvider; id: string; }

function legacyWalletName(p: EthereumProvider): string {
  if (p.isPhantom) return 'Phantom';
  if (p.isCoinbaseWallet) return 'Coinbase Wallet';
  if (p.isBraveWallet) return 'Brave Wallet';
  if (p.isRabby) return 'Rabby';
  if (p.isMetaMask) return 'MetaMask';
  return 'Browser Wallet';
}

function legacyProviders(): WalletEntry[] {
  if (typeof window === 'undefined') return [];
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (!eth) return [];
  const list = eth.providers?.length ? eth.providers : [eth];
  return list.map((p, i) => ({ name: legacyWalletName(p), provider: p, id: `legacy-${i}` }));
}

export interface UseExternalWalletResult {
  address: string | null;
  chainId: number | null;
  walletName: string;
  wallets: WalletEntry[];
  provider: EthereumProvider | null;
  connecting: boolean;
  error: string | null;
  connect: (walletId: string) => Promise<void>;
  switchToChain: (chainIdHex: string) => Promise<void>;
}

export function useExternalWallet(): UseExternalWalletResult {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletName, setWalletName] = useState<string>('');
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerRef = useRef<EthereumProvider | null>(null);
  // Force a re-render when providerRef updates (since refs don't trigger renders)
  const [, forceRender] = useState(0);

  const handleAccountsChanged = useCallback((accounts: unknown) => {
    const accs = accounts as string[];
    if (!accs.length) {
      providerRef.current = null;
      setAddress(null);
      setWalletName('');
      forceRender((n) => n + 1);
    } else {
      setAddress(accs[0]);
    }
  }, []);

  const handleChainChanged = useCallback((chain: unknown) => {
    setChainId(parseInt(chain as string, 16));
  }, []);

  const attachProvider = useCallback((
    p: EthereumProvider,
    addr: string,
    walletId?: string,
  ) => {
    const prev = providerRef.current;
    if (prev) {
      prev.removeListener('accountsChanged', handleAccountsChanged);
      prev.removeListener('chainChanged', handleChainChanged);
    }
    providerRef.current = p;
    setAddress(addr);
    setWalletName(legacyWalletName(p));
    forceRender((n) => n + 1);

    try {
      sessionStorage.setItem(STORAGE_KEY_ADDR, addr.toLowerCase());
      if (walletId) sessionStorage.setItem(STORAGE_KEY_ID, walletId);
    } catch { /* ignore */ }

    p.on('accountsChanged', handleAccountsChanged);
    p.on('chainChanged', handleChainChanged);

    p.request({ method: 'eth_chainId' })
      .then((c) => setChainId(parseInt(c as string, 16)))
      .catch(() => {});
  }, [handleAccountsChanged, handleChainChanged]);

  // EIP-6963 discovery on mount
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
    const fallback = setTimeout(() => {
      if (found.size === 0) {
        const legacy = legacyProviders();
        legacy.forEach((w) => found.set(w.id, w));
        if (legacy.length) setWallets(legacy);
      }
    }, 300);
    return () => {
      window.removeEventListener('eip6963:announceProvider', handler);
      clearTimeout(fallback);
    };
  }, []);

  // Restore previous connection from sessionStorage (non-prompting eth_accounts)
  useEffect(() => {
    if (address || wallets.length === 0) return;
    let savedAddr: string | null = null;
    let savedId: string | null = null;
    try {
      savedAddr = sessionStorage.getItem(STORAGE_KEY_ADDR);
      savedId = sessionStorage.getItem(STORAGE_KEY_ID);
    } catch { return; }
    if (!savedAddr) return;

    const wallet = savedId ? wallets.find((w) => w.id === savedId) : wallets[0];
    if (!wallet) return;

    wallet.provider.request({ method: 'eth_accounts' })
      .then((accounts: unknown) => {
        const accs = accounts as string[];
        if (accs.length && accs[0].toLowerCase() === savedAddr!.toLowerCase()) {
          attachProvider(wallet.provider, accs[0], wallet.id);
        }
      })
      .catch(() => { /* ignore */ });
  }, [wallets, address, attachProvider]);

  // Cleanup listeners on unmount
  useEffect(() => () => {
    const p = providerRef.current;
    if (p) {
      p.removeListener('accountsChanged', handleAccountsChanged);
      p.removeListener('chainChanged', handleChainChanged);
    }
  }, [handleAccountsChanged, handleChainChanged]);

  const connect = useCallback(async (walletId: string) => {
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet) {
      setError('Wallet not found');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts.length) attachProvider(wallet.provider, accounts[0], wallet.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('user denied')) {
        setError(msg);
      }
    } finally {
      setConnecting(false);
    }
  }, [wallets, attachProvider]);

  const switchToChain = useCallback(async (chainIdHex: string) => {
    const p = providerRef.current;
    if (!p) return;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chain switch failed';
      setError(msg);
    }
  }, []);

  return {
    address,
    chainId,
    walletName,
    wallets,
    provider: providerRef.current,
    connecting,
    error,
    connect,
    switchToChain,
  };
}
