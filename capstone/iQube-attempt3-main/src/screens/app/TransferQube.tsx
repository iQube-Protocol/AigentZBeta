import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import { ownerOf, transferQube } from "../../utilities/contractUtils";
import { supabase } from "../../utilities/supabase";
import type { Address } from "viem";
import Navbar from "../../components/Navbar";

export default function TransferQube() {
  const { address } = useWallet();
  const [searchParams] = useSearchParams();
  const [tokenId, setTokenId] = useState(searchParams.get("tokenId") ?? "");
  const [recipient, setRecipient] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const handleTransfer = async () => {
    if (!address) {
      setError("Please connect your wallet first.");
      return;
    }
    if (!tokenId.trim()) {
      setError("Please enter a token ID.");
      return;
    }
    if (!recipient.trim() || !/^0x[a-fA-F0-9]{40}$/.test(recipient.trim())) {
      setError("Please enter a valid Ethereum address (0x...).");
      return;
    }
    if (recipient.toLowerCase() === address.toLowerCase()) {
      setError("You cannot transfer to yourself.");
      return;
    }

    setIsLoading(true);
    setError("");
    setTxHash("");

    try {
      // Verify ownership
      const owner = await ownerOf(Number(tokenId));
      if (owner.toLowerCase() !== address.toLowerCase()) {
        setError("You are not the owner of this iQube.");
        return;
      }

      // Execute transfer
      const hash = await transferQube(recipient.trim() as Address, Number(tokenId));
      setTxHash(hash);

      // Update owner in Supabase so My iQubes reflects the transfer
      if (supabase) {
        await supabase
          .from("iqubes")
          .update({ owner_address: recipient.trim().toLowerCase() })
          .eq("token_id", Number(tokenId))
          .then(({ error: updateErr }) => {
            if (updateErr) console.error("Failed to update owner in Supabase:", updateErr.message);
          });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-16 px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Transfer iQube</h1>
          <p className="text-slate-500 text-base mb-8">
            Send an iQube you own to another wallet address.
          </p>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {!address && (
              <div className="mb-8 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                Connect your wallet to transfer an iQube.
              </div>
            )}

            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Token ID</label>
                <input
                  type="number"
                  min={0}
                  value={tokenId}
                  onChange={(e) => { setTokenId(e.target.value); setError(""); }}
                  placeholder="e.g. 1"
                  className="w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Address</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => { setRecipient(e.target.value); setError(""); }}
                  placeholder="0x..."
                  className="w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-base font-mono focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleTransfer}
              disabled={isLoading || !address}
              className="w-full flex items-center justify-center gap-2 py-5 rounded-2xl text-base font-bold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Transferring…</>
              ) : (
                <><Send size={18} /> Transfer iQube</>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-8 flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertTriangle size={18} /> {error}
              </div>
            )}

            {/* Success */}
            {txHash && (
              <div className="mt-8 px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <CheckCircle size={18} /> Transfer successful!
                </div>
                <a
                  href={`https://amoy.polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  View transaction ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
