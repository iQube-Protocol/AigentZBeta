import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Database, FileText, Wrench, Brain, Bot,
  Unlock, Send, ExternalLink, Loader2, Inbox,
} from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import { supabase, isSupabaseConfigured } from "../../utilities/supabase";
import Navbar from "../../components/Navbar";
import type { IQubeType } from "../../types/iqube";

interface IQubeRow {
  token_id: number;
  owner_address: string;
  minter_address: string;
  tx_hash: string;
  ipfs_url: string;
  title: string;
  description: string;
  iqube_type: IQubeType;
  category: string;
  visibility: string;
  access_policy: string;
  business_model: string;
  risk_score: number;
  is_encrypted: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<IQubeType, { icon: React.ReactNode; color: string }> = {
  DataQube:    { icon: <Database size={20} />,  color: "#2563eb" },
  ContentQube: { icon: <FileText size={20} />,  color: "#9333ea" },
  ToolQube:    { icon: <Wrench size={20} />,    color: "#ea580c" },
  ModelQube:   { icon: <Brain size={20} />,     color: "#db2777" },
  AgentQube:   { icon: <Bot size={20} />,       color: "#059669" },
};

export default function MyIQubes() {
  const { address } = useWallet();
  const [iqubes, setIqubes] = useState<IQubeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address || !isSupabaseConfigured() || !supabase) return;
    setIsLoading(true);
    setError("");
    supabase
      .from("iqubes")
      .select("*")
      .eq("owner_address", address)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setIqubes((data as IQubeRow[]) ?? []);
        }
        setIsLoading(false);
      });
  }, [address]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-16 px-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">My iQubes</h1>
          <p className="text-slate-500 text-base mb-8">
            All iQubes owned by your connected wallet.
          </p>

          {!address && (
            <div className="mb-8 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Connect your wallet to view your iQubes.
            </div>
          )}

          {!isSupabaseConfigured() && address && (
            <div className="mb-8 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              Supabase is not configured. Cannot load iQubes.
            </div>
          )}

          {error && (
            <div className="mb-8 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-3" /> Loading your iQubes…
            </div>
          )}

          {!isLoading && address && iqubes.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Inbox size={48} className="mb-4" />
              <p className="text-lg font-medium">No iQubes yet</p>
              <p className="text-sm mt-1">
                <Link to="/" className="text-black underline font-semibold">Mint your first iQube</Link>
              </p>
            </div>
          )}

          {iqubes.length > 0 && (
            <div className="space-y-4">
              {iqubes.map((q) => {
                const typeMeta = TYPE_ICONS[q.iqube_type] ?? TYPE_ICONS.DataQube;
                return (
                  <Link
                    key={q.token_id}
                    to={`/iqube/${q.token_id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: typeMeta.color + "15", color: typeMeta.color }}
                        >
                          {typeMeta.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-gray-900">{q.title}</h3>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              #{q.token_id}
                            </span>
                          </div>
                          {q.description && (
                            <p className="text-sm text-gray-500 mt-1 max-w-xl">{q.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                            <span style={{ color: typeMeta.color }} className="font-semibold">
                              {q.iqube_type} · {q.category}
                            </span>
                            <span>{q.access_policy === "only-me" ? "Private" : q.access_policy === "specific" ? "Shared" : "Public"}</span>
                            <span>{q.business_model}</span>
                            <span>Risk: {q.risk_score}/10</span>
                            {q.is_encrypted && (
                              <span className="text-amber-600 font-medium">Encrypted</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {q.is_encrypted && (
                          <span
                            onClick={(e) => { e.preventDefault(); window.location.href = `/decrypt?tokenId=${q.token_id}`; }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <Unlock size={14} /> Decrypt
                          </span>
                        )}
                        <span
                          onClick={(e) => { e.preventDefault(); window.location.href = `/transfer?tokenId=${q.token_id}`; }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <Send size={14} /> Transfer
                        </span>
                        <span
                          onClick={(e) => { e.preventDefault(); window.open(`https://amoy.polygonscan.com/tx/${q.tx_hash}`, "_blank"); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <ExternalLink size={14} /> Tx
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
