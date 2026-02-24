'use client';

import { useRef, useState } from 'react';
import { useCodexList } from '@/app/hooks/useCodexConfig';
import {
  Plus,
  BookOpen,
  Settings,
  Eye,
  EyeOff,
  Edit,
  RefreshCw,
  FileJson,
  Loader2,
  Upload,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { CodexUploadModal } from './components/CodexUploadModal';

type CodexStats = {
  summary?: { totalEpisodes?: number; episodesWithMotion?: number; episodesWithCovers?: number };
  globalStats?: { totalAllAssets?: number; totalCharacters?: number; totalLoreDocs?: number };
};

function getAccessTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.includes('auth-token')) continue;
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

export default function CodexManagementPage() {
  const { data: codexes, isLoading, error, refetch } = useCodexList();
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [statusData, setStatusData] = useState<CodexStats | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const filteredCodexes = codexes?.filter((codex: any) => {
    if (filter === 'enabled') return codex.enabled;
    if (filter === 'disabled') return !codex.enabled;
    return true;
  });

  const fetchStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const token = getAccessTokenFromStorage();
      const response = await fetch('/api/admin/codex/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to load status');
      setStatusData(data);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Failed to load status');
    } finally {
      setStatusLoading(false);
    }
  };

  const onImportFileSelected = async (file: File | null) => {
    if (!file) return;
    setImportLoading(true);
    setImportMessage(null);
    setImportError(null);
    try {
      const token = getAccessTokenFromStorage();
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/admin/codex/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Import failed');
      setImportMessage(`Import complete: ${data.message || 'metadata processed'}`);
      await fetchStatus();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportLoading(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-purple-400" />
              Codex Management
            </h1>
            <p className="text-slate-400 mt-2">
              Manage multi-codex system configurations, tabs, and permissions
            </p>
          </div>
          <Link
            href="/admin/codex/new"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Codex
          </Link>
        </div>

        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Codex Content Operations</h2>
              <p className="text-xs text-slate-400">Upload assets, import metadata, and review ingestion status.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
              >
                <Upload className="h-4 w-4" />
                Upload Content
              </button>

              <button
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                disabled={importLoading}
              >
                {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                Import Metadata
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => onImportFileSelected(event.target.files?.[0] ?? null)}
              />

              <button
                onClick={fetchStatus}
                className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                disabled={statusLoading}
              >
                <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
                Refresh Status
              </button>
            </div>
          </div>

          {importMessage && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              <span>{importMessage}</span>
            </div>
          )}

          {importError && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="h-4 w-4" />
              <span>{importError}</span>
            </div>
          )}

          {statusError && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="h-4 w-4" />
              <span>{statusError}</span>
            </div>
          )}

          {statusData && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
                <p className="text-xs text-slate-400">Episodes</p>
                <p className="text-xl font-semibold text-white">{statusData.summary?.totalEpisodes ?? 0}</p>
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
                <p className="text-xs text-slate-400">With Motion</p>
                <p className="text-xl font-semibold text-white">{statusData.summary?.episodesWithMotion ?? 0}</p>
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
                <p className="text-xs text-slate-400">With Covers</p>
                <p className="text-xl font-semibold text-white">{statusData.summary?.episodesWithCovers ?? 0}</p>
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
                <p className="text-xs text-slate-400">Characters</p>
                <p className="text-xl font-semibold text-white">{statusData.globalStats?.totalCharacters ?? 0}</p>
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-900/70 p-3">
                <p className="text-xs text-slate-400">All Assets</p>
                <p className="text-xl font-semibold text-white">{statusData.globalStats?.totalAllAssets ?? 0}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'enabled', 'disabled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span className="ml-3 text-slate-400">Loading codexes...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error loading codexes: {error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Codex List */}
        {filteredCodexes && filteredCodexes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCodexes.map((codex: any) => (
              <div
                key={codex.id}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">{codex.name}</h3>
                      {codex.enabled ? (
                        <Eye className="w-4 h-4 text-green-400" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{codex.slug}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    codex.enabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {codex.enabled ? 'Active' : 'Disabled'}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                  {codex.metadata.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Settings className="w-4 h-4" />
                    <span>{codex.tabCount} tabs</span>
                  </div>
                  {codex.metadata.category && (
                    <div className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-300">
                      {codex.metadata.category}
                    </div>
                  )}
                </div>

                {/* Tags */}
                {codex.metadata.tags && codex.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {codex.metadata.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {codex.metadata.tags.length > 3 && (
                      <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                        +{codex.metadata.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
                  <Link
                    href={`/admin/codex/${codex.id}`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Link>
                  <Link
                    href={`/triad/embed/codex/${codex.slug}`}
                    target="_blank"
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredCodexes && filteredCodexes.length === 0 && !isLoading && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {filter === 'all' ? 'No codexes found' : `No ${filter} codexes`}
            </h3>
            <p className="text-slate-400 mb-6">
              {filter === 'all'
                ? 'Get started by creating your first codex'
                : `There are no ${filter} codexes at the moment`}
            </p>
            {filter === 'all' && (
              <Link
                href="/admin/codex/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Your First Codex
              </Link>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {codexes && codexes.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-white mb-1">{codexes.length}</div>
              <div className="text-sm text-slate-400">Total Codexes</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {codexes.filter((c: any) => c.enabled).length}
              </div>
              <div className="text-sm text-slate-400">Active Codexes</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {codexes.reduce((sum: number, c: any) => sum + c.tabCount, 0)}
              </div>
              <div className="text-sm text-slate-400">Total Tabs</div>
            </div>
          </div>
        )}

        <CodexUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUploadComplete={() => {
            void fetchStatus();
          }}
        />
      </div>
    </div>
  );
}
