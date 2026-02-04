import { useState, useEffect } from 'react';
const KNYT_ETH = 0.0005;
export function useEthPrice() {
  const [eth, setEth] = useState(3500);
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then(r => r.json()).then(d => d?.ethereum?.usd && setEth(d.ethereum.usd)).catch(() => {});
  }, []);
  return { ethPriceUsd: eth, knytPriceUsd: eth * KNYT_ETH, knytEthRate: KNYT_ETH };
}
