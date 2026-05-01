'use client';

/**
 * Minimal hook for signing an EVM KNYT transfer from the user's browser wallet.
 * Extracts the send logic from ExternalWalletConnect so ContentPurchaseModal
 * can trigger on-chain KNYT payments without mounting the full wallet UI.
 */

import { useCallback, useState } from 'react';

const KNYT_CONTRACT = '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4';
const ETH_CHAIN_HEX = '0x1';

type EvmKnytStatus = 'idle' | 'connecting' | 'waiting' | 'done' | 'error';

interface EthProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function getProvider(): EthProvider | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
}

function encodeTransfer(to: string, amount: bigint): string {
  const toEncoded = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  return '0xa9059cbb' + toEncoded + amountHex;
}

function toUnits18(amount: number): bigint {
  const str = amount.toFixed(18);
  const [whole = '0', frac = ''] = str.split('.');
  const fracPadded = frac.padEnd(18, '0').slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(fracPadded || '0');
}

export interface UseEvmKnytPaymentReturn {
  status: EvmKnytStatus;
  txHash: string | null;
  error: string | null;
  address: string | null;
  /** Send amountKnyt KNYT from user's wallet to treasury. Resolves with txHash. */
  sendKnyt: (amountKnyt: number) => Promise<string>;
  reset: () => void;
}

export function useEvmKnytPayment(): UseEvmKnytPaymentReturn {
  const [status, setStatus] = useState<EvmKnytStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const sendKnyt = useCallback(async (amountKnyt: number): Promise<string> => {
    const treasury = process.env.NEXT_PUBLIC_KNYT_TREASURY_ADDRESS ?? '';
    const p = getProvider();
    if (!p) throw new Error('No EVM wallet detected — install MetaMask or a compatible wallet');
    if (!treasury) throw new Error('Treasury address not configured');

    let from = address;
    if (!from) {
      setStatus('connecting');
      setError(null);
      const accounts = await p.request({ method: 'eth_requestAccounts' }) as string[];
      from = accounts[0];
      if (!from) throw new Error('No wallet accounts available');
      setAddress(from);
    }

    // Ensure we're on Ethereum mainnet
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ETH_CHAIN_HEX }] });
    } catch { /* ignore — wallet may already be on mainnet */ }

    setStatus('waiting');
    setError(null);

    const data = encodeTransfer(treasury, toUnits18(amountKnyt));
    const hash = await p.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: KNYT_CONTRACT, data }],
    }) as string;

    setTxHash(hash);
    setStatus('done');
    return hash;
  }, [address]);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  return { status, txHash, error, address, sendKnyt, reset };
}
