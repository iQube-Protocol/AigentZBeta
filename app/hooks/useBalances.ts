import { useEffect, useState } from "react";
import { ethers } from "ethers";

const QCT_SEPOLIA = process.env.NEXT_PUBLIC_QCT_SEPOLIA as `0x${string}` | undefined;
const QCT_ARB = process.env.NEXT_PUBLIC_QCT_ARB_SEPOLIA as `0x${string}` | undefined;
const KNYT_SEP = process.env.NEXT_PUBLIC_KNYT_SEPOLIA as `0x${string}` | undefined;
const USDC_SEPOLIA = (process.env.NEXT_PUBLIC_USDC_SEPOLIA || process.env.USDC_SEPOLIA) as `0x${string}` | undefined;
const RPC_SEPOLIA = process.env.NEXT_PUBLIC_RPC_SEPOLIA as string | undefined;
const RPC_ARB = process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA as string | undefined;
const BTC_BALANCE_API = process.env.NEXT_PUBLIC_BTC_BALANCE_API as string | undefined;

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export type Balances = {
  qctSep: string;
  qctArb: string;
  knytSep: string;
  btcQcent: string;
  usdcSep: string;
  qctSepDecimals?: number;
  qctArbDecimals?: number;
  knytSepDecimals?: number;
  usdcSepDecimals?: number;
};

// Global cache to prevent multiple fetches for same address
const balanceCache = new Map<string, { balance: string; decimals: number; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

export function useBalances(addresses: { sepolia?: `0x${string}`; arb?: `0x${string}`; btc?: string }) {
  const [state, setState] = useState<Balances>({ qctSep: "0", qctArb: "0", knytSep: "0", btcQcent: "0", usdcSep: "0" });

  useEffect(() => {
    let cancel = false;
    
    const fetchBalances = async () => {
      const res: Partial<Balances> = {};
      
      // Hardcode the working values we know
      const HARDCODED_QCT_CONTRACT = "0x4C4f1aD931589449962bB675bcb8e95672349d09";
      const HARDCODED_ARB_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
      
      // Always try Arbitrum first since that's where the funds are
      if (addresses.arb) {
        const cacheKey = `arb-${addresses.arb}`;
        const cached = balanceCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          // Use cached value
          res.qctArb = cached.balance;
          res.qctArbDecimals = cached.decimals;
        } else {
          // Fetch fresh value
          try {
            const provider = new ethers.JsonRpcProvider(HARDCODED_ARB_RPC);
            const contract = new ethers.Contract(HARDCODED_QCT_CONTRACT, ERC20_ABI, provider);
            const balance = await contract.balanceOf(addresses.arb);
            const decimals = await contract.decimals();
            
            const balanceStr = balance.toString();
            const decimalsNum = Number(decimals);
            
            res.qctArb = balanceStr;
            res.qctArbDecimals = decimalsNum;
            
            // Cache the result
            balanceCache.set(cacheKey, {
              balance: balanceStr,
              decimals: decimalsNum,
              timestamp: now
            });
          } catch (error) {
            console.warn('Arbitrum balance fetch failed:', error);
            // Use cached value if available, even if expired
            if (cached) {
              res.qctArb = cached.balance;
              res.qctArbDecimals = cached.decimals;
            }
          }
        }
      }
      
      // Try Sepolia with caching
      if (addresses.sepolia && RPC_SEPOLIA && QCT_SEPOLIA) {
        const cacheKey = `sep-${addresses.sepolia}`;
        const cached = balanceCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          res.qctSep = cached.balance;
          res.qctSepDecimals = cached.decimals;
        } else {
          try {
            const provider = new ethers.JsonRpcProvider(RPC_SEPOLIA);
            const contract = new ethers.Contract(QCT_SEPOLIA, ERC20_ABI, provider);
            const balance = await contract.balanceOf(addresses.sepolia);
            const decimals = await contract.decimals();
            
            const balanceStr = balance.toString();
            const decimalsNum = Number(decimals);
            
            res.qctSep = balanceStr;
            res.qctSepDecimals = decimalsNum;
            
            balanceCache.set(cacheKey, {
              balance: balanceStr,
              decimals: decimalsNum,
              timestamp: now
            });
          } catch (error) {
            console.warn('Sepolia balance fetch failed:', error);
            if (cached) {
              res.qctSep = cached.balance;
              res.qctSepDecimals = cached.decimals;
            }
          }
        }
      }
      
      if (!cancel) {
        setState(prev => ({ ...prev, ...res }));
      }
    };
    
    fetchBalances();
    
    return () => {
      cancel = true;
    };
  }, [addresses.sepolia, addresses.arb, addresses.btc]);

  return state;
}
