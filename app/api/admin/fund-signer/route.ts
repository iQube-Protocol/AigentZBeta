export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";

// Minimal ERC20 ABI
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
];

// Chain config: rpc envs and QCT address mapping
function getChainConfig(chainId: number) {
  const qctAddress = "0x4C4f1aD931589449962bB675bcb8e95672349d09";
  switch (chainId) {
    case 11155111:
      return {
        name: "Ethereum Sepolia",
        rpc: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://rpc.sepolia.org",
        qct: qctAddress,
      };
    case 421614:
      return {
        name: "Arbitrum Sepolia",
        rpc: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA || "https://sepolia-rollup.arbitrum.io/rpc",
        qct: qctAddress,
      };
    case 11155420:
      return {
        name: "Optimism Sepolia",
        rpc: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA || "https://sepolia.optimism.io",
        qct: qctAddress,
      };
    case 84532:
      return {
        name: "Base Sepolia",
        rpc: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || "https://sepolia.base.org",
        qct: qctAddress,
      };
    case 80002:
      return {
        name: "Polygon Amoy",
        rpc: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || "https://rpc-amoy.polygon.technology",
        qct: qctAddress,
      };
    default:
      return null;
  }
}

async function getSignerAddress() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/a2a/signer/address`, { cache: "no-store" }).catch(() => null);
  if (res && res.ok) {
    try { const j = await res.json(); return j?.address as string; } catch {}
  }
  // Fallback: compute locally if env shared
  const pk = process.env.SIGNER_PRIVATE_KEY;
  if (pk) {
    const { ethers } = await import("ethers");
    return new (ethers as any).Wallet(pk).address as string;
  }
  throw new Error("Signer address unavailable");
}

function requireAdmin(req: NextRequest) {
  // Dev-only by default; optionally allow header token in non-prod
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) return true;
  const token = req.headers.get("x-admin-token");
  return !!token && token === process.env.ADMIN_TOKEN;
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const chainIds: number[] = body?.chainIds || [11155111, 421614, 11155420, 84532, 80002];
    const amountQct: string = body?.amountQct || "100"; // human units
    const targetAddress: string = body?.targetAddress; // Optional target address for funding agents

    const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
    if (!TREASURY_PRIVATE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "TREASURY_PRIVATE_KEY not set" }), { status: 500, headers: { "content-type": "application/json" } });
    }

    const signerAddress = await getSignerAddress();
    const recipientAddress = targetAddress || signerAddress; // Use target address if provided, otherwise signer
    const { ethers } = await import("ethers");

    const results: any[] = [];

    for (const cid of chainIds) {
      const cfg = getChainConfig(cid);
      if (!cfg) { results.push({ chainId: cid, error: "unsupported chain" }); continue; }

      try {
        const provider = new (ethers as any).JsonRpcProvider(cfg.rpc);
        const treasury = new (ethers as any).Wallet(TREASURY_PRIVATE_KEY, provider);
        const erc20 = new (ethers as any).Contract(cfg.qct, ERC20_ABI, treasury);

        // Convert human amount to wei-like with 18 decimals
        const decimals = await erc20.decimals();
        const amount = (ethers as any).parseUnits(amountQct, decimals);

        const tx = await erc20.transfer(recipientAddress, amount);
        const receipt = await tx.wait();
        results.push({ chainId: cid, chain: cfg.name, recipient: recipientAddress, hash: tx.hash, status: receipt?.status });
      } catch (e: any) {
        results.push({ chainId: cid, chain: cfg.name, error: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, signer: signerAddress, results }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
