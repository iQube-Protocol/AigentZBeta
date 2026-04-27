import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Database, FileText, Wrench, Brain, Bot,
  ExternalLink, Loader2, ArrowLeft, Unlock, Send,
  ShoppingCart, GitFork, KeyRound, Shield, AlertTriangle,
  CheckCircle, Clock, Eye, DollarSign, Users, Lock,
} from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import { supabase, isSupabaseConfigured } from "../../utilities/supabase";
import { ownerOf, getMetaQubeLocation } from "../../utilities/contractUtils";
import { requestDekForDecryption, unwrapLegacyDek, authorizeDekStorage } from "../../utilities/keyWrapping";
import EncryptionModule from "../../utilities/encryption";
import Navbar from "../../components/Navbar";
import type { IQubeType } from "../../types/iqube";

// ─── Types ───────────────────────────────────────────────────────────────────

interface IQubeRow {
  token_id: number;
  owner_address: string;
  minter_address: string;
  tx_hash: string;
  ipfs_url: string;
  ipfs_hash: string;
  title: string;
  description: string;
  iqube_type: IQubeType;
  category: string;
  visibility: string;
  access_policy: string;
  business_model: string;
  price: string | null;
  risk_score: number;
  is_encrypted: boolean;
  created_at: string;
  allowed_addresses: string[] | null;
}

type AccessLevel = "owner" | "shared" | "purchased" | "none";
const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || "http://localhost:4000";

const TYPE_META: Record<IQubeType, { icon: React.ReactNode; color: string; bg: string }> = {
  DataQube:    { icon: <Database size={24} />,  color: "#2563eb", bg: "#eff6ff" },
  ContentQube: { icon: <FileText size={24} />,  color: "#9333ea", bg: "#faf5ff" },
  ToolQube:    { icon: <Wrench size={24} />,    color: "#ea580c", bg: "#fff7ed" },
  ModelQube:   { icon: <Brain size={24} />,     color: "#db2777", bg: "#fdf2f8" },
  AgentQube:   { icon: <Bot size={24} />,       color: "#059669", bg: "#ecfdf5" },
};

function riskColor(score: number): string {
  if (score <= 3) return "#059669";
  if (score <= 6) return "#d97706";
  if (score <= 8) return "#ea580c";
  return "#dc2626";
}

function buildMetadataFetchUrl(rawUrl: string | null): string {
  if (!rawUrl) throw new Error("Empty metaQube URL on chain");
  let url = rawUrl;
  if (!url.startsWith("http")) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "gateway.autonomys.xyz") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const cid = segments[segments.length - 1] ?? "";
      const gatewayUrl = `https://gateway.autonomys.xyz/file/${cid}`;
      return `${API_BASE_URL}/api/autodrive-metadata?url=${encodeURIComponent(gatewayUrl)}`;
    }
    return parsed.toString();
  } catch {
    const cid = rawUrl.replace(/^ipfs:\/\//, "").split("/").pop() ?? "";
    const gatewayUrl = `https://gateway.autonomys.xyz/file/${cid}`;
    return `${API_BASE_URL}/api/autodrive-metadata?url=${encodeURIComponent(gatewayUrl)}`;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function QubeDetail() {
  const { tokenId: tokenIdParam } = useParams<{ tokenId: string }>();
  const navigate = useNavigate();
  const { address } = useWallet();

  // Data
  const [qube, setQube] = useState<IQubeRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Access
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("none");
  const [pendingRequest, setPendingRequest] = useState(false);

  // Purchase
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  // Access request
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");

  // Decrypt
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<Record<string, string> | null>(null);
  const [decryptError, setDecryptError] = useState("");
  const [decryptNotice, setDecryptNotice] = useState("");

  // Owner: pending access requests
  const [incomingRequests, setIncomingRequests] = useState<Array<{ id: number; requester_address: string; created_at: string }>>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // ─── Load iQube data ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!tokenIdParam || !isSupabaseConfigured() || !supabase) {
      setError("Invalid token ID or Supabase not configured.");
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const { data, error: fetchErr } = await supabase
          .from("iqubes")
          .select("*")
          .eq("token_id", Number(tokenIdParam))
          .single();

        if (fetchErr || !data) {
          setError("iQube not found.");
          return;
        }
        setQube(data as IQubeRow);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [tokenIdParam]);

  // ─── Determine access level ──────────────────────────────────────────────

  useEffect(() => {
    if (!qube || !address || !supabase) {
      setAccessLevel("none");
      return;
    }

    const check = async () => {
      // Owner?
      if (qube.owner_address.toLowerCase() === address.toLowerCase()) {
        setAccessLevel("owner");
        return;
      }

      // In access list? (shared or purchased)
      const { data: accessRow } = await supabase
        .from("iqube_access_list")
        .select("id")
        .eq("token_id", qube.token_id)
        .eq("address", address.toLowerCase())
        .maybeSingle();

      if (accessRow) {
        setAccessLevel("shared");
        return;
      }

      // Pending request?
      const { data: reqRow } = await supabase
        .from("access_requests")
        .select("id, status")
        .eq("token_id", qube.token_id)
        .eq("requester_address", address.toLowerCase())
        .eq("status", "pending")
        .maybeSingle();

      if (reqRow) {
        setPendingRequest(true);
      }

      setAccessLevel("none");
    };
    check();
  }, [qube, address]);

  // ─── Load incoming requests (owner only) ─────────────────────────────────

  useEffect(() => {
    if (!qube || !address || !supabase || accessLevel !== "owner") return;

    supabase
      .from("access_requests")
      .select("id, requester_address, created_at")
      .eq("token_id", qube.token_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setIncomingRequests(data);
      });
  }, [qube, address, accessLevel]);

  // ─── Purchase ────────────────────────────────────────────────────────────

  const handlePurchase = useCallback(async () => {
    if (!qube || !address) return;
    setIsPurchasing(true);
    setPurchaseError("");
    setPurchaseSuccess(false);

    try {
      const priceWei = qube.price ? parseFloat(qube.price) : 0;

      if (qube.business_model !== "Free" && qube.business_model !== "Donate" && priceWei <= 0) {
        setPurchaseError("This iQube has no valid price set.");
        return;
      }

      const ethereum = (window as unknown as { ethereum?: { request: (args: unknown) => Promise<unknown> } }).ethereum;
      if (!ethereum) {
        setPurchaseError("Wallet not available.");
        return;
      }

      if (qube.business_model === "Free" || priceWei === 0) {
        // Free: just grant access directly
        if (!supabase) throw new Error("Supabase not configured");
        const { error: insertErr } = await supabase
          .from("iqube_access_list")
          .insert({
            token_id: qube.token_id,
            address: address.toLowerCase(),
            granted_by: qube.owner_address.toLowerCase(),
          });
        if (insertErr) throw new Error(insertErr.message);
      } else {
        // Paid: send MATIC to owner, then record purchase
        const amountHex = "0x" + BigInt(Math.round(priceWei * 1e18)).toString(16);

        const txHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: address,
            to: qube.owner_address,
            value: amountHex,
          }],
        });

        if (!txHash) throw new Error("Transaction was rejected.");

        // Record the purchase in access list and purchase_records
        if (!supabase) throw new Error("Supabase not configured");

        await supabase.from("iqube_access_list").insert({
          token_id: qube.token_id,
          address: address.toLowerCase(),
          granted_by: "purchase",
        });

        await supabase.from("purchase_records").insert({
          token_id: qube.token_id,
          buyer_address: address.toLowerCase(),
          seller_address: qube.owner_address.toLowerCase(),
          tx_hash: txHash as string,
          amount: qube.price,
          business_model: qube.business_model,
        });
      }

      setPurchaseSuccess(true);
      setAccessLevel("purchased");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("4001") || msg.toLowerCase().includes("user denied") || msg.toLowerCase().includes("user rejected")) {
        setPurchaseError("Transaction was cancelled.");
      } else {
        setPurchaseError(msg);
      }
    } finally {
      setIsPurchasing(false);
    }
  }, [qube, address]);

  // ─── Request Access ──────────────────────────────────────────────────────

  const handleRequestAccess = useCallback(async () => {
    if (!qube || !address || !supabase) return;
    setIsRequesting(true);
    setRequestError("");

    try {
      const { error: insertErr } = await supabase
        .from("access_requests")
        .insert({
          token_id: qube.token_id,
          requester_address: address.toLowerCase(),
          owner_address: qube.owner_address.toLowerCase(),
          status: "pending",
        });

      if (insertErr) {
        if (insertErr.message.includes("duplicate") || insertErr.message.includes("unique")) {
          setRequestError("You already have a pending request for this iQube.");
        } else {
          throw new Error(insertErr.message);
        }
        return;
      }

      setRequestSent(true);
      setPendingRequest(true);
    } catch (err: unknown) {
      setRequestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRequesting(false);
    }
  }, [qube, address]);

  // ─── Approve Access Request (owner) ──────────────────────────────────────

  const handleApproveRequest = useCallback(async (requestId: number, requesterAddress: string) => {
    if (!qube || !address || !supabase) return;
    setApprovingId(requestId);

    try {
      // Grant access
      await supabase.from("iqube_access_list").insert({
        token_id: qube.token_id,
        address: requesterAddress.toLowerCase(),
        granted_by: address.toLowerCase(),
      });

      // Update request status
      await supabase
        .from("access_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: unknown) {
      console.error("Failed to approve request:", err);
    } finally {
      setApprovingId(null);
    }
  }, [qube, address]);

  const handleDenyRequest = useCallback(async (requestId: number) => {
    if (!supabase) return;
    setApprovingId(requestId);
    try {
      await supabase
        .from("access_requests")
        .update({ status: "denied" })
        .eq("id", requestId);
      setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    } finally {
      setApprovingId(null);
    }
  }, []);

  // ─── Decrypt ─────────────────────────────────────────────────────────────

  const handleDecrypt = useCallback(async () => {
    if (!qube || !address || !supabase) return;
    setIsDecrypting(true);
    setDecryptError("");
    setDecryptNotice("");
    setDecryptedData(null);

    try {
      // Verify access on-chain
      const owner = await ownerOf(qube.token_id);
      if (owner.toLowerCase() !== address.toLowerCase()) {
        const { data: accessRow } = await supabase
          .from("iqube_access_list")
          .select("id")
          .eq("token_id", qube.token_id)
          .eq("address", address.toLowerCase())
          .maybeSingle();

        if (!accessRow) {
          setDecryptError("You are not authorized to decrypt this iQube.");
          return;
        }
      }

      // Fetch IPFS metadata
      const rawMetaQubeUrl = await getMetaQubeLocation(qube.token_id);
      const metaFetchUrl = buildMetadataFetchUrl(rawMetaQubeUrl);
      const metaRes = await fetch(metaFetchUrl);
      if (!metaRes.ok) throw new Error(`Failed to fetch metadata (status ${metaRes.status})`);
      const meta = await metaRes.json();

      const blakQubeAttr = meta.attributes?.find(
        (a: { trait_type: string }) => a.trait_type === "blakQube"
      );
      const isEncryptedAttr = meta.attributes?.find(
        (a: { trait_type: string }) => a.trait_type === "isEncrypted"
      );

      if (!isEncryptedAttr?.value || !blakQubeAttr?.value) {
        setDecryptError("This iQube has no encrypted private data.");
        return;
      }

      // Fetch DEK
      const { data: keyRow, error: keyErr } = await supabase
        .from("iqube_wrapped_keys")
        .select("wrapped_key, encrypted_key, key_encryption_iv, ipfs_hash")
        .eq("token_id", qube.token_id)
        .single();

      if (keyErr || !keyRow) {
        setDecryptError("Could not retrieve the encrypted key.");
        return;
      }

      let dekHex: string;

      if (keyRow.encrypted_key && keyRow.key_encryption_iv) {
        dekHex = await requestDekForDecryption({ tokenId: qube.token_id, address });
      } else if (keyRow.wrapped_key) {
        dekHex = await unwrapLegacyDek(keyRow.wrapped_key, address);
        try {
          await authorizeDekStorage({ tokenId: qube.token_id, address, dekHex, ipfsHash: keyRow.ipfs_hash });
          setDecryptNotice("Legacy key migrated to new scheme.");
        } catch {
          setDecryptNotice("Decryption succeeded but key migration failed.");
        }
      } else {
        setDecryptError("No decryptable key found.");
        return;
      }

      const encryptedBlob = JSON.parse(blakQubeAttr.value as string);
      const decrypted = await EncryptionModule.Decrypt({
        iv: encryptedBlob.iv,
        authTag: encryptedBlob.authTag,
        encryptedData: encryptedBlob.encryptedData,
        key: dekHex,
      });

      setDecryptedData(decrypted);
    } catch (err: unknown) {
      setDecryptError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDecrypting(false);
    }
  }, [qube, address]);

  // ─── Fork ────────────────────────────────────────────────────────────────

  const handleFork = useCallback(() => {
    if (!qube) return;
    const params = new URLSearchParams({
      fork: "true",
      sourceTokenId: String(qube.token_id),
      iQubeType: qube.iqube_type,
      category: qube.category,
      title: `Fork of ${qube.title}`,
      description: qube.description || "",
    });
    navigate(`/?${params.toString()}`);
  }, [qube, navigate]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="pt-28 pb-16 px-8 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-gray-400 mr-3" />
          <span className="text-gray-400">Loading iQube...</span>
        </div>
      </div>
    );
  }

  if (error || !qube) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="pt-28 pb-16 px-8">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-black mb-6 transition-colors">
              <ArrowLeft size={16} /> Back
            </button>
            <div className="px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error || "iQube not found."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const typeMeta = TYPE_META[qube.iqube_type] ?? TYPE_META.DataQube;
  const hasAccess = accessLevel === "owner" || accessLevel === "shared" || accessLevel === "purchased";
  const isOwner = accessLevel === "owner";
  const isFree = qube.business_model === "Free" || qube.business_model === "Donate";
  const isPublic = qube.access_policy === "requirements";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-16 px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-black mb-6 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>

          {/* Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm mb-6">
            <div className="flex items-start gap-5 mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}
              >
                {typeMeta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">{qube.title}</h1>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 shrink-0">
                    #{qube.token_id}
                  </span>
                </div>
                {qube.description && (
                  <p className="text-gray-500 text-base mt-1">{qube.description}</p>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}
              >
                {qube.iqube_type}
              </span>
              <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                {qube.category}
              </span>
              <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                {qube.access_policy === "only-me" ? "Private" : qube.access_policy === "specific" ? "Shared" : "Public"}
              </span>
              {qube.is_encrypted && (
                <span className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-medium flex items-center gap-1">
                  <Lock size={12} /> Encrypted
                </span>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <DollarSign size={12} /> Pricing
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {qube.business_model}
                  {qube.price && qube.price !== "0" ? ` \u00b7 ${qube.price} POL` : ""}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <Shield size={12} /> Risk Score
                </div>
                <div className="text-sm font-semibold" style={{ color: riskColor(qube.risk_score) }}>
                  {qube.risk_score}/10
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <Users size={12} /> Owner
                </div>
                <div className="text-sm font-semibold text-gray-900 font-mono">
                  {qube.owner_address.slice(0, 6)}...{qube.owner_address.slice(-4)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <Clock size={12} /> Minted
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {new Date(qube.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Tx link */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span className="font-mono">
                Minter: {qube.minter_address.slice(0, 6)}...{qube.minter_address.slice(-4)}
              </span>
              <a
                href={`https://amoy.polygonscan.com/tx/${qube.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-gray-500 hover:text-black transition-colors"
              >
                <ExternalLink size={12} /> View on Polygonscan
              </a>
            </div>
          </div>

          {/* Access status banner */}
          {address && (
            <div className={`rounded-2xl border p-5 mb-6 flex items-center gap-3 ${
              hasAccess
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-50 border-slate-200 text-slate-600"
            }`}>
              {hasAccess ? (
                <>
                  <CheckCircle size={18} />
                  <span className="text-sm font-medium">
                    {isOwner ? "You own this iQube" : "You have access to this iQube"}
                  </span>
                </>
              ) : (
                <>
                  <Eye size={18} />
                  <span className="text-sm font-medium">
                    You are viewing this iQube's public metadata
                  </span>
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Owner actions */}
              {isOwner && (
                <>
                  {qube.is_encrypted && (
                    <button
                      onClick={handleDecrypt}
                      disabled={isDecrypting}
                      className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30"
                    >
                      {isDecrypting ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                      {isDecrypting ? "Decrypting..." : "Decrypt Private Data"}
                    </button>
                  )}
                  <Link
                    to={`/transfer?tokenId=${qube.token_id}`}
                    className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:border-black hover:text-black transition-colors"
                  >
                    <Send size={16} /> Transfer
                  </Link>
                </>
              )}

              {/* Non-owner with access */}
              {!isOwner && hasAccess && qube.is_encrypted && (
                <button
                  onClick={handleDecrypt}
                  disabled={isDecrypting}
                  className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30"
                >
                  {isDecrypting ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                  {isDecrypting ? "Decrypting..." : "Decrypt Private Data"}
                </button>
              )}

              {/* Non-owner without access — purchase or request */}
              {!isOwner && !hasAccess && address && isPublic && (
                <>
                  {/* Buy / Get Access */}
                  {!purchaseSuccess && (
                    <button
                      onClick={handlePurchase}
                      disabled={isPurchasing}
                      className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30"
                    >
                      {isPurchasing ? (
                        <><Loader2 size={16} className="animate-spin" /> Processing...</>
                      ) : isFree ? (
                        <><KeyRound size={16} /> Get Access (Free)</>
                      ) : (
                        <><ShoppingCart size={16} /> Buy Access ({qube.price} POL)</>
                      )}
                    </button>
                  )}

                  {purchaseSuccess && (
                    <div className="flex items-center gap-2 px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                      <CheckCircle size={16} /> Access granted!
                    </div>
                  )}
                </>
              )}

              {/* Request access for non-public iQubes or as alternative */}
              {!isOwner && !hasAccess && address && !isPublic && !requestSent && !pendingRequest && (
                <button
                  onClick={handleRequestAccess}
                  disabled={isRequesting}
                  className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:border-black hover:text-black transition-colors disabled:opacity-30"
                >
                  {isRequesting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  {isRequesting ? "Sending..." : "Request Access"}
                </button>
              )}

              {(requestSent || pendingRequest) && !hasAccess && (
                <div className="flex items-center gap-2 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
                  <Clock size={16} /> Access request pending
                </div>
              )}

              {/* Fork — available if public */}
              {isPublic && address && (
                <button
                  onClick={handleFork}
                  className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:border-black hover:text-black transition-colors"
                >
                  <GitFork size={16} /> Fork iQube
                </button>
              )}
            </div>

            {/* Error messages */}
            {purchaseError && (
              <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertTriangle size={16} /> {purchaseError}
              </div>
            )}
            {requestError && (
              <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertTriangle size={16} /> {requestError}
              </div>
            )}

            {/* No wallet connected */}
            {!address && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                Connect your wallet to interact with this iQube.
              </div>
            )}
          </div>

          {/* Decrypt results */}
          {decryptError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 mb-6">
              <div className="flex items-center gap-2 text-red-700 text-sm">
                <AlertTriangle size={16} /> {decryptError}
              </div>
            </div>
          )}
          {decryptNotice && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6">
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <CheckCircle size={16} /> {decryptNotice}
              </div>
            </div>
          )}
          {decryptedData && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 mb-6">
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
                <CheckCircle size={14} /> Decrypted successfully.
              </div>
            </div>
          )}

          {/* Owner: Incoming access requests */}
          {isOwner && incomingRequests.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <KeyRound size={18} /> Access Requests
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {incomingRequests.length}
                </span>
              </h2>
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div>
                      <span className="text-sm font-mono font-medium text-gray-900">
                        {req.requester_address.slice(0, 6)}...{req.requester_address.slice(-4)}
                      </span>
                      <span className="text-xs text-gray-400 ml-3">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveRequest(req.id, req.requester_address)}
                        disabled={approvingId === req.id}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-30"
                      >
                        {approvingId === req.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleDenyRequest(req.id)}
                        disabled={approvingId === req.id}
                        className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
