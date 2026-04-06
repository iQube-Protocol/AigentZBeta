"use client";

/**
 * RegistrySupplyTab — Registry published asset browser
 *
 * Browse all published registry assets filterable by trust band and
 * asset class. Reads from GET /api/registry/assets (existing route).
 * Clicking an asset opens it in detail. Operators can deep-link to Studio.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Database,
  RefreshCw,
  X,
  ShieldCheck,
  Tag,
  ExternalLink,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TrustBand =
  | "L1_EXPERIMENTAL"
  | "L2_COMMUNITY"
  | "L3_VERIFIED"
  | "L4_CERTIFIED"
  | "L5_CORE_SOVEREIGN";

type RegistryAssetClass =
  | "tool_qube"
  | "skill_qube"
  | "workflow_qube"
  | "connector_qube";

type PolicyClass =
  | "read_only"
  | "network_limited"
  | "sandbox_exec"
  | "browser_operator"
  | "secret_bound"
  | "human_approval_required";

interface Asset {
  assetId: string;
  assetClass: RegistryAssetClass;
  name: string;
  description?: string;
  trustBand: TrustBand;
  publicationStatus: string;
  policyClass: PolicyClass;
  tags: string[];
  tenantId: string;
  publishedBy?: string;
  createdAt: string;
}

// ─── Style maps ──────────────────────────────────────────────────────────────

const TRUST_STYLES: Record<TrustBand, string> = {
  L1_EXPERIMENTAL:  "border-slate-600 text-slate-400",
  L2_COMMUNITY:     "border-blue-500/40 text-blue-300",
  L3_VERIFIED:      "border-emerald-500/40 text-emerald-300",
  L4_CERTIFIED:     "border-violet-500/40 text-violet-300",
  L5_CORE_SOVEREIGN:"border-amber-500/40 text-amber-300",
};

const TRUST_LABELS: Record<TrustBand, string> = {
  L1_EXPERIMENTAL:  "L1 Experimental",
  L2_COMMUNITY:     "L2 Community",
  L3_VERIFIED:      "L3 Verified",
  L4_CERTIFIED:     "L4 Certified",
  L5_CORE_SOVEREIGN:"L5 Sovereign",
};

const CLASS_STYLES: Record<RegistryAssetClass, string> = {
  tool_qube:     "border-sky-500/40 text-sky-300",
  skill_qube:    "border-indigo-500/40 text-indigo-300",
  workflow_qube: "border-violet-500/40 text-violet-300",
  connector_qube:"border-teal-500/40 text-teal-300",
};

const CLASS_LABELS: Record<RegistryAssetClass, string> = {
  tool_qube:     "ToolQube",
  skill_qube:    "SkillQube",
  workflow_qube: "WorkflowQube",
  connector_qube:"ConnectorQube",
};

const POLICY_LABELS: Record<PolicyClass, string> = {
  read_only:              "Read Only",
  network_limited:        "Network Limited",
  sandbox_exec:           "Sandbox Exec",
  browser_operator:       "Browser Operator",
  secret_bound:           "Secret Bound",
  human_approval_required:"Human Approval",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

const TRUST_BANDS: Array<TrustBand | ""> = [
  "", "L1_EXPERIMENTAL", "L2_COMMUNITY", "L3_VERIFIED", "L4_CERTIFIED", "L5_CORE_SOVEREIGN",
];

const ASSET_CLASSES: Array<RegistryAssetClass | ""> = [
  "", "tool_qube", "skill_qube", "workflow_qube", "connector_qube",
];

interface RegistrySupplyTabProps {
  theme?: "light" | "dark";
  personaId?: string;
}

export function RegistrySupplyTab({ theme = "dark" }: RegistrySupplyTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [trustFilter, setTrustFilter] = useState<TrustBand | "">("");
  const [classFilter, setClassFilter] = useState<RegistryAssetClass | "">("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ publicationStatus: "published", limit: "100" });
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
              onClick={() => setTrustFilter(t)}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                trustFilter === t
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              {t === "" ? "All bands" : TRUST_LABELS[t]}
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
              onClick={() => setClassFilter(c)}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                classFilter === c
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              {c === "" ? "All classes" : CLASS_LABELS[c]}
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

      {/* Detail panel */}
      {selected && (
        <div className={`${base} space-y-4`}>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-[11px] ${TRUST_STYLES[selected.trustBand] ?? "border-slate-700 text-slate-400"}`}
                >
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {TRUST_LABELS[selected.trustBand]}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[11px] ${CLASS_STYLES[selected.assetClass] ?? "border-slate-700 text-slate-400"}`}
                >
                  {CLASS_LABELS[selected.assetClass]}
                </Badge>
              </div>
              <div className="font-semibold text-slate-100">{selected.name}</div>
              <div className="font-mono text-[11px] text-slate-400">{selected.assetId}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(null)}
              className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {selected.description && (
            <div className="text-xs text-slate-400">{selected.description}</div>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Policy</div>
              <Badge variant="outline" className="border-slate-700 text-slate-300 text-[11px]">
                {POLICY_LABELS[selected.policyClass] ?? selected.policyClass}
              </Badge>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Published</div>
              <div className="text-xs text-slate-300">{fmtDate(selected.createdAt)}</div>
              {selected.publishedBy && (
                <div className="text-[11px] text-slate-500 mt-0.5">by {selected.publishedBy}</div>
              )}
            </div>
          </div>

          {selected.tags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Tag className="h-3 w-3" /> Tags
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {selected.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-slate-700 text-slate-400 text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={() => {
                window.open(`/studio?assetId=${selected.assetId}`, "_blank");
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Open in Studio
            </Button>
          </div>
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
            {assets.map((asset) => (
              <button
                key={asset.assetId}
                onClick={() => setSelected(asset)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected?.assetId === asset.assetId
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${TRUST_STYLES[asset.trustBand] ?? "border-slate-700 text-slate-400"}`}
                    >
                      {TRUST_LABELS[asset.trustBand]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${CLASS_STYLES[asset.assetClass] ?? "border-slate-700 text-slate-400"}`}
                    >
                      {CLASS_LABELS[asset.assetClass]}
                    </Badge>
                    <span className="text-[11px] text-slate-300 font-medium truncate">{asset.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {fmtDate(asset.createdAt)}
                    {asset.tags.length > 0 && ` · ${asset.tags.slice(0, 3).join(", ")}${asset.tags.length > 3 ? "…" : ""}`}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0 ml-2" />
              </button>
            ))}
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
