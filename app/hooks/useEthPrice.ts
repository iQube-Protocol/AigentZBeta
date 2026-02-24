import { useEffect, useState } from "react";

const KNYT_ETH_RATE = 0.0005;

export function useEthPrice() {
  const [ethPriceUsd, setEthPriceUsd] = useState(3500);

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const next = d?.ethereum?.usd;
        if (typeof next === "number") setEthPriceUsd(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    ethPriceUsd,
    knytPriceUsd: ethPriceUsd * KNYT_ETH_RATE,
    knytEthRate: KNYT_ETH_RATE,
  };
}
