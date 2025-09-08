"use client";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";

export default function MintQube() {
  const [iQubeId, setIQubeId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [network, setNetwork] = useState("Ethereum");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message: string } | null>(null);
  const [transaction, setTransaction] = useState<{ txId: string; explorerUrl: string } | null>(null);

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);
    setTransaction(null);

    try {
      const response = await fetch("/api/core/mint-tokenqube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metaIdentifier: iQubeId,
          tokenId,
          network,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to mint TokenQube");
      }

      setStatus({
        success: true,
        message: "TokenQube minted successfully!",
      });
      
      setTransaction({
        txId: data.tx || "tx_sample_id",
        explorerUrl: data.explorerUrl || `https://etherscan.io/tx/sample_tx_id`,
      });
    } catch (error) {
      console.error("Minting error:", error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-semibold">Mint TokenQube</h1>
      <p className="text-slate-300 mb-4">
        Create a TokenQube by minting an on-chain representation of your iQube.
      </p>

      {status && (
        <div className={`p-4 rounded-xl ${status.success ? "bg-green-500/20 border border-green-500/50 text-green-200" : "bg-red-500/20 border border-red-500/50 text-red-200"}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleMint} className="space-y-4 bg-black/30 p-6 rounded-2xl">
        <Input
          label="iQube Identifier"
          value={iQubeId}
          onChange={(e) => setIQubeId(e.target.value)}
          placeholder="Enter iQube ID"
          required
        />

        <Input
          label="Token ID (optional)"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="Custom token ID (leave blank for auto-generation)"
        />

        <Select
          label="Blockchain Network"
          options={["Ethereum", "Polygon", "Optimism", "Arbitrum", "Base"]}
          value={network}
          onValueChange={setNetwork}
        />

        <div className="pt-2">
          <Button type="submit" disabled={isLoading || !iQubeId.trim()}>
            {isLoading ? "Minting..." : "Mint TokenQube"}
          </Button>
        </div>
      </form>

      {transaction && (
        <div className="space-y-4 bg-black/30 p-6 rounded-2xl">
          <h2 className="text-xl font-medium">Transaction Details</h2>
          
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-slate-400 text-sm">Transaction ID</p>
              <p className="font-mono text-sm break-all">{transaction.txId}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-slate-400 text-sm">Status</p>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <p>Confirmed</p>
              </div>
            </div>
            
            <div className="mt-4">
              <a 
                href={transaction.explorerUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline text-sm"
              >
                View on Block Explorer →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
