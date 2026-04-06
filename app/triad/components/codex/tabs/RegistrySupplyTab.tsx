"use client";

/**
 * RegistrySupplyTab — Registry published asset browser
 *
 * Browse all published registry assets filterable by trust band and
 * asset class. Reads from GET /api/registry/assets (existing route).
 * Clicking a row expands an inline detail panel.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Database,
  RefreshCw,
  ShieldCheck,
  Tag,
  ExternalLink,
  Star,
} from "lucide-react";
import {
  type TrustBand,
  type RegistryAssetClass,
  type PolicyClass,
  TRUST_BAND_LABELS,
  TRUST_BAND_ORDER,
  POLICY_CLASS_LABELS,
} from "@/types/registryIngestion";

// ─── Style maps ──────────────────────────────────────────────────────────────

const TRUST_STYLES: Record<TrustBand, string> = {
  L1_EXPERIMENTAL:         "border-slate-600 text-slate-400",
  L2_VERIFIED_COMMUNITY:   "border-blue-500/40 text-blue-300",
  L3_PRODUCTION_CANDIDATE: "border-emerald-500/40 text-emerald-300",
  L4_PRODUCTION_APPROVED:  "border-violet-500/40 text-violet-300",
  L5_CORE_SOVEREIGN:       "border-amber-500/40 text-amber-300",
};

const CLASS_STYLES: Record<RegistryAssetClass, string> = {
  ToolQube:      "border-sky-500/40 text-sky-300",
  SkillQube:     "border-indigo-500/40 text-indigo-300",
  WorkflowQube:  "border-violet-500/40 text-violet-300",
  ConnectorQube: "border-teal-500/40 text-teal-300",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function trustLabel(band: string): string {
  return TRUST_BAND_LABELS[band as TrustBand] ?? band;
}

function trustStyle(band: string): string {
  return TRUST_STYLES[band as TrustBand] ?? "border-slate-700 text-slate-400";
}

function classLabel(cls: string): string {
  return cls; // PascalCase already: SkillQube, WorkflowQube, etc.
}

function classStyle(cls: string): string {
  return CLASS_STYLES[cls as RegistryAssetClass] ?? "border-slate-700 text-slate-400";
}

function policyLabel(p: string): string {
  return POLICY_CLASS_LABELS[p as PolicyClass] ?? p;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Asset {
  assetId: string;
  assetClass: string;
  name: string;
  description?: string;
  trustBand: string;
  publicationStatus: string;
  policyClass: string;
  tags: string[];
  tenantId: string;
  currentVersion?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const TRUST_BANDS: Array<TrustBand | ""> = ["", ...TRUST_BAND_ORDER];
const ASSET_CLASSES: Array<RegistryAssetClass | ""> = [
  "", "ToolQube", "SkillQube", "WorkflowQube", "ConnectorQube",
];

interface RegistrySupplyTabProps {
  theme?: "light" | "dark";
  personaId?: string;
}

export function RegistrySupplyTab({ theme = "dark" }: RegistrySupplyTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [trustFilter, setTrustFilter] = useState<TrustBand | "">("");
  const [classFilter, setClassFilter] = useState<RegistryAssetClass | "">("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ publicationStatus: "published", limit: "100", tenantId: "platform" });
      if (trustFilter) params.set("trustBand", trustFilter);
      if (classFilter) params.set("assetClass", classFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/registry/assets?${params}`);
      if (!res.ok) {
        setFetchError(`API error ${res.status} — ${res.statusText}`);
        return;
      }
      const data = await res.json();
      setAssets(data.data ?? []);
    } catch {
      setFetchError("Network error — unable to reach the registry assets API.");
    } finally {
      setLoading(false);
    }
  }, [trustFilter, classFilter, search]);

  useEffect(() => { void load(); }, [load]);

  const base = "rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200";

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-emerald-400" />
          <div>
            <div className="font-semibold text-slate-100">Registry Supply</div>
            <div className="text-xs text-slate-400">
              All published registry assets — browse, filter, and inspect
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load()}
        placeholder="Search by name or tag…"
        className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
      />

      {/* Trust band filter */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Trust Band</div>
        <div className="flex gap-2 flex-wrap">
          {TRUST_BANDS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTrustFilter(t)}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                trustFilter === t
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              {t === "" ? "All bands" : TRUST_BAND_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Asset class filter */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Asset Class</div>
        <div className="flex gap-2 flex-wrap">
          {ASSET_CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClassFilter(c)}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                classFilter === c
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              {c === "" ? "All classes" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-rose-300">{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}
            className="h-6 text-xs text-rose-400 hover:text-rose-300 shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Asset count */}
      {!loading && !fetchError && assets.length > 0 && (
        <div className="text-[11px] text-slate-600">
          {assets.length} published asset{assets.length !== 1 ? "s" : ""}
          {trustFilter || classFilter ? " (filtered)" : ""}
        </div>
      )}

      {/* Asset list */}
      <div className={base}>
        {assets.length > 0 ? (
          <div className="space-y-1">
            {assets.map((asset) => {
              const isExpanded = expandedId === asset.assetId;
              const isNative = asset.metadata?.agentiq_native === true;
              return (
                <div key={asset.assetId}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : asset.assetId)}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isExpanded
                        ? "rounded-b-none border-emerald-500/40 bg-emerald-500/5"
                        : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${trustStyle(asset.trustBand)}`}
                        >
                          <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                          {trustLabel(asset.trustBand)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${classStyle(asset.assetClass)}`}
                        >
                          {classLabel(asset.assetClass)}
                        </Badge>
                        {isNative && (
                          <Badge variant="outline" className="text-[11px] border-indigo-500/40 text-indigo-300">
                            <Star className="h-2.5 w-2.5 mr-1" />
                            AgentiQ native
                          </Badge>
                        )}
                        <span className="text-[11px] text-slate-300 font-medium truncate">{asset.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fmtDate(asset.createdAt)}
                        {asset.tags.length > 0 && ` · ${asset.tags.slice(0, 3).join(", ")}${asset.tags.length > 3 ? "…" : ""}`}
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-2" />
                      : <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0 ml-2" />
                    }
                  </button>

                  {/* Inline detail panel */}
                  {isExpanded && (
                    <div className="rounded-b-lg border border-t-0 border-emerald-500/40 bg-slate-900/60 px-4 py-3 space-y-3">
                      {asset.description && (
                        <p className="text-xs text-slate-400">{asset.description}</p>
                      )}

                      <div className="grid gap-2 grid-cols-2">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Policy</div>
                          <span className="text-[11px] text-slate-300">{policyLabel(asset.policyClass)}</span>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Version</div>
                          <span className="font-mono text-[11px] text-slate-300">{asset.currentVersion ?? "—"}</span>
                        </div>
                      </div>

                      {asset.tags.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                            <Tag className="h-3 w-3" /> Tags
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {asset.tags.map((tag) => (
                              <span key={tag} className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="font-mono text-[10px] text-slate-600">{asset.assetId}</div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => window.open(`/studio?assetId=${asset.assetId}`, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open in Studio
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading assets…</div>
        ) : (
          <div className="py-8 text-center space-y-1">
            <div className="text-slate-400 text-sm">No published assets found.</div>
            <div className="text-slate-600 text-xs">
              Assets appear here after passing the full ingestion pipeline and being published.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RegistrySupplyTab;
