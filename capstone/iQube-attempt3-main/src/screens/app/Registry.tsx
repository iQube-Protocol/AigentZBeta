import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Database, FileText, Wrench, Brain, Bot,
  Search, Filter, ExternalLink, Loader2, Globe,
  Lock, ShoppingCart, KeyRound, Users, GitFork,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../utilities/supabase";
import Navbar from "../../components/Navbar";
import type { IQubeType } from "../../types/iqube";

interface RegistryRow {
  token_id: number;
  owner_address: string;
  minter_address: string;
  tx_hash: string;
  ipfs_url: string;
  ipfs_hash: string | null;
  title: string;
  description: string;
  iqube_type: IQubeType;
  category: string;
  visibility: string;
  business_model: string;
  price: string | null;
  risk_score: number | null;
  is_encrypted: boolean;
  allowed_addresses: string[] | null;
  created_at: string;
}

function displayCategory(c: string | null | undefined): string {
  return c && c.trim() ? c : "Uncategorized";
}

function displayRisk(s: number | null | undefined): string {
  return s == null ? "—" : `${s}/10`;
}

function displayPriceOrModel(
  model: string | null | undefined,
  price: string | null | undefined,
  isFree: boolean,
): string {
  if (isFree) return "Free";
  if (price) return `${price} POL`;
  return model || "—";
}

function shortAddr(a: string | null | undefined): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  const diffYr = Math.floor(diffDay / 365);
  return `${diffYr}y ago`;
}

const VISIBILITY_META: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  public:         { label: "Public",       icon: <Globe size={10} />, bg: "#ecfdf5", color: "#047857" },
  "semi-private": { label: "Semi-private", icon: <Users size={10} />, bg: "#eff6ff", color: "#1d4ed8" },
  private:        { label: "Private",      icon: <Lock size={10} />,  bg: "#f3f4f6", color: "#4b5563" },
};

const TYPE_ICONS: Record<IQubeType, { icon: React.ReactNode; color: string; bg: string }> = {
  DataQube:    { icon: <Database size={20} />,  color: "#2563eb", bg: "#eff6ff" },
  ContentQube: { icon: <FileText size={20} />,  color: "#9333ea", bg: "#faf5ff" },
  ToolQube:    { icon: <Wrench size={20} />,    color: "#ea580c", bg: "#fff7ed" },
  ModelQube:   { icon: <Brain size={20} />,     color: "#db2777", bg: "#fdf2f8" },
  AgentQube:   { icon: <Bot size={20} />,       color: "#059669", bg: "#ecfdf5" },
};

const ALL_TYPES: IQubeType[] = ["DataQube", "ContentQube", "ToolQube", "ModelQube", "AgentQube"];
const BUSINESS_MODELS = ["Free", "Buy", "Subscribe", "Rent", "License", "Donate"];

export default function Registry() {
  const [iqubes, setIqubes] = useState<RegistryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<IQubeType | "">("");
  const [modelFilter, setModelFilter] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    setIsLoading(true);
    setError("");
    supabase
      .from("iqubes")
      .select("*")
      .eq("access_policy", "requirements")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setIqubes((data as RegistryRow[]) ?? []);
        }
        setIsLoading(false);
      });
  }, []);

  const filtered = iqubes.filter((q) => {
    if (typeFilter && q.iqube_type !== typeFilter) return false;
    if (modelFilter && q.business_model !== modelFilter) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      if (
        !(q.title ?? "").toLowerCase().includes(s) &&
        !(q.description ?? "").toLowerCase().includes(s) &&
        !(q.category ?? "").toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-16 px-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">iQube Registry</h1>
          <p className="text-slate-500 text-base mb-8">
            Browse public iQubes minted on the network.
          </p>

          {!isSupabaseConfigured() && (
            <div className="mb-8 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              Supabase is not configured. Cannot load registry.
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, description, or category…"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as IQubeType | "")}
                className="px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-black transition-colors"
              >
                <option value="">All types</option>
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-black transition-colors"
              >
                <option value="">All pricing</option>
                {BUSINESS_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-8 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-3" /> Loading registry…
            </div>
          )}

          {!isLoading && filtered.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Globe size={48} className="mb-4" />
              <p className="text-lg font-medium">No public iQubes found</p>
              <p className="text-sm mt-1">
                {iqubes.length > 0
                  ? "Try adjusting your filters."
                  : "Be the first to mint a public iQube!"}
              </p>
            </div>
          )}

          {/* Results count */}
          {!isLoading && filtered.length > 0 && (
            <p className="text-sm text-slate-500 mb-4">
              {filtered.length} iQube{filtered.length !== 1 ? "s" : ""} found
            </p>
          )}

          {/* Grid */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((q) => {
                const typeMeta = TYPE_ICONS[q.iqube_type] ?? TYPE_ICONS.DataQube;
                const isFree = q.business_model === "Free" || q.business_model === "Donate";
                const visMeta = VISIBILITY_META[q.visibility] ?? VISIBILITY_META.public;
                const isTransferred =
                  q.owner_address &&
                  q.minter_address &&
                  q.owner_address.toLowerCase() !== q.minter_address.toLowerCase();
                const created = relativeDate(q.created_at);
                return (
                  <Link
                    key={q.token_id}
                    to={`/iqube/${q.token_id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}
                      >
                        {typeMeta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            {q.title || `iQube #${q.token_id}`}
                          </h3>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                            #{q.token_id}
                          </span>
                        </div>
                        {q.description ? (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{q.description}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic mt-1 line-clamp-2">
                            No description provided
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}
                      >
                        {q.iqube_type}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
                        {displayCategory(q.category)}
                      </span>
                      <span
                        className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1"
                        style={{ backgroundColor: visMeta.bg, color: visMeta.color }}
                      >
                        {visMeta.icon} {visMeta.label}
                      </span>
                      {q.is_encrypted && (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 flex items-center gap-1">
                          <Lock size={10} /> Encrypted
                        </span>
                      )}
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500">
                        Risk {displayRisk(q.risk_score)}
                      </span>
                      {isTransferred && (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 flex items-center gap-1">
                          <GitFork size={10} /> Transferred
                        </span>
                      )}
                    </div>

                    {/* Price / action hint */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        {isFree ? (
                          <><KeyRound size={14} className="text-emerald-600" /> Free</>
                        ) : (
                          <><ShoppingCart size={14} className="text-blue-600" /> {displayPriceOrModel(q.business_model, q.price, isFree)}</>
                        )}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        View details →
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                      <span className="font-mono">
                        Minter: {shortAddr(q.minter_address)}
                      </span>
                      <span className="flex items-center gap-3">
                        {created && <span>{created}</span>}
                        <span
                          onClick={(e) => { e.preventDefault(); window.open(`https://amoy.polygonscan.com/tx/${q.tx_hash}`, "_blank"); }}
                          className="flex items-center gap-1 text-gray-500 hover:text-black transition-colors"
                        >
                          <ExternalLink size={12} /> View tx
                        </span>
                      </span>
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
