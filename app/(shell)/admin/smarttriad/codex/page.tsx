'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Gamepad2,
  Image,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import { CodexUploadModal } from '../../codex/components/CodexUploadModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EpisodeStatus {
  episodeNumber: number;
  hasStillMaster: boolean;
  hasMotionMaster: boolean;
  hasPrintRare: boolean;
  coverCount: number;
  characterCount: number;
  totalAssets: number;
}

interface GlobalStats {
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
}

interface StatusData {
  episodes: EpisodeStatus[];
  globalStats: GlobalStats;
}

type CodexTab = 'knyt' | 'qriptopian';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, badge }: { label: string; value: number; badge?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#141927] p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-4xl font-bold text-white">{value}</p>
        {badge && (
          <span className="mb-1 rounded bg-[#1e2a3a] px-2 py-0.5 text-xs text-gray-300">{badge}</span>
        )}
      </div>
    </div>
  );
}

// ── Asset category card ───────────────────────────────────────────────────────

function AssetCard({
  icon: Icon,
  label,
  count,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  iconColor: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-[#141927] p-5">
      <Icon className={`h-8 w-8 ${iconColor}`} />
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-white">{count}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SmartTriadCodexPage() {
  const [activeTab,    setActiveTab]    = useState<CodexTab>('knyt');
  const [status,       setStatus]       = useState<StatusData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [uploadOpen,   setUploadOpen]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = activeTab === 'knyt' ? 'metaKnyts' : 'qriptopian';
      const res    = await fetch(`/api/admin/codex/status?series=${series}`);
      const json   = await res.json() as { episodes?: EpisodeStatus[]; globalStats?: GlobalStats; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setStatus({ episodes: json.episodes ?? [], globalStats: json.globalStats! });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { void load(); }, [load]);

  const g = status?.globalStats;
  const episodes = status?.episodes ?? [];

  const totalEpisodes      = episodes.length;
  const withPrint          = episodes.filter((e) => e.hasPrintRare).length;
  const printFiles         = g ? (g.totalPrintRare + g.totalPrintEpic + g.totalPrintLegendary) : 0;
  const withMotion         = episodes.filter((e) => e.hasMotionMaster).length;
  const withCovers         = episodes.filter((e) => e.coverCount > 0).length;
  const totalCoverVariants = g?.totalCovers ?? 0;
  const totalAllAssets     = g?.totalAllAssets ?? 0;

  const episodeMasters = (g?.totalStillMasters ?? 0) + (g?.totalMotionMasters ?? 0);

  return (
    <div className="min-h-screen bg-[#0a0d14] px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="rounded-lg p-1.5 text-gray-400 hover:bg-[#1e2a3a] hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">SmartTriad Codex Manager</h1>
          <p className="text-sm text-gray-400">Manage episodes, covers, Autonomys uploads &amp; more</p>
        </div>
      </div>

      {/* Inner card */}
      <div className="rounded-2xl border border-white/5 bg-[#141927] p-6">
        {/* Inner header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d1520]">
              <Sparkles className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Codex Manager</h2>
              <p className="text-xs text-gray-400">Manage Digital Scrolls &amp; Collectibles — KNYT and Qriptopian</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
            >
              <FileText className="h-4 w-4" />
              Import Metadata
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-500"
            >
              <Upload className="h-4 w-4" />
              Upload Content
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex border-b border-white/5">
          {(['knyt', 'qriptopian'] as CodexTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-teal-400 text-teal-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              {tab === 'knyt' ? 'KNYT Codex' : 'Qriptopian Codex'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-5 text-sm text-red-400">{error}</div>
        ) : (
          <>
            {/* Top stats row */}
            <div className="mb-6 grid grid-cols-4 gap-4">
              <StatCard label="Total Episodes"      value={totalEpisodes} />
              <StatCard label="With Print Editions" value={withPrint}     badge={`${printFiles} files`} />
              <StatCard label="With Motion Comics"  value={withMotion}    badge={`${g?.totalMotionMasters ?? 0} files`} />
              <StatCard label="With Covers"         value={withCovers}    badge={`${totalCoverVariants} variants`} />
            </div>

            {/* Asset categories */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-300">Asset Categories</h3>
              <div className="grid grid-cols-6 gap-3">
                <AssetCard icon={Video}    label="Episode Masters" count={episodeMasters}        iconColor="text-teal-400" />
                <AssetCard icon={Image}    label="Covers"          count={totalCoverVariants}    iconColor="text-purple-400" />
                <AssetCard icon={Users}    label="Characters"      count={g?.totalCharacters ?? 0} iconColor="text-blue-400" />
                <AssetCard icon={FileText} label="Lore Docs"       count={g?.totalLoreDocs ?? 0}   iconColor="text-amber-400" />
                <AssetCard icon={Gamepad2} label="Game Assets"     count={g?.totalGameAssets ?? 0} iconColor="text-green-400" />
                <AssetCard icon={Share2}   label="Social Media"    count={g?.totalSocialAssets ?? 0} iconColor="text-pink-400" />
              </div>
            </div>

            {/* Total on Autonomys */}
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0d1520] p-5">
              <div>
                <p className="font-semibold text-white">Total Assets on Autonomys</p>
                <p className="text-sm text-gray-400">All encrypted content stored on Autonomys Auto-Drive</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-teal-400">{totalAllAssets}</p>
                <p className="text-xs text-gray-400">files uploaded</p>
              </div>
            </div>
          </>
        )}
      </div>

      <CodexUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={() => { setUploadOpen(false); void load(); }}
      />
    </div>
  );
}
