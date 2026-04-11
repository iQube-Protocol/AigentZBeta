"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, ShieldCheck, Package2, Workflow, Plug, ChevronRight, SlidersHorizontal, Check } from "lucide-react";
import type { RegistryAssetSummary, RegistryAssetClass, TrustBand } from "@/types/registryIngestion";
import { TRUST_BAND_LABELS as TBL, TRUST_BAND_ORDER } from "@/types/registryIngestion";

// ─────────────────────────────────────────────────────────────────────────────
// Asset class icons
// ─────────────────────────────────────────────────────────────────────────────

const CLASS_ICONS: Record<RegistryAssetClass, React.ReactNode> = {
  ToolQube: <Package2 className="h-3.5 w-3.5" />,
  SkillQube: <ShieldCheck className="h-3.5 w-3.5" />,
  WorkflowQube: <Workflow className="h-3.5 w-3.5" />,
  ConnectorQube: <Plug className="h-3.5 w-3.5" />,
};

const CLASS_COLORS: Record<RegistryAssetClass, string> = {
  ToolQube: "text-cyan-300",
  SkillQube: "text-indigo-300",
  WorkflowQube: "text-amber-300",
  ConnectorQube: "text-emerald-300",
};

const BAND_COLORS: Record<TrustBand, string> = {
  L1_EXPERIMENTAL: "text-red-400",
  L2_VERIFIED_COMMUNITY: "text-amber-400",
  L3_PRODUCTION_CANDIDATE: "text-yellow-400",
  L4_PRODUCTION_APPROVED: "text-emerald-400",
  L5_CORE_SOVEREIGN: "text-cyan-300",
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistryAssetSelection {
  assetId: string;
  assetClass: RegistryAssetClass;
  name: string;
  slug: string;
  trustBand: TrustBand;
  policyClass: string;
  wrapperStrategy: string;
}

interface RegistryBrowserDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks "Add to workflow" on an asset */
  onSelect?: (asset: RegistryAssetSelection) => void;
  /** Highlight already-selected asset IDs */
  selectedIds?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawer
// ─────────────────────────────────────────────────────────────────────────────

export function RegistryBrowserDrawer({
  open,
  onClose,
  onSelect,
  selectedIds = [],
}: RegistryBrowserDrawerProps) {
  const [assets, setAssets] = useState<RegistryAssetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<RegistryAssetClass | "">("");
  const [bandFilter, setBandFilter] = useState<TrustBand | "">("");
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ publicationStatus: "published", limit: "100" });
      if (search) params.set("search", search);
      if (classFilter) params.set("assetClass", classFilter);
      if (bandFilter) params.set("trustBand", bandFilter);
      const res = await fetch(`/api/registry/assets?${params}`).then((r) => r.json());
      if (res.ok) setAssets(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, bandFilter]);

  useEffect(() => {
    if (open) load();
  }, [open, classFilter, bandFilter, load]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full max-w-xl bg-slate-950 border-l border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <div className="text-sm font-semibold text-white">Registry Browser</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Browse published ToolQubes, SkillQubes, and more</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="px-5 py-3 border-b border-white/10 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Search by name, slug, or description…"
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
                showFilters || classFilter || bandFilter
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Asset Class</label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value as RegistryAssetClass | "")}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">All classes</option>
                  {(["ToolQube", "SkillQube", "WorkflowQube", "ConnectorQube"] as RegistryAssetClass[]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Min Trust Band</label>
                <select
                  value={bandFilter}
                  onChange={(e) => setBandFilter(e.target.value as TrustBand | "")}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">Any band</option>
                  {TRUST_BAND_ORDER.map((b) => (
                    <option key={b} value={b}>{TBL[b]}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Asset list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-white/5" />)}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="text-sm text-slate-400">No published assets found</div>
              {(classFilter || bandFilter || search) && (
                <button
                  type="button"
                  onClick={() => { setClassFilter(""); setBandFilter(""); setSearch(""); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            assets.map((asset) => {
              const isSelected = selectedIds.includes(asset.assetId);
              return (
                <div
                  key={asset.assetId}
                  className={`group rounded-xl border transition-colors ${
                    isSelected
                      ? "border-indigo-500/40 bg-indigo-500/5"
                      : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Class icon */}
                    <div className={`shrink-0 ${CLASS_COLORS[asset.assetClass]}`}>
                      {CLASS_ICONS[asset.assetClass]}
                    </div>

                    {/* Asset info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{asset.name}</span>
                        {isSelected && <Check className="h-3 w-3 text-indigo-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-medium ${BAND_COLORS[asset.trustBand]}`}>
                          {TBL[asset.trustBand]}
                        </span>
                        <span className="text-[10px] text-slate-600">·</span>
                        <span className="text-[10px] text-slate-500 truncate">{asset.slug}</span>
                      </div>
                      {asset.description && (
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{asset.description}</div>
                      )}
                    </div>

                    {/* Add button */}
                    {onSelect && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelect({
                            assetId: asset.assetId,
                            assetClass: asset.assetClass,
                            name: asset.name,
                            slug: asset.slug,
                            trustBand: asset.trustBand,
                            policyClass: String(asset.policyClass ?? ""),
                            wrapperStrategy: "",
                          })
                        }
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40"
                            : "bg-white/5 text-slate-400 ring-1 ring-white/10 hover:bg-indigo-500/20 hover:text-indigo-300 hover:ring-indigo-500/30 group-hover:visible"
                        }`}
                      >
                        {isSelected ? "Added" : "Add"}
                        {!isSelected && <ChevronRight className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 shrink-0">
          <div className="text-[10px] text-slate-600">
            Showing published assets only · {assets.length} result{assets.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
