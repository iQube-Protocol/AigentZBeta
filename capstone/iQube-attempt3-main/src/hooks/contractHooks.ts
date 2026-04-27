import { useState, useEffect, useCallback } from "react";
import type { Address } from "viem";
import {
  getMetaQubeLocation,
  ownerOf as readOwnerOf,
  mintQube as mintQubeTx,
  transferQube as transferQubeTx,
} from "../utilities/contractUtils";

// React hooks that mirror the old Thirdweb hook API so components need minimal changes.

export function useMetaQubeLocation(tokenId: string | number) {
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (tokenId === "" || tokenId === undefined) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setData(null);
    setIsLoading(true);
    getMetaQubeLocation(Number(tokenId))
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return { data, isLoading, error };
}

export function useMintQube() {
  const [transactionResult, setTransactionResult] = useState<{ transactionHash: string } | null>(null);
  const [transactionError, setTransactionError] = useState<Error | null>(null);

  const mintQube = useCallback(
    async (to: Address, metaQubeLocation: string): Promise<`0x${string}` | undefined> => {
      if (!to || !metaQubeLocation) return undefined;
      setTransactionError(null);
      setTransactionResult(null);
      try {
        const hash = await mintQubeTx(to, metaQubeLocation);
        setTransactionResult({ transactionHash: hash });
        return hash;
      } catch (err) {
        setTransactionError(err instanceof Error ? err : new Error(String(err)));
        return undefined;
      }
    },
    []
  );

  return { mintQube, transactionResult, transactionError };
}

export function useOwnerOf(tokenId: string | number) {
  const [data, setData] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (tokenId === "" || tokenId === undefined) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setData(null);
    setIsLoading(true);
    readOwnerOf(Number(tokenId))
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return { data, isLoading, error };
}

export function useTransferQube(tokenId: string | number, to: Address | null) {
  const [transactionResult, setTransactionResult] = useState<{ transactionHash: string } | null>(null);
  const [transactionError, setTransactionError] = useState<Error | null>(null);

  const transfer = useCallback(async () => {
    if (to == null || tokenId === "" || tokenId === undefined) return;
    setTransactionError(null);
    setTransactionResult(null);
    try {
      const hash = await transferQubeTx(to, Number(tokenId));
      setTransactionResult({ transactionHash: hash });
    } catch (err) {
      setTransactionError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [to, tokenId]);

  return { transfer, transactionResult, transactionError };
}
