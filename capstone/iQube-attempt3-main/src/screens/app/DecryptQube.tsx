import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, Unlock, Search, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import { ownerOf, getMetaQubeLocation } from "../../utilities/contractUtils";
import { supabase, isSupabaseConfigured } from "../../utilities/supabase";
import EncryptionModule from "../../utilities/encryption";
import {
  authorizeDekStorage,
  requestDekForDecryption,
  unwrapLegacyDek,
} from "../../utilities/keyWrapping";
import Navbar from "../../components/Navbar";

const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || "http://localhost:4000";

function buildMetadataFetchUrl(rawUrl: string | null): string {
  if (!rawUrl) {
    throw new Error("Empty metaQube URL on chain");
  }

  let url = rawUrl;
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname === "gateway.autonomys.xyz") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const cid = segments[segments.length - 1] ?? "";
      const gatewayUrl = `https://gateway.autonomys.xyz/file/${cid}`;
      return `${API_BASE_URL}/api/autodrive-metadata?url=${encodeURIComponent(
        gatewayUrl
      )}`;
    }

    return parsed.toString();
  } catch {
    const cid = rawUrl.replace(/^ipfs:\/\//, "").split("/").pop() ?? "";
    const gatewayUrl = `https://gateway.autonomys.xyz/file/${cid}`;
    return `${API_BASE_URL}/api/autodrive-metadata?url=${encodeURIComponent(
      gatewayUrl
    )}`;
  }
}

export default function DecryptQube() {
  const { address } = useWallet();
  const [searchParams] = useSearchParams();
  const [tokenId, setTokenId] = useState(searchParams.get("tokenId") ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decryptedData, setDecryptedData] = useState<Record<string, string> | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);

  const handleDecrypt = async () => {
    if (!address) {
      setError("Please connect your wallet first.");
      return;
    }
    if (!tokenId.trim()) {
      setError("Please enter a token ID.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Cannot retrieve wrapped keys.");
      return;
    }

    setIsLoading(true);
    setError("");
    setNotice("");
    setDecryptedData(null);
    setMetadata(null);

    try {
      // 1. Verify ownership or shared access
      const owner = await ownerOf(Number(tokenId));
      if (owner.toLowerCase() !== address.toLowerCase()) {
        // Not the owner — check if the caller is in the access list
        const { data: accessRow } = await supabase!
          .from("iqube_access_list")
          .select("id")
          .eq("token_id", Number(tokenId))
          .eq("address", address.toLowerCase())
          .maybeSingle();

        if (!accessRow) {
          setError("You are not the owner or an authorized address for this iQube.");
          return;
        }
      }

      // 2. Fetch metadata from IPFS (proxied via Auto-Drive server for CORS safety)
      const rawMetaQubeUrl = await getMetaQubeLocation(Number(tokenId));
      const metaFetchUrl = buildMetadataFetchUrl(rawMetaQubeUrl);
      const metaRes = await fetch(metaFetchUrl);
      if (!metaRes.ok) {
        throw new Error(
          `Failed to fetch metadata from IPFS (status ${metaRes.status}). Check that the Auto-Drive server is running and the CID is available.`
        );
      }
      const meta = await metaRes.json();
      setMetadata(meta);

      // 3. Check if there is encrypted data
      const blakQubeAttr = meta.attributes?.find(
        (a: { trait_type: string; value: unknown }) => a.trait_type === "blakQube"
      );
      const isEncryptedAttr = meta.attributes?.find(
        (a: { trait_type: string; value: unknown }) => a.trait_type === "isEncrypted"
      );

      if (!isEncryptedAttr?.value || !blakQubeAttr?.value) {
        setError("This iQube has no encrypted private data.");
        return;
      }

      // 4. Fetch stored key metadata from Supabase
      const { data: keyRow, error: keyErr } = await supabase!
        .from("iqube_wrapped_keys")
        .select("wrapped_key, encrypted_key, key_encryption_iv, ipfs_hash")
        .eq("token_id", Number(tokenId))
        .single();

      if (keyErr || !keyRow) {
        setError("Could not retrieve the encrypted key from Supabase. The key may not have been stored.");
        return;
      }

      let dekHex: string;

      if (keyRow.encrypted_key && keyRow.key_encryption_iv) {
        dekHex = await requestDekForDecryption({
          tokenId: Number(tokenId),
          address,
        });
      } else if (keyRow.wrapped_key) {
        // Legacy fallback for iQubes minted before the server-managed key flow.
        dekHex = await unwrapLegacyDek(keyRow.wrapped_key, address);

        try {
          await authorizeDekStorage({
            tokenId: Number(tokenId),
            address,
            dekHex,
            ipfsHash: keyRow.ipfs_hash,
          });
          setNotice(
            "Legacy key migrated. Future decrypts will use a wallet signature instead of MetaMask's deprecated decrypt RPC."
          );
        } catch (migrationError: unknown) {
          const msg =
            migrationError instanceof Error
              ? migrationError.message
              : String(migrationError);
          console.warn("Legacy key migration failed:", msg);
          setNotice(
            "Decryption succeeded, but key migration failed. Future decrypts may still trigger the legacy MetaMask decrypt prompt."
          );
        }
      } else {
        setError("No decryptable key was stored for this iQube.");
        return;
      }

      // 6. Parse encrypted blob and decrypt
      const encryptedBlob = JSON.parse(blakQubeAttr.value as string);
      const decrypted = await EncryptionModule.Decrypt({
        iv: encryptedBlob.iv,
        authTag: encryptedBlob.authTag,
        encryptedData: encryptedBlob.encryptedData,
        key: dekHex,
      });

      setDecryptedData(decrypted);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Decrypt iQube</h1>
          <p className="text-slate-500 text-base mb-8">
            Enter your token ID to verify ownership and decrypt your private data.
          </p>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {!address && (
              <div className="mb-8 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                Connect your wallet to decrypt an iQube.
              </div>
            )}

            {/* Input */}
            <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Token ID</label>
            <div className="flex gap-4">
              <input
                type="number"
                min={0}
                value={tokenId}
                onChange={(e) => { setTokenId(e.target.value); setError(""); }}
                placeholder="e.g. 1"
                className="flex-1 px-5 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:border-black transition-colors"
              />
              <button
                onClick={handleDecrypt}
                disabled={isLoading || !address}
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 size={18} className="animate-spin" /> Decrypting…</>
                ) : (
                  <><Search size={18} /> Decrypt</>
                )}
              </button>
            </div>
          </div>

            {/* Error */}
            {error && (
              <div className="mb-8 flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertTriangle size={18} /> {error}
              </div>
            )}
            {notice && (
              <div className="mb-8 flex items-center gap-3 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <CheckCircle size={18} /> {notice}
              </div>
            )}

            {/* Metadata summary */}
            {metadata && (
              <div className="mb-8 rounded-2xl border-2 border-gray-200 divide-y divide-gray-100">
              <div className="px-6 py-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Lock size={16} /> iQube Metadata
              </div>
              {[
                { label: "Name", value: metadata.name },
                { label: "Description", value: metadata.description },
                ...(metadata.attributes as Array<{ trait_type: string; value: unknown }> ?? [])
                  .filter((a) => a.trait_type !== "blakQube")
                  .map((a) => ({ label: a.trait_type, value: String(a.value) })),
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center px-6 py-4">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{String(row.value)}</span>
                </div>
              ))}
              </div>
            )}

            {/* Decrypted data */}
            {decryptedData && (
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50">
              <div className="px-6 py-4 flex items-center gap-2 text-sm font-semibold text-emerald-800 border-b border-emerald-200">
                <Unlock size={16} /> Decrypted Private Data
              </div>
              <div className="divide-y divide-emerald-100">
                {Object.entries(decryptedData).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center px-6 py-4">
                    <span className="text-sm text-emerald-700 font-medium">{key}</span>
                    <span className="text-sm font-semibold text-gray-900 font-mono">{value}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 flex items-center gap-2 text-xs text-emerald-600 border-t border-emerald-200">
                <CheckCircle size={14} /> Decrypted successfully after wallet authorization.
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
