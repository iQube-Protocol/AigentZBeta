"use client";
import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";

const NETWORKS = [
  { label: "Base Sepolia (testnet)", value: "base-sepolia" },
  { label: "Base Mainnet", value: "base" },
  { label: "Ethereum", value: "ethereum" },
];

const CONTRACT_ADDRESS = "0xaF5d81D3BE501F8aCDF77b7f99Dd0ab53882B485";

type MintResult = {
  tokenId: number;
  chainId: number;
  contractAddress: string;
  tx: string;
  explorerUrl: string;
  mintedAt: string;
  owner: string;
  minter: string;
  proofOfState?: { receiptId: string; status: string } | null;
};

type TokenEntry = {
  tokenId: number;
  uri: string;
  minter: string;
  owner: string;
  explorerUrl: string;
};

export default function MintQube() {
  const [metaIdentifier, setMetaIdentifier] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [network, setNetwork] = useState("base-sepolia");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);

  async function loadTokens() {
    setTokensLoading(true);
    try {
      const res = await fetch("/api/core/mint-tokenqube");
      const data = await res.json();
      if (data.tokens) setTokens(data.tokens);
    } catch {
      // non-fatal
    } finally {
      setTokensLoading(false);
    }
  }

  useEffect(() => { loadTokens(); }, []);

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/core/mint-tokenqube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaIdentifier, recipientAddress: recipientAddress || undefined, network }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mint failed");
      setResult(data);
      loadTokens(); // refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-semibold">Mint TokenQube</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Anchor an iQube on-chain as an ERC-721 NFT. Token ID is auto-assigned by the contract.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleMint} className="space-y-4 bg-black/30 p-6 rounded-2xl border border-slate-800">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">
            iQube Identifier <span className="text-red-400">*</span>
          </label>
          <Input
            value={metaIdentifier}
            onChange={(e) => setMetaIdentifier(e.target.value)}
            placeholder="e.g. iq:base/0xContract.../1 or a Supabase UUID"
            required
          />
          <p className="text-xs text-slate-500">
            The metaQube reference stored as the on-chain URI — IPFS CID, Autonomys CID, or <code className="text-slate-400">iq:&lt;chain&gt;/&lt;contract&gt;/&lt;id&gt;</code>.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Recipient Address <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <Input
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x… — leave blank to mint to deployer wallet"
          />
          <p className="text-xs text-slate-500">
            Wallet that will own this TokenQube NFT. Defaults to Moneypenny&apos;s deployer address.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">Network</label>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {NETWORKS.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Contract: <code className="text-slate-400">{CONTRACT_ADDRESS}</code>
          </p>
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={isLoading || !metaIdentifier.trim()}>
            {isLoading ? "Minting on-chain…" : "Mint TokenQube"}
          </Button>
        </div>
      </form>

      {result && (
        <div className="space-y-4 bg-emerald-950/40 border border-emerald-700/40 p-6 rounded-2xl">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <h2 className="text-lg font-semibold text-emerald-300">TokenQube Minted</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Token ID</p>
              <p className="font-mono text-white font-semibold text-lg">#{result.tokenId}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Chain</p>
              <p className="text-slate-200">Base Sepolia ({result.chainId})</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Transaction</p>
              <p className="font-mono text-slate-300 text-xs break-all">{result.tx}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Owner</p>
              <p className="font-mono text-slate-300 text-xs break-all">{result.owner}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Minted At</p>
              <p className="text-slate-300 text-xs">{new Date(result.mintedAt).toLocaleString()}</p>
            </div>
            {result.proofOfState && (
              <div className="col-span-2">
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">ICP Receipt</p>
                <p className="font-mono text-slate-300 text-xs">{result.proofOfState.receiptId}</p>
              </div>
            )}
          </div>
          <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 underline">
            View on Basescan →
          </a>
        </div>
      )}

      {/* Minted tokens list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Minted TokenQubes</h2>
          <button onClick={loadTokens} className="text-xs text-slate-400 hover:text-slate-200">
            Refresh
          </button>
        </div>

        {tokensLoading ? (
          <p className="text-slate-400 text-sm">Loading from contract…</p>
        ) : tokens.length === 0 ? (
          <p className="text-slate-500 text-sm">No TokenQubes minted yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.tokenId} className="bg-black/30 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold font-mono">#{t.tokenId}</span>
                    <span className="text-xs text-slate-500 truncate">{t.uri}</span>
                  </div>
                  <p className="text-xs text-slate-400">Owner: <span className="font-mono">{t.owner}</span></p>
                  <p className="text-xs text-slate-500">Minter: <span className="font-mono">{t.minter}</span></p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <a href={t.explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap">
                    Basescan →
                  </a>
                  <button
                    onClick={() => window.open(`/iqube/view?id=${t.tokenId}`, '_blank')}
                    className="text-xs text-slate-400 hover:text-slate-200 whitespace-nowrap text-left">
                    View →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
