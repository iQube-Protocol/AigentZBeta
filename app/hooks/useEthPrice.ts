import { useEffect, useState } from "react";

const KNYT_ETH_RATE = 0.0005;
const ETH_PRICE_CACHE_KEY = "knyt:ethPriceUsd:v1";
const STATIC_ETH_PRICE_FALLBACK = 3500;
const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

interface CachedEthPrice {
  ethPriceUsd: number;
  fetchedAt: number;
}

function readCached(): CachedEthPrice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ETH_PRICE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ethPriceUsd !== "number" || typeof parsed?.fetchedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCached(ethPriceUsd: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ETH_PRICE_CACHE_KEY,
      JSON.stringify({ ethPriceUsd, fetchedAt: Date.now() } as CachedEthPrice),
    );
  } catch {
    // localStorage quota / disabled — non-fatal
  }
}

export interface EthPriceResult {
  ethPriceUsd: number;
  knytPriceUsd: number;
  knytEthRate: number;
  /** True while we're using a cached or static value (no successful live fetch this session). */
  stale: boolean;
  /** "live" — fresh from CoinGecko this session.
   *  "cached" — value from previous session's localStorage.
   *  "static" — falling back to STATIC_ETH_PRICE_FALLBACK because no cache + fetch hasn't completed/failed. */
  source: "live" | "cached" | "static";
  /** Epoch ms of the source value (cache write time for cached, fetch return time for live). */
  fetchedAt: number | null;
}

export function useEthPrice(): EthPriceResult {
  // Initialise from cache if available — gives immediate render-time value
  // close to current price instead of the static $3500. This minimises the
  // delta between fallback and live until the live fetch lands.
  const [state, setState] = useState<{ ethPriceUsd: number; source: "live" | "cached" | "static"; fetchedAt: number | null }>(() => {
    const cached = readCached();
    if (cached) {
      return { ethPriceUsd: cached.ethPriceUsd, source: "cached", fetchedAt: cached.fetchedAt };
    }
    return { ethPriceUsd: STATIC_ETH_PRICE_FALLBACK, source: "static", fetchedAt: null };
  });

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const next = d?.ethereum?.usd;
        if (typeof next === "number" && next > 0) {
          writeCached(next);
          setState({ ethPriceUsd: next, source: "live", fetchedAt: Date.now() });
        }
      })
      .catch(() => {
        // Keep the cached / static value already in state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stale =
    state.source !== "live" ||
    (state.fetchedAt !== null && Date.now() - state.fetchedAt > STALE_AFTER_MS);

  return {
    ethPriceUsd: state.ethPriceUsd,
    knytPriceUsd: state.ethPriceUsd * KNYT_ETH_RATE,
    knytEthRate: KNYT_ETH_RATE,
    stale,
    source: state.source,
    fetchedAt: state.fetchedAt,
  };
}
