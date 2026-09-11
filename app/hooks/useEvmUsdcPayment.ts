'use client';

/**
 * Minimal hook for sending a USDC (ERC-20, 6-decimal) transfer from the user's
 * browser wallet to a server-provided treasury — for plan-subscription USDC
 * settlement on Base. Mirrors useEvmKnytPayment, but every address (token,
 * treasury) comes from the server's USDC payment intent, so the client never
 * hardcodes or guesses a contract/treasury address.
 */

import { useCallback, useState } from 'react';

type EvmUsdcStatus = 'idle' | 'connecting' | 'switching' | 'waiting' | 'done' | 'error';

interface EthProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function getProvider(): EthProvider | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
}

// ERC-20 transfer(address,uint256) selector + ABI-encoded args.
function encodeTransfer(to: string, amount: bigint): string {
  const toEncoded = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  return '0xa9059cbb' + toEncoded + amountHex;
}

export interface UsdcPaymentIntent {
  chainId: number;
  tokenAddress: string;
  payTo: string;
  amountUsdcMicroUnits: string;
}

export interface UseEvmUsdcPaymentReturn {
  status: EvmUsdcStatus;
  txHash: string | null;
  error: string | null;
  address: string | null;
  /** Send the intent's USDC amount to the intent's treasury. Resolves with txHash. */
  payUsdc: (intent: UsdcPaymentIntent) => Promise<string>;
  reset: () => void;
}

export function useEvmUsdcPayment(): UseEvmUsdcPaymentReturn {
  const [status, setStatus] = useState<EvmUsdcStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const payUsdc = useCallback(
    async (intent: UsdcPaymentIntent): Promise<string> => {
      const p = getProvider();
      if (!p) throw new Error('No EVM wallet detected — install MetaMask or a compatible wallet');
      if (!intent.tokenAddress || !intent.payTo) throw new Error('USDC payment not configured');

      setStatus('connecting');
      setError(null);
      const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[];
      const from = accounts[0];
      if (!from) throw new Error('No wallet accounts available');
      setAddress(from);

      // Switch to the intent's chain (e.g. Base mainnet = 0x2105).
      const chainHex = '0x' + intent.chainId.toString(16);
      setStatus('switching');
      try {
        await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] });
      } catch {
        /* ignore — wallet may already be on the target chain */
      }

      setStatus('waiting');
      const data = encodeTransfer(intent.payTo, BigInt(intent.amountUsdcMicroUnits));
      const hash = (await p.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: intent.tokenAddress, data }],
      })) as string;

      setTxHash(hash);
      setStatus('done');
      return hash;
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  return { status, txHash, error, address, payUsdc, reset };
}
