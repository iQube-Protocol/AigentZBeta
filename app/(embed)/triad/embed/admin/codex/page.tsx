/**
 * Admin Codex Embed — Auto-Drive Upload Panel
 *
 * Embeddable version of the Qriptopian CodexManager admin page.
 * Shows Autonomys Auto-Drive stats and provides upload / import controls.
 *
 * Route: /triad/embed/admin/codex
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Database,
  FileJson,
  FileText,
  Gamepad2,
  Image,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { CodexUploadModal } from "@/app/(shell)/admin/codex/components/CodexUploadModal";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveTab = "knyt" | "qriptopian";

type CodexStats = {
  totalEpisodes: number;
  episodesWithStill: number;
  episodesWithMotion: number;
  episodesWithCovers: number;
  episodesComplete: number;
  summary?: {
    episodesWithPrint?: number;
  };
  globalStats: {
    totalStillMasters: number;
    totalMotionMasters: number;
    totalPrintRare: number;
    totalPrintEpic: number;
    totalPrintLegendary: number;
    totalCovers: number;
    totalCharacters: number;
    totalLoreDocs: number;
    totalGameAssets: number;
    totalSocialAssets: number;
    totalAllAssets: number;
  };
};

function getAccessTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.includes("auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token as string;
    }
  } catch {
    return null;
  }
  return null;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, badge }: { label: string; value: number; badge?: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        {badge != null && (
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────
function CategoryCard({
  icon: Icon,
  label,
  count,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 text-center">
      <Icon className={`mx-auto mb-2 h-8 w-8 ${colorClass}`} />
      <p className="text-xs font-medium text-slate-300">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-white">{count}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCodexEmbedPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("knyt");
  const [stats, setStats] = useState<CodexStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const token = getAccessTokenFromStorage();
      const res = await fetch("/api/admin/codex/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats({
        totalEpisodes: data.summary?.totalEpisodes ?? 0,
        episodesWithStill: data.summary?.episodesWithStill ?? 0,
        episodesWithMotion: data.summary?.episodesWithMotion ?? 0,
        episodesWithCovers: data.summary?.episodesWithCovers ?? 0,
        episodesComplete: data.summary?.episodesComplete ?? 0,
        summary: data.summary,
        globalStats: data.globalStats ?? {
          totalStillMasters: 0,
          totalMotionMasters: 0,
          totalPrintRare: 0,
          totalPrintEpic: 0,
          totalPrintLegendary: 0,
          totalCovers: 0,
          totalCharacters: 0,
          totalLoreDocs: 0,
          totalGameAssets: 0,
          totalSocialAssets: 0,
          totalAllAssets: 0,
        },
      });
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const handleImportMetadata = () => {
    if (!importInputRef.current) return;
    importInputRef.current.value = "";
    importInputRef.current.click();
  };

  const onImportFileSelected = async (file: File | null) => {
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const token = getAccessTokenFromStorage();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/codex/import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");
      setImportResult({
        success: true,
        message: `Imported: ${data.results?.characters?.inserted ?? 0} characters, ${data.results?.knyt_cards?.inserted ?? 0} cards, ${data.results?.episodes?.inserted ?? 0} episodes`,
      });
      void fetchStats();
    } catch (err) {
      setImportResult({ success: false, message: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setImportLoading(false);
    }
  };

  const g = stats?.globalStats;
  const masterCount = (g?.totalStillMasters ?? 0) + (g?.totalMotionMasters ?? 0) + (g?.totalPrintRare ?? 0) + (g?.totalPrintEpic ?? 0) + (g?.totalPrintLegendary ?? 0);
  const printCount = (g?.totalPrintRare ?? 0) + (g?.totalPrintEpic ?? 0) + (g?.totalPrintLegendary ?? 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hidden import file input */}
      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => onImportFileSelected(e.target.files?.[0] ?? null)}
      />

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Database className="h-7 w-7 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Codex Manager</h1>
              <p className="text-sm text-slate-400">
                Manage Digital Scrolls &amp; Collectibles — KNYT and Qriptopian
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchStats()}
              disabled={statsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleImportMetadata}
              disabled={importLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {importLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />}
              Import Metadata
            </button>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Content
            </button>
          </div>
        </div>

        {/* Import result */}
        {importResult && (
          <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${importResult.success ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
            {importResult.success ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            <span className="flex-1">{importResult.message}</span>
            <button type="button" onClick={() => setImportResult(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex gap-1 border-b border-slate-800">
          {(["knyt", "qriptopian"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 border-b-2 px-4 pb-3 pt-1 text-sm font-medium transition ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab === "knyt" ? <BookOpen className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {tab === "knyt" ? "KNYT Codex" : "Qriptopian Codex"}
            </button>
          ))}
        </div>

        {/* KNYT tab */}
        {activeTab === "knyt" && (
          <div className="space-y-5">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              </div>
            ) : (
              <>
                {/* Episode stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Total Episodes" value={stats?.totalEpisodes ?? 0} />
                  <StatCard
                    label="With Print Editions"
                    value={stats?.summary?.episodesWithPrint ?? 0}
                    badge={`${printCount} files`}
                  />
                  <StatCard
                    label="With Motion Comics"
                    value={stats?.episodesWithMotion ?? 0}
                    badge={`${g?.totalMotionMasters ?? 0} files`}
                  />
                  <StatCard
                    label="With Covers"
                    value={stats?.episodesWithCovers ?? 0}
                    badge={`${g?.totalCovers ?? 0} variants`}
                  />
                </div>

                {/* Asset categories */}
                <div>
                  <h2 className="mb-3 text-base font-semibold">Asset Categories</h2>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    <CategoryCard icon={BookOpen} label="Episode Masters" count={masterCount} colorClass="text-cyan-400" />
                    <CategoryCard icon={Image} label="Covers" count={g?.totalCovers ?? 0} colorClass="text-purple-400" />
                    <CategoryCard icon={Users} label="Characters" count={g?.totalCharacters ?? 0} colorClass="text-blue-400" />
                    <CategoryCard icon={FileText} label="Lore Docs" count={g?.totalLoreDocs ?? 0} colorClass="text-amber-400" />
                    <CategoryCard icon={Gamepad2} label="Game Assets" count={g?.totalGameAssets ?? 0} colorClass="text-green-400" />
                    <CategoryCard icon={Share2} label="Social Media" count={g?.totalSocialAssets ?? 0} colorClass="text-pink-400" />
                  </div>
                </div>

                {/* Total on Autonomys */}
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">Total Assets on Autonomys</h3>
                      <p className="mt-0.5 text-sm text-slate-400">
                        All encrypted content stored on Autonomys Auto-Drive
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-bold text-indigo-400">{g?.totalAllAssets ?? 0}</p>
                      <p className="text-xs text-slate-500">files uploaded</p>
                    </div>
                  </div>
                </div>

                {statsError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
                    ⚠️ {statsError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Qriptopian tab */}
        {activeTab === "qriptopian" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/10">
              <Sparkles className="h-10 w-10 text-purple-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Qriptopian Codex Coming Soon</h3>
            <p className="max-w-md text-sm text-slate-400">
              The Qriptopian Codex will feature exclusive content, character profiles, interactive
              experiences, and collectibles from the Quantum-Ready Internet universe.
            </p>
          </div>
        )}
      </div>

      <CodexUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => { void fetchStats(); }}
      />
    </div>
  );
}
